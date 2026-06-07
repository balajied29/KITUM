const mongoose = require('mongoose');

/**
 * Append-only consent audit log. Under the DPDP Act 2023 a Data Fiduciary must be
 * able to DEMONSTRATE that valid, informed consent was obtained (and log any
 * withdrawal). One immutable row per consent event — we never update a row except
 * to scrub the IP / user-agent (the only PII here) when the user erases their account.
 */
const consentLogSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    // What the consent was for, e.g. 'account_signup' | 'partner_signup'.
    purpose: { type: String, required: true },
    action: { type: String, enum: ['granted', 'withdrawn'], default: 'granted' },
    role: { type: String }, // 'customer' | 'fulfiller'
    // Version of the notice/policies the user agreed to (so we know exactly what
    // they saw) and which documents were referenced in the consent.
    policyVersion: { type: String },
    documents: { type: [String], default: [] }, // e.g. ['terms', 'privacy']
    ageConfirmed: { type: Boolean }, // the "I am 18 or older" affirmation
    // Evidence of the affirmative action (cleared on account erasure).
    ip: { type: String, default: null },
    userAgent: { type: String, default: null },
  },
  { timestamps: true } // createdAt = the exact time consent was recorded
);

module.exports = mongoose.model('ConsentLog', consentLogSchema);
