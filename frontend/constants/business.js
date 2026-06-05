/**
 * Single source of truth for business & legal details.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 *  ⚠️  BEFORE GOING LIVE — replace every value wrapped in [ square brackets ].
 *      App stores (Play Store / App Store) and payment gateways (Razorpay)
 *      verify that the contact, address and legal-entity details in your
 *      policies match your real, registered business. Placeholder or
 *      mismatched details are a common reason reviews are rejected.
 *
 *      The Footer and all /legal/* pages read from this file, so you only
 *      need to fill these in ONCE here.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const BUSINESS = {
  /* ── Brand ─────────────────────────────────────────────────────────────── */
  brand: 'KitUm',
  tagline: 'Water delivered to your door.',
  // Public-facing URL of the deployed web app (used in policies + app listings).
  website: '[https://your-domain.com]',

  /* ── Registered legal entity ───────────────────────────────────────────── */
  // The exact name on your GST/registration certificate. If you operate as an
  // individual, use "<Your Full Name>, Proprietor of KitUm".
  legalName: '[Registered Business / Proprietor Name]',
  // 'Sole Proprietorship' | 'Partnership' | 'LLP' | 'Private Limited Company'
  entityType: '[Sole Proprietorship]',
  registeredAddress: '[Building / Street, Locality, Shillong, Meghalaya – PIN code]',
  // Leave '' if not applicable (e.g. turnover below the GST threshold).
  gstin: '[GSTIN, if registered]',
  cin: '', // Company Identification Number — only for a Private Limited Company / LLP

  /* ── Where you operate ─────────────────────────────────────────────────── */
  operatingCity: 'Shillong',
  operatingState: 'Meghalaya',
  country: 'India',
  // Courts of this city have exclusive jurisdiction (governing-law clause).
  jurisdictionCity: 'Shillong',

  /* ── Customer contact (shown publicly — must be reachable) ──────────────── */
  supportEmail: 'meghalayawater@gmail.com',
  phone: '+91 76300 03427',
  // Human-readable support hours.
  hours: 'Monday to Sunday, 7:00 AM – 9:00 PM IST',

  /* ── Grievance Officer ─────────────────────────────────────────────────── */
  // Required by the Consumer Protection (E-Commerce) Rules, 2020 and the Digital
  // Personal Data Protection Act, 2023. Must be a named, reachable person.
  grievanceOfficer: {
    name: '[Grievance Officer Full Name]',
    designation: 'Grievance Officer',
    email: '[grievance@your-domain.com]',
    phone: '[+91 XXXXX XXXXX]',
    address: '[Office Address for grievances, Shillong, Meghalaya – PIN]',
  },

  /* ── Payments ──────────────────────────────────────────────────────────── */
  paymentGateway: 'Razorpay Software Private Limited',
  paymentMethods: 'UPI, debit/credit cards, net banking and wallets (via Razorpay), and Cash on Delivery',
  currency: 'INR',
  currencySymbol: '₹',

  /* ── Policy versioning ─────────────────────────────────────────────────── */
  // Update whenever you change any policy text.
  lastUpdated: '3 June 2026',
  effectiveDate: '3 June 2026',
};

/** Canonical list of legal/policy pages — used by the Footer, Account menu and
 *  the /legal index so links never drift out of sync. */
export const LEGAL_LINKS = [
  { href: '/legal/privacy',  label: 'Privacy Policy' },
  { href: '/legal/terms',    label: 'Terms & Conditions' },
  { href: '/legal/refunds',  label: 'Refund & Cancellation' },
  { href: '/legal/shipping', label: 'Shipping & Delivery' },
  { href: '/contact',        label: 'Contact Us' },
];
