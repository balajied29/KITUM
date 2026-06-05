import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AppState, Alert } from 'react-native';

import { useAuth } from '../lib/store';
import { connectSocket, getSocket, disconnectSocket } from '../lib/socket';
import { EVENTS, REQUEST_STATUS } from '../lib/constants';
import { getActiveJob, getHistory, registerPushToken, logout as apiLogout, getMe, postNoShow } from '../lib/api';
import { registerForPush } from '../lib/notifications';
import {
  requestPermissions,
  startForegroundTracking,
  stopForegroundTracking,
  startBackgroundTracking,
  stopBackgroundTracking,
} from '../lib/location';
import { startAlarm, stopAlarm } from '../lib/alarm';
import { enqueueJobStatus, flushJobStatus, hasPendingJobStatus } from '../lib/jobSync';

// Eligibility helpers — mirror the backend's canGoOnline gate.
const isApproved = (u) => (u?.fulfillerProfile?.applicationStatus || 'approved') === 'approved';
const isKycVerified = (u) => u?.fulfillerProfile?.kyc?.status === 'verified';
const eligibleOnline = (u) => isApproved(u) && isKycVerified(u);
const hasBankDetails = (u) => {
  const b = u?.fulfillerProfile?.bank || {};
  return !!((b.accountHolder && b.accountNumber && b.ifsc) || b.upiId);
};

const SessionContext = createContext(null);

/** All driver session state + the realtime/dispatch engine, lifted out of the UI
 * so screens just read what they need via useDriverSession(). The live-delivery
 * logic (socket, location, alarm, offline journal, payment gate) is unchanged. */
