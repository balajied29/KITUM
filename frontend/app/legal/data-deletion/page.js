import LegalLayout from '@/components/LegalLayout';
import { BUSINESS } from '@/constants/business';

export const metadata = {
  title: 'Account & Data Deletion — KitUm',
  description:
    'How to delete your KitUm account and personal data, what is removed, and what is retained under Indian law — for customers and delivery partners.',
};

export default function DataDeletionPage() {
  const B = BUSINESS;
  const go = B.grievanceOfficer;

  return (
    <LegalLayout
      title="Account & Data Deletion"
      intro={`This policy explains how you can delete your ${B.brand} account and personal data, what we remove, and what we are required to keep. It applies to both customers and delivery partners, in line with India’s Digital Personal Data Protection Act, 2023.`}
    >
      <h2>1. How to request deletion</h2>
      <p>You can delete your account and personal data in two ways:</p>
      <ul>
        <li>
          <strong>In the app (fastest):</strong> Customers — open <em>Account → “Delete my account”</em> and
          confirm. Delivery partners — open <em>Settings → “Delete account”</em> and confirm. Deletion
          begins immediately and signs you out.
        </li>
        <li>
          <strong>By email:</strong> if you can’t access the app, email{' '}
          <a href={`mailto:${B.supportEmail}`}>{B.supportEmail}</a> from your registered email address
          with the subject “Delete my account”. We may verify your identity before acting on the request.
        </li>
      </ul>

      <h2>2. What we delete</h2>
      <p>When you delete your account, we permanently remove your personal data, including:</p>
      <ul>
        <li>your name, email address, phone number and password;</li>
        <li>your saved delivery addresses and precise location data;</li>
        <li>your profile photo;</li>
        <li>
          <strong>(delivery partners)</strong> your KYC documents and numbers — PAN and driving-licence
          images and numbers — and your bank / UPI settlement details.
        </li>
      </ul>
      <p>Your login is disabled at once and the account cannot be used again.</p>

      <h2>3. What we keep, and why</h2>
      <p>
        Indian tax and commercial law requires us to retain certain transaction records (such as order
        and invoice details, amounts and dates) even after an account is deleted. We keep these in{' '}
        <strong>anonymised</strong> form — with your personal identifiers (name, contact, address and
        exact location) removed — for the period required by applicable law (typically up to 8 years for
        GST / income-tax records). We also keep the minimum needed to resolve an open dispute, prevent
        fraud, or meet a legal obligation. We do not keep your data longer than necessary for these
        purposes.
      </p>

      <h2>4. Timeline</h2>
      <ul>
        <li>
          Your account access ends and your personal data is erased or anonymised <strong>immediately</strong>{' '}
          when you confirm deletion in the app (or promptly after we verify an email request).
        </li>
        <li>
          Any residual copies in our encrypted backups are overwritten on our normal backup-rotation
          cycle (within 90 days).
        </li>
      </ul>

      <h2>5. Deliveries in progress</h2>
      <p>
        For everyone’s safety, you cannot delete your account while a delivery is in progress. Please wait
        for it to complete — or cancel / release it — and then delete your account.
      </p>

      <h2>6. Questions or help</h2>
      <p>
        For any deletion request or question, contact our Grievance Officer:
      </p>
      <p>
        <strong>{go.name}</strong> ({go.designation}), {B.legalName}
        <br />
        {go.address}
        <br />
        Email: <a href={`mailto:${go.email}`}>{go.email}</a>
        <br />
        Phone: {go.phone}
      </p>
      <p>
        We acknowledge requests within 48 hours and complete them within the timelines above, in line
        with applicable Indian law. See also our{' '}
        <a href="/legal/privacy">Privacy Policy</a> for how we handle your data.
      </p>
    </LegalLayout>
  );
}
