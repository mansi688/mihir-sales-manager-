/**
 * Booking Application Form — single source of truth for the form fields (staff app renders from this),
 * the legal text (terms, cancellation, RERA norms, declaration) and the PDF.
 * Legal wording should be reviewed by Mihir's legal team before go-live.
 */

const GENDERS = ['Male', 'Female', 'Other'];
const ACCOUNT_TYPES = ['Savings', 'Current', 'NRE', 'NRO'];
const FUNDING = ['Self-Funded', 'Home Loan', 'Part Loan'];
const MODES = ['UPI', 'NEFT/RTGS', 'IMPS', 'Cheque', 'Demand Draft', 'Payment link'];

const PAN = '^[A-Z]{5}[0-9]{4}[A-Z]$';
const AADHAAR = '^[0-9]{12}$';
const PIN = '^[1-9][0-9]{5}$';
const MOBILE = '^[6-9][0-9]{9}$';
const IFSC = '^[A-Z]{4}0[A-Z0-9]{6}$';
const EMAIL = '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$';

/**
 * kind: pair   → fields filled for First and Second applicant (stored as form.a1.k / form.a2.k)
 *       single → stored as form.k
 *       flat   → unit picker + pricing (stored as form.k, plus flatId)
 *       clp    → payment schedule rows (form.clp)
 *       terms  → read-only legal text + acceptance (form.declarationAccepted)
 * req: required to submit (for pair sections: First applicant always; Second applicant only if a name is given)
 */
