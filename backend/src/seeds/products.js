/**
 * Seed script — products
 * Usage: npm run seed:products
 *
 * Clears the products collection and inserts the canonical SKU list.
 * Safe to re-run: uses deleteMany + insertMany (idempotent).
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Product = require('../models/Product.model');

// `tankerLitres` is the authoritative tanker volume (0 = bottled water, not a
// tanker delivery). Tanker SKUs must keep "Tanker" in the name and the litres in
// `unit` — the instant flow filters by /tanker/i and parses capacity from `unit`.
const PRODUCTS = [
  {
    name:   'Standard 20L Jar',
    slug:   'standard-20l-jar',
    unit:   '20 Litres',
    price:  40,
    tankerLitres: 0,
    active: true,
    description: 'Multi-stage purified water with essential minerals. Ideal for daily household use.',
  },
  {
    name:   '5L Bottle Pack',
    slug:   '5l-bottle-pack',
    unit:   'Pack of 4 × 5L',
    price:  120,
    tankerLitres: 0,
    active: true,
    description: 'Easy to carry bottles for travel and short trips.',
  },
  {
    name:   'Mineral Crate',
    slug:   'mineral-crate',
    unit:   '4 Bottles × 1L',
    price:  240,
    tankerLitres: 0,
    active: true,
    description: '1L mineral water bottles. Great for offices and guests.',
  },
  {
    name:   '500L Tanker',
    slug:   '500l-tanker',
    unit:   '500 Litres',
    price:  500,
    tankerLitres: 500,
    active: true,
    description: 'Compact tanker for small households, top-ups, and quick refills.',
  },
  {
    name:   '1000L Tanker',
    slug:   '1000l-tanker',
    unit:   '1000 Litres',
    price:  800,
    tankerLitres: 1000,
    active: true,
    description: 'For medium-sized households and regular daily usage. Reliable and quick to maneuver through city streets.',
  },
  {
    name:   '2000L Tanker',
    slug:   '2000l-tanker',
    unit:   '2000 Litres',
    price:  1500,
    tankerLitres: 2000,
    active: true,
    description: 'Ideal for large families, commercial facilities, or events needing significant water volume storage.',
  },
];

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  await Product.deleteMany({});
  console.log('Cleared existing products');

  const inserted = await Product.insertMany(PRODUCTS);
  console.log(`Inserted ${inserted.length} products:`);
  inserted.forEach((p) => console.log(`  · ${p.name} (${p.unit}) — ₹${p.price}`));

  await mongoose.disconnect();
  console.log('Done.');
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
