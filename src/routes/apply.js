/**
 * Customer self-service forms (no login — signed links):
 *   /apply/<token>  customer fills their part of the booking application on their phone
 *   /f/<token>      customer's filled enquiry form (PDF, printable)
 *   /forms/*.pdf    blank originals for printing
 */
const express = require('express');
const jwt = require('jsonwebtoken');
const config = require('../config');
const { all, one, run, logActivity } = require('../db');
const auth = require('../auth');
const wf = require('../services/workflow');
const wa = require('../services/whatsapp');
const BF = require('../content/booking-form');
const EO = require('../content/enquiry-options');
const { bookingPdf, enquiryPdf, allotmentPdf } = require('../services/pdf');
const { getFile } = require('../db');
const { ah, httpError } = require('../util');

const r = express.Router();
const ANY = auth.requireAuth();
const CUSTOMER_SECTIONS = ['applicants', 'contact', 'bank', 'loan', 'terms', 'cancellation', 'declaration'];
const LOAN_KEYS = ['funding', 'loanBank', 'loanBranch', 'loanOfficer', 'loanPhone', 'loanAmount', 'loanRef'];
const EDITABLE_STAGES = ['Walk-in', 'Attending', 'Site visit', 'Booking form'];

const sign = (payload, days) => jwt.sign(payload, config.jwtSecret, { expiresIn: `${days}d` });
const applyUrl = (id) => `${config.publicUrl}/apply/?t=${sign({ a: id }, 14)}`;
const formUrl = (id) => `${config.publicUrl}/f/${sign({ f: id }, 30)}`;
const pdfOut = (res, name, buf, download) => res.set('Content-Disposition', `${download ? 'attachment' : 'inline'}; filename="${name}"`).set('Cache-Control', 'private, max-age=30').type('application/pdf').send(buf);
const enquiryOpts = async () => ({ projects: await wf.listProjects(), sources: EO.SOURCES, budgets: EO.BUDGETS, purposes: EO.PURPOSES, visitPrefs: EO.VISIT_PREFS });

function fromToken(token) {
  try { const p = jwt.verify(String(token || ''), config.jwtSecret); if (p.a) return p.a; } catch { /* fall through */ }
  throw httpError(410, 'This link has expired. Please ask your relationship manager for a new one.');
}

/** Current form = booking draft (if any) overlaid with customer-owned values, seeded from the enquiry. */
async function currentForm(e) {
  const [booking, cf] = await Promise.all([one('SELECT * FROM bookings WHERE enquiry_id=?', e.id), one('SELECT * FROM customer_forms WHERE enquiry_id=?', e.id)]);
  const base = booking && booking.extra ? booking.extra : {};
  const mine = cf ? cf.data : {};
  const f = BF.normalize({ ...base, ...pick(mine), a1: { ...(base.a1 || {}), ...(mine.a1 || {}) }, a2: { ...(base.a2 || {}), ...(mine.a2 || {}) } });
  if (!f.a1.name) f.a1.name = e.name.toUpperCase();
  if (!f.a1.mobile) f.a1.mobile = e.mobile;
  if (!f.a1.email) f.a1.email = e.email || '';
  if (!f.a1.address) f.a1.address = e.residence || '';
  if (!f.a1.nationality) f.a1.nationality = 'Indian';
  if (!f.funding) f.funding = 'Self-Funded';
  return { form: f, booking, cf };
}
/** Only the parts a customer may fill. */
function pick(src = {}) {
  const out = {};
  if (src.a1) out.a1 = src.a1; if (src.a2) out.a2 = src.a2;
  if (src.corrAddress !== undefined) out.corrAddress = src.corrAddress;
  for (const k of LOAN_KEYS) if (src[k] !== undefined) out[k] = src[k];
  if (src.declarationAccepted !== undefined) out.declarationAccepted = !!src.declarationAccepted;
  return out;
}

/* ---------- staff: create the link ---------- */
r.post('/api/enquiries/:id/apply-link', ANY, ah(async (req, res) => {
  const e = await wf.getEnquiry(req.params.id);
  if (!e) throw httpError(404, 'Enquiry not found');
  if (req.user.role === 'sales' && e.assigned_to !== req.user.id) throw httpError(403, 'This customer is assigned to someone else');
  await logActivity(e.id, req.user.id, 'apply_link', 'Booking application link sent to the customer');
  res.json({ url: applyUrl(e.id) });
}));

/* ---------- customer: open / save / submit ---------- */
r.get('/api/apply/:token', ah(async (req, res) => {
  const e = await wf.getEnquiry(fromToken(req.params.token));
  if (!e) throw httpError(404, 'Application not found');
  const { form, booking, cf } = await currentForm(e);
  const rm = e.assigned_to ? wf.publicProfile(await one('SELECT * FROM users WHERE id=?', e.assigned_to)) : null;
  res.json({
    enquiry: { id: e.id, name: e.name, project: e.project_name, config: e.config, stage: e.stage },
    unit: booking ? { tower: booking.tower, wing: booking.wing, unit: booking.unit, floor: booking.floor, carpet: booking.carpet_area, total: booking.total_consideration } : null,
    form, locked: !EDITABLE_STAGES.includes(e.stage), submittedAt: cf ? cf.submitted_at : null, rm: rm && { name: rm.name, designation: rm.designation, phone: rm.phone, photoUrl: rm.photoUrl },
    schema: { sections: BF.SECTIONS.filter((s) => CUSTOMER_SECTIONS.includes(s.id)), terms: BF.TERMS, cancellation: BF.CANCELLATION, reraSlabs: BF.RERA_SLABS, reraNorms: BF.RERA_NORMS, declaration: BF.DECLARATION },
  });
}));

