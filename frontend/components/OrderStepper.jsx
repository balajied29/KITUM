const STEPS = [
  { key: 'pending',           label: 'Order Placed' },
  { key: 'confirmed',         label: 'Confirmed' },
  { key: 'out_for_delivery',  label: 'Out for Delivery' },
  { key: 'delivered',         label: 'Delivered' },
];

const STATUS_INDEX = Object.fromEntries(STEPS.map((s, i) => [s.key, i]));

export default function OrderStepper({ status, statusLog = [] }) {
  const currentIndex = STATUS_INDEX[status] ?? 0;

  return (
    <ol className="relative flex flex-col gap-0">
      {STEPS.map((step, i) => {
        const done = i < currentIndex;
        const active = i === currentIndex;
        const upcoming = i > currentIndex;
        const logEntry = statusLog.find((l) => l.status === step.key);

        return (
          <li key={step.key} className="flex gap-4 pb-6 last:pb-0">
            {/* Line + dot column */}
            <div className="flex flex-col items-center">
              <div className={`w-3 h-3 rounded-full mt-0.5 flex-shrink-0 ${
                done ? 'bg-emerald-500' : active ? 'bg-primary' : 'bg-border-default'
              }`} />
              {i < STEPS.length - 1 && (
                <div className={`w-px flex-1 mt-1 ${done ? 'bg-emerald-500' : 'bg-border-default'}`} />
              )}
            </div>

            {/* Text column */}
            <div className="pb-1">
              <p className={`text-sm font-medium ${upcoming ? 'text-text-muted' : 'text-text-main'}`}>
                {step.label}
              </p>
              {logEntry && (
                <p className="text-xs text-text-muted mt-0.5">
                  {new Date(logEntry.changedAt).toLocaleString('en-IN', {
                    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                  })}
                </p>
              )}
              {active && status !== 'delivered' && (
                <span className="inline-block mt-1 text-xs font-medium text-primary bg-blue-50 px-2 py-0.5 rounded-full">
                  Current
                </span>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
