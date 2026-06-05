const mongoose = require('mongoose');

/**
 * Server-side refresh tokens (rotation + reuse detection).
 *
 * We store only the SHA-256 hash of the token — never the raw value — so a DB
 * leak can't be replayed. Each refresh rotates: the old row is revoked and
 * linked to its replacement. Presenting an already-revoked token is treated as
 * theft and revokes the whole family for that user.
 */
const refreshTokenSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    replacedByHash: { type: String, default: null },
  },
  { timestamps: true }
);

// TTL: Mongo auto-purges rows once expired (keeps revoked-but-unexpired rows
// around long enough for reuse detection).
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('RefreshToken', refreshTokenSchema);
