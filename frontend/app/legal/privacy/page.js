import LegalLayout from '@/components/LegalLayout';
import { BUSINESS } from '@/constants/business';

export const metadata = {
  title: 'Privacy Policy — KitUm',
  description: 'How KitUm collects, uses, shares and protects your personal data, in line with India\'s DPDP Act 2023, the DPDP Rules 2025 and the IT Act 2000.',
};

export default function PrivacyPolicyPage() {
  const B = BUSINESS;
  const go = B.grievanceOfficer;

  return (
    <LegalLayout
      title="Privacy Policy"
      intro={`This Privacy Policy explains how ${B.legalName} (“${B.brand}”, “we”, “us” or “our”) collects, uses, discloses, retains and protects your personal data when you use the ${B.brand} mobile application and website (together, the “Platform”) to order water delivery in ${B.operatingCity}, ${B.operatingState}.`}
    >
      <p>
        We are committed to protecting your privacy and handling your personal data
        responsibly and in accordance with applicable Indian law, including the{' '}
        <strong>Digital Personal Data Protection Act, 2023 (“DPDP Act”)</strong> and the{' '}
        <strong>Digital Personal Data Protection Rules, 2025 (“DPDP Rules”)</strong>, the{' '}
        <strong>Information Technology Act, 2000</strong> and the{' '}
        <strong>Information Technology (Reasonable Security Practices and Procedures and
        Sensitive Personal Data or Information) Rules, 2011 (“SPDI Rules”)</strong>.
        For the purposes of the DPDP Act, {B.legalName} is the{' '}
        <strong>Data Fiduciary</strong> that determines how and why your personal data
        is processed.
      </p>
      <p>
        By creating an account, placing an order, or otherwise using the Platform, you
        confirm that you have read and understood this Policy. Where we rely on your
        consent, we will ask for it clearly and you may withdraw it at any time (see
        “Your rights” below).
      </p>

      <h2>1. Information we collect</h2>
      <p>We collect only the data we need to deliver water to your door and run our service:</p>

      <h3>a) Information you give us</h3>
      <ul>
        <li><strong>Account details</strong> — your name, email address, phone number, password (stored only in encrypted/hashed form) and your selected locality.</li>
        <li><strong>Delivery details</strong> — delivery addresses, building/flat number, landmarks, directions for the driver, and the contact name and phone number for a delivery.</li>
        <li><strong>Order &amp; transaction details</strong> — the products you order, quantity, delivery slot, order amount, payment method (UPI/card/Cash on Delivery) and order history.</li>
        <li><strong>Communications</strong> — messages, ratings, feedback and support requests you send us.</li>
      </ul>

      <h3>b) Information we collect automatically</h3>
      <ul>
        <li><strong>Location data</strong> — with your permission, your device’s precise GPS location to set your delivery point, find the nearest available tanker, and show you live delivery tracking. You can turn location access off in your device settings; some features may then stop working.</li>
        <li><strong>Device &amp; usage data</strong> — device type, operating system, app version, IP address, and basic diagnostic/log data used to keep the service secure and reliable.</li>
        <li><strong>Cookies &amp; local storage</strong> — small files used to keep you signed in and remember preferences (see Section 7).</li>
      </ul>

      <h3>c) Sensitive personal data</h3>
      <p>
        Under the SPDI Rules, your password and payment information are treated as
        sensitive personal data. We do <strong>not</strong> collect or store your full
        card number, CVV, UPI PIN or bank credentials — these are entered directly with
        our payment gateway (see Section 4).
      </p>

      <h2>2. How we use your information</h2>
      <p>We use your personal data for the following purposes:</p>
      <ul>
        <li>To create and manage your account and authenticate you.</li>
        <li>To process, fulfil and deliver your orders, and to assign and route the right tanker/driver.</li>
        <li>To enable live order tracking and to share necessary delivery details with the assigned delivery partner.</li>
        <li>To take and confirm payments, issue receipts, and process refunds.</li>
        <li>To send you transactional updates about your order (via email, SMS, WhatsApp or push notification).</li>
        <li>To provide customer support and resolve disputes or complaints.</li>
        <li>To improve, secure and troubleshoot the Platform, and prevent fraud or misuse.</li>
        <li>To comply with legal obligations and enforce our Terms &amp; Conditions.</li>
      </ul>
      <p>
        We process your data on the basis of your <strong>consent</strong> and, where
        applicable, for the performance of the service you request, to comply with law,
        and for our certain legitimate uses as permitted under the DPDP Act.
      </p>

      <h2>3. Who we share your information with</h2>
      <p>We do not sell your personal data. We share it only as needed to run the service:</p>
      <ul>
        <li><strong>Delivery partners (tanker operators/drivers)</strong> — the delivery address, location, contact name and phone number, and order details required to complete your delivery.</li>
        <li><strong>Payment gateway</strong> — {B.paymentGateway} (“Razorpay”), to securely process online payments. Your payment is handled on Razorpay’s PCI-DSS-compliant systems under Razorpay’s own privacy policy.</li>
        <li><strong>Service providers</strong> — vendors who help us operate the Platform, such as cloud hosting, mapping &amp; geocoding, email, SMS and WhatsApp messaging, and analytics. They may process data only on our instructions and for these purposes.</li>
        <li><strong>Legal &amp; safety</strong> — government authorities, regulators or law-enforcement where required by law, to enforce our terms, or to protect the rights, safety and property of our users, the public or {B.brand}.</li>
        <li><strong>Business transfers</strong> — if our business is merged, acquired or reorganised, your data may be transferred as part of that transaction, subject to this Policy.</li>
      </ul>

      <h2>4. Payments</h2>
      <p>
        Online payments are processed by <strong>{B.paymentGateway}</strong>. When you
        pay online, you are redirected to Razorpay’s secure checkout and your card/UPI/bank
        credentials are collected and processed by Razorpay, not by us. We receive only a
        payment confirmation and a transaction reference (such as a Razorpay order and
        payment ID) so we can mark your order as paid and process any refund. We never store
        your full card number, CVV or UPI PIN. Please review{' '}
        <a href="https://razorpay.com/privacy/" target="_blank" rel="noopener noreferrer">Razorpay’s Privacy Policy</a>{' '}
        for how they handle your payment data.
      </p>

      <h2>5. Location information</h2>
      <p>
        {B.brand} is a location-based delivery service, so location data is central to how
        it works. We use your location to detect your delivery area, find the nearest
        available tanker, calculate distance and estimated time of arrival, and show live
        tracking of your delivery. We collect precise location only with your permission
        and only when relevant to a delivery. You can disable location access at any time
        through your device or browser settings.
      </p>

      <h2>6. Data retention</h2>
      <p>
        We keep your personal data only for as long as needed for the purposes set out in
        this Policy — typically while your account is active and for a reasonable period
        afterwards — and as required to comply with legal, tax, accounting and dispute-resolution
        obligations. Transaction and invoice records may be retained for the period required
        under applicable tax and commercial laws. When data is no longer required, we delete
        or anonymise it.
      </p>

      <h2>7. Cookies &amp; similar technologies</h2>
      <p>
        We use cookies and local storage to keep you signed in, remember your preferences
        (such as your selected locality), and understand how the Platform is used so we can
        improve it. You can clear or block cookies through your browser settings, but some
        features may not work properly as a result.
      </p>

      <h2>8. How we protect your data</h2>
      <p>
        We maintain reasonable security practices and procedures as required under the IT
        Act, the SPDI Rules and the DPDP Act, including:
      </p>
      <ul>
        <li><strong>Encryption in transit</strong> — all traffic is served over HTTPS/TLS.</li>
        <li><strong>Encryption at rest</strong> — sensitive identifiers such as PAN, driver’s
          licence and bank-account numbers are encrypted in our database using strong
          authenticated encryption (AES-256-GCM), so they are not readable from the underlying
          data store.</li>
        <li><strong>Hashed credentials</strong> — passwords are stored only as salted hashes
          (bcrypt) and are never recoverable; session tokens are stored hashed and rotated.</li>
        <li><strong>Private document storage</strong> — identity documents (such as a delivery
          partner’s PAN and licence images) are kept in a private store and are accessible only
          to authorised staff via short-lived, access-controlled links — never publicly.</li>
        <li><strong>Access controls</strong> — access to personal data is restricted to
          authorised personnel on a need-to-know basis.</li>
      </ul>
      <p>
        While we work hard to protect your data, no method of transmission or storage is
        completely secure, and we cannot guarantee absolute security.
      </p>

      <h2>9. Your rights</h2>
      <p>Subject to applicable law, including the DPDP Act, you have the right to:</p>
      <ul>
        <li><strong>Access</strong> — request a summary of the personal data we hold about you and how we process it.</li>
        <li><strong>Correction &amp; updating</strong> — correct or update inaccurate or incomplete data (you can edit most details in the app).</li>
        <li><strong>Erasure</strong> — delete your account and personal data at any time directly in the app (<em>Account → “Delete my account”</em>), or by contacting us, subject to legal retention requirements.</li>
        <li><strong>Withdraw consent</strong> — withdraw any consent you gave, at any time, with effect going forward.</li>
        <li><strong>Grievance redressal</strong> — raise a complaint about how we handle your data with our Grievance Officer (Section 12).</li>
        <li><strong>Nominate</strong> — nominate another individual to exercise your rights in the event of your death or incapacity.</li>
      </ul>
      <p>
        To exercise any of these rights, contact us at{' '}
        <a href={`mailto:${B.supportEmail}`}>{B.supportEmail}</a>. We may need to verify
        your identity before acting on your request. You also have the right to make a
        complaint to the Data Protection Board of India.
      </p>

      <h2>10. Children’s privacy</h2>
      <p>
        The Platform is intended for users aged 18 and above. We do not knowingly collect
        personal data from children without verifiable consent of a parent or legal
        guardian as required under the DPDP Act. If you believe a child has provided us
        personal data, please contact us so we can take appropriate action.
      </p>

      <h2>11. Changes to this Policy</h2>
      <p>
        We may update this Privacy Policy from time to time. We will post the updated
        version here with a revised “Last updated” date and, where appropriate, notify you
        in the app. Your continued use of the Platform after an update means you accept the
        revised Policy.
      </p>

      <h2>12. Grievance Officer &amp; contact</h2>
      <p>
        In accordance with the Information Technology Act, 2000, the Consumer Protection
        (E-Commerce) Rules, 2020 and the DPDP Act, the contact details of our Grievance
        Officer are:
      </p>
      <p>
        <strong>{go.name}</strong> ({go.designation})<br />
        {B.legalName}<br />
        {go.address}<br />
        Email: <a href={`mailto:${go.email}`}>{go.email}</a><br />
        Phone: {go.phone}<br />
        Hours: {B.hours}
      </p>
      <p>
        We will acknowledge your complaint within 48 hours and aim to resolve it within
        one month of receipt, in line with applicable law.
      </p>
      <p>
        For general queries you can also reach us at{' '}
        <a href={`mailto:${B.supportEmail}`}>{B.supportEmail}</a> or {B.phone}.
      </p>

      <h2>13. Governing law</h2>
      <p>
        This Policy is governed by the laws of India. Any disputes are subject to the
        exclusive jurisdiction of the courts at {B.jurisdictionCity}, {B.operatingState}.
      </p>
    </LegalLayout>
  );
}