r.put('/api/apply/:token', ah(async (req, res) => {
  const e = await wf.getEnquiry(fromToken(req.params.token));
  if (!e) throw httpError(404, 'Application not found');
  if (!EDITABLE_STAGES.includes(e.stage)) throw httpError(400, 'Your application has already been submitted to the team. Please contact your relationship manager for changes.');
  const submit = !!req.body?.submit;
  const { form: cur, booking } = await currentForm(e);
  const merged = BF.normalize({ ...cur, ...pick(req.body?.form || {}), a1: { ...cur.a1, ...(req.body?.form?.a1 || {}) }, a2: { ...cur.a2, ...(req.body?.form?.a2 || {}) } });
  const mine = pick(merged);
  if (submit) {
    // Validate only what the customer fills: borrow staff-owned values so those checks pass.
    const errs = BF.validate({ ...merged, agreementValue: merged.agreementValue || '1', clp: BF.DEFAULT_CLP }).filter((m) => !/Agreement Value|CLP|Booking amount/i.test(m));
    if (errs.length) return res.status(400).json({ error: 'Please complete the highlighted details', errors: errs });
  }
  await run(`INSERT INTO customer_forms(enquiry_id,data,submitted_at,updated_at) VALUES(?,?,${submit ? 'now()' : 'NULL'},now())
      ON CONFLICT (enquiry_id) DO UPDATE SET data=excluded.data, updated_at=now()${submit ? ', submitted_at=now()' : ''}`, e.id, JSON.stringify(mine));
  if (booking) { // keep the sales draft in step
    const extra = { ...(booking.extra || {}), ...mine, a1: { ...((booking.extra || {}).a1 || {}), ...mine.a1 }, a2: { ...((booking.extra || {}).a2 || {}), ...mine.a2 } };
    await run('UPDATE bookings SET extra=? WHERE enquiry_id=?', JSON.stringify(extra), e.id);
  }
  if (submit) {
    await logActivity(e.id, null, 'customer_form', 'Customer filled and submitted the booking application details online');
    const u = e.assigned_to ? await one('SELECT name, phone FROM users WHERE id=?', e.assigned_to) : null;
    if (u) await wa.text(u.phone, e.id, `📝 ${e.name} (${e.id}) has filled the booking application details online. Open the customer in Mihir Sales to review and choose the flat.`);
  }
  res.json({ ok: true, submittedAt: submit ? new Date().toISOString() : null });
}));

r.get('/api/apply/:token/application.pdf', ah(async (req, res) => {
  const e = await wf.getEnquiry(fromToken(req.params.token));
  if (!e) throw httpError(404, 'Application not found');
  const { form, booking } = await currentForm(e);
  const full = await wf.fullEnquiry(e.id);
  const pdf = await bookingPdf({ enquiry: full, booking: { ...(booking || {}), extra: { ...((booking && booking.extra) || {}), ...form } }, payment: null, signatures: {}, draft: full.stage !== 'Booked' });
  pdfOut(res, `Booking Application ${e.id}.pdf`, pdf, req.query.download);
}));

/* ---------- allotment letter link for the customer ---------- */
r.get('/api/enquiries/:id/allotment-link', ANY, ah(async (req, res) => {
  const e = await wf.getEnquiry(req.params.id);
  if (!e) throw httpError(404, 'Enquiry not found');
  if (req.user.role === 'sales' && e.assigned_to !== req.user.id) throw httpError(403, 'This customer is assigned to someone else');
  await logActivity(e.id, req.user.id, 'allotment_sent', 'Allotment letter shared with the customer');
  res.json({ url: `${config.publicUrl}/al/${sign({ al: e.id }, 30)}` });
}));
r.get('/al/:token', ah(async (req, res) => {
  let id; try { id = jwt.verify(req.params.token, config.jwtSecret).al; } catch { return res.status(410).send('This link has expired. Please ask your relationship manager for a new one.'); }
  const full = id && await wf.fullEnquiry(id);
  if (!full || !full.booking || !full.payments.some((p) => p.status === 'Received')) return res.status(404).send('Allotment letter not available');
  const sig = full.signatures.developer; const f = sig ? await getFile(sig.file_id) : null; const dev = sig ? await one('SELECT name, designation FROM users WHERE id=?', sig.signed_by) : null;
  pdfOut(res, `Allotment Letter ${full.id}.pdf`, await allotmentPdf({ enquiry: full, booking: full.booking, payments: full.payments, developer: f ? { image: f.data, ...dev } : null }), req.query.download);
}));

/* ---------- filled enquiry form for the customer ---------- */
r.get('/f/:token', ah(async (req, res) => {
  let id; try { id = jwt.verify(req.params.token, config.jwtSecret).f; } catch { return res.status(410).send('This link has expired.'); }
  const e = id && await wf.getEnquiry(id);
  if (!e) return res.status(404).send('Enquiry not found');
  pdfOut(res, `Enquiry ${e.id}.pdf`, await enquiryPdf({ ...(await enquiryOpts()), enquiry: e }), req.query.download);
}));

/* ---------- blank originals (public) ---------- */
r.get('/forms/enquiry.pdf', ah(async (req, res) => pdfOut(res, 'Mihir Enquiry Form.pdf', await enquiryPdf(await enquiryOpts()), req.query.download)));
r.get('/forms/booking-application.pdf', ah(async (req, res) => pdfOut(res, 'Mihir Booking Application Form.pdf', await bookingPdf({ blank: true, enquiry: {}, booking: { extra: {} }, signatures: {} }), req.query.download)));

module.exports = { router: r, formUrl, applyUrl };
