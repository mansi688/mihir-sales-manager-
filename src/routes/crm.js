/** Admin sales dashboard API: follow-ups, quotations (cost sheets), analytics, customer records. */
const express = require('express');
const jwt = require('jsonwebtoken');
const config = require('../config');
const { all, one, run, logActivity } = require('../db');
const auth = require('../auth');
const wf = require('../services/workflow');
const { inventory } = require('../services/integrations');
const { quotationPdf } = require('../services/pdf');
const Q = require('../content/quotation');
const { ah, httpError, todayStartUtc } = require('../util');

const r = express.Router();
const ANY = auth.requireAuth();
const SALES = auth.requireAuth('sales', 'manager');
const DESKMGR = auth.requireAuth('reception', 'manager', 'accounts');

async function load(req, id = req.params.id) {
  const e = await wf.getEnquiry(id);
  if (!e) throw httpError(404, 'Enquiry not found');
  if (req.user.role === 'sales' && e.assigned_to !== req.user.id) throw httpError(403, 'This customer is assigned to someone else');
  return e;
}
const KINDS = ['Call', 'WhatsApp', 'Site visit', 'Meeting', 'Email'];

/* ---------- follow-ups ---------- */
r.get('/api/followups', ANY, ah(async (req, res) => {
  const mine = req.user.role === 'sales' || req.query.scope === 'mine';
  const done = req.query.status === 'done';
  const rows = await all(`SELECT f.*, e.name, e.mobile, e.stage, e.config, p.name project_name, u.name assigned_name, e.assigned_to
      FROM followups f JOIN enquiries e ON e.id=f.enquiry_id JOIN public.projects p ON p.id=e.project_id LEFT JOIN users u ON u.id=e.assigned_to
      WHERE ${done ? 'f.done_at IS NOT NULL' : 'f.done_at IS NULL'} ${mine ? 'AND e.assigned_to=?' : ''}
      ORDER BY ${done ? 'f.done_at DESC' : 'f.due_at ASC'} LIMIT 300`, ...(mine ? [req.user.id] : []));
  res.json({ followups: rows });
}));

r.post('/api/enquiries/:id/followups', ANY, ah(async (req, res) => {
  const e = await load(req);
  const b = req.body || {};
  const due = new Date(b.dueAt);
  if (Number.isNaN(due.getTime())) throw httpError(400, 'Choose a date and time');
  const kind = KINDS.includes(b.kind) ? b.kind : 'Call';
  const note = String(b.note || '').trim().slice(0, 500);
  await run('INSERT INTO followups(enquiry_id,due_at,kind,note,created_by) VALUES(?,?,?,?,?)', e.id, due.toISOString(), kind, note, req.user.id);
  await logActivity(e.id, req.user.id, 'followup', `Follow-up scheduled: ${kind} on ${due.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}${note ? ' — ' + note : ''}`);
  res.json({ enquiry: await wf.fullEnquiry(e.id) });
}));

r.post('/api/followups/:fid/done', ANY, ah(async (req, res) => {
  const f = await one('SELECT * FROM followups WHERE id=?', Number(req.params.fid));
  if (!f) throw httpError(404, 'Follow-up not found');
  const e = await load(req, f.enquiry_id);
  if (f.done_at) throw httpError(400, 'Already completed');
  const outcome = String(req.body?.outcome || '').trim().slice(0, 500);
  await run('UPDATE followups SET done_at=now(), done_by=?, outcome=? WHERE id=?', req.user.id, outcome, f.id);
  await logActivity(e.id, req.user.id, 'followup_done', `${f.kind} follow-up done${outcome ? ' — ' + outcome : ''}`);
  res.json({ ok: true });
}));

/* ---------- quotations ---------- */
r.get('/api/quotation-defaults', ANY, (_req, res) => res.json({ defaults: Q.DEFAULTS }));

r.get('/api/quotations', ANY, ah(async (req, res) => {
  const mine = req.user.role === 'sales';
  res.json({ quotations: await all(`SELECT q.id, q.enquiry_id, q.unit_label, q.total, q.valid_until, q.created_at, e.name, e.mobile, e.stage, p.name project_name, u.name created_name
      FROM quotations q JOIN enquiries e ON e.id=q.enquiry_id JOIN public.projects p ON p.id=e.project_id LEFT JOIN users u ON u.id=q.created_by
      ${mine ? 'WHERE e.assigned_to=?' : ''} ORDER BY q.created_at DESC LIMIT 300`, ...(mine ? [req.user.id] : [])) });
}));

r.post('/api/enquiries/:id/quotations', SALES, ah(async (req, res) => {
  const e = await load(req);
  const b = req.body || {};
  let unitLabel = String(b.unitLabel || '').trim().slice(0, 80); let flatId = null; let carpet = b.carpet; let floor = b.floor;
  if (b.flatId) {
    const u = await inventory.getUnit(String(b.flatId));
    if (!u || String(u.project_id) !== String(e.project_id)) throw httpError(400, 'That unit is not in this project');
    flatId = u.id; unitLabel = `${u.tower}${u.wing ? ' · Wing ' + u.wing : ''} · ${u.flat_no}`;
    if (!carpet) carpet = u.carpet_area; if (floor === undefined || floor === '') floor = u.floor;
  }
  const c = Q.compute({ ...b, carpet, floor });
  if (!c.inputs.carpet || !c.inputs.rate) throw httpError(400, 'Enter the carpet area and the rate per sq ft');
  const valid = new Date(Date.now() + c.inputs.validDays * 864e5).toISOString().slice(0, 10);
  const q = await one('INSERT INTO quotations(enquiry_id,flat_id,unit_label,data,total,valid_until,created_by) VALUES(?,?,?,?,?,?,?) RETURNING id',
    e.id, flatId, unitLabel, JSON.stringify(c), c.total, valid, req.user.id);
  await logActivity(e.id, req.user.id, 'quotation', `Quotation ${q.id} shared${unitLabel ? ' for ' + unitLabel : ''} — Rs. ${Math.round(c.total).toLocaleString('en-IN')}`);
  res.json({ id: q.id, url: `${config.publicUrl}/q/${jwt.sign({ q: q.id }, config.jwtSecret, { expiresIn: '30d' })}` });
}));

