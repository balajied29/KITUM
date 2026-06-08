/**
 * KitUm Partner — download landing.
 * Web port of the partner app's LandingScreen (flat, type-led cobalt design):
 * solid brand cobalt, a corner water-ripple motif, the ownership headline, three
 * glanceable benefits, and a single CTA that downloads the Android APK.
 */
import Link from 'next/link';

export const metadata = {
  title: 'KitUm Partner — Drive. Earn. Your way.',
  description: 'Become a KitUm water-tanker partner. Go online when you want, get pinged for nearby requests, and earn on your own terms. Download the Android app.',
};

const APK_HREF = '/kitum-partner.apk';

/* ── benefit + CTA icons (white stroke, matching the app's line set) ── */
const IconPower = ({ className = 'w-[22px] h-[22px]' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.2} strokeLinecap="round">
    <path d="M12 3v9" /><path d="M6.5 7a8 8 0 1 0 11 0" />
  </svg>
);
const IconRupee = ({ className = 'w-[22px] h-[22px]' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M7 5h10" /><path d="M7 9h10" /><path d="M7 5c5 0 6 8 0 8h1l6 6" />
  </svg>
);
const IconPin = ({ className = 'w-[22px] h-[22px]' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 10c0 5.5-8 12-8 12s-8-6.5-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="2.6" />
  </svg>
);
const DownloadIcon = ({ className = 'w-5 h-5' }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 4v11" /><path d="M7.5 10.5 12 15l4.5-4.5" /><path d="M5 19h14" />
  </svg>
);

const BENEFITS = [
  { Icon: IconPower, label: 'Be your own boss' },
  { Icon: IconRupee, label: 'Clear, upfront fares' },
  { Icon: IconPin, label: 'Jobs close to you' },
];

export default function PartnerLandingPage() {
  return (
    <main className="relative min-h-dvh overflow-hidden bg-primary text-white">
      {/* Water motif — concentric ripples radiating from the corner "drop point" */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <span className="absolute rounded-full bg-[#00298A]" style={{ width: 300, height: 300, top: -96, right: -90 }} />
        <span className="absolute rounded-full border-[1.5px] border-white/[0.20]" style={{ width: 330, height: 330, top: -111, right: -105 }} />
        <span className="absolute rounded-full border-[1.5px] border-white/[0.12]" style={{ width: 412, height: 412, top: -152, right: -146 }} />
        <span className="absolute rounded-full border-[1.5px] border-white/[0.07]" style={{ width: 504, height: 504, top: -198, right: -192 }} />
        <span className="absolute rounded-full border-[1.5px] border-white/[0.045]" style={{ width: 612, height: 612, top: -252, right: -246 }} />
      </div>

      <div
        className="relative z-[2] mx-auto flex min-h-dvh max-w-[480px] flex-col px-7"
        style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top, 0px))', paddingBottom: 'calc(2rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <p className="mt-2 font-display text-[19px] font-extrabold tracking-[-0.4px]">
          KitUm<span className="font-semibold text-white/55"> Partner</span>
        </p>

        <div className="flex-1" />

        {/* Ownership headline — "Your" lighter, the nouns heavy, "Money." in a pill */}
        <div className="mb-7">
          <p className="font-display text-[40px] font-extrabold leading-[46px] tracking-[-1.4px]">
            <span className="font-medium text-white/[0.78]">Your </span>Tanker.
          </p>
          <p className="font-display text-[40px] font-extrabold leading-[46px] tracking-[-1.4px]">
            <span className="font-medium text-white/[0.78]">Your </span>Schedule.
          </p>
          <p className="font-display text-[40px] font-extrabold leading-[46px] tracking-[-1.4px]">
            <span className="font-medium text-white/[0.78]">Your </span>
            <span className="rounded-[7px] bg-[#EAF0FF] px-[9px] py-[1px] text-primary">Money.</span>
          </p>
        </div>

        <p className="mb-9 max-w-[312px] text-[15px] font-medium leading-6 text-[#EAF0FF]/80">
          Go online when you want, get pinged for nearby water requests, and start earning on your own terms.
        </p>

        <div className="mb-11 flex flex-col gap-[18px]">
          {BENEFITS.map(({ Icon, label }) => (
            <div key={label} className="flex items-center gap-[13px]">
              <span className="flex h-6 w-6 items-center justify-center"><Icon /></span>
              <span className="text-[15px] font-semibold tracking-[-0.2px]">{label}</span>
            </div>
          ))}
        </div>

        <a
          href={APK_HREF}
          download="KitUm-Partner.apk"
          className="flex h-[60px] w-full items-center justify-center gap-2.5 rounded-2xl bg-white text-[17px] font-extrabold tracking-[-0.2px] text-primary shadow-lg transition-transform active:scale-[0.97]"
        >
          <DownloadIcon className="w-5 h-5" />
          Download the App
        </a>

        <p className="mt-4 text-center text-[12.5px] font-medium leading-snug text-white/65">
          For Android. After downloading, open the file and allow installs if your browser asks.
        </p>

        <p className="mt-3 text-center text-[13px] font-medium text-white/70">
          Looking to order water?{' '}
          <Link href="/" className="font-bold text-white">Go to KitUm</Link>
        </p>
      </div>
    </main>
  );
}
