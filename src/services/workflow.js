/**
 * Business actions shared by the staff API and the webhooks.
 * Every step: update DB → log activity → notify (WhatsApp) → sync (CRM / inventory / accounts).
 */
const jwt = require('jsonwebtoken');
const config = require('../config');
const { all, one, run, sql, logActivity, advanceStage, saveFile, getFile } = require('../db');
const { assign } = require('./assignment');
const wa = require('./whatsapp');
const { crm, inventory, accounts } = require('./integrations');
const { bookingPdf } = require('./pdf');
const { httpError } = require('../util');

const userById = (id) => one('SELECT * FROM users WHERE id=?', id);
const fmtPhone = (p) => { const d = String(p || '').replace(/\D/g, ''); return d.length === 12 ? `+91 ${d.slice(2, 7)} ${d.slice(7)}` : '+' + d; };
const first = (n) => String(n || '').split(' ')[0];

/** Active CRM projects with their configurations (distinct flat types). */
async function listProjects() {
  const rows = await all(`SELECT p.id, p.name, p.code, p.project_type,
        coalesce((SELECT array_agg(DISTINCT f.flat_type ORDER BY f.flat_type) FROM public.towers t JOIN public.wings w ON w.tower_id=t.id
          JOIN public.flats f ON f.wing_id=w.id WHERE t.project_id=p.id AND f.flat_type IS NOT NULL), '{}') configs
      FROM public.projects p WHERE p.is_active ORDER BY p.landing_order, p.name`);
  return rows.map((p) => ({ ...p, configs: p.configs.length ? p.configs : ['2 BHK', '3 BHK'] }));
}

function getEnquiry(id) {
  return one(`SELECT e.*, p.name project_name, u.name assigned_name, u.phone assigned_phone
      FROM enquiries e JOIN public.projects p ON p.id=e.project_id LEFT JOIN users u ON u.id=e.assigned_to WHERE e.id=?`, id);
}

async function fullEnquiry(id) {
  const e = await getEnquiry(id);
  if (!e) return null;
  const [activities, booking, kyc, payments, sigs, sync, whatsapp] = await Promise.all([
    all('SELECT a.*, u.name user_name FROM activities a LEFT JOIN users u ON u.id=a.user_id WHERE enquiry_id=? ORDER BY a.id DESC', id),
    one('SELECT * FROM bookings WHERE enquiry_id=?', id),
    all('SELECT id, kind, file_id, original_name, uploaded_at FROM kyc_docs WHERE enquiry_id=? ORDER BY id', id),
    all('SELECT * FROM payments WHERE enquiry_id=? ORDER BY id DESC', id),
    all('SELECT enquiry_id, party, file_id, signed_by, signed_at FROM signatures WHERE enquiry_id=?', id),
    all('SELECT * FROM sync_log WHERE enquiry_id=? ORDER BY id DESC LIMIT 50', id),
    all('SELECT * FROM wa_messages WHERE enquiry_id=? ORDER BY id DESC LIMIT 30', id),
  ]);
  return { ...e, activities, booking: booking || null, kyc, payments, signatures: Object.fromEntries(sigs.map((s) => [s.party, s])), sync, whatsapp };
}

function publicProfile(u) {
  return {
    name: u.name, designation: u.designation, phone: u.phone, email: u.email, slug: u.slug,
    photoUrl: u.photo_file_id ? `/media/photos/${u.photo_file_id}` : null, cardUrl: `${config.publicUrl}/card/${u.slug}`,
  };
}

const salesAlertParams = (e, u) => [first(u.name), e.id, e.name, '+91 ' + e.mobile, `${e.project_name} · ${e.config}`, e.budget, e.source + (e.cp_name ? ` (${e.cp_name})` : '')];
const salesAlertPreview = (e, reason) => `🔔 New walk-in assigned to you\n${e.id}\n👤 ${e.name}\n📱 +91 ${e.mobile}\n🏢 ${e.project_name} · ${e.config}\n💰 ${e.budget}${e.purpose ? ' · ' + e.purpose : ''}\n📣 ${e.source}${e.cp_name ? ' (' + e.cp_name + ')' : ''}\n🕑 Visit: ${e.visit_pref || '—'}\nCustomer is at reception.${reason ? '\n(' + reason + ')' : ''}`;

