/**
 * Field-level encryption at rest for the most sensitive identifiers we store —
 * a partner's PAN number, driving-licence number and bank account number. These
 * are government / financial identifiers; encrypting them means a DB dump alone
 * never exposes them (DPDP Rule 6 "reasonable security safeguards").
 *
 * AES-256-GCM (authenticated) with a random 96-bit IV per value. Stored as
 *   enc:v1:<base64( iv(12) | tag(16) | ciphertext )>
 * The version prefix lets us evolve the scheme and lets reads transparently pass
 * through any legacy plaintext that predates the migration.
 *
 * The key comes from FIELD_ENCRYPTION_KEY (32-byte, base64 or hex — or any
 * passphrase, which we hash to 32 bytes). The server refuses to boot without it
 * (see src/index.js) so we never silently fall back to storing plaintext.
 */
const crypto = require('crypto');

const PREFIX = 'enc:v1:';

let _key = null;
function key() {
  if (_key) return _key;
  const raw = process.env.FIELD_ENCRYPTION_KEY;
  if (!raw) throw new Error('FIELD_ENCRYPTION_KEY is not set');
  // Accept a 32-byte base64 or hex key; otherwise derive 32 bytes from a passphrase.
  let buf = null;
  const b64 = Buffer.from(raw, 'base64');
  if (b64.length === 32) buf = b64;
  if (!buf && /^[0-9a-fA-F]{64}$/.test(raw)) buf = Buffer.from(raw, 'hex');
  if (!buf) buf = crypto.createHash('sha256').update(raw).digest();
  _key = buf;
  return _key;
}

const isConfigured = () => !!process.env.FIELD_ENCRYPTION_KEY;
const isEncrypted = (v) => typeof v === 'string' && v.startsWith(PREFIX);

/** Encrypt a value → "enc:v1:…". Empty/nullish and already-encrypted pass through. */
function encrypt(plaintext) {
  if (plaintext == null || plaintext === '') return plaintext;
  if (isEncrypted(plaintext)) return plaintext;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const ct = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, tag, ct]).toString('base64');
}

/** Decrypt an "enc:v1:" value. Legacy plaintext / empty values pass through. */
function decrypt(value) {
  if (!isEncrypted(value)) return value; // legacy plaintext, '', null, undefined
  try {
    const raw = Buffer.from(value.slice(PREFIX.length), 'base64');
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const ct = raw.subarray(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
  } catch {
    return ''; // wrong key / tampered — fail closed rather than leak ciphertext
  }
}

/**
 * Strip the encrypted sensitive identifiers from a plain user object before it's
 * returned in a GENERIC payload (auth /me, admin lists, etc.). The decrypted
 * values are surfaced only by the dedicated endpoints (KYC + bank views), so a
 * client never receives ciphertext and we minimise exposure. Mutates + returns.
 */
function scrubSensitive(u) {
  const k = u?.fulfillerProfile?.kyc;
  if (k) {
    delete k.panNumber;
    delete k.dlNumber;
  }
  const b = u?.fulfillerProfile?.bank;
  if (b) delete b.accountNumber;
  return u;
}

module.exports = { encrypt, decrypt, scrubSensitive, isConfigured, isEncrypted };
