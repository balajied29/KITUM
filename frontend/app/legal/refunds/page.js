import LegalLayout from '@/components/LegalLayout';
import { BUSINESS } from '@/constants/business';
import { PLATFORM_FEE_PCT } from '@/lib/pricing';

export const metadata = {
  title: 'Refund & Cancellation Policy — KitUm',
  description: 'When you can cancel a KitUm order and how refunds are processed.',
};

export default function RefundsPage() {
  const B = BUSINESS;
  const FEE_PCT = Math.round(PLATFORM_FEE_PCT * 100);

  return (
    <LegalLayout
      title="Refund & Cancellation Policy"
      intro={`This policy explains when you can cancel an order on ${B.brand}, when you are entitled to a refund, and how refunds are processed. It forms part of our Terms & Conditions.`}
    >
      <h2>1. What you pay, and when</h2>
      <p>
        {B.brand} does not charge you at the time of booking. You choose how you’d like
        to pay — <strong>Cash</strong> or <strong>UPI</strong> — and you pay only on
        delivery: in cash to the Delivery Partner, or by UPI in the app when your tanker
        arrives. Every order includes a <strong>Platform Fee of {FEE_PCT}%</strong> of the
        order value, shown in your bill before you confirm and included in the total you pay
        on delivery.
      </p>

      <h2>2. Cancellation by you</h2>
      <ul>
        <li>You can cancel <strong>free of charge</strong> — there is nothing to refund, because nothing is charged until delivery.</li>
        <li>Because we don’t take any money upfront, we rely on good-faith use. Repeatedly cancelling after a Delivery Partner has been assigned, or not being available to receive deliveries you booked, may lead to your account being <strong>temporarily restricted from booking</strong>.</li>
        <li>If you paid by UPI in the app and then the delivery does not complete for a reason on our side, that payment is refunded in full (see Section 5).</li>
      </ul>
      <p>
        To cancel, use the order screen in the app where available, or contact us at{' '}
        <a href={`mailto:${B.supportEmail}`}>{B.supportEmail}</a> / {B.phone} as soon as possible.
      </p>

      <h2>3. Cancellation by us</h2>
      <p>We may cancel an order — and will refund any amount you have already paid online in full — if:</p>
      <ul>
        <li>No Delivery Partner is available to fulfil your order;</li>
        <li>Your delivery location is outside our serviceable area or cannot be safely reached;</li>
        <li>The product or slot is unavailable, or there was a pricing or listing error;</li>
        <li>We are unable to complete the delivery for reasons attributable to us; or</li>
        <li>The order is suspected to be fraudulent or in breach of our Terms.</li>
      </ul>

      <h2>4. When you are entitled to a refund</h2>
      <p>Because payment is collected on delivery, there is usually nothing to refund on a cancelled order. A refund is due where:</p>
      <ul>
        <li>You paid online (UPI) but the delivery was not completed;</li>
        <li>We cancelled the order after you had paid (Section 3);</li>
        <li>You were charged more than once, or charged an incorrect amount; or</li>
        <li>The water delivered was materially short in quantity or unfit for use, reported to us promptly with reasonable evidence (such as photos) and verified by us.</li>
      </ul>
      <p>
        Because water is a consumable product delivered in bulk, we are generally unable to
        offer returns once a delivery has been accepted and completed, except in the cases above.
      </p>

      <h2>5. How refunds are processed</h2>
      <ul>
        <li><strong>UPI / online payments</strong> are refunded to the original payment method via our payment gateway, {B.paymentGateway} (“Razorpay”).</li>
        <li><strong>Cash on delivery</strong> involves no online payment, so there is normally nothing to refund — if a delivery doesn’t happen, no cash is collected. Where a cash refund is genuinely due (for example an overcharge), we’ll refund it to a UPI ID or bank account you provide.</li>
      </ul>

      <h3>Refund timelines</h3>
      <table>
        <thead>
          <tr><th>Stage</th><th>Typical time</th></tr>
        </thead>
        <tbody>
          <tr><td>We approve and initiate the refund</td><td>Within 2–3 business days of approval</td></tr>
          <tr><td>Razorpay processes the refund</td><td>As per gateway timelines</td></tr>
          <tr><td>Amount reflects in your account</td><td>Usually 5–7 business days, depending on your bank/payment provider</td></tr>
        </tbody>
      </table>
      <p>
        Timelines are indicative. Banks, card networks and UPI providers may take additional
        time, which is outside our control. We will share a refund reference where available.
      </p>

      <h2>6. How to request a refund</h2>
      <p>To raise a refund or cancellation request, contact us with your order details:</p>
      <p>
        Email: <a href={`mailto:${B.supportEmail}`}>{B.supportEmail}</a><br />
        Phone: {B.phone}<br />
        Hours: {B.hours}
      </p>
      <p>
        Please reach out as soon as possible — and within <strong>48 hours</strong> of the
        delivery for any quality or quantity concern — so we can investigate effectively. We
        acknowledge requests within 48 hours and aim to resolve them within one month, in
        line with applicable law.
      </p>

      <h2>7. Grievances</h2>
      <p>
        If you are not satisfied with how a refund or cancellation was handled, you may
        escalate to our Grievance Officer, whose details are published in our{' '}
        <a href="/legal/privacy">Privacy Policy</a> and on the{' '}
        <a href="/contact">Contact Us</a> page.
      </p>
    </LegalLayout>
  );
}