/* ---------- 1. Kiosk enquiry ---------- */
async function createEnquiry(input) {
  const project = await one('SELECT id FROM public.projects WHERE id::text=? AND is_active', String(input.projectId || ''));
  if (!project) throw httpError(400, 'Please choose a project');
  const mobile = String(input.mobile || '').replace(/\D/g, '').slice(-10);
  if (!/^[6-9]\d{9}$/.test(mobile)) throw httpError(400, 'Please enter a valid 10-digit mobile number');
  const name = String(input.name || '').trim();
  if (name.length < 2) throw httpError(400, 'Please enter your name');
  if (!input.config || !input.budget || !input.source) throw httpError(400, 'Please complete all required fields');
  if (!input.consent) throw httpError(400, 'Consent is required');

  const a = await assign({ mobile, projectId: project.id, cpName: input.source === 'Channel partner' ? String(input.cpName || '') : '' });
  const row = await one(`INSERT INTO enquiries(name,mobile,email,residence,project_id,config,budget,purpose,source,cp_name,visit_pref,consent,assigned_to,assign_reason)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,true,?,?) RETURNING id`, name.slice(0, 120), mobile, String(input.email || '').trim(), String(input.residence || '').trim(),
  project.id, String(input.config), String(input.budget), String(input.purpose || ''), String(input.source), String(input.cpName || '').trim(), String(input.visitPref || ''),
  a.userId, a.reason);
  const id = row.id;
  await logActivity(id, null, 'created', 'Enquiry submitted at reception kiosk');
  const u = a.userId ? await userById(a.userId) : null;
  await logActivity(id, null, 'assigned', u ? `Assigned to ${u.name} — ${a.reason}` : a.reason);

  const e = await getEnquiry(id);
  await Promise.all([
    u ? wa.template(u.phone, id, config.wa.tplSalesAlert, salesAlertParams(e, u), salesAlertPreview(e, a.reason)) : null,
    crm.upsertLead(e),
  ]);
  return { enquiry: e, assignment: a, sales: u ? publicProfile(u) : null };
}

/* ---------- 2. Customer scans QR and messages the org number ---------- */
async function handleInboundWhatsApp(from, text) {
  await wa.record('in', from, null, 'text', text, 'received');
  const m = /MG-\d{3,}/i.exec(text || '');
  let e = m ? await getEnquiry(m[0].toUpperCase()) : null;
  if (!e) {
    const last = await one('SELECT id FROM enquiries WHERE mobile=? ORDER BY created_at DESC LIMIT 1', String(from).replace(/\D/g, '').slice(-10));
    if (last) e = await getEnquiry(last.id);
  }
  if (!e) { await wa.text(from, null, `Thank you for contacting ${config.org.name}. Our team will get back to you shortly. 🙏`); return { matched: false }; }
  await run('UPDATE enquiries SET wa_linked_at=coalesce(wa_linked_at, now()) WHERE id=?', e.id);
  if (!e.assigned_to) {
    await wa.text(from, e.id, `Welcome to ${config.org.name}, ${first(e.name)}! 🙏 A relationship manager will be with you in a few minutes.`);
    return { matched: true, enquiryId: e.id };
  }
  const u = await userById(e.assigned_to);
  await wa.text(from, e.id, `Welcome to ${config.org.name}, ${first(e.name)}! 🙏\nYour relationship manager is:\n\n*${u.name}*\n${u.designation}\n📞 ${fmtPhone(u.phone)}\n✉️ ${u.email}\n\n${first(u.name)} will meet you in the lounge in a few minutes.\n\n🪪 Visiting card: ${publicProfile(u).cardUrl}`);
  await logActivity(e.id, null, 'whatsapp', 'Customer connected on WhatsApp');
  return { matched: true, enquiryId: e.id };
}

