/** Staff API: login, profile, enquiries, inventory, reception board, team, accounts. */
const express = require('express');
const bcrypt = require('bcryptjs');
const config = require('../config');
const { all, one, run, STAGES, USER_STATUSES, saveFile, getFile } = require('../db');
const auth = require('../auth');
const wf = require('../services/workflow');
const { crm, inventory } = require('../services/integrations');
const BF = require('../content/booking-form');
const EO = require('../content/enquiry-options');
const { bookingPdf, enquiryPdf } = require('../services/pdf');
const { ah, httpError, uploadDoc, uploadPhoto, pngFromDataUrl, todayStartUtc } = require('../util');

const r = express.Router();
const ANY = auth.requireAuth();
const DESK = auth.requireAuth('reception', 'manager');
const MGR = auth.requireAuth('manager');
const ACC = auth.requireAuth('accounts', 'manager');
const SALES = auth.requireAuth('sales', 'manager');

async function me(u) {
  return {
    id: u.id, name: u.name, designation: u.designation, employeeId: u.employee_id || '', phone: u.phone, email: u.email, role: u.role, status: u.status, slug: u.slug, active: u.active,
    photoUrl: u.photo_file_id ? `/media/photos/${u.photo_file_id}` : null, cardUrl: `${config.publicUrl}/card/${u.slug}`, qrUrl: `/card/${u.slug}/qr.png`,
    projects: await all('SELECT p.id, p.name FROM user_projects up JOIN public.projects p ON p.id=up.project_id WHERE up.user_id=? ORDER BY p.name', u.id),
  };
}
const reload = async (id) => me(await one('SELECT * FROM users WHERE id=?', id));

/* ---------- Auth & profile ---------- */
r.post('/api/auth/login', ah(async (req, res) => {
  const u = await auth.login(req.body?.phone, req.body?.pin);
  if (!u) return res.status(401).json({ error: 'Wrong mobile number or PIN' });
  auth.issue(res, u);
  res.json({ user: await me(u) });
}));
r.post('/api/auth/logout', (_req, res) => { auth.clear(res); res.json({ ok: true }); });

r.get('/api/me', ANY, ah(async (req, res) => res.json({ user: await me(req.user), org: config.org, stages: STAGES, statuses: USER_STATUSES })));

/* Booking Application Form definition + legal text (rendered by the staff app) */
r.get('/api/booking-form', ANY, (_req, res) => {
  res.set('Cache-Control', 'private, max-age=300');
  res.json({ sections: BF.SECTIONS, defaultClp: BF.DEFAULT_CLP, terms: BF.TERMS, cancellation: BF.CANCELLATION,
    reraSlabs: BF.RERA_SLABS, reraNorms: BF.RERA_NORMS, declaration: BF.DECLARATION, modes: BF.MODES });
});

r.patch('/api/me', ANY, ah(async (req, res) => {
  const { status } = req.body || {};
  if (status && !USER_STATUSES.includes(status)) throw httpError(400, 'Unknown status');
  if (status) await run('UPDATE users SET status=? WHERE id=?', status, req.user.id);
  res.json({ user: await reload(req.user.id) });
}));

r.post('/api/me/photo', ANY, uploadPhoto.single('photo'), ah(async (req, res) => {
  if (!req.file) throw httpError(400, 'Choose a photo');
  const id = await saveFile('photo', req.file.mimetype, req.file.originalname, req.file.buffer);
  const old = req.user.photo_file_id;
  await run('UPDATE users SET photo_file_id=? WHERE id=?', id, req.user.id);
  if (old) await run('DELETE FROM files WHERE id=?', old);
  res.json({ user: await reload(req.user.id) });
}));

r.post('/api/me/pin', ANY, ah(async (req, res) => {
  const { current, next } = req.body || {};
  if (!bcrypt.compareSync(String(current || ''), req.user.pin_hash)) throw httpError(400, 'Current PIN is wrong');
  if (!/^\d{4,6}$/.test(String(next || ''))) throw httpError(400, 'New PIN must be 4–6 digits');
  await run('UPDATE users SET pin_hash=? WHERE id=?', bcrypt.hashSync(String(next), 10), req.user.id);
  res.json({ ok: true });
}));

