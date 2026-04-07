import Link from 'next/link';

const LOCALITIES = [
  'Laitumkhrah', 'Police Bazaar', 'Lachulmiere', 'Mawpat',
  'Nongthymmai', 'Rynjah', 'Bara Bazaar',
];

const SERVICES = [
  { title: '2-Hour Slots', desc: 'Precise delivery windows' },
  { title: 'Cash & UPI',   desc: 'Pay how you prefer' },
  { title: 'Track Live',   desc: 'Know when we arrive' },
];

export default function HomePage() {
  return (
    <main>
      {/* Header */}
      <header className="flex items-center justify-between px-4 pt-5 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-primary rounded flex items-center justify-center">
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="white" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 2C8 8 5 12 5 15a7 7 0 0014 0c0-3-3-7-7-13z" />
            </svg>
          </div>
          <span className="font-700 text-text-main text-sm">Shillong Water</span>
        </div>
        <Link href="/login" className="text-xs font-medium text-primary hover:underline">Sign in</Link>
      </header>

      {/* Hero */}
      <section className="px-4 pt-6 pb-8 bg-primary text-white mx-4 rounded-card mt-2">
        <p className="text-xs font-medium uppercase tracking-wide opacity-80 mb-2">Clean · Reliable · On-time</p>
        <h1 className="text-2xl font-700 leading-snug mb-3">
          Water delivered<br />to your door,<br />on your schedule.
        </h1>
        <p className="text-sm opacity-80 mb-5">
          The most reliable water supply service in Shillong. Quality tested, timely delivered.
        </p>
        <Link href="/order" className="inline-block bg-white text-primary text-sm font-medium px-5 py-2.5 rounded-btn transition-colors hover:bg-blue-50">
          Order Now
        </Link>
      </section>

      {/* Service pills */}
      <section className="px-4 mt-5 flex gap-3 overflow-x-auto pb-1 scrollbar-none">
        {SERVICES.map((s) => (
          <div key={s.title} className="flex-shrink-0 card flex flex-col gap-0.5 min-w-[110px]">
            <p className="text-xs font-medium text-text-main">{s.title}</p>
            <p className="text-[11px] text-text-muted">{s.desc}</p>
          </div>
        ))}
      </section>

      {/* Our Services */}
      <section className="px-4 mt-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-700 text-text-main">Our Services</h2>
          <Link href="/order" className="text-xs text-primary font-medium hover:underline">View All</Link>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            { name: 'Standard 20L Jar',   price: '₹60',      desc: 'Multi-stage purified water with essential minerals.' },
            { name: 'Tanker Supply',       price: 'From ₹800', desc: '1000L–5000L high-capacity solution for residential areas.', href: '/order/tanker' },
          ].map((item) => (
            <Link key={item.name} href={item.href ?? '/order'} className="card hover:shadow-sm transition-shadow block">
              <div className="h-20 bg-bg-card rounded mb-2 flex items-center justify-center">
                <svg width="32" height="32" fill="none" viewBox="0 0 24 24" stroke="#1d4ed8" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 2C8 8 5 12 5 15a7 7 0 0014 0c0-3-3-7-7-13z" />
                </svg>
              </div>
              <p className="text-xs font-medium text-text-main">{item.name}</p>
              <p className="text-[11px] text-text-muted mt-0.5 mb-2">{item.desc}</p>
              <p className="text-xs font-700 text-primary">{item.price}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Localities */}
      <section className="px-4 mt-6 mb-4">
        <h2 className="text-sm font-700 text-text-main mb-3">Serving Your Locality</h2>
        <div className="flex flex-wrap gap-2">
          {LOCALITIES.map((loc) => (
            <span key={loc} className="text-xs border border-border-default rounded-full px-3 py-1 text-text-muted">
              {loc}
            </span>
          ))}
          <span className="text-xs border border-border-default rounded-full px-3 py-1 text-primary font-medium">
            More soon…
          </span>
        </div>
      </section>
    </main>
  );
}
