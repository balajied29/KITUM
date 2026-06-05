import Link from 'next/link';

/**
 * Short inline consent line that links to the relevant policies, shown next to
 * order-placement and sign-in actions so users accept the policies in context.
 * Surfacing this at the point of action is expected by app-store reviewers and
 * payment-gateway onboarding.
 *
 *  variant="order" → Terms, Privacy, Refund & Shipping policies
 *  variant="auth"  → Terms & Privacy only
 */
export default function LegalConsent({ action = 'continuing', variant = 'order', className = '' }) {
  return (
    <p className={`text-[11px] leading-relaxed text-text-muted ${className}`}>
      By {action}, you agree to our{' '}
      <Link href="/legal/terms" className="text-primary font-medium hover:underline">Terms &amp; Conditions</Link>{' '}
      and{' '}
      <Link href="/legal/privacy" className="text-primary font-medium hover:underline">Privacy Policy</Link>
      {variant === 'order' && (
        <>
          , including our{' '}
          <Link href="/legal/refunds" className="text-primary font-medium hover:underline">Refund &amp; Cancellation</Link>{' '}
          and{' '}
          <Link href="/legal/shipping" className="text-primary font-medium hover:underline">Shipping &amp; Delivery</Link>{' '}
          policies
        </>
      )}
      .
    </p>
  );
}