const SECTIONS = [
  {
    id: 'applicants', no: 1, title: 'Applicant Details', kind: 'pair',
    fields: [
      { k: 'name', label: 'Full Name (as per PAN)', req: true, upper: true },
      { k: 'relation', label: "Father's / Spouse's Name", req: true },
      { k: 'dob', label: 'Date of Birth', type: 'date', req: true },
      { k: 'gender', label: 'Gender', type: 'select', options: GENDERS, req: true },
      { k: 'pan', label: 'PAN Number', pattern: PAN, upper: true, req: true, ph: 'ABCDE1234F', max: 10 },
      { k: 'aadhaar', label: 'Aadhaar Number', pattern: AADHAAR, digits: true, ph: '12 digits', max: 12, mask: true },
      { k: 'nationality', label: 'Nationality', def: 'Indian' },
      { k: 'occupation', label: 'Occupation' },
      { k: 'company', label: 'Company / Business Name' },
      { k: 'relationship', label: 'Relationship with First Applicant', only: 'a2' },
    ],
  },
  {
    id: 'contact', no: 2, title: 'Residential & Contact Details', kind: 'pair',
    fields: [
      { k: 'address', label: 'Residential Address', type: 'textarea', req: true },
      { k: 'city', label: 'City / State', req: true },
      { k: 'pin', label: 'PIN Code', pattern: PIN, digits: true, max: 6, req: true },
      { k: 'mobile', label: 'Mobile Number', pattern: MOBILE, digits: true, max: 10, req: true },
      { k: 'altMobile', label: 'Alternate Number', pattern: MOBILE, digits: true, max: 10 },
      { k: 'email', label: 'Email ID', type: 'email', pattern: EMAIL },
    ],
    extra: [{ k: 'corrAddress', label: 'Correspondence Address (if different)', type: 'textarea' }],
  },
  {
    id: 'flat', no: 3, title: 'Booked Flat Details', kind: 'flat',
    fields: [
      { k: 'carpetSqm', label: 'Carpet Area (Sq. M.)', type: 'number' },
      { k: 'carpetSqft', label: 'Carpet Area (Sq. Ft.)', type: 'number' },
      { k: 'exclusiveArea', label: 'Exclusive / Other Area (if applicable)' },
      { k: 'parking', label: 'Parking Details', ph: 'e.g. 1 covered — P1-23' },
      { k: 'reraNo', label: 'MahaRERA Registration No.', ph: 'P5210000XXXX' },
      { k: 'possession', label: 'Possession Date (as per RERA)', type: 'date' },
      { k: 'agreementValue', label: 'Total Agreement Value (₹)', type: 'money', req: true },
      { k: 'otherCharges', label: 'Other Applicable Charges (₹)', type: 'money' },
    ],
  },
  { id: 'payment', no: 4, title: 'First Transaction / Booking Payment Details', kind: 'payment' },
  {
    id: 'bank', no: 5, title: 'Applicant Bank Details', kind: 'pair',
    note: 'Bank details shall be used for applicable refunds and financial correspondence, subject to verification and company policy.',
    fields: [
      { k: 'holder', label: 'Account Holder Name' },
      { k: 'bank', label: 'Bank Name' },
      { k: 'branch', label: 'Branch' },
      { k: 'accountNo', label: 'Account Number', digits: true, max: 18, mask: true },
      { k: 'ifsc', label: 'IFSC Code', pattern: IFSC, upper: true, max: 11 },
      { k: 'accountType', label: 'Account Type', type: 'select', options: ACCOUNT_TYPES },
    ],
  },
  {
    id: 'loan', no: 6, title: 'Home Loan / Financing Details', kind: 'single',
    fields: [
      { k: 'funding', label: 'Funding Source', type: 'select', options: FUNDING, req: true, def: 'Self-Funded' },
      { k: 'loanBank', label: 'Loaning Bank / NBFC', showIf: 'loan' },
      { k: 'loanBranch', label: 'Bank Branch', showIf: 'loan' },
      { k: 'loanOfficer', label: 'Bank Contact Person', showIf: 'loan' },
      { k: 'loanPhone', label: 'Bank Contact Number', digits: true, max: 10, showIf: 'loan' },
      { k: 'loanAmount', label: 'Loan Amount Sanctioned / Applied (₹)', type: 'money', showIf: 'loan' },
      { k: 'loanRef', label: 'Sanction Letter / Application Ref. No.', showIf: 'loan' },
    ],
  },
  { id: 'clp', no: 7, title: 'Cost Sheet & Construction Linked Payment Plan (CLP)', kind: 'clp' },
  { id: 'terms', no: 8, title: 'Standard Terms & Conditions', kind: 'text' },
  { id: 'cancellation', no: 9, title: 'Cancellation Policy', kind: 'text' },
  {
    id: 'sales', no: 10, title: 'Sales & Channel Partner Details', kind: 'single',
    groups: [
      { title: 'Sales Manager Details', auto: true, fields: [
        { k: 'smName', label: 'Sales Manager Name', auto: true },
        { k: 'smEmpId', label: 'Employee ID', auto: true },
        { k: 'smPhone', label: 'Contact Number', auto: true },
        { k: 'smEmail', label: 'Email ID', auto: true },
      ] },
      { title: 'Channel Partner Details (if applicable)', fields: [
        { k: 'cpName', label: 'Channel Partner / Agency Name' },
        { k: 'cpCode', label: 'CP Registration Code (MahaRERA)' },
        { k: 'cpRep', label: 'CP Representative Name' },
        { k: 'cpPhone', label: 'Contact Number', digits: true, max: 10 },
        { k: 'cpEmail', label: 'Email ID', type: 'email', pattern: EMAIL },
      ] },
    ],
  },
  { id: 'declaration', no: 11, title: 'Customer Declaration & Undertaking', kind: 'text' },
  { id: 'signatures', no: 12, title: 'Signatures', kind: 'signatures' },
];

const DEFAULT_CLP = [
  { milestone: 'Booking Amount', pct: 10 },
  { milestone: 'Agreement Execution', pct: 20 },
  { milestone: 'Plinth Completion', pct: 15 },
  { milestone: 'Slab Completion', pct: 25 },
  { milestone: 'Brickwork / Internal Work', pct: 10 },
  { milestone: 'Flooring / Finishing', pct: 15 },
  { milestone: 'Possession / Final Demand', pct: 5 },
];

