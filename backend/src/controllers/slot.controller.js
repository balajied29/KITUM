const SlotConfig = require('../models/SlotConfig.model');

const getSlotsByDate = async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) {
      return res.status(400).json({ success: false, error: 'date query param is required (YYYY-MM-DD)' });
    }

    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);

    const slots = await SlotConfig.find({
      date: { $gte: start, $lte: end },
      blocked: false,
    }).sort({ startTime: 1 });

    const data = slots.map((s) => ({
      ...s.toObject(),
      spotsLeft: s.maxCapacity - s.currentBooked,
      available: s.currentBooked < s.maxCapacity,
    }));

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch slots' });
  }
};

module.exports = { getSlotsByDate };
