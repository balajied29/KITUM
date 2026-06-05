const router = require('express').Router();
const {
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
} = require('../controllers/fulfiller.controller');
const { protect, restrictTo } = require('../middleware/auth.middleware');
const { upload, handleUploadErrors } = require('../middleware/upload');

router.use(protect, restrictTo('fulfiller'));
router.get('/active', getActiveJob);
router.get('/history', getJobHistory);
router.post('/push-token', registerPushToken);
router.patch('/profile', updateProfile);
router.post('/location', updateLocation);
router.post('/job-status', postJobStatus); // offline mirror of the JOB_STATUS socket event
router.post('/no-show', reportNoShow); // driver reports the customer unreachable at the drop

// KYC documents (PAN + driver's licence front/back)
const kycUpload = upload.fields([
  { name: 'panImage', maxCount: 1 },
  { name: 'dlFrontImage', maxCount: 1 },
  { name: 'dlBackImage', maxCount: 1 },
]);
router.get('/kyc', getKyc);
router.post('/kyc', handleUploadErrors(kycUpload), uploadKyc);

// Settlement bank details
router.get('/bank', getBank);
router.put('/bank', saveBank);

module.exports = router;