/* ---------- Enquiries ---------- */
async function load(req) {
  const e = await wf.getEnquiry(req.params.id);
  if (!e) throw httpError(404, 'Enquiry not found');
  if (req.user.role === 'sales' && e.assigned_to !== req.user.id) throw httpError(403, 'This customer is assigned to someone else');
  return e;
}

r.get('/api/enquiries', ANY, ah(async (req, res) => {
  const where = []; const args = [];
  if (req.user.role === 'sales' || req.query.mine === '1') { where.push('e.assigned_to=?'); args.push(req.user.id); }
  if (req.query.stage) { where.push('e.stage=?'); args.push(String(req.query.stage)); }
  if (req.query.today === '1') { where.push('e.created_at>=?'); args.push(todayStartUtc()); }
  if (req.query.q) { where.push('(e.name ILIKE ? OR e.mobile LIKE ? OR e.id ILIKE ?)'); const q = `%${req.query.q}%`; args.push(q, q, q); }
  res.json({
    enquiries: await all(`SELECT e.*, p.name project_name, u.name assigned_name FROM enquiries e
      JOIN public.projects p ON p.id=e.project_id LEFT JOIN users u ON u.id=e.assigned_to
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY e.created_at DESC LIMIT 500`, ...args),
  });
}));

r.get('/api/enquiries/:id', ANY, ah(async (req, res) => { await load(req); res.json({ enquiry: await wf.fullEnquiry(req.params.id) }); }));

const act = (fn) => ah(async (req, res) => { const e = await load(req); await fn(e, req); res.json({ enquiry: await wf.fullEnquiry(e.id) }); });

r.post('/api/enquiries/:id/attend', SALES, act((e, req) => wf.attend(e, req.user)));
r.post('/api/enquiries/:id/visit', SALES, act((e, req) => wf.siteVisit(e, req.user, req.body || {})));
r.post('/api/enquiries/:id/notes', ANY, act((e, req) => {
  if (!String(req.body?.note || '').trim()) throw httpError(400, 'Write a note');
  return wf.addNote(e, req.user, String(req.body.note).trim().slice(0, 1000));
}));
r.put('/api/enquiries/:id/booking', SALES, act((e, req) => wf.saveBooking(e, req.user, req.body || {})));
r.get('/api/enquiries/:id/application.pdf', ANY, ah(async (req, res) => {
  const e = await load(req);
  const pdf = await wf.previewPdf(e);
  res.set('Content-Disposition', `inline; filename="Booking Application ${e.id}.pdf"`).type('application/pdf').send(pdf);
}));
r.post('/api/enquiries/:id/kyc', SALES, uploadDoc.single('file'), act((e, req) => {
  const kind = String(req.body?.kind || '');
  if (!/^(pan|aadhaar|photo|co_pan|co_aadhaar|other)$/.test(kind)) throw httpError(400, 'Unknown document type');
  if (!req.file) throw httpError(400, 'Choose a file');
  return wf.addKyc(e, req.user, kind, req.file);
}));
r.post('/api/enquiries/:id/kyc/complete', SALES, act((e, req) => wf.kycComplete(e, req.user)));
r.post('/api/enquiries/:id/payments', SALES, act((e, req) => wf.submitPayment(e, req.user, req.body || {})));
r.post('/api/enquiries/:id/signatures', SALES, act(async (e, req) => {
  if (!(await one("SELECT 1 FROM payments WHERE enquiry_id=? AND status='Received'", e.id))) throw httpError(400, 'Signatures open after Accounts verifies the first payment');
  const { customer, coApplicant } = req.body || {};
  if (!customer && !coApplicant) throw httpError(400, 'No signature received');
  const c = customer ? pngFromDataUrl(customer) : null; const c2 = coApplicant ? pngFromDataUrl(coApplicant) : null;
  if (c) await wf.saveSignature(e, req.user, 'customer', c);
  if (c2) await wf.saveSignature(e, req.user, 'co_applicant', c2);
}));
r.post('/api/enquiries/:id/approve', MGR, act((e, req) => wf.approveBooking(e, req.user, req.body?.developer ? pngFromDataUrl(req.body.developer) : null)));
r.post('/api/enquiries/:id/reassign', DESK, act((e, req) => {
  if (!String(req.body?.reason || '').trim()) throw httpError(400, 'Give a reason');
  return wf.reassign(e.id, req.body.userId, String(req.body.reason).trim(), req.user);
}));
r.post('/api/enquiries/:id/lost', SALES, act((e, req) => wf.markLost(e, req.user, String(req.body?.reason || '').trim())));
r.post('/api/enquiries/:id/sync/retry', ANY, act((e) => crm.sync(e.id, 'retry')));