const TERMS = [
  'The booking shall be considered provisional until the booking amount is realised and the application is accepted by the Developer.',
  'The applicant shall submit all required KYC documents, PAN, Aadhaar and other relevant supporting documents.',
  'All payments must be made through authorised banking channels in favour of the Developer / designated collection account.',
  'The applicant agrees to adhere to the agreed payment schedule and CLP milestones.',
  'Any delay in payment shall attract applicable interest / charges as per the Agreement for Sale and applicable law.',
  'The applicant shall be responsible for applicable taxes, stamp duty, registration fees, statutory charges and other agreed charges.',
  'The Developer reserves the right to verify applicant information and supporting documents before confirming the booking.',
  'The allotment, area, specifications, possession timelines and other commitments shall be governed by the registered Agreement for Sale and applicable RERA provisions.',
  'Any changes in applicant details, ownership structure or correspondence details must be communicated to the Developer in writing.',
];

const CANCELLATION = [
  'Cancellation requests must be submitted in writing by the applicant(s) to the Developer.',
  'Cancellation and refund shall be governed by the signed booking terms, Agreement for Sale and applicable provisions of the Real Estate (Regulation and Development) Act, 2016, including Section 13 and relevant state rules, wherever applicable.',
  'Any permissible deduction towards cancellation shall be as per the applicable agreement and law, and shall not exceed the MahaRERA limits set out below.',
  'Refunds, wherever due, shall be processed within the applicable statutory or contractual timelines, subject to verification and completion of required formalities.',
  'Any brokerage, administrative charges or other deductions shall be applicable only where legally permissible and contractually agreed.',
];

/** MahaRERA model allotment letter — buyer-initiated cancellation (developer not in default). */
const RERA_SLABS = [
  ['Within 15 days of the allotment letter', 'Nil — full refund'],
  ['16 to 30 days', 'Up to 1% of the total flat consideration'],
  ['31 to 60 days', 'Up to 1.5% of the total flat consideration'],
  ['61 days and beyond', 'Up to 2% of the total flat consideration (maximum)'],
];
const RERA_NORMS = [
  'Booking amount / advance collected before execution and registration of the Agreement for Sale shall not exceed 10% of the total cost of the unit.',
  'An allotment letter in the MahaRERA model format shall be issued against the booking amount, stating the MahaRERA registration number, unit and carpet area, parking, total price, possession date, payment milestones and encumbrances, if any.',
  'Payments shall be made only to the project\'s RERA designated collection bank account as specified in the allotment letter / Agreement for Sale.',
  'Refund of the balance amount after permissible deduction shall be made within 45 days of the written cancellation request; delayed refunds attract interest (SBI highest MCLR + 2%) as per MahaRERA norms.',
  'The Developer may offer more buyer-favourable terms (more days or lower deductions). Any deviation from the MahaRERA model format shall be disclosed and highlighted.',
];

const DECLARATION = [
  'I/We hereby declare that all the information and documents furnished in this application form are true, correct and complete to the best of my/our knowledge.',
  'I/We have understood the project details, flat specifications, agreed consideration value, payment schedule, applicable charges and booking terms and conditions.',
  'I/We agree to abide by the terms of this application, the applicable payment schedule and the Agreement for Sale to be executed with the Developer, subject to applicable laws.',
  'I/We understand that the final allotment and transaction shall be governed by the registered Agreement for Sale and applicable RERA provisions.',
];