/* ---------- 3. Reassign ---------- */
async function reassign(enquiryId, toUserId, reason, by) {
  const e = await getEnquiry(enquiryId);
  if (!e) throw httpError(404, 'Enquiry not found');
  const to = await one("SELECT * FROM users WHERE id=? AND role='sales' AND active", Number(toUserId));
  if (!to) throw httpError(400, 'Choose an active sales person');
  if (to.id === e.assigned_to) return;
  const fromName = e.assigned_name || 'Unassigned';
  await run('UPDATE enquiries SET assigned_to=?, assign_reason=? WHERE id=?', to.id, `Reassigned by ${by.name}: ${reason}`, enquiryId);
  await logActivity(enquiryId, by.id, 'reassigned', `${fromName} → ${to.name} (${reason})`);
  const fresh = await getEnquiry(enquiryId);
  await wa.template(to.phone, enquiryId, config.wa.tplSalesAlert, salesAlertParams(fresh, to), salesAlertPreview(fresh, 'Reassigned: ' + reason));
  if (e.assigned_to) {
    const from = await userById(e.assigned_to);
    await wa.template(from.phone, enquiryId, config.wa.tplReassign, [first(from.name), enquiryId, e.name, reason], `${enquiryId} (${e.name}) has been moved to ${to.name}. Reason: ${reason}`);
  }
  await crm.sync(enquiryId, 'setOwner');
}

/* ---------- 4. Sales actions ---------- */
async function attend(e, user) {
  await advanceStage(e.id, 'Attending');
  await logActivity(e.id, user.id, 'attending', 'Started meeting the customer');
  await run("UPDATE users SET status='With customer' WHERE id=?", user.id);
  await crm.sync(e.id, 'attending');
}

async function siteVisit(e, user, { units, feedback, note }) {
  await advanceStage(e.id, 'Site visit');
  await logActivity(e.id, user.id, 'site_visit', `Site visit — units shown: ${units || '—'} · ${feedback || ''}${note ? ' · ' + note : ''}`);
  await crm.sync(e.id, 'siteVisit');
}

async function addNote(e, user, note) {
  await logActivity(e.id, user.id, 'note', note);
  await crm.sync(e.id, 'note');
}

async function saveBooking(e, user, b) {
  if (['Booked', 'Lost'].includes(e.stage)) throw httpError(400, 'This enquiry is closed');
  const unit = b.flatId ? await inventory.getUnit(String(b.flatId)) : null;
  if (!unit || unit.project_id !== e.project_id) throw httpError(400, 'Choose a unit from this project');
  const existing = await one('SELECT * FROM bookings WHERE enquiry_id=?', e.id);
  const holdUntil = await inventory.hold(unit.id, e.id, config.unitHoldHours);
  if (!holdUntil) {
    const h = await one('SELECT enquiry_id, status FROM unit_status WHERE flat_id=?', unit.id);
    throw httpError(409, `Unit ${unit.flat_no} is ${h ? h.status.toLowerCase() : 'not available'}${h && h.enquiry_id ? ' (' + h.enquiry_id + ')' : ''}`);
  }
  if (existing && existing.flat_id !== unit.id) await inventory.release(existing.flat_id, e.id);
  const value = String(b.agreementValue || '').replace(/[^\d.]/g, '');
  const vals = [unit.id, unit.tower, unit.wing || '', unit.floor === null ? '' : String(unit.floor), unit.flat_no, unit.carpet_area === null ? '' : String(unit.carpet_area),
    value ? Number(value) : null, String(b.paymentPlan || ''), String(b.coApplicant || ''), JSON.stringify(b.extra || {}), holdUntil];
  if (existing) {
    await run(`UPDATE bookings SET flat_id=?,tower=?,wing=?,floor=?,unit=?,carpet_area=?,agreement_value=?,payment_plan=?,co_applicant=?,extra=?::jsonb,hold_until=?,updated_at=now() WHERE enquiry_id=?`, ...vals, e.id);
  } else {
    await run(`INSERT INTO bookings(flat_id,tower,wing,floor,unit,carpet_area,agreement_value,payment_plan,co_applicant,extra,hold_until,enquiry_id)
        VALUES(?,?,?,?,?,?,?,?,?,?::jsonb,?,?)`, ...vals, e.id);
  }
  await advanceStage(e.id, 'KYC');
  await logActivity(e.id, user.id, 'booking_form', `Booking form saved — ${unit.tower} ${unit.flat_no} on hold for ${config.unitHoldHours} h`);
  await crm.sync(e.id, 'bookingForm');
}

async function addKyc(e, user, kind, file) {
  if (!(await one('SELECT 1 FROM bookings WHERE enquiry_id=?', e.id))) throw httpError(400, 'Save the booking form first');
  const fileId = await saveFile('kyc', file.mimetype, file.originalname, file.buffer);
  await run('INSERT INTO kyc_docs(enquiry_id,kind,file_id,original_name,uploaded_by) VALUES(?,?,?,?,?)', e.id, kind, fileId, file.originalname || '', user.id);
  await logActivity(e.id, user.id, 'kyc', `Uploaded ${kind}`);
}

