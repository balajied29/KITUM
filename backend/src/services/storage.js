/**
 * Private object storage for sensitive KYC documents (PAN, driver's licence).
 *
 * S3-compatible — works with both AWS S3 and Cloudflare R2. Images are stored in
 * a PRIVATE bucket (no public ACL); the only way to view them is a short-lived
 * presigned GET URL minted for an authenticated admin. The partner app uploads
 * via the backend (multer → buffer → putObject), so bucket credentials never
 * leave the server.
 *
 * Env (R2 example):
 *   S3_ENDPOINT=https://<accountid>.r2.cloudflarestorage.com   # omit for AWS S3
 *   S3_REGION=auto                                             # 'auto' for R2
 *   S3_BUCKET=kitum-kyc
 *   S3_ACCESS_KEY_ID=...
 *   S3_SECRET_ACCESS_KEY=...
 */
const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const BUCKET = process.env.S3_BUCKET;
const ENDPOINT = process.env.S3_ENDPOINT || undefined;
const REGION = process.env.S3_REGION || (ENDPOINT ? 'auto' : 'us-east-1');

const isConfigured = () =>
  !!(BUCKET && process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY);

let _client = null;
const client = () => {
  if (!isConfigured()) {
    throw new Error(
      'Document storage is not configured. Set S3_BUCKET, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY (plus S3_ENDPOINT for R2).'
    );
  }
  if (!_client) {
    _client = new S3Client({
      region: REGION,
      endpoint: ENDPOINT,
      forcePathStyle: !!ENDPOINT, // required for R2 / most S3-compatibles
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
      },
    });
  }
  return _client;
};

/** Upload a buffer to a private object. Returns the stored key. */
async function putObject(key, buffer, contentType) {
  await client().send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType || 'application/octet-stream',
    })
  );
  return key;
}

/** Short-lived presigned GET URL for an admin to view a private object. */
async function signedGetUrl(key, expiresInSeconds = 300) {
  if (!key) return null;
  return getSignedUrl(client(), new GetObjectCommand({ Bucket: BUCKET, Key: key }), {
    expiresIn: expiresInSeconds,
  });
}

/** Best-effort delete (e.g. when a doc is replaced). Never throws. */
async function deleteObject(key) {
  if (!key) return;
  try {
    await client().send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
  } catch {
    /* ignore — stale objects are harmless and lifecycle rules can sweep them */
  }
}

/** Deterministic-ish key for a partner's KYC doc. Timestamp avoids CDN cache reuse. */
const kycKey = (userId, doc, ext, ts) => `kyc/${userId}/${doc}-${ts}.${ext}`;

/** Key for a partner's profile selfie (captured at signup). */
const photoKey = (userId, ext, ts) => `photos/${userId}/profile-${ts}.${ext}`;

module.exports = { isConfigured, putObject, signedGetUrl, deleteObject, kycKey, photoKey };
