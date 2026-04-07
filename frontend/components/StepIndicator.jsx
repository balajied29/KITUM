const STEPS = ['Product', 'Slot', 'Checkout'];

export default function StepIndicator({ step }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-5">
      {STEPS.map((label, i) => {
        const num = i + 1;
        const done = num < step;
        const active = num === step;
        return (
          <div key={label} className="flex items-center">
            {/* Step circle + label */}
            <div className="flex flex-col items-center gap-1">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-700 transition-colors ${
                done
                  ? 'bg-emerald-500 text-white'
                  : active
                  ? 'bg-primary text-white'
                  : 'bg-bg-card border border-border-default text-text-muted'
              }`}>
                {done ? (
                  <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : num}
              </div>
              <span className={`text-[10px] font-medium ${active ? 'text-primary' : done ? 'text-emerald-600' : 'text-text-muted'}`}>
                {label}
              </span>
            </div>

            {/* Connector line */}
            {i < STEPS.length - 1 && (
              <div className={`h-px w-10 mx-1 mb-4 transition-colors ${done ? 'bg-emerald-500' : 'bg-border-default'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}
