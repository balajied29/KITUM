const Address = require('../models/Address.model');

const listAddresses = async (req, res) => {
  try {
    const addresses = await Address.find({ userId: req.user._id }).sort({ isDefault: -1, updatedAt: -1 });
    res.json({ success: true, data: addresses });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch addresses' });
  }
};

const createAddress = async (req, res) => {
  try {
    const { label, type, address, landmark, contactName, contactPhone, coordinates, isDefault } = req.body;
    if (!address || !coordinates?.length) {
      return res.status(400).json({ success: false, error: 'address and coordinates are required' });
    }
    const [lng, lat] = coordinates;
    if (typeof lng !== 'number' || typeof lat !== 'number') {
      return res.status(400).json({ success: false, error: 'coordinates must be [lng, lat] numbers' });
    }

    // First address (or explicitly requested) becomes the default.
    const count = await Address.countDocuments({ userId: req.user._id });
    const makeDefault = isDefault || count === 0;
    if (makeDefault) await Address.updateMany({ userId: req.user._id }, { isDefault: false });

    const doc = await Address.create({
      userId: req.user._id,
      label,
      type: type || 'other',
      address,
      landmark,
      contactName,
      contactPhone,
      location: { type: 'Point', coordinates: [lng, lat] },
      isDefault: makeDefault,
    });
    res.status(201).json({ success: true, data: doc });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to save address' });
  }
};

const updateAddress = async (req, res) => {
  try {
    const { label, type, address, landmark, contactName, contactPhone, coordinates, isDefault } = req.body;
    const set = {};
    if (label !== undefined) set.label = label;
    if (type !== undefined) set.type = type;
    if (address !== undefined) set.address = address;
    if (landmark !== undefined) set.landmark = landmark;
    if (contactName !== undefined) set.contactName = contactName;
    if (contactPhone !== undefined) set.contactPhone = contactPhone;
    if (coordinates?.length === 2) set.location = { type: 'Point', coordinates: [coordinates[0], coordinates[1]] };

    if (isDefault) {
      await Address.updateMany({ userId: req.user._id }, { isDefault: false });
      set.isDefault = true;
    }

    const doc = await Address.findOneAndUpdate({ _id: req.params.id, userId: req.user._id }, { $set: set }, { new: true });
    if (!doc) return res.status(404).json({ success: false, error: 'Address not found' });
    res.json({ success: true, data: doc });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to update address' });
  }
};

const deleteAddress = async (req, res) => {
  try {
    const doc = await Address.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!doc) return res.status(404).json({ success: false, error: 'Address not found' });
    // If we removed the default, promote the most recent remaining one.
    if (doc.isDefault) {
      const next = await Address.findOne({ userId: req.user._id }).sort({ updatedAt: -1 });
      if (next) await Address.updateOne({ _id: next._id }, { isDefault: true });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to delete address' });
  }
};

module.exports = { listAddresses, createAddress, updateAddress, deleteAddress };
