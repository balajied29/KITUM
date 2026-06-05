import LegalLayout from '@/components/LegalLayout';
import { BUSINESS } from '@/constants/business';
import { PLATFORM_FEE_PCT } from '@/lib/pricing';

export const metadata = {
  title: 'Terms & Conditions — KitUm',
  description: 'The terms governing your use of the KitUm water-delivery platform.',
};

export default function TermsPage() {
  const B = BUSINESS;
  const FEE_PCT = Math.round(PLATFORM_FEE_PCT * 100);

  return (
    <LegalLayout
      title="Terms & Conditions"
      intro={`These Terms & Conditions (“Terms”) govern your access to and use of the ${B.brand} mobile application and website (the “Platform”), operated by ${B.legalName} (“${B.brand}”, “we”, “us” or “our”). Please read them carefully before using the Platform.`}
    >
      <p>
        By creating an account, placing an order, or otherwise using the Platform, you
        agree to be bound by these Terms, our{' '}
        <a href="/legal/privacy">Privacy Policy</a>,{' '}
        <a href="/legal/refunds">Refund &amp; Cancellation Policy</a> and{' '}
        <a href="/legal/shipping">Shipping &amp; Delivery Policy</a>, which are incorporated
        here by reference. If you do not agree, please do not use the Platform.
      </p>

      <h2>1. About our service</h2>
      <p>
        {B.brand} is a technology platform that lets customers in {B.operatingCity},{' '}
        {B.operatingState} order water delivery — including water tankers, jars and
        bottles — for instant (on-demand) or scheduled (slot-based) delivery. Deliveries
        are fulfilled by {B.brand} and/or independent tanker operators and drivers
        (“Delivery Partners”) listed on the Platform. Delivery Partners operate independently
        and, for each order they complete, receive the delivery fare less a platform
        commission of {FEE_PCT}% retained by {B.brand} for use of the Platform and its
        services. The specific commercial terms applicable to Delivery Partners are set out in
        the partner app and the agreement they accept when they join.
      </p>

      <h2>2. Eligibility</h2>
      <p>
        You must be at least 18 years old and capable of entering into a legally binding
        contract under the Indian Contract Act, 1872 to use the Platform. By using it, you
        represent that you meet these requirements and that the information you provide is
        accurate and complete.
      </p>

      <h2>3. Your account</h2>
      <ul>
        <li>You are responsible for maintaining the confidentiality of your account credentials and for all activity under your account.</li>
        <li>You agree to provide accurate, current and complete information and to keep it updated.</li>
        <li>Notify us immediately of any unauthorised use of your account.</li>
        <li>We may suspend or terminate accounts that violate these Terms or that we reasonably believe are involved in fraud, abuse or unlawful activity.</li>
      </ul>

      <h2>4. Orders</h2>
      <ul>
        <li>Placing an order is an offer to purchase. An order is confirmed only when we accept it and (for prepaid orders) payment is successfully received.</li>
        <li>We may refuse or cancel an order — for example, if a product or delivery slot is unavailable, the delivery location is outside our service area, the order appears fraudulent, or there is an error in price or product information. If you have already paid, we will refund you in accordance with our <a href="/legal/refunds">Refund &amp; Cancellation Policy</a>.</li>
        <li>Product images and descriptions are indicative. Water quantities (e.g. tanker litres) are nominal and may vary slightly within normal operational tolerances.</li>
      </ul>

      <h2>5. Pricing &amp; taxes</h2>
      <ul>
        <li>Prices are shown in Indian Rupees ({B.currencySymbol}) and are inclusive of applicable taxes unless stated otherwise.</li>
        <li>A <strong>Platform Fee of {FEE_PCT}%</strong> of the order value is added to every order. It is shown as a separate line in your bill before you confirm and forms part of the total payable.</li>
        <li>The total payable — including the Platform Fee and any delivery charge — is shown to you before you confirm your order.</li>
        <li>We may change prices and fees at any time, but changes will not affect orders that have already been confirmed.</li>
      </ul>

      <h2>6. Payments</h2>
      <p>
        You can pay {B.paymentMethods}. Online payments are processed securely by our
        payment gateway, {B.paymentGateway} (“Razorpay”). By choosing online payment, you
        agree to Razorpay’s terms. We are not responsible for failures, delays or errors
        caused by the payment gateway, your bank, or your payment instrument. {B.brand} does
        not charge you at booking — you pay <strong>on delivery</strong> by your chosen method:
        in cash to the Delivery Partner, or by UPI in the app when your order arrives.
        Repeated cancellations or missed deliveries may lead to a temporary booking
        restriction, as described in our{' '}
        <a href="/legal/refunds">Refund &amp; Cancellation Policy</a>.
      </p>

      <h2>7. Delivery</h2>
      <p>
        Delivery timelines, service areas, slots and charges are described in our{' '}
        <a href="/legal/shipping">Shipping &amp; Delivery Policy</a>. Estimated times are
        indicative and may be affected by traffic, weather, water availability, demand and
        other factors beyond our control. You agree to provide accurate delivery details and
        safe, lawful access for the delivery vehicle, and to be available (or have someone
        available) to receive the delivery.
      </p>

      <h2>8. Cancellations &amp; refunds</h2>
      <p>
        Cancellations and refunds are governed by our{' '}
        <a href="/legal/refunds">Refund &amp; Cancellation Policy</a>.
      </p>

      <h2>9. Your responsibilities &amp; acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Use the Platform for any unlawful, fraudulent or abusive purpose.</li>
        <li>Provide false information, impersonate others, or place fake or speculative orders.</li>
        <li>Harass, threaten or harm our staff or Delivery Partners.</li>
        <li>Interfere with, disrupt, reverse-engineer or attempt to gain unauthorised access to the Platform or its systems.</li>
        <li>Infringe our or any third party’s intellectual property or other rights.</li>
      </ul>

      <h2>10. Intellectual property</h2>
      <p>
        The Platform and all content on it — including the {B.brand} name, logo, design,
        text, graphics and software — are owned by or licensed to {B.legalName} and are
        protected by applicable intellectual-property laws. You are granted a limited,
        non-exclusive, non-transferable, revocable licence to use the Platform for its
        intended purpose. You may not copy, modify, distribute or create derivative works
        without our prior written permission.
      </p>

      <h2>11. Third-party services</h2>
      <p>
        The Platform relies on third-party services (such as the payment gateway, mapping,
        and messaging providers) and may contain links to third-party sites. We are not
        responsible for the content, policies or practices of those third parties, and your
        use of them is at your own risk and subject to their terms.
      </p>

      <h2>12. Disclaimers</h2>
      <p>
        The Platform and services are provided on an “as is” and “as available” basis. To
        the maximum extent permitted by law, we disclaim all warranties, express or implied,
        including merchantability, fitness for a particular purpose and non-infringement. We
        do not warrant that the Platform will be uninterrupted, error-free or secure, or that
        delivery times will always be met.
      </p>

      <h2>13. Limitation of liability</h2>
      <p>
        To the maximum extent permitted by law, {B.legalName} shall not be liable for any
        indirect, incidental, special, consequential or punitive damages, or any loss of
        profits or data, arising out of or relating to your use of the Platform. Our total
        aggregate liability for any claim arising out of or relating to an order shall not
        exceed the amount you paid for that order. Nothing in these Terms limits liability
        that cannot be excluded under applicable law.
      </p>

      <h2>14. Indemnity</h2>
      <p>
        You agree to indemnify and hold harmless {B.legalName}, its officers, employees and
        Delivery Partners from any claims, losses, liabilities and expenses (including
        reasonable legal fees) arising out of your breach of these Terms or your misuse of
        the Platform.
      </p>

      <h2>15. Suspension &amp; termination</h2>
      <p>
        We may suspend or terminate your access to the Platform at any time if you breach
        these Terms or for operational, legal or security reasons. You may stop using the
        Platform and request closure of your account at any time. Provisions that by their
        nature should survive termination will continue to apply.
      </p>

      <h2>16. Changes to these Terms</h2>
      <p>
        We may update these Terms from time to time. The updated version will be posted here
        with a revised “Last updated” date. Your continued use of the Platform after changes
        take effect means you accept the revised Terms.
      </p>

      <h2>17. Governing law &amp; jurisdiction</h2>
      <p>
        These Terms are governed by and construed in accordance with the laws of India.
        Subject to any applicable consumer-protection law, the courts at{' '}
        {B.jurisdictionCity}, {B.operatingState} shall have exclusive jurisdiction over any
        dispute arising out of or relating to these Terms or the Platform.
      </p>

      <h2>18. Grievance redressal &amp; contact</h2>
      <p>
        For any questions, complaints or grievances regarding these Terms or the Platform,
        please contact our Grievance Officer, whose details are published in our{' '}
        <a href="/legal/privacy">Privacy Policy</a> and on our{' '}
        <a href="/contact">Contact Us</a> page. You can also email us at{' '}
        <a href={`mailto:${B.supportEmail}`}>{B.supportEmail}</a> or call {B.phone}.
        We acknowledge complaints within 48 hours and aim to resolve them within one month.
      </p>
    </LegalLayout>
  );
}
