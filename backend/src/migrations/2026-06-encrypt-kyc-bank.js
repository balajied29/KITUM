/**
 * One-off migration: encrypt existing plaintext PAN / DL / bank-account numbers
 * at rest. Idempotent — values already in the enc:v1: envelope are skipped, so
 * it's safe to re-run. Requires FIELD_ENCRYPTION_KEY (the same key the app uses).
 *
 *   node src/migrations/2026-06-encrypt-kyc-bank.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User.model');
const { encrypt, isEncrypted } = require('../services/fieldCrypto');

const needs = (v) => typeof v === 'string' && v.length > 0 && !isEncrypted(v);

(async () => {
  if (!process.env.MONGO_URI || !process.env.FIELD_ENCRYPTION_KEY) {
    console.error('✖ MONGO_URI and FIELD_ENCRYPTION_KEY must be set.');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGO_URI);

  const users = await User.find({ role: 'fulfiller' }).select(
    'fulfillerProfile.kyc.panNumber fulfillerProfile.kyc.dlNumber fulfillerProfile.bank.accountNumber'
  );

  let changed = 0;
  for (const u of users) {
    const pan = u.fulfillerProfile?.kyc?.panNumber;
    const dl = u.fulfillerProfile?.kyc?.dlNumber;
    const acct = u.fulfillerProfile?.bank?.accountNumber;
    const set = {};
    if (needs(pan)) set['fulfillerProfile.kyc.panNumber'] = encrypt(pan);
    if (needs(dl)) set['fulfillerProfile.kyc.dlNumber'] = encrypt(dl);
    if (needs(acct)) set['fulfillerProfile.bank.accountNumber'] = encrypt(acct);
    if (Object.keys(set).length) {
      await User.updateOne({ _id: u._id }, { $set: set });
      changed += 1;
    }
  }

  console.log(`✓ Encrypted sensitive fields for ${changed} of ${users.length} fulfiller(s).`);
  await mongoose.connection.close();
  process.exit(0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
