'use client';
import { useState, useEffect } from 'react';
import { getSlots } from '@/lib/api';
import { useCartStore } from '@/lib/store';

const toDateString = (date) => date.toISOString().split('T')[0];

const next7Days = () =>
  Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d;
  });

export default function SlotPicker() {
  const { slotId, setSlot } = useCartStore();
  const [days] = useState(next7Days);
  const [selectedDay, setSelectedDay] = useState(toDateString(days[0]));
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    getSlots(selectedDay)
      .then((res) => setSlots(res.data.data))
      .catch(() => setSlots([]))
      .finally(() => setLoading(false));
  }, [selectedDay]);

  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div>
      {/* Date row */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
        {days.map((d) => {
          const ds = toDateString(d);
          const active = ds === selectedDay;
          return (
            <button
              key={ds}
              onClick={() => { setSelectedDay(ds); setSlot(null); }}
              className={`flex-shrink-0 flex flex-col items-center px-3 py-2 rounded-btn text-xs font-medium border transition-colors ${
                active ? 'bg-primary text-white border-primary' : 'bg-white text-text-muted border-border-default hover:border-primary'
              }`}
            >
              <span>{dayLabels[d.getDay()]}</span>
              <span className="text-base font-700 leading-tight">{d.getDate()}</span>
            </button>
          );
        })}
      </div>

      {/* Slot pills */}
      <div className="mt-3 flex flex-col gap-2">
        {loading && <p className="text-xs text-text-muted">Loading slots…</p>}
        {!loading && slots.length === 0 && (
          <p className="text-xs text-text-muted">No slots available for this date.</p>
        )}
        {slots.map((slot) => {
          const selected = slotId === slot._id;
          const full = !slot.available;
          return (
            <button
              key={slot._id}
              disabled={full}
              onClick={() => setSlot(slot._id)}
              className={`flex items-center justify-between px-4 py-3 rounded-btn border text-sm font-medium transition-colors ${
                full
                  ? 'bg-bg-card text-text-muted border-border-default cursor-not-allowed line-through'
                  : selected
                  ? 'bg-primary text-white border-primary'
                  : 'bg-white text-text-main border-border-default hover:border-primary'
              }`}
            >
              <span>{slot.slotLabel}</span>
              <span className="text-xs font-normal">{slot.startTime} – {slot.endTime}</span>
              {!full && <span className="text-xs font-normal">{slot.spotsLeft} left</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
