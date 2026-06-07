/**
 * Consent records (DPDP Act 2023). We persist a timestamped, attributable record
 * every time a user gives consent (and, in future, withdraws it) so we can
 * demonstrate lawful basis on request.
 */
const ConsentLog = require('../models/ConsentLog.model');

// Bump this whenever the consent text / linked policies change materially, so each
// record captures exactly which version the user agreed to. Keep in step with the
// policies' "Last updated" date.
const CONSENT_VERSION = '2026-06-07';

/**
 * Write a consent event. Best-effort: a logging hiccup must never break signup
 * (the account still exists and the gated UI was the affirmative action), but we
 * surface failures loudly so they can be reconciled.
 */
async function recordConsent(req, { userId, purpose, role, documents = [], ageConfirmed = true, action = 'granted' }) {
  try {
    await ConsentLog.create({
      userId,
      purpose,
      action,
      role,
      documents,
      ageConfirmed,
      policyVersion: CONSENT_VERSION,
      ip: req?.ip || null,
      userAgent: (req?.headers?.['user-agent'] || '').slice(0, 400) || null,
    });
  } catch (err) {
    console.error('recordConsent failed:', err.message);
  }
}

module.exports = { recordConsent, CONSENT_VERSION };