const REQUIRED_KYC = ['pan', 'aadhaar', 'photo'];
async function kycComplete(e, user) {
  const have = new Set((await all('SELECT kind FROM kyc_docs WHERE enquiry_id=?', e.id)).map((r) => r.kind));
  const missing = REQUIRED_KYC.filter((k) => !have.has(k));
  if (missing.length) throw httpError(400, 'Missing KYC: ' + missing.join(', '));
  await advanceStage(e.id, 'Payment');
  await logActivity(e.id, user.id, 'kyc_complete', 'KYC complete');
}

async function submitPayment(e, user, { amount, mode, ref }) {
  if (!(await one('SELECT 1 FROM bookings WHERE enquiry_id=?', e.id))) throw httpError(400, 'Save the booking form first');
  const amt = Number(String(amount ?? '').replace(/[^\d.]/g, ''));
  if (!(amt > 0)) throw httpError(400, 'Enter the amount');
  if (!mode) throw httpError(400, 'Choose the payment mode');
  if (mode !== 'Payment link' && !String(ref || '').trim()) throw httpError(400, 'Enter the UTR / cheque / UPI reference');
  if (await one("SELECT 1 FROM payments WHERE enquiry_id=? AND status='Pending verification'", e.id)) throw httpError(409, 'A payment is already waiting for Accounts');
  const p = await one('INSERT INTO payments(enquiry_id,amount,mode,ref,submitted_by) VALUES(?,?,?,?,?) RETURNING *', e.id, amt, mode, String(ref || '').trim(), user.id);
  await advanceStage(e.id, 'Payment');
  await logActivity(e.id, user.id, 'payment_submitted', `₹${amt.toLocaleString('en-IN')} by ${mode} (${p.ref || '—'}) sent to Accounts`);
  await accounts.submitReceipt(e.id, p);
  return p;
}

async function verifyPayment(paymentId, by, receiptNo) {
  const p = await one('SELECT * FROM payments WHERE id=?', paymentId);
  if (!p) throw httpError(404, 'Payment not found');
  if (p.status === 'Received') return p;
  const rn = String(receiptNo || '').trim() || 'RCPT-' + String(p.id).padStart(5, '0');
  await run("UPDATE payments SET status='Received', receipt_no=?, verified_by=?, verified_at=now() WHERE id=?", rn, by ? by.id : null, p.id);
  await advanceStage(p.enquiry_id, 'Signatures');
  await logActivity(p.enquiry_id, by ? by.id : null, 'payment_verified', `Payment ₹${Number(p.amount).toLocaleString('en-IN')} verified by ${by ? by.name : 'internal portal'} · ${rn}`);
  await crm.sync(p.enquiry_id, 'paymentVerified');
  const e = await getEnquiry(p.enquiry_id);
  if (e.assigned_to) {
    const u = await userById(e.assigned_to);
    await wa.text(u.phone, e.id, `✅ Payment verified for ${e.id} (${e.name}) — ₹${Number(p.amount).toLocaleString('en-IN')}, receipt ${rn}. Please complete signatures.`);
  }
  return one('SELECT * FROM payments WHERE id=?', p.id);
}

async function rejectPayment(paymentId, by, remarks) {
  const p = await one('SELECT * FROM payments WHERE id=?', paymentId);
  if (!p) throw httpError(404, 'Payment not found');
  await run("UPDATE payments SET status='Rejected', remarks=?, verified_by=?, verified_at=now() WHERE id=?", remarks || '', by.id, p.id);
  await logActivity(p.enquiry_id, by.id, 'payment_rejected', `Payment rejected: ${remarks || '—'}`);
}

async function saveSignature(e, user, party, png) {
  const fileId = await saveFile('signature', 'image/png', `${e.id}-${party}.png`, png);
  await run(`INSERT INTO signatures(enquiry_id,party,file_id,signed_by) VALUES(?,?,?,?)
      ON CONFLICT (enquiry_id,party) DO UPDATE SET file_id=excluded.file_id, signed_by=excluded.signed_by, signed_at=now()`, e.id, party, fileId, user.id);
  await logActivity(e.id, user.id, 'signature', `${party} signature captured`);
}

