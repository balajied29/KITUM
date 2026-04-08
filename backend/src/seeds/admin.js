/**
 * Seed script — admin user + today's slots
 * Usage: npm run seed:admin
 *
 * Creates an admin user and 3 slots for today + tomorrow.
 * Safe to re-run (upserts).
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User.model');
const SlotConfig = require('../models/SlotConfig.model');

const ADMIN_EMAIL = 'balajied29@gmail.com';

const SLOT_TEMPLATES = [
  { slotLabel: 'Morning',   startTime: '7:00 AM',  endTime: '9:00 AM',  maxCapacity: 20 },
  { slotLabel: 'Afternoon', startTime: '12:00 PM', endTime: '2:00 PM',  maxCapacity: 20 },
  { slotLabel: 'Evening',   startTime: '4:00 PM',  endTime: '6:00 PM',  maxCapacity: 20 },
];

function daysFromNow(n) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + n);
  // Normalize to UTC midnight to match slot query convention
  return new Date(d.toISOString().split('T')[0] + 'T00:00:00.000Z');
}

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  // Admin user
  const admin = await User.findOneAndUpdate(
    { email: ADMIN_EMAIL },
    { email: ADMIN_EMAIL, role: 'admin', name: 'Admin', isActive: true },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  console.log(`Admin user: ${admin.email} (${admin._id})`);

  // Slots for today + next 6 days
  let created = 0;
  for (let i = 0; i < 7; i++) {
    const date = daysFromNow(i);
    for (const tpl of SLOT_TEMPLATES) {
      try {
        await SlotConfig.findOneAndUpdate(
          { date, slotLabel: tpl.slotLabel },
          { date, ...tpl },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        created++;
      } catch {
        // skip duplicates
      }
    }
  }
  console.log(`Created/updated ${created} slots across 7 days`);

  await mongoose.disconnect();
  console.log('Done.');
  console.log(`\nLog in with: ${ADMIN_EMAIL} (send OTP to this email)`);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
