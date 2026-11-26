/** Kiosk API, public e-visiting card, shared document links, public photos. */
const express = require('express');
const jwt = require('jsonwebtoken');
const QRCode = require('qrcode');
const config = require('../config');
const { one, all } = require('../db');
const { requireKiosk } = require('../auth');
const wf = require('../services/workflow');
const wa = require('../services/whatsapp');
const { ah } = require('../util');

const r = express.Router();

const { SOURCES, BUDGETS, PURPOSES, VISIT_PREFS } = require('../content/enquiry-options');
const ph = (p) => { const d = String(p || '').replace(/\D/g, ''); return d.length === 12 && d.startsWith('91') ? `+91 ${d.slice(2, 7)} ${d.slice(7)}` : '+' + d; };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

r.get('/api/public/config', ah(async (_req, res) => {
  res.set('Cache-Control', 'public, max-age=60');
  res.json({
    org: config.org, projects: await wf.listProjects(), sources: SOURCES, budgets: BUDGETS,
    purposes: PURPOSES, visitPrefs: VISIT_PREFS,
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

/* QR code that opens the person's card page */
r.get('/card/:slug/qr.png', ah(async (req, res) => {
  const u = await one('SELECT slug FROM users WHERE slug=? AND active', req.params.slug);
  if (!u) return res.status(404).end();
  const png = await QRCode.toBuffer(`${config.publicUrl}/card/${u.slug}`, { margin: 1, width: 420, color: { dark: '#262B52', light: '#FFFFFF' } });
  res.set('Cache-Control', 'public, max-age=86400').type('png').send(png);
}));

/* Public e-visiting card page: /card/ankit-deshmukh */
r.get('/card/:slug', ah(async (req, res) => {
  const u = await one("SELECT * FROM users WHERE slug=? AND active AND role IN ('sales','manager')", req.params.slug);
  if (!u) return res.status(404).send('Card not found');
  const p = wf.publicProfile(u);
  const projects = await all('SELECT p.name, p.location_label, p.city FROM user_projects up JOIN public.projects p ON p.id=up.project_id WHERE up.user_id=? AND p.is_active ORDER BY p.name', u.id).catch(() => []);
  const data = { name: u.name, designation: u.designation, phone: u.phone, email: u.email, website: config.org.website, tagline: config.org.tagline,
    photoUrl: p.photoUrl, cardUrl: p.cardUrl, qrUrl: `/card/${u.slug}/qr.png` };
  const icon = (d) => `<svg class="ic" viewBox="0 0 24 24">${d}</svg>`;
  res.send(`<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(u.name)} — ${esc(config.org.name)}</title><meta name="theme-color" content="#F4F2EE">
<meta name="description" content="${esc(u.designation)} at ${esc(config.org.name)}. ${esc(config.org.tagline)}.">
<meta property="og:title" content="${esc(u.name)} · ${esc(u.designation)}"><meta property="og:description" content="${esc(config.org.name)} — ${esc(config.org.tagline)}">
<meta property="og:image" content="${config.publicUrl}${p.photoUrl || '/assets/icon-512.png'}"><link rel="icon" href="/assets/mark.png"><link rel="apple-touch-icon" href="/assets/icon-192.png">
<link rel="stylesheet" href="/assets/styles.css"></head>
<body><div class="cardpage"><div class="wrap fade-in">
  <div id="card" style="width:100%;display:flex;justify-content:center"></div>
  <div class="who"><div class="over" style="color:var(--cu-d)">${esc(config.org.name)}</div><h1>${esc(u.name)}</h1><p class="muted b">${esc(u.designation)}</p></div>
  <div class="acts">
    <a class="act" href="tel:+${esc(u.phone)}">${icon('<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>')}Call</a>
    <a class="act wa" href="https://wa.me/${esc(u.phone)}?text=${encodeURIComponent(`Hi ${u.name.split(' ')[0]}, I'd like to know more about ${config.org.name} projects.`)}">${icon('<path d="M4 20l1.3-4A8 8 0 1 1 8 18.7z"/>')}WhatsApp</a>
    <a class="act" href="mailto:${esc(u.email)}">${icon('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>')}Email</a>
    <a class="act" href="/card/${esc(u.slug)}.vcf">${icon('<path d="M12 4v11m0 0-4-4m4 4 4-4"/><path d="M5 20h14"/>')}Save</a>
  </div>
  <button class="btn line full" id="shareBtn">${icon('<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.6-4.4M8.2 13.2l7.6 4.4"/>')} Share this card</button>
  ${projects.length ? `<div class="card p box"><div class="over mb-12">Projects</div><div class="list">${projects.map((x) => `<div class="li"><span class="avatar" style="border-radius:12px;background:var(--cu-t);color:var(--cu-d)">${icon('<path d="M4 21V8l8-5 8 5v13"/><path d="M9 21v-6h6v6"/>')}</span><div class="grow"><b>${esc(x.name)}</b><div class="xs muted">${esc(x.location_label || x.city || '')}</div></div></div>`).join('')}</div></div>` : ''}
  <footer><img src="/assets/logo.png" alt="${esc(config.org.name)}"><span>${esc(config.org.tagline)} · <a href="https://${esc(config.org.website)}">${esc(config.org.website)}</a></span></footer>
</div></div>
<script src="/assets/ecard.js"></script>
<script>
  const D = ${JSON.stringify(data).replace(/</g, '\\u003c')};
  document.getElementById('card').innerHTML = MihirCard.html(D); MihirCard.bind(document);
  document.getElementById('shareBtn').onclick = async () => {
    if (navigator.share) { try { await navigator.share({ title: D.name + ' — Mihir Group', url: location.href }); return; } catch (e) { if (e.name === 'AbortError') return; } }
    try { await navigator.clipboard.writeText(location.href); document.getElementById('shareBtn').textContent = 'Link copied'; } catch {}
  };
</script></body></html>`);
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