r.get('/api/enquiries/:id/booking.pdf', ANY, ah(async (req, res) => {
  const e = await load(req);
  const b = await one('SELECT pdf_file_id FROM bookings WHERE enquiry_id=?', e.id);
  const f = b && b.pdf_file_id ? await getFile(b.pdf_file_id) : null;
  if (!f) throw httpError(404, 'Booking PDF not generated yet');
  res.set('Content-Disposition', `inline; filename="${f.name}"`).type('application/pdf').send(f.data);
}));
r.get('/api/enquiries/:id/share-link', ANY, ah(async (req, res) => {
  const e = await load(req);
  const b = await one('SELECT pdf_file_id FROM bookings WHERE enquiry_id=?', e.id);
  if (!b || !b.pdf_file_id) throw httpError(404, 'Booking PDF not generated yet');
  res.json({ url: wf.shareLink(b.pdf_file_id, 30) });
}));

/* ---------- Printable forms ---------- */
const pdfOut = (res, name, buf, download) => res.set('Content-Disposition', `${download ? 'attachment' : 'inline'}; filename="${name}"`).set('Cache-Control', 'private, max-age=60').type('application/pdf').send(buf);
const enquiryOpts = async () => ({ projects: await wf.listProjects(), sources: EO.SOURCES, budgets: EO.BUDGETS, purposes: EO.PURPOSES, visitPrefs: EO.VISIT_PREFS });
r.get('/api/forms/booking-application.pdf', ANY, ah(async (req, res) => {
  pdfOut(res, 'Mihir Booking Application Form.pdf', await bookingPdf({ blank: true, enquiry: {}, booking: { extra: {} }, signatures: {} }), req.query.download);
}));
r.get('/api/forms/enquiry.pdf', ANY, ah(async (req, res) => pdfOut(res, 'Mihir Walk-in Enquiry Form.pdf', await enquiryPdf(await enquiryOpts()), req.query.download)));
r.get('/api/enquiries/:id/enquiry.pdf', ANY, ah(async (req, res) => {
  const e = await load(req);
  pdfOut(res, `Enquiry ${e.id}.pdf`, await enquiryPdf({ ...(await enquiryOpts()), enquiry: e }), req.query.download);
}));

/* Protected KYC / signature files */
r.get('/api/files/:id', ANY, ah(async (req, res) => {
  const fileId = req.params.id;
  if (!/^[0-9a-f-]{36}$/i.test(fileId)) throw httpError(404, 'File not found');
  const owner = await one('SELECT enquiry_id FROM kyc_docs WHERE file_id=? UNION SELECT enquiry_id FROM signatures WHERE file_id=?', fileId, fileId);
  if (!owner) throw httpError(404, 'File not found');
  await load({ params: { id: owner.enquiry_id }, user: req.user });
  const f = await getFile(fileId);
  res.set('Cache-Control', 'private, max-age=300').type(f.mime).send(f.data);
}));

/* Kiosk key for staff devices (lets any staff phone/tablet open the walk-in form) */
r.get('/api/kiosk-link', ANY, (_req, res) => res.json({ url: `/kiosk/?key=${encodeURIComponent(config.kioskKey)}` }));

