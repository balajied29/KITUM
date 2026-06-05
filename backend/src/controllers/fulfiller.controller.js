const DeliveryRequest = require('../models/DeliveryRequest.model');
const User = require('../models/User.model');
const registry = require('../realtime/registry');
const emit = require('../realtime/emit');
const storage = require('../services/storage');
const dispatch = require('../services/dispatch/DispatchManager');
const { REQUEST_STATUS, EVENTS } = require('../shared/constants');

const PERSIST_THROTTLE_MS = 20000;

const ACTIVE_STATUSES = [
  REQUEST_STATUS.DRIVER_ASSIGNED,
  REQUEST_STATUS.EN_ROUTE,
  REQUEST_STATUS.ARRIVED,
];

/** The job this fulfiller is currently serving (if any). */
const getActiveJob = async (req, res) => {
  try {
    const job = await DeliveryRequest.findOne({
      fulfillerId: req.user._id,
      status: { $in: ACTIVE_STATUSES },
    })
      .populate('productId', 'name unit')
      .populate('customerId', 'name phone')
      .sort({ updatedAt: -1 });
    res.json({ success: true, data: job });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch active job' });
  }
};

/** Completed/cancelled job history + a quick earnings tally. */
const getJobHistory = async (req, res) => {
  try {
    const jobs = await DeliveryRequest.find({
      fulfillerId: req.user._id,
      status: { $in: [REQUEST_STATUS.COMPLETED, REQUEST_STATUS.CANCELLED, REQUEST_STATUS.CUSTOMER_NO_SHOW] },
    })
      .populate('productId', 'name unit')
      .sort({ createdAt: -1 })
      .limit(50);

    // Completed jobs pay the partner payout (net of KitUm's 5% commission);
    // a verified customer-no-show pays the dry-run fee for the wasted trip.
    const earnings = jobs.reduce((sum, j) => {
      if (j.status === REQUEST_STATUS.COMPLETED) {
        return sum + (j.pricing?.partnerPayout ?? j.pricing?.fare ?? j.pricing?.amount ?? 0);
      }
      if (j.status === REQUEST_STATUS.CUSTOMER_NO_SHOW) {
        return sum + (j.pricing?.dryRunFee ?? 0);
      }
      return sum;
    }, 0);

    res.json({ success: true, data: { jobs, earnings } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch history' });
  }
};

/** Register / refresh the Expo push token so offers can wake the app. */
const registerPushToken = async (req, res) => {
  try {
    const { expoPushToken } = req.body;
    await User.updateOne(
      { _id: req.user._id },
      { $set: { 'fulfillerProfile.expoPushToken': expoPushToken } }
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to register push token' });
  }
};

/**
 * Vehicle number and tanker capacity are LOCKED after registration — they drive
 * dispatch matching, so a partner can't silently change them. Changes go through
 * a support request that an admin reviews and applies (admin updateFulfiller).
 */
const updateProfile = async (req, res) => {
  res.status(403).json({
    success: false,
    error: 'Vehicle and tanker details are locked after registration. Please request a change from Help & support.',
  });
};

/**
 * REST fallback for location updates (used by the background-location task when
 * the socket isn't connected). Mirrors the socket LOCATION_UPDATE handler:
 * relay to the active request room + throttled Mongo persist.
 */
const updateLocation = async (req, res) => {
  try {
    const { lat, lng, heading } = req.body;
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return res.status(400).json({ success: false, error: 'lat/lng required' });
    }
    const fid = String(req.user._id);
    registry.setLocation(fid, { lat, lng, heading });

    const activeReq = registry.getActiveRequest(fid);
    if (activeReq) emit.toRequest(activeReq, EVENTS.REQUEST_LOCATION, { lat, lng, heading });

    const onJob = !!activeReq;
    const now = Date.now();
    if (!onJob || now - registry.getLastPersist(fid) > PERSIST_THROTTLE_MS) {
      registry.setLastPersist(fid, now);
      await User.updateOne(
        { _id: fid },
        {
          $set: {
            'fulfillerProfile.currentLocation': { type: 'Point', coordinates: [lng, lat] },
            'fulfillerProfile.lastLocationAt': new Date(),
          },
        }
      );
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update location' });
  }
};

/**
 * REST mirror of the JOB_STATUS socket event — the offline fallback for the
 * partner app's job-status journal. When the socket can't deliver (or doesn't
 * ack) a transition, the app POSTs here so a completion can never silently
 * vanish in low-signal terrain. Shares the exact same atomic, idempotent
 * handleJobStatus path as the socket, so replays are safe.
 */
const postJobStatus = async (req, res) => {
  try {
    const { requestId, status } = req.body;
    if (!requestId || !status) {
      return res.status(400).json({ success: false, error: 'requestId and status are required' });
    }
    const result = await dispatch.handleJobStatus(req.user._id, requestId, status);
    // Request gone / not ours and not already at target → tell the client to stop retrying.
    if (!result.ok && result.status === null) {
      return res.status(404).json({ success: false, error: 'Job not found', data: result });
    }
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update job status' });
  }
};

/**
 * Driver reports the customer unreachable at the drop. Gated + monetised in the
 * DispatchManager (arrived + wait + proximity → terminal customer_no_show, partial
 * refund for prepaid, dry-run fee to the driver). REST (not socket) so the app gets
 * the precise gate result to show the driver.
 */
const reportNoShow = async (req, res) => {
  try {
    const { requestId, reason, callAttempted } = req.body;
    if (!requestId) return res.status(400).json({ success: false, error: 'requestId is required' });
    const result = await dispatch.handleCustomerNoShow(req.user._id, requestId, { reason, callAttempted });
    if (!result.ok) return res.status(400).json({ success: false, error: result.error || 'Could not report no-show.' });
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Could not report no-show. Please try again.' });
  }
};

/* ----------------------------- KYC documents ----------------------------- */

const MIME_EXT = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
};

// multipart field name → stored key field → object-key doc segment
const KYC_DOCS = [
  { field: 'panImage', key: 'panKey', name: 'pan' },
  { field: 'dlFrontImage', key: 'dlFrontKey', name: 'dl-front' },
  { field: 'dlBackImage', key: 'dlBackKey', name: 'dl-back' },
];

/** Safe, partner-facing projection of KYC state (booleans, never object keys). */
function kycView(k = {}) {
  return {
    status: k.status || 'not_submitted',
    panNumber: k.panNumber || '',
    dlNumber: k.dlNumber || '',
    hasPan: !!k.panKey,
    hasDlFront: !!k.dlFrontKey,
    hasDlBack: !!k.dlBackKey,
    submittedAt: k.submittedAt || null,
    reviewedAt: k.reviewedAt || null,
    rejectionReason: k.rejectionReason || '',
  };
}

/** Current KYC status for the signed-in partner. */
const getKyc = async (req, res) => {
  res.json({ success: true, data: kycView(req.user.fulfillerProfile?.kyc) });
};

/**
 * Upload one or more KYC images (PAN, DL front, DL back) + optional numbers.
 * Any subset is accepted so a partner can submit progressively. Once all three
 * images are present the record flips to 'pending' (admin re-review). Replacing
 * a doc while 'verified' reverts to 'pending' and pulls the partner offline.
 */
const uploadKyc = async (req, res) => {
  try {
    if (!storage.isConfigured()) {
      return res
        .status(503)
        .json({ success: false, error: 'Document upload is temporarily unavailable. Please try again shortly.' });
    }
    const files = req.files || {};
    const existing = req.user.fulfillerProfile?.kyc || {};
    const set = {};
    const ts = Date.now();

    await Promise.all(
      KYC_DOCS.map(async ({ field, key, name }) => {
        const f = files[field]?.[0];
        if (!f) return;
        const ext = MIME_EXT[f.mimetype] || 'jpg';
        const objectKey = storage.kycKey(req.user._id, name, ext, ts);
        await storage.putObject(objectKey, f.buffer, f.mimetype);
        if (existing[key]) storage.deleteObject(existing[key]); // best-effort cleanup of the old image
        set[`fulfillerProfile.kyc.${key}`] = objectKey;
      })
    );

    if (req.body.panNumber !== undefined)
      set['fulfillerProfile.kyc.panNumber'] = String(req.body.panNumber).trim().toUpperCase();
    if (req.body.dlNumber !== undefined)
      set['fulfillerProfile.kyc.dlNumber'] = String(req.body.dlNumber).trim().toUpperCase();

    const merged = {
      panKey: set['fulfillerProfile.kyc.panKey'] || existing.panKey,
      dlFrontKey: set['fulfillerProfile.kyc.dlFrontKey'] || existing.dlFrontKey,
      dlBackKey: set['fulfillerProfile.kyc.dlBackKey'] || existing.dlBackKey,
    };
    const complete = !!(merged.panKey && merged.dlFrontKey && merged.dlBackKey);

    if (complete) {
      set['fulfillerProfile.kyc.status'] = 'pending';
      set['fulfillerProfile.kyc.submittedAt'] = new Date();
      set['fulfillerProfile.kyc.rejectionReason'] = null;
      // Changing documents invalidates a prior approval — re-verify before they work again.
      if (existing.status === 'verified') set['fulfillerProfile.isOnline'] = false;
    } else {
      set['fulfillerProfile.kyc.status'] = 'not_submitted';
    }

    const user = await User.findByIdAndUpdate(req.user._id, { $set: set }, { new: true }).select('-password');
    res.json({ success: true, data: { kyc: kycView(user.fulfillerProfile?.kyc), user } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Could not upload your documents. Please try again.' });
  }
};

/* ------------------------- Bank / settlement details ------------------------ */

function bankView(b = {}) {
  return {
    accountHolder: b.accountHolder || '',
    accountNumber: b.accountNumber || '',
    ifsc: b.ifsc || '',
    bankName: b.bankName || '',
    upiId: b.upiId || '',
    updatedAt: b.updatedAt || null,
  };
}

const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;

/** Settlement details for the signed-in partner. */
const getBank = async (req, res) => {
  res.json({ success: true, data: bankView(req.user.fulfillerProfile?.bank) });
};

/** Save settlement details. Accepts a full bank account OR a UPI ID. */
const saveBank = async (req, res) => {
  try {
    const { accountHolder, accountNumber, ifsc, bankName, upiId } = req.body;
    const acct = String(accountNumber || '').replace(/\s+/g, '');
    const code = String(ifsc || '').trim().toUpperCase();
    const vpa = String(upiId || '').trim();
    const holder = String(accountHolder || '').trim();

    const hasBank = holder && acct && code;
    if (!hasBank && !vpa) {
      return res.status(400).json({
        success: false,
        error: 'Enter your account holder name, account number and IFSC — or a UPI ID.',
      });
    }
    if (hasBank) {
      if (!/^\d{6,18}$/.test(acct))
        return res.status(400).json({ success: false, error: 'Enter a valid bank account number.' });
      if (!IFSC_RE.test(code))
        return res.status(400).json({ success: false, error: 'Enter a valid IFSC code (e.g. SBIN0001234).' });
    }

    const set = {
      'fulfillerProfile.bank.accountHolder': holder,
      'fulfillerProfile.bank.accountNumber': acct,
      'fulfillerProfile.bank.ifsc': code,
      'fulfillerProfile.bank.bankName': String(bankName || '').trim(),
      'fulfillerProfile.bank.upiId': vpa,
      'fulfillerProfile.bank.updatedAt': new Date(),
    };
    const user = await User.findByIdAndUpdate(req.user._id, { $set: set }, { new: true }).select('-password');
    res.json({ success: true, data: { bank: bankView(user.fulfillerProfile?.bank), user } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Could not save your bank details.' });
  }
};

module.exports = {
  getActiveJob,
  getJobHistory,
  registerPushToken,
  updateProfile,
  updateLocation,
  postJobStatus,
  reportNoShow,
  getKyc,
  uploadKyc,
  getBank,
  saveBank,
};
