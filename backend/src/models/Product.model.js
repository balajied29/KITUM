const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    unit: {
      type: String,
      required: true,
      trim: true, // e.g. "20L", "1000L", "5L"
    },
    // Tanker volume in litres for tanker SKUs; 0 for bottled water (jar/pack/crate).
    // This is the authoritative order→tanker-capacity mapping for scheduled matching
    // (the free-text `unit` is not machine-reliable). Backfilled by the migration.
    tankerLitres: {
      type: Number,
      default: 0,
    },
    price: {
      type: Number,
      required: true,
    },
    description: {
      type: String,
      trim: true,
    },
    image: {
      type: String, // URL or file path
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Product', productSchema);
