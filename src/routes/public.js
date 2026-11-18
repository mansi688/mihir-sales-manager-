/** Kiosk API, public e-visiting card, shared document links, public photos. */
const express = require('express');
const jwt = require('jsonwebtoken');
const QRCode = require('qrcode');
const config = require('../config');
const { one } = require('../db');
const { requireKiosk } = require('../auth');
const wf = require('../services/workflow');
const wa = require('../services/whatsapp');
const { ah } = require('../util');

const r = express.Router();

const SOURCES = ['Newspaper', 'Hoarding', 'Digital / Instagram', 'Website', 'Referral', 'Channel partner', 'Walk-by', 'Existing customer'];
const BUDGETS = ['Below ₹50 L', '₹50 – 75 L', '₹75 L – 1 Cr', '₹1 – 1.5 Cr', 'Above ₹1.5 Cr'];
const ph = (p) => { const d = String(p || '').replace(/\D/g, ''); return d.length === 12 && d.startsWith('91') ? `+91 ${d.slice(2, 7)} ${d.slice(7)}` : '+' + d; };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

r.get('/api/public/config', ah(async (_req, res) => {
  res.set('Cache-Control', 'public, max-age=60');
  res.json({
    org: config.org, projects: await wf.listProjects(), sources: SOURCES, budgets: BUDGETS,
    purposes: ['Self use', 'Investment'], visitPrefs: ['Right now', 'Later today', 'This weekend', 'Will decide'],
  });
}));

r.post('/api/kiosk/enquiries', requireKiosk, ah(async (req, res) => {
  const out = await wf.createEnquiry(req.body || {});
  const link = wa.kioskLink(out.enquiry.id);
  const qr = await QRCode.toDataURL(link, { margin: 1, width: 360, color: { dark: '#343A5E', light: '#FFFFFF' } });
  res.json({ id: out.enquiry.id, firstName: out.enquiry.name.split(' ')[0], sales: out.sales, whatsappLink: link, qr, busy: !!out.assignment.busy });
}));

r.get('/card/:slug.vcf', ah(async (req, res) => {
  const u = await one('SELECT * FROM users WHERE slug=? AND active', req.params.slug);
  if (!u) return res.status(404).end();
  res.type('text/vcard').set('Content-Disposition', `attachment; filename="${u.slug}.vcf"`).send(
    ['BEGIN:VCARD', 'VERSION:3.0', `FN:${u.name}`, `ORG:${config.org.name}`, `TITLE:${u.designation}`, `TEL;TYPE=CELL:+${u.phone}`,
      `EMAIL:${u.email}`, `URL:https://${config.org.website}`, 'END:VCARD'].join('\r\n'));
}));

/* Public e-visiting card: /card/ankit-deshmukh */
r.get('/card/:slug', ah(async (req, res) => {
  const u = await one("SELECT * FROM users WHERE slug=? AND active AND role IN ('sales','manager')", req.params.slug);
  if (!u) return res.status(404).send('Card not found');
  const p = wf.publicProfile(u);
  const photo = p.photoUrl || '/assets/mark.png';
  res.send(`<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(u.name)} — ${esc(config.org.name)}</title>
<meta property="og:title" content="${esc(u.name)} · ${esc(u.designation)}"><meta property="og:description" content="${esc(config.org.name)} — ${esc(config.org.tagline)}">
<meta property="og:image" content="${config.publicUrl}${photo}"><link rel="icon" href="/assets/mark.png">
<link rel="stylesheet" href="/assets/styles.css"></head>
<body class="card-page"><div class="ecard">
 <div class="ecard-top"><img src="/assets/logo-light.png" alt="${esc(config.org.name)}" class="ecard-logo"><img src="${esc(photo)}" alt="" class="ecard-photo"></div>
 <div><div class="ecard-name">${esc(u.name)}</div><div class="ecard-desig">${esc(u.designation)}</div></div>
 <div class="ecard-ct">📞 <a href="tel:+${esc(u.phone)}">${esc(ph(u.phone))}</a><br>✉️ <a href="mailto:${esc(u.email)}">${esc(u.email)}</a><br>🌐 <a href="https://${esc(config.org.website)}">${esc(config.org.website)}</a></div>
 <div class="ecard-tag">${esc(config.org.tagline)}</div><div class="ecard-bar"></div></div>
 <div class="card-actions"><a class="btn wa" href="https://wa.me/${esc(u.phone)}">Chat on WhatsApp</a><a class="btn ghost" href="/card/${esc(u.slug)}.vcf">Save contact</a></div>
</body></html>`);
}));

/* Staff profile photos (public: shown on e-cards) */
r.get('/media/photos/:id', ah(async (req, res) => {
  if (!/^[0-9a-f-]{36}$/i.test(req.params.id)) return res.status(404).end();
  const f = await one("SELECT f.mime, f.data FROM files f JOIN users u ON u.photo_file_id=f.id WHERE f.id=? AND f.kind='photo'", req.params.id);
  if (!f) return res.status(404).end();
  res.set('Cache-Control', 'public, max-age=86400, immutable').type(f.mime).send(f.data);
}));

/* Time-limited link to a generated document (booking PDF) */
r.get('/d/:token', ah(async (req, res) => {
  let id;
  try { id = jwt.verify(req.params.token, config.jwtSecret).f; } catch { return res.status(410).send('This link has expired. Please ask your relationship manager for a new one.'); }
  const f = await one("SELECT mime, name, data FROM files WHERE id=? AND kind='booking_pdf'", id);
  if (!f) return res.status(404).send('Document not found');
  res.set('Content-Disposition', `inline; filename="${f.name.replace(/"/g, '')}"`).type(f.mime).send(f.data);
}));

module.exports = r;
