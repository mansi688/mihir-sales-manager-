/**
 * Inbound webhooks.
 *  GET/POST /webhooks/whatsapp          — Meta Cloud API (verify + incoming messages)
 *  POST     /webhooks/internal/payment  — internal portal reports a payment verified / rejected
 */
const express = require('express');
const config = require('../config');
const { one } = require('../db');
const wf = require('../services/workflow');
const { ah } = require('../util');

const r = express.Router();

r.get('/webhooks/whatsapp', (req, res) => {
  if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === config.wa.verifyToken) return res.status(200).send(req.query['hub.challenge']);
  res.sendStatus(403);
});

// Serverless: finish the work before responding (the function may be frozen right after the response).
r.post('/webhooks/whatsapp', ah(async (req, res) => {
  for (const en of req.body?.entry || []) {
    for (const ch of en.changes || []) {
      for (const m of ch.value?.messages || []) {
        const text = m.text?.body || m.button?.text || m.interactive?.button_reply?.title || '';
        try { await wf.handleInboundWhatsApp(m.from, text); } catch (err) { console.error('[webhook] whatsapp', err); }
      }
    }
  }
  res.sendStatus(200);
}));

/** Body: { "paymentId": 12, "status": "Received" | "Rejected", "receiptNo": "RCPT-001", "remarks": "" }; header X-Webhook-Secret */
r.post('/webhooks/internal/payment', ah(async (req, res) => {
  if (req.get('X-Webhook-Secret') !== config.internal.webhookSecret) return res.sendStatus(401);
  const { paymentId, status, receiptNo, remarks } = req.body || {};
  const p = await one('SELECT id FROM payments WHERE id=?', Number(paymentId) || 0);
  if (!p) return res.status(404).json({ error: 'payment not found' });
  if (status === 'Received') await wf.verifyPayment(p.id, null, receiptNo);
  else if (status === 'Rejected') await wf.rejectPayment(p.id, { id: null, name: 'Internal portal' }, remarks);
  else return res.status(400).json({ error: 'status must be Received or Rejected' });
  res.json({ ok: true });
}));

module.exports = r;
