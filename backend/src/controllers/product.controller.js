const Product = require('../models/Product.model');

const listProducts = async (req, res) => {
  try {
    const products = await Product.find({ active: true }).sort({ createdAt: 1 });
    res.json({ success: true, data: products });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch products' });
  }
};

module.exports = { listProducts };
