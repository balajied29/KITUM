/**
 * Token service: short-lived access JWTs + rotating opaque refresh tokens.
 *
 *  - Access token  = JWT `{ id }`, ~15 min. Verified by the existing `protect`
 *    middleware (unchanged). Sent as the Bearer / socket handshake token.
 *  - Refresh token = opaque random string, ~30 days, stored hashed server-side.
 *    Rotated on every use; reuse of a revoked token nukes the whole family.
 *
 * Refresh tokens are NOT JWTs, so they can never be used as an access token.
 */
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const RefreshToken = require('../models/RefreshToken.model');

const ACCESS_TTL = process.env.ACCESS_TOKEN_TTL || '15m';
const REFRESH_TTL_DAYS = Number(process.env.REFRESH_TOKEN_TTL_DAYS) || 30;
// Grace window after a token is rotated during which presenting it again is treated
// as a BENIGN race (a 2nd tab / rapid reload / retried request), not theft. Without
// this, any duplicate refresh nukes the whole session and logs the user out.
const REUSE_GRACE_MS = Number(process.env.REFRESH_REUSE_GRACE_MS) || 60 * 1000;

const hash = (raw) => crypto.createHmac('sha256', process.env.JWT_SECRET).update(raw).digest('hex');

function signAccessToken(userId) {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: ACCESS_TTL });
}

/** Create + persist a fresh refresh token; returns the raw value (shown once). */
async function issueRefreshToken(userId) {
  const raw = crypto.randomBytes(48).toString('hex');
  await RefreshToken.create({
    userId,
    tokenHash: hash(raw),
    expiresAt: new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000),
  });
  return raw;
}

/** Issue a fresh access+refresh pair for a user. */
async function issuePair(userId) {
  const [accessToken, refreshToken] = await Promise.all([
    signAccessToken(userId),
    issueRefreshToken(userId),
  ]);
  return { accessToken, refreshToken };
}

async function revokeAllForUser(userId) {
  await RefreshToken.updateMany({ userId, revokedAt: null }, { revokedAt: new Date() });
}

/** Revoke a single refresh token (logout). Best-effort. */
async function revokeRefreshToken(raw) {
  await RefreshToken.updateOne({ tokenHash: hash(raw) }, { revokedAt: new Date() }).catch(() => {});
}

/**
 * Rotate a refresh token. Returns a new pair on success, or null if invalid.
 * Reuse of an already-revoked token → revoke the whole family (theft response).
 */
async function rotateRefreshToken(raw) {
  if (!raw) return null;
  const tokenHash = hash(raw);
  const doc = await RefreshToken.findOne({ tokenHash });
  if (!doc) return null; // unknown token

  if (doc.revokedAt) {
    // Benign reuse race (another tab / a rapid reload / a retried request presenting
    // a just-rotated token): re-issue a fresh pair instead of punishing the user.
    if (Date.now() - doc.revokedAt.getTime() <= REUSE_GRACE_MS) {
      return {
        userId: doc.userId,
        accessToken: signAccessToken(doc.userId),
        refreshToken: await issueRefreshToken(doc.userId),
      };
    }
    // Reuse of a LONG-revoked token → likely stolen. Burn the whole family.
    await revokeAllForUser(doc.userId);
    return null;
  }
  if (doc.expiresAt.getTime() < Date.now()) return null;

  // Rotate: mint the replacement, then mark this one revoked + linked.
  const newRaw = await issueRefreshToken(doc.userId);
  doc.revokedAt = new Date();
  doc.replacedByHash = hash(newRaw);
  await doc.save();

  return { userId: doc.userId, accessToken: signAccessToken(doc.userId), refreshToken: newRaw };
}

module.exports = {
  signAccessToken,
  issueRefreshToken,
  issuePair,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllForUser,
};
