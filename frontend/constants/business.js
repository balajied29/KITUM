/**
 * Single source of truth for business & legal details.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 *  KitUm operates as a brand / trade name of a GST-registered sole
 *  proprietorship (GSTIN 17MLZPS8388F1ZL, Meghalaya) — same legal entity and
 *  GSTIN as the proprietor's other trade names. These registered details appear
 *  ONLY on the legal & Contact pages where Indian law requires them (Consumer
 *  Protection (E-Commerce) Rules 2020 + DPDP Act); the rest of the app UI uses
 *  the KitUm brand. Play Store and Razorpay verify these against the GST record.
 *
 *  ▶ One value still to fill: WEBSITE (your deployed web app URL).
 * ─────────────────────────────────────────────────────────────────────────────
 */

/* ── Registered details (shown only where legally required) ─────────────────── */
const PROPRIETOR_NAME = 'Meubalajied Ki Wa O S Sungoh'; // legal name (per GST)
const GRIEVANCE_OFFICER_NAME = 'Barister Mawrie'; // named grievance/complaints officer
const GSTIN = '17MLZPS8388F1ZL'; // GST registration (proprietorship)
const REGISTERED_ADDRESS = 'C/o S W Blah, Umpling, Donglumsurok, Shillong, East Khasi Hills, Meghalaya – 793006';
const SUPPORT_EMAIL = 'meghalayawater@gmail.com'; // reachable inbox (also the grievance contact)
const SUPPORT_PHONE = '+91 76300 03427';
const WEBSITE = 'https://kitum.online'; // deployed web app URL
/* ─────────────────────────────────────────────────────────────────────────── */

export const BUSINESS = {
  /* ── Brand ─────────────────────────────────────────────────────────────── */
  brand: 'KitUm',
  tagline: 'Water delivered to your door.',
  website: WEBSITE,

  /* ── Legal entity (registered sole proprietorship) ─────────────────────── */
  // KitUm is a brand/trade name operated under this GST-registered proprietorship.
  legalName: PROPRIETOR_NAME,
  entityType: 'Sole Proprietorship',
  registeredAddress: REGISTERED_ADDRESS,
  gstin: GSTIN,
  cin: '', // companies only — not applicable to a sole proprietor

  /* ── Where you operate ─────────────────────────────────────────────────── */
  operatingCity: 'Shillong',
  operatingState: 'Meghalaya',
  country: 'India',
  // Courts of this city have exclusive jurisdiction (governing-law clause).
  jurisdictionCity: 'Shillong',

  /* ── Customer contact (shown publicly — must be reachable) ──────────────── */
  supportEmail: SUPPORT_EMAIL,
  phone: SUPPORT_PHONE,
  hours: 'Monday to Sunday, 7:00 AM – 9:00 PM IST',

  /* ── Grievance Officer ─────────────────────────────────────────────────── */
  // Required by the Consumer Protection (E-Commerce) Rules, 2020 and the DPDP
  // Act, 2023. A named, reachable person who handles data & consumer complaints.
  grievanceOfficer: {
    name: GRIEVANCE_OFFICER_NAME,
    designation: 'Grievance Officer',
    email: SUPPORT_EMAIL,
    phone: SUPPORT_PHONE,
    address: REGISTERED_ADDRESS,
  },

  /* ── Payments ──────────────────────────────────────────────────────────── */
  // Onboard Razorpay as a Proprietorship using GSTIN 17MLZPS8388F1ZL + the
  // proprietor's PAN and the business bank account.
  paymentGateway: 'Razorpay Software Private Limited',
  paymentMethods: 'UPI, debit/credit cards, net banking and wallets (via Razorpay), and Cash on Delivery',
  currency: 'INR',
  currencySymbol: '₹',

  /* ── Policy versioning ─────────────────────────────────────────────────── */
  // Update whenever you change any policy text.
  lastUpdated: '7 June 2026',
  effectiveDate: '3 June 2026',
};

/** Canonical list of legal/policy pages — used by the Footer, Account menu and
 *  the /legal index so links never drift out of sync. */
export const LEGAL_LINKS = [
  { href: '/legal/privacy',  label: 'Privacy Policy' },
  { href: '/legal/terms',    label: 'Terms & Conditions' },
  { href: '/legal/refunds',  label: 'Refund & Cancellation' },
  { href: '/legal/shipping', label: 'Shipping & Delivery' },
  { href: '/legal/data-deletion', label: 'Account & Data Deletion' },
  { href: '/contact',        label: 'Contact Us' },
];