/* ---------- Pipeline stats (sales: own customers; others: everyone) ---------- */
r.get('/api/stats', ANY, ah(async (req, res) => {
  const mine = req.user.role === 'sales';
  const where = mine ? 'WHERE assigned_to=?' : '';
  const args = mine ? [req.user.id] : [];
  const stages = await all(`SELECT stage, count(*)::int c FROM enquiries ${where} GROUP BY stage`, ...args);
  const month = new Date(); month.setUTCDate(1); month.setUTCHours(0, 0, 0, 0);
  const booked = await one(`SELECT count(*)::int c, coalesce(sum(b.total_consideration),0) v FROM activities a JOIN enquiries e ON e.id=a.enquiry_id
      JOIN bookings b ON b.enquiry_id=e.id WHERE a.type='approved' AND a.at>=? ${mine ? 'AND e.assigned_to=?' : ''}`, month.toISOString(), ...args);
  const today = await one(`SELECT count(*)::int c FROM enquiries WHERE created_at>=? ${mine ? 'AND assigned_to=?' : ''}`, todayStartUtc(), ...args);
  const pending = await one("SELECT count(*)::int c FROM payments WHERE status='Pending verification'");
  const approvals = await one("SELECT count(*)::int c FROM enquiries WHERE stage='Signatures'");
  res.json({ stages: Object.fromEntries(stages.map((x) => [x.stage, x.c])), bookedThisMonth: booked.c, valueThisMonth: booked.v, today: today.c, pendingPayments: pending.c, approvals: approvals.c });
}));

/* ---------- Inventory (real CRM flats) ---------- */
r.get('/api/projects/:id/units', ANY, ah(async (req, res) => res.json({ units: await inventory.projectUnits(req.params.id) })));

/* ---------- Reception board & team ---------- */
r.get('/api/board', DESK, ah(async (_req, res) => {
  const since = todayStartUtc();
  const today = await all(`SELECT e.*, p.name project_name, u.name assigned_name FROM enquiries e JOIN public.projects p ON p.id=e.project_id
      LEFT JOIN users u ON u.id=e.assigned_to WHERE e.created_at>=? ORDER BY e.created_at DESC`, since);
  const team = await Promise.all((await all("SELECT * FROM users WHERE role='sales' AND active ORDER BY name")).map(async (u) => ({
    ...(await me(u)), today: today.filter((e) => e.assigned_to === u.id).length,
  })));
  const booked = await one("SELECT count(*)::int c FROM activities WHERE type='approved' AND at>=?", since);
  res.json({
    enquiries: today, team,
    stats: {
      walkins: today.length, waiting: today.filter((e) => e.stage === 'Walk-in').length, booked: booked.c,
      free: team.filter((t) => t.status === 'Available').length, team: team.length, unassigned: today.filter((e) => !e.assigned_to).length,
    },
  });
}));

r.patch('/api/team/:id/status', DESK, ah(async (req, res) => {
  if (!USER_STATUSES.includes(req.body?.status)) throw httpError(400, 'Unknown status');
  await run("UPDATE users SET status=? WHERE id=? AND role='sales'", req.body.status, Number(req.params.id));
  res.json({ ok: true });
}));

r.get('/api/team', DESK, ah(async (_req, res) => {
  res.json({
    users: await Promise.all((await all('SELECT * FROM users ORDER BY active DESC, role, name')).map(me)),
    projects: await all('SELECT id, name FROM public.projects WHERE is_active ORDER BY landing_order, name'),
    channelPartners: await all('SELECT c.*, u.name owner_name FROM channel_partners c LEFT JOIN users u ON u.id=c.owner_user_id ORDER BY c.name'),
  });
}));

async function slugify(name) {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'staff';
  let s = base; let i = 2;
  while (await one('SELECT 1 FROM users WHERE slug=?', s)) s = `${base}-${i++}`;
  return s;
}
async function setProjects(userId, ids) {
  await run('DELETE FROM user_projects WHERE user_id=?', userId);
  for (const pid of ids || []) await run('INSERT INTO user_projects(user_id,project_id) VALUES(?,?) ON CONFLICT DO NOTHING', userId, String(pid));
}

