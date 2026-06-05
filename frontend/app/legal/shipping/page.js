import LegalLayout from '@/components/LegalLayout';
import { BUSINESS } from '@/constants/business';
import { PLATFORM_FEE_PCT } from '@/lib/pricing';

export const metadata = {
  title: 'Shipping & Delivery Policy — KitUm',
  description: 'KitUm delivery areas, timelines, slots and charges for water delivery in Shillong.',
};

export default function ShippingPage() {
  const B = BUSINESS;
  const FEE_PCT = Math.round(PLATFORM_FEE_PCT * 100);

  return (
    <LegalLayout
      title="Shipping & Delivery Policy"
      intro={`This Shipping & Delivery Policy explains how ${B.brand} delivers water — including service areas, delivery options, timelines and charges. As ${B.brand} delivers a physical product (water) locally, “shipping” here means local delivery by road.`}
    >
      <h2>1. Service area</h2>
      <p>
        {B.brand} currently delivers within {B.operatingCity} and surrounding serviceable
        areas in {B.operatingState}, {B.country}. Availability depends on your exact
        location and on Delivery Partner coverage. If your delivery address falls outside our
        serviceable area, you will be informed during ordering and, if you have already paid,
        refunded in accordance with our <a href="/legal/refunds">Refund &amp; Cancellation Policy</a>.
      </p>

      <h2>2. Delivery options</h2>
      <ul>
        <li><strong>Instant (on-demand) delivery</strong> — we dispatch the nearest available tanker to you, with live tracking, as soon as possible after your order is confirmed.</li>
        <li><strong>Scheduled (slot-based) delivery</strong> — you choose a delivery slot (typically a 2-hour window), and we deliver within that slot.</li>
      </ul>

      <h2>3. Delivery timelines</h2>
      <p>
        Estimated delivery and arrival times shown in the app are <strong>indicative</strong>.
        For instant orders, the time to reach you depends on Delivery Partner availability,
        distance and traffic. For scheduled orders, we aim to deliver within your chosen slot.
      </p>
      <p>Delivery may be delayed by factors beyond our control, including:</p>
      <ul>
        <li>Traffic, road conditions, weather or natural events;</li>
        <li>Water-source or refilling availability and demand surges;</li>
        <li>Incorrect or incomplete address/contact details;</li>
        <li>Restricted, unsafe or inaccessible delivery locations; or</li>
        <li>Other operational or force-majeure events.</li>
      </ul>
      <p>If we expect a significant delay, we will try to notify you and, where appropriate, offer rescheduling or a refund.</p>

      <h2>4. Charges &amp; payment</h2>
      <p>
        Any applicable delivery charge is calculated based on factors such as distance,
        tanker size and demand. A <strong>Platform Fee of {FEE_PCT}%</strong> of the order
        value is also added to every order. All charges are shown to you transparently as a
        breakdown <strong>before</strong> you confirm and pay; the total shown at checkout is
        inclusive of all applicable charges and taxes unless stated otherwise.
      </p>
      <p>
        {B.brand} does not charge you at booking — you pay <strong>on delivery</strong> by your
        chosen method: in cash to the Delivery Partner, or by UPI in the app when your tanker
        arrives.
      </p>

      <h2>5. Receiving your delivery</h2>
      <p>To help us deliver smoothly, please ensure that:</p>
      <ul>
        <li>Your delivery address, contact name and phone number are accurate and complete;</li>
        <li>You (or someone authorised by you) are available to receive the delivery and to direct the tanker to the storage point/tank;</li>
        <li>The delivery vehicle has safe, lawful and reasonable access to the delivery location; and</li>
        <li>Your payment is ready at the time of delivery — exact cash, or your UPI app for online payment.</li>
      </ul>

      <h2>6. Failed or missed deliveries</h2>
      <p>
        If we cannot complete a delivery because the recipient is unavailable, the location is
        inaccessible, contact details are incorrect, or a Cash on Delivery amount is not paid,
        the order may be marked as a failed delivery. How refunds are handled in such cases is
        described in our <a href="/legal/refunds">Refund &amp; Cancellation Policy</a>. We may
        attempt to contact you to reschedule where possible.
      </p>

      <h2>7. Order tracking &amp; confirmation</h2>
      <p>
        You can track the status of your order in the app, and for instant deliveries you can
        view live tracking once a Delivery Partner is assigned. We also send order updates via
        email, SMS, WhatsApp and/or push notification.
      </p>

      <h2>8. Contact</h2>
      <p>
        For any delivery-related question or issue, contact us at{' '}
        <a href={`mailto:${B.supportEmail}`}>{B.supportEmail}</a> or {B.phone} ({B.hours}),
        or see our <a href="/contact">Contact Us</a> page.
      </p>
    </LegalLayout>
  );
}
