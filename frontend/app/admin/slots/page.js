'use client';
import { useEffect, useState } from 'react';
import { adminGetSlots, adminCreateSlot, adminUpdateSlot } from '@/lib/api';

const LABELS = ['Morning', 'Afternoon', 'Evening'];
const DEFAULT_TIMES = {
  Morning:   { startTime: '7:00 AM',  endTime: '9:00 AM'  },
  Afternoon: { startTime: '12:00 PM', endTime: '2:00 PM'  },
  Evening:   { startTime: '4:00 PM',  endTime: '6:00 PM'  },
};

const next7Days = () => Array.from({ length: 7 }, (_, i) => {
  const d = new Date(); d.setDate(d.getDate() + i);
  return d.toISOString().split('T')[0];
});

export default function AdminSlotsPage() {
  const [slots, setSlots] = useState([]);
  const [saving, setSaving] = useState('');
  const days = next7Days();

  const fetchSlots = () => {
    adminGetSlots().then((res) => setSlots(res.data.data)).catch(() => {});
  };

  useEffect(fetchSlots, []);

  const getSlot = (date, label) =>
    slots.find((s) => s.slotLabel === label && new Date(s.date).toISOString().split('T')[0] === date);

  const handleCapacity = async (slot, value) => {
    const cap = parseInt(value, 10);
    if (isNaN(cap) || cap < 0) return;
    setSaving(slot._id);
    await adminUpdateSlot(slot._id, { maxCapacity: cap }).catch(() => {});
    fetchSlots();
    setSaving('');
  };

  const handleBlock = async (slot) => {
    setSaving(slot._id);
    await adminUpdateSlot(slot._id, { blocked: !slot.blocked }).catch(() => {});
    fetchSlots();
    setSaving('');
  };

  const handleCreate = async (date, label) => {
    setSaving(`${date}-${label}`);
    await adminCreateSlot({
      date,
      slotLabel: label,
      ...DEFAULT_TIMES[label],
      maxCapacity: 20,
    }).catch(() => {});
    fetchSlots();
    setSaving('');
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-base font-700 text-text-main">Slot Management</h1>
        <p className="text-xs text-text-muted">Next 7 days · Tap capacity to edit</p>
      </div>

      <div className="card p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead className="bg-bg-card border-b border-border-default">
              <tr>
                <th className="text-left text-xs font-700 text-text-muted px-4 py-3 w-28">Slot</th>
                {days.map((d) => (
                  <th key={d} className="text-center text-xs font-700 text-text-muted px-3 py-3">
                    {new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {LABELS.map((label) => (
                <tr key={label} className="border-b border-border-default last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-medium text-text-main text-xs">{label}</p>
                    <p className="text-[11px] text-text-muted">{DEFAULT_TIMES[label].startTime}–{DEFAULT_TIMES[label].endTime}</p>
                  </td>
                  {days.map((date) => {
                    const slot = getSlot(date, label);
                    const key = `${date}-${label}`;
                    return (
                      <td key={date} className="px-3 py-3 text-center">
                        {slot ? (
                          <div className="flex flex-col items-center gap-1.5">
                            <input
                              type="number"
                              min={0}
                              defaultValue={slot.maxCapacity}
                              onBlur={(e) => handleCapacity(slot, e.target.value)}
                              className="input text-center py-1 text-xs w-16"
                              title="Max capacity"
                            />
                            <p className="text-[11px] text-text-muted">{slot.currentBooked}/{slot.maxCapacity} booked</p>
                            <button
                              onClick={() => handleBlock(slot)}
                              disabled={saving === slot._id}
                              className={`text-[11px] font-medium px-2 py-0.5 rounded-full transition-colors ${
                                slot.blocked
                                  ? 'bg-red-50 text-red-600 hover:bg-red-100'
                                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                              }`}
                            >
                              {slot.blocked ? 'Blocked' : 'Active'}
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleCreate(date, label)}
                            disabled={saving === key}
                            className="text-[11px] text-text-muted border border-dashed border-border-default px-3 py-1.5 rounded-btn hover:border-primary hover:text-primary transition-colors"
                          >
                            {saving === key ? '…' : '+ Add'}
                          </button>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