r.post('/api/team', MGR, ah(async (req, res) => {
  const { name, designation, phone, email, role, pin, projectIds, employeeId } = req.body || {};
  const ph = auth.normalizePhone(phone);
  if (!String(name || '').trim() || !/^91\d{10}$/.test(ph)) throw httpError(400, 'Name and a valid mobile are required');
  if (!['sales', 'reception', 'manager', 'accounts'].includes(role) && !(role === 'admin' && req.user.role === 'admin')) throw httpError(400, 'Choose a role');
  if (!/^\d{4,6}$/.test(String(pin || ''))) throw httpError(400, 'Starting PIN must be 4–6 digits');
  if (await one('SELECT 1 FROM users WHERE phone=?', ph)) throw httpError(409, 'A user with this mobile already exists');
  const u = await one('INSERT INTO users(name,designation,phone,email,role,pin_hash,slug,employee_id) VALUES(?,?,?,?,?,?,?,?) RETURNING id',
    String(name).trim(), designation || '', ph, email || '', role, bcrypt.hashSync(String(pin), 10), await slugify(String(name)), String(employeeId || '').trim());
  await setProjects(u.id, projectIds);
  res.json({ ok: true, id: u.id });
}));

r.patch('/api/team/:id', MGR, ah(async (req, res) => {
  const u = await one('SELECT * FROM users WHERE id=?', Number(req.params.id));
  if (!u) throw httpError(404, 'User not found');
  const b = req.body || {};
  await run('UPDATE users SET name=coalesce(?,name), designation=coalesce(?,designation), email=coalesce(?,email), employee_id=coalesce(?,employee_id), active=coalesce(?,active) WHERE id=?',
    b.name ?? null, b.designation ?? null, b.email ?? null, b.employeeId ?? null, b.active === undefined ? null : !!b.active, u.id);
  if (b.pin) {
    if (!/^\d{4,6}$/.test(String(b.pin))) throw httpError(400, 'PIN must be 4–6 digits');
    await run('UPDATE users SET pin_hash=? WHERE id=?', bcrypt.hashSync(String(b.pin), 10), u.id);
  }
  if (Array.isArray(b.projectIds)) await setProjects(u.id, b.projectIds);
  res.json({ ok: true });
}));

r.post('/api/channel-partners', MGR, ah(async (req, res) => {
  const { name, ownerUserId, regCode, repName, phone, email } = req.body || {};
  if (!String(name || '').trim()) throw httpError(400, 'Name required');
  const t = (v) => String(v || '').trim().slice(0, 120);
  await run(`INSERT INTO channel_partners(name,owner_user_id,reg_code,rep_name,phone,email) VALUES(?,?,?,?,?,?)
      ON CONFLICT (lower(name)) DO UPDATE SET owner_user_id=excluded.owner_user_id, reg_code=excluded.reg_code, rep_name=excluded.rep_name, phone=excluded.phone, email=excluded.email`,
  t(name), ownerUserId ? Number(ownerUserId) : null, t(regCode), t(repName), t(phone), t(email));
  res.json({ ok: true });
}));

/* ---------- Accounts ---------- */
r.get('/api/payments', ACC, ah(async (req, res) => {
  res.json({
    payments: await all(`SELECT pa.*, e.name customer, e.mobile, p.name project_name, b.unit, u.name submitted_name
        FROM payments pa JOIN enquiries e ON e.id=pa.enquiry_id JOIN public.projects p ON p.id=e.project_id
        LEFT JOIN bookings b ON b.enquiry_id=e.id LEFT JOIN users u ON u.id=pa.submitted_by
        WHERE pa.status=? ORDER BY pa.submitted_at DESC LIMIT 300`, String(req.query.status || 'Pending verification')),
  });
}));
r.post('/api/payments/:id/verify', ACC, ah(async (req, res) => res.json({ payment: await wf.verifyPayment(Number(req.params.id), req.user, req.body?.receiptNo) })));
r.post('/api/payments/:id/reject', ACC, ah(async (req, res) => { await wf.rejectPayment(Number(req.params.id), req.user, req.body?.remarks); res.json({ ok: true }); }));

/* ---------- Outbox & sync log ---------- */
r.get('/api/outbox', MGR, ah(async (_req, res) => {
  res.json({
    whatsapp: await all('SELECT * FROM wa_messages ORDER BY id DESC LIMIT 100'),
    sync: await all('SELECT * FROM sync_log ORDER BY id DESC LIMIT 100'),
  });
}));

module.exports = r;
