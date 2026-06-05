import BackHeader from '@/components/BackHeader';
import Footer from '@/components/Footer';
import SupportTicketsPanel from '@/components/SupportTicketsPanel';
import { BUSINESS } from '@/constants/business';

export const metadata = {
  title: 'Contact Us — KitUm',
  description: 'Get in touch with the KitUm team for support, orders and grievances.',
};

const MailIcon = (p) => (
  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#0037b0" strokeWidth={1.8} {...p}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 7l9 6 9-6" />
  </svg>
);
const PhoneIcon = (p) => (
  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#0037b0" strokeWidth={1.8} {...p}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h2.5a1 1 0 01.95.68l1 3a1 1 0 01-.25 1L8 9.5a11 11 0 005.5 5.5l1.8-1.2a1 1 0 011-.25l3 1a1 1 0 01.7.95V18a2 2 0 01-2 2A14 14 0 013 6.5z" />
  </svg>
);
const ClockIcon = (p) => (
  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#0037b0" strokeWidth={1.8} {...p}>
    <circle cx="12" cy="12" r="9" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 3" />
  </svg>
);
const PinIcon = (p) => (
  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#0037b0" strokeWidth={1.8} {...p}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
    <circle cx="12" cy="11" r="3" />
  </svg>
);

export default function ContactPage() {
  const B = BUSINESS;
  const go = B.grievanceOfficer;
  const telHref = `tel:${B.phone.replace(/\s/g, '')}`;

  return (
    <main className="bg-bg-page min-h-dvh">
      <BackHeader title="Contact Us" />

      <div className="px-4 pt-6">
        <h1 className="font-display font-extrabold text-[26px] leading-tight tracking-[-0.5px] text-text-main">
          We&apos;re here to help
        </h1>
        <p className="text-sm text-text-body mt-2 leading-relaxed">
          Questions about an order, a refund, or your account? Raise a request below — it’s
          tracked end to end and we reply right here.
        </p>

        {/* Ticket-based support: templated topics + your open requests */}
        <SupportTicketsPanel />

        {/* Other ways to reach us */}
        <p className="text-xs font-700 text-text-muted uppercase tracking-wide mt-8 mb-2">Other ways to reach us</p>

        {/* Quick contact cards */}
        <div className="flex flex-col gap-3 mt-6">
          <a href={`mailto:${B.supportEmail}`} className="card flex items-center gap-3.5 hover:shadow-sm transition-shadow">
            <span className="w-11 h-11 rounded-full bg-bg-trust flex items-center justify-center shrink-0"><MailIcon /></span>
            <div className="min-w-0">
              <p className="text-xs text-text-muted">Email us</p>
              <p className="text-sm font-700 text-text-main truncate">{B.supportEmail}</p>
            </div>
          </a>

          <a href={telHref} className="card flex items-center gap-3.5 hover:shadow-sm transition-shadow">
            <span className="w-11 h-11 rounded-full bg-bg-trust flex items-center justify-center shrink-0"><PhoneIcon /></span>
            <div className="min-w-0">
              <p className="text-xs text-text-muted">Call us</p>
              <p className="text-sm font-700 text-text-main truncate">{B.phone}</p>
            </div>
          </a>

          <div className="card flex items-center gap-3.5">
            <span className="w-11 h-11 rounded-full bg-bg-trust flex items-center justify-center shrink-0"><ClockIcon /></span>
            <div className="min-w-0">
              <p className="text-xs text-text-muted">Support hours</p>
              <p className="text-sm font-700 text-text-main">{B.hours}</p>
            </div>
          </div>

          <div className="card flex items-start gap-3.5">
            <span className="w-11 h-11 rounded-full bg-bg-trust flex items-center justify-center shrink-0"><PinIcon /></span>
            <div className="min-w-0">
              <p className="text-xs text-text-muted">Service area</p>
              <p className="text-sm font-700 text-text-main">{B.operatingCity}, {B.operatingState}, {B.country}</p>
            </div>
          </div>
        </div>

        {/* Business details — transparency for customers, app stores & payment gateways */}
        <section className="card mt-5">
          <h2 className="text-xs font-700 uppercase tracking-wide text-text-muted mb-3">Business details</h2>
          <dl className="flex flex-col gap-2.5 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-text-muted shrink-0">Legal name</dt>
              <dd className="text-text-main font-medium text-right">{B.legalName}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-text-muted shrink-0">Registered address</dt>
              <dd className="text-text-main font-medium text-right">{B.registeredAddress}</dd>
            </div>
            {B.gstin && (
              <div className="flex justify-between gap-4">
                <dt className="text-text-muted shrink-0">GSTIN</dt>
                <dd className="text-text-main font-medium text-right">{B.gstin}</dd>
              </div>
            )}
          </dl>
        </section>

        {/* Grievance officer — mandatory under E-Commerce Rules & DPDP Act */}
        <section className="card mt-4">
          <h2 className="text-xs font-700 uppercase tracking-wide text-text-muted mb-3">Grievance Officer</h2>
          <p className="text-sm text-text-main font-700">{go.name}</p>
          <p className="text-xs text-text-muted mb-2">{go.designation}, {B.legalName}</p>
          <div className="flex flex-col gap-1 text-sm">
            <p className="text-text-body">{go.address}</p>
            <a href={`mailto:${go.email}`} className="text-primary font-medium hover:underline">{go.email}</a>
            <p className="text-text-body">{go.phone}</p>
          </div>
          <p className="text-xs text-text-muted mt-3 leading-relaxed">
            We acknowledge complaints within 48 hours and aim to resolve them within one
            month, in line with applicable Indian law.
          </p>
        </section>

        <p className="text-xs text-text-muted text-center mt-6 leading-relaxed">
          See also our <a href="/legal/terms" className="text-primary font-medium">Terms</a>,{' '}
          <a href="/legal/privacy" className="text-primary font-medium">Privacy Policy</a>,{' '}
          <a href="/legal/refunds" className="text-primary font-medium">Refunds</a> and{' '}
          <a href="/legal/shipping" className="text-primary font-medium">Delivery</a> policies.
        </p>
      </div>

      <Footer />
    </main>
  );
}
