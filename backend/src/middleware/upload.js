/**
 * In-memory multipart upload for KYC document images. Files are held as buffers
 * (never written to disk) and handed straight to the storage service. Capped at
 * 6 MB/file and restricted to images so a partner can't push arbitrary blobs.
 */
const multer = require('multer');

const MAX_BYTES = 6 * 1024 * 1024; // 6 MB — comfortably fits a phone photo
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 3 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED.has(file.mimetype)) return cb(null, true);
    cb(new Error('Only image files (JPEG, PNG, WebP, HEIC) are accepted.'));
  },
});

// Surface multer/file errors as clean 400s instead of a 500 stack.
const handleUploadErrors = (handler) => (req, res, next) =>
  handler(req, res, (err) => {
    if (err) {
      const msg =
        err.code === 'LIMIT_FILE_SIZE'
          ? 'Each image must be under 6 MB.'
          : err.message || 'Upload failed.';
      return res.status(400).json({ success: false, error: msg });
    }
    next();
  });

module.exports = { upload, handleUploadErrors };
