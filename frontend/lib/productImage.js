// Product → display photo / category helpers.
//
// A SKU counts as a tanker when it has a positive `tankerLitres` OR carries
// "Tanker" in its name — the seed file warns tanker names must keep that word,
// and `tankerLitres` can be 0/undefined on un-backfilled rows, so we trust both
// signals. Categorisation and image selection MUST share this one rule, or a
// tanker could land in the "Bottles & Jars" group while showing a tanker photo.
import { tankerImage } from './tankerImage';

export function isTankerProduct(product) {
  return (Number(product?.tankerLitres) || 0) > 0 || /tanker/i.test(product?.name || '');
}

// Resolve a product's photo from /public:
//   • Tankers → their size photo (500 / 1000 / 2000 L), else a generic tanker shot.
//   • Everything else (jars, bottles, crates) → the bottled-water shot.
export function productImage(product) {
  if (isTankerProduct(product)) {
    return tankerImage(Number(product?.tankerLitres) || 0) || '/product-tanker.jpg';
  }
  return '/product-jar.jpg';
}