async function approveBooking(e, manager) {
  if (e.stage === 'Booked') throw httpError(400, 'Already booked');
  if (!(await one("SELECT 1 FROM payments WHERE enquiry_id=? AND status='Received'", e.id))) throw httpError(400, 'First payment is not verified yet');
  const sigRows = await all('SELECT * FROM signatures WHERE enquiry_id=?', e.id);
  const sig = Object.fromEntries(sigRows.map((s) => [s.party, s]));
  if (!sig.customer || !sig.sales) throw httpError(400, 'Customer and sales signatures are required first');

  // Build the PDF before changing anything, so a failure leaves the enquiry ready to retry.
  const full = await fullEnquiry(e.id);
  const now = new Date();
  const images = {};
  for (const party of ['customer', 'sales']) images[party] = sig[party].file_id ? (await getFile(sig[party].file_id))?.data : null;
  const pdf = await bookingPdf({
    enquiry: full, booking: full.booking, payment: full.payments.find((p) => p.status === 'Received'), sales: await userById(full.assigned_to), kyc: full.kyc,
    signatures: { customer: { ...sig.customer, image: images.customer }, sales: { ...sig.sales, image: images.sales }, manager: { signed_at: now } },
  });

  const fileId = await sql.begin(async (tx) => {
    const [f] = await tx.unsafe('INSERT INTO files(kind,mime,name,data) VALUES($1,$2,$3,$4) RETURNING id', ['booking_pdf', 'application/pdf', `Booking form ${e.id}.pdf`, pdf]);
    await tx.unsafe('UPDATE bookings SET pdf_file_id=$1, hold_until=NULL WHERE enquiry_id=$2', [f.id, e.id]);
    await tx.unsafe(`INSERT INTO signatures(enquiry_id,party,file_id,signed_by,signed_at) VALUES($1,'manager',NULL,$2,$3)
        ON CONFLICT (enquiry_id,party) DO UPDATE SET signed_by=excluded.signed_by, signed_at=excluded.signed_at`, [e.id, manager.id, now]);
    await tx.unsafe("UPDATE enquiries SET stage='Booked', updated_at=now() WHERE id=$1", [e.id]);
    await tx.unsafe("INSERT INTO activities(enquiry_id,user_id,type,note) VALUES($1,$2,'approved',$3)", [e.id, manager.id, `Booking approved by ${manager.name} — ${full.booking.unit} booked`]);
    return f.id;
  });

  await inventory.markSold(full.booking.flat_id, e.id);
  await crm.sync(e.id, 'booked');
  const link = shareLink(fileId, 30);
  const u = await userById(full.assigned_to);
  await wa.template('91' + full.mobile, e.id, config.wa.tplBooked, [first(full.name), full.booking.unit, full.project_name, u.name],
    `Congratulations ${first(full.name)}! Your booking of ${full.booking.unit} at ${full.project_name} is confirmed. — ${u.name}, ${config.org.name}`);
  if (full.wa_linked_at) await wa.text('91' + full.mobile, e.id, `📄 Your signed booking form: ${link}`);
  await run("UPDATE users SET status='Available' WHERE id=? AND status='With customer'", u.id);
}

async function markLost(e, user, reason) {
  if (e.stage === 'Booked') throw httpError(400, 'A booked enquiry cannot be marked lost');
  await run("UPDATE enquiries SET stage='Lost', updated_at=now() WHERE id=?", e.id);
  const b = await one('SELECT flat_id FROM bookings WHERE enquiry_id=?', e.id);
  if (b) await inventory.release(b.flat_id, e.id);
  await logActivity(e.id, user.id, 'lost', `Marked lost: ${reason || '—'}`);
  await crm.sync(e.id, 'lost');
}

/** Time-limited public link to a generated document (for WhatsApp / CRM). */
function shareLink(fileId, days) {
  return `${config.publicUrl}/d/${jwt.sign({ f: fileId }, config.jwtSecret, { expiresIn: `${days}d` })}`;
}

module.exports = {
  listProjects, getEnquiry, fullEnquiry, createEnquiry, handleInboundWhatsApp, reassign, attend, siteVisit, addNote, saveBooking,
  addKyc, kycComplete, submitPayment, verifyPayment, rejectPayment, saveSignature, approveBooking, markLost, publicProfile, shareLink,
  REQUIRED_KYC, userById,
};