async function sendQuotation(res, id, inline = true) {
  const q = await one('SELECT * FROM quotations WHERE id=?', id);
  if (!q) throw httpError(404, 'Quotation not found');
  const e = await wf.getEnquiry(q.enquiry_id);
  const rm = await one('SELECT name, designation, phone, email FROM users WHERE id=?', q.created_by || e.assigned_to);
  const pdf = await quotationPdf({ q, enquiry: e, rm });
  res.set('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename="${q.id}-${e.name.replace(/[^\w ]/g, '')}.pdf"`).type('application/pdf').send(pdf);
}
r.get('/api/quotations/:qid.pdf', ANY, ah(async (req, res) => {
  const q = await one('SELECT enquiry_id FROM quotations WHERE id=?', req.params.qid);
  if (!q) throw httpError(404, 'Quotation not found');
  await load(req, q.enquiry_id);
  await sendQuotation(res, req.params.qid, !req.query.download);
}));
r.get('/api/quotations/:qid/link', ANY, ah(async (req, res) => {
  const q = await one('SELECT enquiry_id FROM quotations WHERE id=?', req.params.qid);
  if (!q) throw httpError(404, 'Quotation not found');
  await load(req, q.enquiry_id);
  res.json({ url: `${config.publicUrl}/q/${jwt.sign({ q: req.params.qid }, config.jwtSecret, { expiresIn: '30d' })}` });
}));
/* customer-facing link (sent on WhatsApp) */
r.get('/q/:token', ah(async (req, res) => {
  let id; try { id = jwt.verify(req.params.token, config.jwtSecret).q; } catch { return res.status(410).send('This quotation link has expired. Please ask your relationship manager for a new one.'); }
  await sendQuotation(res, id);
}));

/* ---------- analytics for the admin dashboard ---------- */
r.get('/api/analytics', DESKMGR, ah(async (req, res) => {
  const days = Math.min(365, Math.max(7, Number(req.query.days) || 30));
  const since = new Date(Date.now() - days * 864e5).toISOString();
  const [bySource, byProject, byPerson, daily, fu, quotes, totals] = await Promise.all([
    all(`SELECT source k, count(*)::int n, count(*) FILTER (WHERE stage='Booked')::int booked FROM enquiries WHERE created_at>=? GROUP BY source ORDER BY n DESC`, since),
    all(`SELECT p.name k, count(*)::int n, count(*) FILTER (WHERE e.stage='Booked')::int booked FROM enquiries e JOIN public.projects p ON p.id=e.project_id WHERE e.created_at>=? GROUP BY p.name ORDER BY n DESC`, since),
    all(`SELECT u.id, u.name, u.status, u.photo_file_id,
          count(e.id)::int leads,
          count(e.id) FILTER (WHERE e.stage NOT IN ('Booked','Lost'))::int active,
          count(e.id) FILTER (WHERE e.stage='Booked')::int booked,
          count(e.id) FILTER (WHERE e.stage='Lost')::int lost,
          (SELECT count(*)::int FROM followups f JOIN enquiries x ON x.id=f.enquiry_id WHERE x.assigned_to=u.id AND f.done_at IS NULL AND f.due_at<now()) overdue
        FROM users u LEFT JOIN enquiries e ON e.assigned_to=u.id AND e.created_at>=?
        WHERE u.role IN ('sales','manager') AND u.active GROUP BY u.id ORDER BY booked DESC, leads DESC`, since),
    all(`SELECT to_char((created_at AT TIME ZONE 'Asia/Kolkata')::date, 'YYYY-MM-DD') d, count(*)::int n FROM enquiries WHERE created_at>=now() - interval '14 days' GROUP BY 1 ORDER BY 1`),
    one(`SELECT count(*) FILTER (WHERE due_at<now())::int overdue, count(*) FILTER (WHERE due_at>=now() AND due_at<?::timestamptz + interval '1 day')::int today, count(*)::int open FROM followups WHERE done_at IS NULL`, todayStartUtc()),
    one('SELECT count(*)::int n, coalesce(sum(total),0) v FROM quotations WHERE created_at>=?', since),
    one(`SELECT count(*)::int leads, count(*) FILTER (WHERE stage='Booked')::int booked, count(*) FILTER (WHERE stage='Lost')::int lost FROM enquiries WHERE created_at>=?`, since),
  ]);
  res.json({ days, bySource, byProject, byPerson: byPerson.map((p) => ({ ...p, photoUrl: p.photo_file_id ? `/media/photos/${p.photo_file_id}` : null })), daily, followups: fu, quotes, totals });
}));

module.exports = r;
