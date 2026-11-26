/**
 * Business actions shared by the staff API and the webhooks.
 * Every step: update DB → log activity → notify (WhatsApp) → sync (CRM / inventory / accounts).
 */
const jwt = require('jsonwebtoken');
const config = require('../config');
const { all, one, run, tx, logActivity, advanceStage, saveFile, getFile } = require('../db');
const { assign } = require('./assignment');
const wa = require('./whatsapp');
const { crm, inventory, accounts } = require('./integrations');
const { bookingPdf } = require('./pdf');
const { httpError } = require('../util');
const BF = require('../content/booking-form');

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
  const [activities, booking, kyc, payments, sigs, sync, whatsapp, followups, quotations, customerForm] = await Promise.all([
    all('SELECT a.*, u.name user_name FROM activities a LEFT JOIN users u ON u.id=a.user_id WHERE enquiry_id=? ORDER BY a.id DESC', id),
    one('SELECT * FROM bookings WHERE enquiry_id=?', id),
    all('SELECT id, kind, file_id, original_name, uploaded_at FROM kyc_docs WHERE enquiry_id=? ORDER BY id', id),
    all('SELECT * FROM payments WHERE enquiry_id=? ORDER BY id DESC', id),
    all('SELECT enquiry_id, party, file_id, signed_by, signed_at FROM signatures WHERE enquiry_id=?', id),
    all('SELECT * FROM sync_log WHERE enquiry_id=? ORDER BY id DESC LIMIT 50', id),
    all('SELECT * FROM wa_messages WHERE enquiry_id=? ORDER BY id DESC LIMIT 30', id),
    all('SELECT f.*, u.name created_name, d.name done_name FROM followups f LEFT JOIN users u ON u.id=f.created_by LEFT JOIN users d ON d.id=f.done_by WHERE enquiry_id=? ORDER BY (f.done_at IS NOT NULL), f.due_at', id).catch(() => []),
    all('SELECT q.id, q.unit_label, q.total, q.valid_until, q.created_at, u.name created_name FROM quotations q LEFT JOIN users u ON u.id=q.created_by WHERE enquiry_id=? ORDER BY q.created_at DESC', id).catch(() => []),
    one('SELECT data, submitted_at, updated_at FROM customer_forms WHERE enquiry_id=?', id).catch(() => null),
  ]);
  return { ...e, activities, booking: booking || null, kyc, payments, signatures: Object.fromEntries(sigs.map((s) => [s.party, s])), sync, whatsapp, followups, quotations, customerForm: customerForm || null };
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

  const online = input.channel === 'online';
  let a = null;
  if (online && input.rm) {
    const rm = await one("SELECT id, name FROM users WHERE slug=? AND active AND role IN ('sales','manager')", String(input.rm));
    if (rm) a = { userId: rm.id, reason: `Online enquiry via ${rm.name}'s link` };
  }
  if (!a) a = await assign({ mobile, projectId: project.id, cpName: input.source === 'Channel partner' ? String(input.cpName || '') : '' });
  const row = await one(`INSERT INTO enquiries(name,mobile,email,residence,project_id,config,budget,purpose,source,cp_name,visit_pref,consent,assigned_to,assign_reason)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,true,?,?) RETURNING id`, name.slice(0, 120), mobile, String(input.email || '').trim(), String(input.residence || '').trim(),
  project.id, String(input.config), String(input.budget), String(input.purpose || ''), String(input.source), String(input.cpName || '').trim(), String(input.visitPref || ''),
  a.userId, a.reason);
  const id = row.id;
  await logActivity(id, null, 'created', online ? 'Enquiry submitted online (customer portal)' : 'Enquiry submitted at reception kiosk');
  const u = a.userId ? await userById(a.userId) : null;
  await logActivity(id, null, 'assigned', u ? `Assigned to ${u.name} — ${a.reason}` : a.reason);

  const e = await getEnquiry(id);
  await Promise.all([
    u ? wa.template(u.phone, id, config.wa.tplSalesAlert, salesAlertParams(e, u), online ? salesAlertPreview(e, a.reason).replace('New walk-in', 'New online enquiry').replace('Customer is at reception.', 'Enquired online — please call or WhatsApp them.') : salesAlertPreview(e, a.reason)) : null,
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
  const form = BF.normalize(b.form || {});

  // Facts the portal knows: flat from CRM inventory, sales manager from the assigned user, CP from the enquiry.
  const sm = e.assigned_to ? await userById(e.assigned_to) : user;
  Object.assign(form, {
    project: e.project_name, tower: unit.tower, wing: unit.wing || '', unit: unit.flat_no,
    floor: unit.floor === null ? '' : String(unit.floor), config: unit.flat_type || e.config,
    smName: sm.name, smEmpId: sm.employee_id || '', smPhone: '+' + sm.phone, smEmail: sm.email,
  });
  if (!form.carpetSqft && unit.carpet_area) form.carpetSqft = String(unit.carpet_area);
  if (!form.carpetSqm && form.carpetSqft) form.carpetSqm = (Number(form.carpetSqft) / 10.7639).toFixed(2);
  if (!form.cpName && e.cp_name) form.cpName = e.cp_name;
  if (form.cpName) {
    const cp = await one('SELECT * FROM channel_partners WHERE lower(name)=lower(?)', form.cpName);
    if (cp) for (const [k, v] of [['cpCode', cp.reg_code], ['cpRep', cp.rep_name], ['cpPhone', cp.phone], ['cpEmail', cp.email]]) if (!form[k] && v) form[k] = v;
  }
  const agreement = Number(form.agreementValue) || null;
  const other = Number(form.otherCharges) || 0;
  const total = agreement ? agreement + other : null;
  form.totalConsideration = total ? String(total) : '';
  form.clp = form.clp.map((r) => ({ ...r, amount: total ? Math.round((total * r.pct) / 100) : null }));

  const errors = BF.validate(form);
  if (b.submit && errors.length) throw Object.assign(httpError(400, 'Please complete the application:\n• ' + errors.slice(0, 8).join('\n• ') + (errors.length > 8 ? `\n…and ${errors.length - 8} more` : '')), { errors });

  const existing = await one('SELECT * FROM bookings WHERE enquiry_id=?', e.id);
  const holdUntil = await inventory.hold(unit.id, e.id, config.unitHoldHours);
  if (!holdUntil) {
    const h = await one('SELECT enquiry_id, status FROM unit_status WHERE flat_id=?', unit.id);
    throw httpError(409, `Unit ${unit.flat_no} is ${h ? h.status.toLowerCase() : 'not available'}${h && h.enquiry_id ? ' (' + h.enquiry_id + ')' : ''}`);
  }
  if (existing && existing.flat_id !== unit.id) await inventory.release(existing.flat_id, e.id);
  const vals = [unit.id, unit.tower, unit.wing || '', form.floor, unit.flat_no, form.carpetSqft || '', agreement, other || null, total,
    form.funding || '', form.a2.name || '', JSON.stringify(form), holdUntil];
  if (existing) {
    await run(`UPDATE bookings SET flat_id=?,tower=?,wing=?,floor=?,unit=?,carpet_area=?,agreement_value=?,other_charges=?,total_consideration=?,
        payment_plan=?,co_applicant=?,extra=?::jsonb,hold_until=?,updated_at=now() WHERE enquiry_id=?`, ...vals, e.id);
  } else {
    await run(`INSERT INTO bookings(flat_id,tower,wing,floor,unit,carpet_area,agreement_value,other_charges,total_consideration,payment_plan,co_applicant,extra,hold_until,enquiry_id)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?::jsonb,?,?)`, ...vals, e.id);
  }
  if (b.submit) {
    await advanceStage(e.id, 'KYC');
    await logActivity(e.id, user.id, 'booking_form', `Booking application submitted — ${unit.tower} ${unit.flat_no}, total ₹${(total || 0).toLocaleString('en-IN')}`);
  } else {
    await advanceStage(e.id, 'Booking form');
    if (!existing || existing.flat_id !== unit.id) await logActivity(e.id, user.id, 'booking_draft', `Draft saved — ${unit.tower} ${unit.flat_no} on hold for ${config.unitHoldHours} h`);
  }
  await crm.sync(e.id, 'bookingForm');
  return { errors };
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

async function submitPayment(e, user, { amount, mode, ref, txnDate, bankName, branch }) {
  const bk = await one('SELECT total_consideration FROM bookings WHERE enquiry_id=?', e.id);
  if (!bk) throw httpError(400, 'Save the booking application first');
  if (STAGE_INDEX(e.stage) < STAGE_INDEX('KYC')) throw httpError(400, 'Submit the booking application first');
  const amt = Number(String(amount ?? '').replace(/[^\d.]/g, ''));
  if (!(amt > 0)) throw httpError(400, 'Enter the amount');
  if (!BF.MODES.includes(mode)) throw httpError(400, 'Choose the payment mode');
  if (mode !== 'Payment link' && !String(ref || '').trim()) throw httpError(400, 'Enter the cheque / UTR / transaction number');
  if (await one("SELECT 1 FROM payments WHERE enquiry_id=? AND status='Pending verification'", e.id)) throw httpError(409, 'A payment is already waiting for Accounts');
  if (bk.total_consideration) {
    const paid = (await one("SELECT coalesce(sum(amount),0) s FROM payments WHERE enquiry_id=? AND status<>'Rejected'", e.id)).s;
    const cap = Math.floor(bk.total_consideration * 0.10);
    if (paid + amt > cap) throw httpError(400, `RERA limit: the booking amount before the Agreement for Sale cannot exceed 10% of the total consideration (₹${cap.toLocaleString('en-IN')}).`);
  }
  const date = /^\d{4}-\d{2}-\d{2}$/.test(String(txnDate || '')) ? txnDate : null;
  const p = await one('INSERT INTO payments(enquiry_id,amount,mode,ref,txn_date,bank_name,branch,submitted_by) VALUES(?,?,?,?,?,?,?,?) RETURNING *',
    e.id, amt, mode, String(ref || '').trim().slice(0, 60), date, String(bankName || '').trim().slice(0, 80), String(branch || '').trim().slice(0, 80), user.id);
  await advanceStage(e.id, 'Payment');
  await logActivity(e.id, user.id, 'payment_submitted', `₹${amt.toLocaleString('en-IN')} by ${mode} (${p.ref || '—'}) sent to Accounts`);
  await accounts.submitReceipt(e.id, p);
  return p;
}
const STAGE_INDEX = (s) => require('../db').STAGES.indexOf(s);

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
  const who = { customer: 'First applicant', co_applicant: 'Second applicant', sales: 'Sales', developer: 'Developer' }[party] || party;
  await logActivity(e.id, user.id, 'signature', `${who} signed the booking application`);
}

async function approveBooking(e, manager, developerPng) {
  if (e.stage === 'Booked') throw httpError(400, 'Already booked');
  if (!(await one("SELECT 1 FROM payments WHERE enquiry_id=? AND status='Received'", e.id))) throw httpError(400, 'First payment is not verified yet');
  const bk = await one('SELECT co_applicant FROM bookings WHERE enquiry_id=?', e.id);
  const sig = Object.fromEntries((await all('SELECT * FROM signatures WHERE enquiry_id=?', e.id)).map((s) => [s.party, s]));
  if (!sig.customer) throw httpError(400, "First applicant's signature is required first");
  if (bk && bk.co_applicant && !sig.co_applicant) throw httpError(400, "Second applicant's signature is required first");
  if (!developerPng) throw httpError(400, 'Sign as the Developer / Authorised Representative to approve');

  // Build the PDF before changing anything, so a failure leaves the enquiry ready to retry.
  const full = await fullEnquiry(e.id);
  const now = new Date();
  const img = async (s) => (s && s.file_id ? (await getFile(s.file_id))?.data : null);
  const pdf = await bookingPdf({
    enquiry: full, booking: full.booking, payment: full.payments.find((p) => p.status === 'Received'), kyc: full.kyc,
    signatures: {
      customer: { ...sig.customer, image: await img(sig.customer) },
      co_applicant: sig.co_applicant ? { ...sig.co_applicant, image: await img(sig.co_applicant) } : null,
      developer: { signed_at: now, image: developerPng, name: manager.name, designation: manager.designation },
    },
  });

  const fileId = await tx(async (t) => {
    const sf = await t.one('INSERT INTO files(kind,mime,name,data) VALUES(?,?,?,?) RETURNING id', 'signature', 'image/png', `${e.id}-developer.png`, developerPng);
    const f = await t.one('INSERT INTO files(kind,mime,name,data) VALUES(?,?,?,?) RETURNING id', 'booking_pdf', 'application/pdf', `Booking Application ${e.id}.pdf`, pdf);
    await t.run('UPDATE bookings SET pdf_file_id=?, hold_until=NULL WHERE enquiry_id=?', f.id, e.id);
    await t.run(`INSERT INTO signatures(enquiry_id,party,file_id,signed_by,signed_at) VALUES(?,'developer',?,?,?)
        ON CONFLICT (enquiry_id,party) DO UPDATE SET file_id=excluded.file_id, signed_by=excluded.signed_by, signed_at=excluded.signed_at`, e.id, sf.id, manager.id, now);
    await t.run("UPDATE enquiries SET stage='Booked', updated_at=now() WHERE id=?", e.id);
    await t.run("INSERT INTO activities(enquiry_id,user_id,type,note) VALUES(?,?,'approved',?)", e.id, manager.id, `Booking approved by ${manager.name} — ${full.booking.unit} booked`);
    return f.id;
  });

  await inventory.markSold(full.booking.flat_id, e.id);
  await crm.sync(e.id, 'booked');
  const link = shareLink(fileId, 30);
  const u = await userById(full.assigned_to);
  await wa.template('91' + full.mobile, e.id, config.wa.tplBooked, [first(full.name), full.booking.unit, full.project_name, u.name],
    `Congratulations ${first(full.name)}! Your booking of ${full.booking.unit} at ${full.project_name} is confirmed. — ${u.name}, ${config.org.name}`);
  if (full.wa_linked_at) await wa.text('91' + full.mobile, e.id, `📄 Your signed booking application: ${link}`);
  await run("UPDATE users SET status='Available' WHERE id=? AND status='With customer'", u.id);
}

/** PDF preview of the application as it stands (any stage after the form is saved). */
async function previewPdf(e) {
  const full = await fullEnquiry(e.id);
  if (!full.booking) throw httpError(400, 'Save the booking application first');
  const sig = full.signatures;
  const img = async (s) => (s && s.file_id ? (await getFile(s.file_id))?.data : null);
  return bookingPdf({
    enquiry: full, booking: full.booking, payment: full.payments.find((p) => p.status !== 'Rejected'), kyc: full.kyc, draft: full.stage !== 'Booked',
    signatures: {
      customer: sig.customer ? { ...sig.customer, image: await img(sig.customer) } : null,
      co_applicant: sig.co_applicant ? { ...sig.co_applicant, image: await img(sig.co_applicant) } : null,
      developer: sig.developer ? { ...sig.developer, image: await img(sig.developer) } : null,
    },
  });
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
  REQUIRED_KYC, userById, previewPdf,
};
