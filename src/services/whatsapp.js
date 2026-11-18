/**
 * WhatsApp Business (Meta Cloud API) adapter.
 * WA_MODE=mock → every message is stored in wa_messages with status "mock" (see Outbox page).
 * WA_MODE=cloud → sent via graph.facebook.com and stored with the API response.
 * Template wording: docs/CRM_API.md.
 */
const config = require('../config');
const { run } = require('../db');

const s = (x) => (typeof x === 'string' ? x : JSON.stringify(x ?? ''));
const record = (direction, toFrom, enquiryId, kind, body, status, response = '') =>
  run('INSERT INTO wa_messages(direction,to_from,enquiry_id,kind,body,status,response) VALUES(?,?,?,?,?,?,?)',
    direction, toFrom, enquiryId || null, kind, s(body), status, s(response));

async function send(to, enquiryId, kind, payload, preview) {
  if (config.wa.mode !== 'cloud') { await record('out', to, enquiryId, kind, preview, 'mock'); return { mock: true }; }
  try {
    const r = await fetch(`https://graph.facebook.com/${config.wa.version}/${config.wa.phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.wa.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to, ...payload }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(JSON.stringify(j));
    await record('out', to, enquiryId, kind, preview, 'sent', j);
    return j;
  } catch (err) {
    await record('out', to, enquiryId, kind, preview, 'failed', String(err.message || err));
    console.error('[whatsapp] send failed:', err.message);
    return { error: err.message };
  }
}

const template = (to, enquiryId, name, params, preview) => send(to, enquiryId, 'template', {
  type: 'template',
  template: { name, language: { code: config.wa.lang }, components: [{ type: 'body', parameters: params.map((t) => ({ type: 'text', text: String(t ?? '') })) }] },
}, preview);
const text = (to, enquiryId, body) => send(to, enquiryId, 'text', { type: 'text', text: { body, preview_url: true } }, body);

const kioskLink = (enquiryId) => `https://wa.me/${config.org.whatsapp}?text=${encodeURIComponent(`Hi, my enquiry ID is ${enquiryId}`)}`;

module.exports = { template, text, record, kioskLink };
