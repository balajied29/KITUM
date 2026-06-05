/**
 * Seed script — locality centroids
 * Usage:
 *   npm run seed:localities            # geocode + write localities.centroids.json
 *   npm run seed:localities -- --dry   # report only, write nothing
 *
 * Geocodes every locality in shared/localities.js via Google Geocoding
 * ("<name>, Shillong, Meghalaya, India") and writes the resulting
 * [lng, lat] centroids to shared/localities.centroids.json, which the
 * localities module overlays over its hand-placed approximations.
 *
 * Why a file (not the DB): localities are config, not user data. Keeping the
 * generated centroids in a committed JSON makes them reviewable in a PR (you can
 * eyeball each coordinate on a map) and avoids a runtime geocode on the hot path.
 *
 * Requires GOOGLE_MAPS_API_KEY. Fails soft per-locality: anything that doesn't
 * geocode is reported and left to its approximation (centroid omitted from JSON).
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { LOCALITIES } = require('../shared/localities');
const geo = require('../services/geo');

const OUT = path.join(__dirname, '..', 'shared', 'localities.centroids.json');
const DRY = process.argv.includes('--dry');

// Plausible bounding box for Greater Shillong — a geocode outside this is almost
// certainly wrong (Google matched a same-named place elsewhere), so we reject it.
const BBOX = { minLat: 25.45, maxLat: 25.70, minLng: 91.75, maxLng: 92.05 };
const inBbox = (lat, lng) =>
  lat >= BBOX.minLat && lat <= BBOX.maxLat && lng >= BBOX.minLng && lng <= BBOX.maxLng;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function run() {
  if (!process.env.GOOGLE_MAPS_API_KEY) {
    console.error('GOOGLE_MAPS_API_KEY is not set — cannot geocode. Aborting.');
    process.exit(1);
  }

  const out = {};
  const rejected = [];
  const failed = [];

  for (const l of LOCALITIES) {
    const query = `${l.name}, Shillong, Meghalaya, India`;
    const hit = await geo.geocode(query);
    await sleep(120); // be gentle with the geocoding quota

    if (!hit) {
      failed.push(l.id);
      console.warn(`✗ ${l.id.padEnd(24)} no geocode result`);
      continue;
    }
    if (!inBbox(hit.lat, hit.lng)) {
      rejected.push(l.id);
      console.warn(`! ${l.id.padEnd(24)} out of bbox (${hit.lat.toFixed(4)}, ${hit.lng.toFixed(4)}) — kept approx`);
      continue;
    }
    out[l.id] = [Number(hit.lng.toFixed(6)), Number(hit.lat.toFixed(6))]; // [lng, lat]
    console.log(`✓ ${l.id.padEnd(24)} [${out[l.id][0]}, ${out[l.id][1]}]`);
  }

  const verified = Object.keys(out).length;
  console.log(
    `\nGeocoded ${verified}/${LOCALITIES.length}` +
      `${rejected.length ? ` · ${rejected.length} out-of-bbox` : ''}` +
      `${failed.length ? ` · ${failed.length} failed` : ''}`
  );

  if (DRY) {
    console.log('Dry run — not writing.');
    return;
  }

  fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n');
  console.log(`Wrote ${OUT}`);
  if (verified < LOCALITIES.length) {
    console.log('NOTE: not all localities verified — review the warnings above and fix names/aliases.');
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
