const SlotConfig = require('../models/SlotConfig.model');

// Parse a YYYY-MM-DD string as UTC midnight — avoids timezone drift
const utcDay = (dateStr) => new Date(dateStr + 'T00:00:00.000Z');

const getSlotsByDate = async (req, res) => {
  try {
    const { date } = req.query;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ success: false, error: 'date query param required (YYYY-MM-DD)' });
    }

    const start = utcDay(date);
    const end   = new Date(date + 'T23:59:59.999Z');

    const slots = await SlotConfig.find({
      date:    { $gte: start, $lte: end },
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
