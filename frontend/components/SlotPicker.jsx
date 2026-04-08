'use client';
import { useState, useEffect } from 'react';
import { getSlots } from '@/lib/api';
import { useCartStore, useLocationStore } from '@/lib/store';

const toDateString = (date) => date.toISOString().split('T')[0];

const next7Days = () =>
  Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return d;
  });

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const SESSION_META = {
  Morning:   { icon: '☀️' },
  Afternoon: { icon: '🌤️' },
  Evening:   { icon: '🌙' },
};

export default function SlotPicker() {
  const { slot: selectedSlot, setSlot } = useCartStore();
  const { locality } = useLocationStore();
  const [days] = useState(next7Days);
  const [selectedDay, setSelectedDay] = useState(toDateString(days[0]));
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    getSlots(selectedDay, locality)
      .then((res) => setSlots(res.data.data))
      .catch(() => setSlots([]))
      .finally(() => setLoading(false));
  }, [selectedDay, locality]);

  const grouped = ['Morning', 'Afternoon', 'Evening'].map((label) => ({
    label,
    ...SESSION_META[label],
    slots: slots.filter((s) => s.slotLabel === label),
  }));

  return (
    <div>
      {/* Date row */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none mb-4">
        {days.map((d, i) => {
          const ds = toDateString(d);
          const active = ds === selectedDay;
          return (
            <button
              key={ds}
              onClick={() => { setSelectedDay(ds); setSlot(null); /* clear slot on day change */}}
              className={`flex-shrink-0 flex flex-col items-center px-3 py-2 rounded-btn border transition-colors min-w-[52px] ${
                active
                  ? 'bg-primary text-white border-primary'
                  : 'bg-white text-text-muted border-border-default hover:border-primary'
              }`}
            >
              <span className={`text-[10px] font-medium uppercase ${active ? 'text-white/75' : ''}`}>
                {i === 0 ? 'Today' : DAY_LABELS[d.getDay()]}
              </span>
              <span className="text-base font-700 leading-tight">{d.getDate()}</span>
              <span className={`text-[9px] ${active ? 'text-white/60' : 'text-text-muted'}`}>
                {d.toLocaleString('default', { month: 'short' })}
              </span>
            </button>
          );
        })}
      </div>

      {/* Slots */}
      {loading ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-14 animate-pulse bg-bg-card rounded-card" />)}
        </div>
      ) : slots.length === 0 ? (
        <p className="text-xs text-text-muted py-4 text-center">No slots available for this date.</p>
      ) : (
        <div className="flex flex-col gap-4 mb-4">
          {grouped.map(({ label, icon, slots: groupSlots }) => {
            if (groupSlots.length === 0) return null;
            return (
              <div key={label}>
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="text-sm">{icon}</span>
                  <p className="text-xs font-700 text-text-main">{label}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {groupSlots.map((slot) => {
                    const selected = selectedSlot?._id === slot._id;
                    const full = !slot.available;
                    return (
                      <button
                        key={slot._id}
                        disabled={full}
                        onClick={() => setSlot(slot)}
                        className={`flex flex-col items-start px-4 py-2.5 rounded-btn border text-xs font-medium transition-colors min-w-[120px] ${
                          full
                            ? 'bg-bg-card text-text-muted border-border-default cursor-not-allowed opacity-60'
                            : selected
                            ? 'bg-primary text-white border-primary'
                            : 'bg-white text-text-main border-border-default hover:border-primary'
                        }`}
                      >
                        <span className={`font-700 ${full ? 'line-through' : ''}`}>
                          {slot.startTime} – {slot.endTime}
                        </span>
                        {!full && (
                          <span className={`text-[10px] mt-0.5 ${selected ? 'text-white/70' : 'text-text-muted'}`}>
                            {slot.spotsLeft} left
                          </span>
                        )}
                        {full && <span className="text-[10px] mt-0.5">Full</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delivery protocol */}
      <div className="card border-accent/30 bg-blue-50/40 mt-2">
        <div className="flex items-start gap-2">
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#0ea5e9" strokeWidth={2} className="flex-shrink-0 mt-0.5">
            <circle cx="12" cy="12" r="10" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01" />
          </svg>
          <div>
            <p className="text-[10px] font-700 text-accent uppercase tracking-widest mb-1">Delivery Protocol</p>
            <p className="text-[11px] text-text-muted leading-relaxed">
              KIT UM drivers will contact you 10 minutes prior to arrival. Please ensure someone is available to receive the delivery. Unattended deliveries will be rescheduled for the next available slot.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
