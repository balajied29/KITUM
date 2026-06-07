/**
 * Seed the launch-offer campaigns directly into the database.
 *
 * Use this when the campaigns table is empty (e.g. the backend was running before
 * the launch-offer code, or you want to (re)seed without a restart). Idempotent:
 * $setOnInsert means re-running never clobbers admin-tuned caps/windows.
 *
 *   cd backend && node src/seeds/campaigns.js
 *
 * Reads MONGO_URI from backend/.env (same DB the API uses), so it works against
 * production Atlas without redeploying.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { seedCampaigns } = require('../services/promotions');
const Campaign = require('../models/Campaign.model');

(async () => {
  if (!process.env.MONGO_URI) {
    console.error('✖ MONGO_URI is not set (check backend/.env). Aborting.');
    process.exit(1);
  }
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB connected — seeding launch campaigns…');
    await seedCampaigns();
    const all = await Campaign.find().sort({ audience: 1, key: 1 }).lean();
    console.log(`✓ ${all.length} campaign(s) present:`);
    all.forEach((c) =>
      console.log(`   - ${c.key}  [${c.audience}]  cap=${c.cap}  claimed=${c.claimed}  active=${c.active}`)
    );
  } catch (err) {
    console.error('✖ Seed failed:', err.message || err);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close().catch(() => {});
    process.exit(process.exitCode || 0);
  }
})();
