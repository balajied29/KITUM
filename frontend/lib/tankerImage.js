// Maps a tanker's litre capacity to its product photo in /public/images.
// Returns null for sizes without a photo, so callers fall back to the icon.
const TANKER_IMAGES = {
  500: '/images/500L.jpeg',
  1000: '/images/1000L.jpeg',
  2000: '/images/2000L.jpeg',
};

export function tankerImage(litres) {
  return TANKER_IMAGES[Number(litres)] || null;
}
