/**
 * Seed script — demo fulfillers (tanker operators)
 * Usage: npm run seed:fulfillers
 *
 * Creates a few fulfiller accounts placed around Shillong with starting
 * locations so the dispatch engine has candidates to offer to during testing.
 * Safe to re-run (upserts by email).
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User.model');

const PASSWORD = 'Fulfiller@2026';

// [lng, lat] around Shillong (Police Bazar ~ 25.5760, 91.8825).
const FULFILLERS = [
  { name: ' Rilang Tanker', email: 'fulfiller1@shillongwater.com', phone: '9000000001', vehicleNumber: 'ML05 A 1001', capacityLitres: 2000, coordinates: [91.8825, 25.5760] },
  { name: 'Bah Kong Water', email: 'fulfiller2@shillongwater.com', phone: '9000000002', vehicleNumber: 'ML05 B 2002', capacityLitres: 5000, coordinates: [91.8900, 25.5700] },
  { name: 'Mawlai Supply', email: 'fulfiller3@shillongwater.com', phone: '9000000003', vehicleNumber: 'ML05 C 3003', capacityLitres: 1000, coordinates: [91.8750, 25.5850] },
];

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  const hashed = await bcrypt.hash(PASSWORD, 10);

  for (const f of FULFILLERS) {
    await User.findOneAndUpdate(
      { email: f.email },
      {
        email: f.email,
        password: hashed,
        name: f.name,
        phone: f.phone,
        role: 'fulfiller',
        isActive: true,
        fulfillerProfile: {
          vehicleNumber: f.vehicleNumber,
          capacityLitres: f.capacityLitres,
          isOnline: true,
          isAvailable: true,
          currentLocation: { type: 'Point', coordinates: f.coordinates },
          lastLocationAt: new Date(),
          rating: 5,
          ratingCount: 0,
          applicationStatus: 'approved',
          reviewedAt: new Date(),
          // Pre-verified KYC so demo fulfillers pass the go-online gate.
          kyc: { status: 'verified', panNumber: 'ABCDE1234F', reviewedAt: new Date() },
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    console.log(`  · ${f.name} (${f.email}) — ${f.capacityLitres}L`);
  }

  await mongoose.disconnect();
  console.log('Done.');
  console.log(`\nAll demo fulfillers use password: ${PASSWORD}`);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