/* ---------------- Helpers shared by server ---------------- */
const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
function two(n) { return n < 20 ? ONES[n] : TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : ''); }
function three(n) { return (n >= 100 ? ONES[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' : '') : '') + (n % 100 ? two(n % 100) : ''); }
/** 1250000 → "Rupees Twelve Lakh Fifty Thousand Only" (Indian numbering). */
function amountInWords(amount) {
  let n = Math.round(Number(amount) || 0);
  if (!n) return 'Rupees Zero Only';
  const parts = [];
  const crore = Math.floor(n / 1e7); n %= 1e7;
  const lakh = Math.floor(n / 1e5); n %= 1e5;
  const thousand = Math.floor(n / 1e3); n %= 1e3;
  if (crore) parts.push((crore > 999 ? amountInWords(crore).replace(/^Rupees | Only$/g, '') : three(crore)) + ' Crore');
  if (lakh) parts.push(two(lakh) + ' Lakh');
  if (thousand) parts.push(two(thousand) + ' Thousand');
  if (n) parts.push(three(n));
  return 'Rupees ' + parts.join(' ') + ' Only';
}

const allFields = (s) => (s.groups ? s.groups.flatMap((g) => g.fields) : (s.fields || []).concat(s.extra || []));

/** Clean and type-normalise a submitted form (unknown keys dropped, strings trimmed and capped). */
function normalize(input) {
  const src = input && typeof input === 'object' ? input : {};
  const clean = (f, v) => {
    if (v === undefined || v === null) return '';
    let s = String(v).trim().slice(0, f.type === 'textarea' ? 500 : 120);
    if (f.upper) s = s.toUpperCase();
    if (f.digits) s = s.replace(/\D/g, '').slice(0, f.max || 20);
    if (f.type === 'money' || f.type === 'number') s = s.replace(/[^\d.]/g, '');
    return s;
  };
  const out = { a1: {}, a2: {} };
  for (const s of SECTIONS) {
    if (s.kind === 'pair') {
      for (const f of s.fields) {
        if (f.only !== 'a2') out.a1[f.k] = clean(f, src.a1?.[f.k]);
        if (f.only !== 'a1') out.a2[f.k] = clean(f, src.a2?.[f.k]);
      }
      for (const f of s.extra || []) out[f.k] = clean(f, src[f.k]);
    } else if (s.kind === 'single' || s.kind === 'flat') {
      for (const f of allFields(s)) out[f.k] = clean(f, src[f.k]);
    }
  }
  const rows = Array.isArray(src.clp) && src.clp.length ? src.clp : DEFAULT_CLP;
  out.clp = rows.slice(0, 15).map((r) => ({
    milestone: String(r.milestone || '').trim().slice(0, 80),
    pct: Math.max(0, Math.min(100, Number(r.pct) || 0)),
    due: String(r.due || '').trim().slice(0, 40),
  })).filter((r) => r.milestone);
  out.declarationAccepted = !!src.declarationAccepted;
  return out;
}

/** Returns a list of problems that block submitting the application (drafts may be saved anyway). */
function validate(form) {
  const errs = [];
  const hasA2 = !!form.a2.name;
  for (const s of SECTIONS) {
    if (s.kind === 'pair') {
      for (const f of s.fields) {
        for (const who of ['a1', 'a2']) {
          if (f.only && f.only !== who) continue;
          const v = form[who][f.k];
          const label = `${who === 'a1' ? 'First' : 'Second'} applicant — ${f.label}`;
          if (f.req && !v && (who === 'a1' || (hasA2 && s.id !== 'bank'))) errs.push(`${label} is required`);
          else if (v && f.pattern && !new RegExp(f.pattern).test(v)) errs.push(`${label} looks invalid`);
        }
      }
    } else if (s.kind === 'single' || s.kind === 'flat') {
      for (const f of allFields(s)) {
        const v = form[f.k];
        if (f.showIf === 'loan' && form.funding === 'Self-Funded') continue;
        if (f.req && !v) errs.push(`${f.label} is required`);
        else if (v && f.pattern && !new RegExp(f.pattern).test(v)) errs.push(`${f.label} looks invalid`);
      }
    }
  }
  if (hasA2 && !form.a2.relationship) errs.push('Second applicant — Relationship with First Applicant is required');
  if (form.funding !== 'Self-Funded' && !form.loanBank) errs.push('Loaning Bank / NBFC is required for a home loan');
  const total = form.clp.reduce((t, r) => t + r.pct, 0);
  if (Math.abs(total - 100) > 0.01) errs.push(`CLP percentages add up to ${total}% — they must total 100%`);
  const bookingRow = form.clp.find((r) => /booking/i.test(r.milestone));
  if (bookingRow && bookingRow.pct > 10) errs.push('Booking amount in the CLP cannot exceed 10% of the total cost (RERA)');
  if (!form.declarationAccepted) errs.push('The customer must accept the declaration and terms');
  return errs;
}

module.exports = {
  SECTIONS, DEFAULT_CLP, TERMS, CANCELLATION, RERA_SLABS, RERA_NORMS, DECLARATION, MODES,
  amountInWords, normalize, validate, allFields,
};