export function DriverSessionProvider({ children }) {
  const { accessToken, user, logout } = useAuth();
  const [booting, setBooting] = useState(true);
  const [online, setOnline] = useState(false);
  const [offer, setOffer] = useState(null);
  const [job, setJob] = useState(null);
  const [status, setStatus] = useState(null);
  const [earnings, setEarnings] = useState(0);
  const [pendingSync, setPendingSync] = useState(false);
  const [paid, setPaid] = useState(false); // current job's payment received? (UPI gate)

  // Refs to read latest state inside long-lived socket listeners.
  const offerRef = useRef(null);
  const jobRef = useRef(null);
  const statusRef = useRef(null);
  const onlineRef = useRef(false);
  const paidRef = useRef(false);
  const advancingRef = useRef(new Set()); // synchronous re-entry guard for advance()
  offerRef.current = offer;
  jobRef.current = job;
  statusRef.current = status;
  onlineRef.current = online;
  paidRef.current = paid;

  const requestIdOf = (j) => j?.requestId || j?._id;

  const refreshPending = async () => setPendingSync(await hasPendingJobStatus());
  const flushNow = () => flushJobStatus().then(refreshPending).catch(() => {});

  const endJobLocal = (msg) => {
    if (!jobRef.current) return; // already ended this tick — guards duplicate end events
    jobRef.current = null; // synchronous guard so a second event in the same tick no-ops
    setJob(null);
    setStatus(null);
    setPaid(false);
    stopBackgroundTracking();
    if (onlineRef.current) startForegroundTracking('IDLE');
    else stopForegroundTracking();
    if (msg) Alert.alert('Delivery', msg);
  };

  // ---- Boot + realtime wiring (runs when authenticated) ----
  useEffect(() => {
    if (!accessToken) {
      setBooting(false);
      return;
    }
    let cancelled = false;
    const socket = connectSocket();

    (async () => {
      try {
        const me = await getMe();
        if (!cancelled && me.data?.data) useAuth.setState({ user: me.data.data });
      } catch {}

      try {
        const pushToken = await registerForPush();
        if (pushToken) registerPushToken(pushToken).catch(() => {});
      } catch {}

      try {
        const res = await getActiveJob();
        if (!cancelled && res.data.data) {
          const j = res.data.data;
          setJob(j);
          setPaid(j.paymentStatus === 'paid');
          setStatus(j.status);
          setOnline(true);
          startForegroundTracking('ACTIVE');
          startBackgroundTracking();
        }
      } catch {}

      try {
        const h = await getHistory();
        if (!cancelled) setEarnings(h.data.data?.earnings || 0);
      } catch {}

      if (!cancelled) setBooting(false);
      flushNow();
    })();

    const onOffer = (p) => {
      setOffer(p);
      startAlarm();
    };
    const onClosed = (p) => {
      if (offerRef.current?.requestId === p.requestId) {
        stopAlarm();
        setOffer(null);
      }
    };
    const onJobAssigned = (p) => {
      stopAlarm();
      setOffer(null);
      setJob(p);
      setStatus(REQUEST_STATUS.DRIVER_ASSIGNED);
      setPaid(p.paymentStatus === 'paid');
      startForegroundTracking('ACTIVE');
      startBackgroundTracking();
    };
    const onPaymentReceived = (p) => {
      if (requestIdOf(jobRef.current) === p.requestId) setPaid(true);
    };
    const onJobCancelled = (p) => {
      if (requestIdOf(jobRef.current) === p.requestId) endJobLocal('The customer cancelled this request.');
    };
    const onRequestStatus = (p) => {
      if (!p?.requestId || requestIdOf(jobRef.current) !== p.requestId) return;
      const s = p.status;
      if (!s || s === statusRef.current) return;
      if (s === REQUEST_STATUS.DRIVER_ASSIGNED || s === REQUEST_STATUS.EN_ROUTE || s === REQUEST_STATUS.ARRIVED) {
        setStatus(s);
      }
    };
    const onConnect = async () => {
      if (onlineRef.current) {
        socket.emit(EVENTS.PRESENCE_SET, { online: true });
        socket.emit(EVENTS.AVAILABILITY_SET, { available: !jobRef.current });
      }
      flushNow();
      if (jobRef.current) {
        try {
          const res = await getActiveJob();
          if (!res.data.data) endJobLocal('This job was reassigned while you were offline.');
        } catch {}
      }
    };
    const onError = (p) => {
      if (p?.code === 'not_eligible') {
        setOnline(false);
        stopForegroundTracking();
        Alert.alert('Not online yet', p.message || 'Finish verification before going online.');
        getMe().then((r) => r.data?.data && useAuth.setState({ user: r.data.data })).catch(() => {});
      }
    };

    socket.on('connect', onConnect);
    socket.on(EVENTS.OFFER_NEW, onOffer);
    socket.on(EVENTS.OFFER_CLOSED, onClosed);
    socket.on(EVENTS.JOB_ASSIGNED, onJobAssigned);
    socket.on(EVENTS.JOB_CANCELLED, onJobCancelled);
    socket.on(EVENTS.REQUEST_STATUS, onRequestStatus);
    socket.on(EVENTS.PAYMENT_RECEIVED, onPaymentReceived);
    socket.on(EVENTS.ERROR, onError);

    return () => {
      cancelled = true;
      socket.off('connect', onConnect);
      socket.off(EVENTS.OFFER_NEW, onOffer);
      socket.off(EVENTS.OFFER_CLOSED, onClosed);
      socket.off(EVENTS.JOB_ASSIGNED, onJobAssigned);
      socket.off(EVENTS.JOB_CANCELLED, onJobCancelled);
      socket.off(EVENTS.REQUEST_STATUS, onRequestStatus);
      socket.off(EVENTS.PAYMENT_RECEIVED, onPaymentReceived);
      socket.off(EVENTS.ERROR, onError);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  // ---- Keep tracking alive across foreground/background while on a job ----
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        getSocket()?.connect?.();
        getMe().then((r) => r.data?.data && useAuth.setState({ user: r.data.data })).catch(() => {});
        flushNow();
        if (jobRef.current) startForegroundTracking('ACTIVE');
        else if (onlineRef.current) startForegroundTracking('IDLE');
      }
    });
    return () => sub.remove();
  }, []);

  const toggleOnline = async (val) => {
    if (val && !eligibleOnline(user)) {
      if (!isApproved(user)) {
        Alert.alert('Awaiting approval', 'You can go online once your application is approved.');
      } else {
        Alert.alert('Verification required', 'Upload and get your PAN and driver’s licence verified before going online.');
      }
      return;
    }
    if (val) {
      const granted = await requestPermissions();
      if (!granted) {
        Alert.alert('Location required', 'Enable location access to receive delivery requests.');
        return;
      }
      setOnline(true);
      getSocket()?.emit(EVENTS.PRESENCE_SET, { online: true });
      startForegroundTracking('IDLE');
    } else {
      setOnline(false);
      getSocket()?.emit(EVENTS.PRESENCE_SET, { online: false });
      stopForegroundTracking();
    }
  };

  const acceptOffer = () => {
    stopAlarm();
    getSocket()?.emit(EVENTS.OFFER_ACCEPT, { requestId: offerRef.current?.requestId });
    setOffer(null);
  };

  const rejectOffer = () => {
    stopAlarm();
    getSocket()?.emit(EVENTS.OFFER_REJECT, { requestId: offerRef.current?.requestId });
    setOffer(null);
  };

  const advance = async (to) => {
    const requestId = requestIdOf(jobRef.current);
    if (!requestId) return;
    const key = `${requestId}:${to}`;
    if (advancingRef.current.has(key)) return;
    advancingRef.current.add(key);
    try {
      if (to === REQUEST_STATUS.COMPLETED && jobRef.current?.paymentMode === 'upi' && !paidRef.current) {
        Alert.alert('Collect payment first', 'Ask the customer to pay by UPI in their app before completing this delivery.');
        return;
      }
      setStatus(to);
      await enqueueJobStatus(requestId, to);
      if (to === REQUEST_STATUS.COMPLETED) {
        const amt = job?.amount ?? job?.pricing?.amount ?? 0;
        setEarnings((e) => e + amt);
        endJobLocal('Delivery completed. Payment collected.');
      }
      flushNow();
    } finally {
      advancingRef.current.delete(key);
    }
  };

  const abandonJob = () => {
    const requestId = requestIdOf(jobRef.current);
    if (requestId) getSocket()?.emit(EVENTS.JOB_ABANDON, { requestId });
    endJobLocal('Job released — we’ll find the customer another tanker.');
  };

  const reportNoShow = async (reason, callAttempted) => {
    const requestId = requestIdOf(jobRef.current);
    if (!requestId) return { ok: false, error: 'No active job.' };
    try {
      const res = await postNoShow({ requestId, reason, callAttempted });
      const fee = res.data?.data?.dryRunFee || 0;
      if (fee) setEarnings((e) => e + fee);
      endJobLocal(`No-show recorded. A ₹${fee} dry-run fee has been added to your earnings.`);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e?.response?.data?.error || 'Could not report a no-show. Please try again.' };
    }
  };

  const handleLogout = () => {
    stopForegroundTracking();
    stopBackgroundTracking();
    getSocket()?.emit(EVENTS.PRESENCE_SET, { online: false });
    apiLogout(useAuth.getState().refreshToken).catch(() => {});
    disconnectSocket();
    stopAlarm();
    setOnline(false);
    setJob(null);
    setOffer(null);
    logout();
  };

  const value = {
    // session
    accessToken,
    user,
    booting,
    // live state
    online,
    offer,
    job,
    status,
    paid,
    earnings,
    pendingSync,
    // derived eligibility
    pending: user?.fulfillerProfile?.applicationStatus === 'pending',
    eligible: eligibleOnline(user),
    kycStatus: user?.fulfillerProfile?.kyc?.status || 'not_submitted',
    bankComplete: hasBankDetails(user),
    // actions
    toggleOnline,
    acceptOffer,
    rejectOffer,
    advance,
    abandonJob,
    reportNoShow,
    handleLogout,
  };

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useDriverSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useDriverSession must be used within DriverSessionProvider');
  return ctx;
}
