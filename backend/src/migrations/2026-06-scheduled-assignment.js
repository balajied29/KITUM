/**
 * Migration — scheduled driver-assignment fields.
 * Usage:
 *   node src/migrations/2026-06-scheduled-assignment.js          # apply
 *   node src/migrations/2026-06-scheduled-assignment.js --dry    # report only
 *
 * Idempotent and additive. Safe to re-run. Backfills:
 *   1. Product.tankerLitres   — derived from slug/unit (0 for bottled SKUs)
 *   2. fulfillerProfile.*      — scheduled service-area + reliability defaults
 *   3. Order.localityId        — normalized from deliveryAddress.locality
 *      Order.requiredLitres    — max tanker line in the order (0 ⇒ bottled-only)
 *      Order.assignmentStatus  — defaulted to 'unassigned' for legacy rows
 *
 * NOTE: Order.deliveryPoint is intentionally NOT backfilled — historical orders
 * have no coordinates and geocoding free-text addresses retroactively is unreliable.
 * New orders should geocode at creation (createOrder hook — see docs/scheduled-dispatch.md §Phase A).
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('../models/Product.model');
const User = require('../models/User.model');
const Order = require('../models/Order.model');
const { SCHED } = require('../shared/constants');
const localities = require('../shared/localities');

const DRY = process.argv.includes('--dry');

const firstInt = (s) => {
  const m = String(s || '').match(/(\d[\d,]*)/);
  return m ? Number(m[1].replace(/,/g, '')) : 0;
};
const tankerLitresFor = (p) => {
  const isTanker = /tanker/i.test(`${p.slug} ${p.name} ${p.unit}`);
  if (!isTanker) return 0;
  return firstInt(p.slug) || firstInt(p.unit) || 0;
};

async function backfillProducts() {
  const products = await Product.find().lean();
  let changed = 0;
  for (const p of products) {
    const litres = tankerLitresFor(p);
    if (p.tankerLitres === litres) continue;
    changed++;
    console.log(`  product ${p.slug.padEnd(20)} tankerLitres → ${litres}`);
    if (!DRY) await Product.updateOne({ _id: p._id }, { $set: { tankerLitres: litres } });
  }
  console.log(`Products: ${changed} updated / ${products.length} total`);
}

async function backfillFulfillers() {
  // Only set fields that are missing (don't clobber configured drivers).
  const res = await User.updateMany(
    { role: 'fulfiller', 'fulfillerProfile.serviceLocalities': { $exists: false } },
    {
      $set: {
        'fulfillerProfile.serviceLocalities': [],
        'fulfillerProfile.primaryZones': [],
        'fulfillerProfile.tripsPerSlot': SCHED.DEFAULT_TRIPS_PER_SLOT,
        'fulfillerProfile.schedOfferCount': 0,
        'fulfillerProfile.schedAcceptCount': 0,
        'fulfillerProfile.schedAssignedCount': 0,
        'fulfillerProfile.schedNoShowCount': 0,
      },
    }
  );
  console.log(`Fulfillers: ${res.modifiedCount} backfilled (serviceLocalities still EMPTY — set via onboarding)`);
}

async function backfillOrders() {
  // Map productId → tankerLitres for requiredLitres computation.
  const products = await Product.find().lean();
  const litresById = new Map(products.map((p) => [String(p._id), tankerLitresFor(p)]));

  const orders = await Order.find().lean();
  let changed = 0;
  let unmatchedLocalities = 0;
  for (const o of orders) {
    const set = {};

    const lid = localities.localityIdForText(o.deliveryAddress?.locality);
    if (lid && o.localityId !== lid) set.localityId = lid;
    if (!lid && o.deliveryAddress?.locality) unmatchedLocalities++;

    const required = Math.max(0, ...(o.items || []).map((it) => litresById.get(String(it.productId)) || 0));
    if (o.requiredLitres !== required) set.requiredLitres = required;

    if (!o.assignmentStatus) set.assignmentStatus = 'unassigned';

    if (Object.keys(set).length === 0) continue;
    changed++;
    if (!DRY) await Order.updateOne({ _id: o._id }, { $set: set });
  }
  console.log(`Orders: ${changed} updated / ${orders.length} total` + (unmatchedLocalities ? ` · ${unmatchedLocalities} locality strings did not normalize (check aliases)` : ''));
}

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log(`Connected to MongoDB${DRY ? ' (DRY RUN — no writes)' : ''}`);

  await backfillProducts();
  await backfillFulfillers();
  await backfillOrders();

  await mongoose.disconnect();
  console.log('Done.');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
