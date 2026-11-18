/**
 * Booking form PDF (A4) → Buffer. Field layout is a placeholder until the official Mihir booking form
 * is finalised — edit the sections below to match it.
 */
const PDFDocument = require('pdfkit');
const config = require('../config');
const LOGO = require('../assets/logo');

const NAVY = '#343A5E';
const COPPER = '#C4895A';
const T = (s) => String(s ?? '').replace(/₹\s?/g, 'Rs. '); // built-in PDF fonts have no ₹ glyph
const inr = (n) => (n === null || n === undefined || n === '' ? '' : 'Rs. ' + Number(n).toLocaleString('en-IN'));
const ist = (d) => new Date(d).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST';
const fmtPhone = (p) => { const d = String(p || '').replace(/\D/g, ''); return d.length === 12 ? `+91 ${d.slice(2, 7)} ${d.slice(7)}` : '+' + d; };

/** signatures: { customer: {signed_at, image: Buffer|null}, sales: {...}, manager: {...} } */
function bookingPdf({ enquiry, booking, payment, sales, signatures, kyc }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 48, info: { Title: `Booking form ${enquiry.id}` } });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.image(LOGO, 48, 36, { height: 64 });
    doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(18).text('BOOKING FORM', 0, 48, { align: 'right' });
    doc.font('Helvetica').fontSize(9).fillColor('#555')
      .text(`Ref: ${enquiry.id}   Date: ${new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' })}`, { align: 'right' })
      .text(`${config.org.name} · ${config.org.website}`, { align: 'right' });
    doc.moveTo(48, 112).lineTo(547, 112).lineWidth(2).strokeColor(COPPER).stroke();
    doc.y = 124;

    const section = (title) => {
      doc.moveDown(0.6);
      doc.rect(48, doc.y, 499, 18).fill(NAVY);
      doc.fillColor('#fff').font('Helvetica-Bold').fontSize(10).text(title.toUpperCase(), 56, doc.y + 4);
      doc.moveDown(0.6).fillColor('#222').font('Helvetica').fontSize(10);
    };
    const rows = (pairs) => {
      for (const [k, v] of pairs) {
        const y = doc.y;
        doc.font('Helvetica').fillColor('#666').text(k, 56, y, { width: 150 });
        doc.font('Helvetica-Bold').fillColor('#222').text(T(v || '—'), 210, y, { width: 330 });
        doc.moveDown(0.25);
      }
    };

    section('Applicant');
    rows([['Name', enquiry.name], ['Mobile', '+91 ' + enquiry.mobile], ['Email', enquiry.email], ['Residence', enquiry.residence], ['Co-applicant', booking.co_applicant]]);
    section('Unit');
    rows([['Project', enquiry.project_name], ['Configuration', enquiry.config],
      ['Tower / Wing / Floor', [booking.tower, booking.wing, booking.floor].filter(Boolean).join(' / ')], ['Unit no.', booking.unit],
      ['Carpet area (sq ft)', booking.carpet_area], ['Agreement value', inr(booking.agreement_value)], ['Payment plan', booking.payment_plan]]);
    const extra = booking.extra || {};
    if (Object.keys(extra).length) rows(Object.entries(extra));
    section('Booking amount received');
    rows(payment ? [['Amount', inr(payment.amount)], ['Mode', payment.mode], ['UTR / Cheque no.', payment.ref], ['Status', payment.status], ['Receipt no.', payment.receipt_no]] : [['Status', 'Not yet received']]);
    section('KYC documents');
    rows([['Submitted', kyc.length ? [...new Set(kyc.map((k) => k.kind.toUpperCase()))].join(', ') : 'None']]);
    section('Sales');
    rows([['Relationship manager', `${sales.name} (${sales.designation})`], ['Contact', `${fmtPhone(sales.phone)} · ${sales.email}`],
      ['Lead source', enquiry.source + (enquiry.cp_name ? ' — ' + enquiry.cp_name : '')]]);

    doc.moveDown(1.2);
    const top = Math.min(doc.y, 650);
    [['customer', 'Customer'], ['sales', 'Sales'], ['manager', 'Sales Manager (approved)']].forEach(([k, label], i) => {
      const x = 56 + i * 166;
      const s = signatures[k];
      let drawn = false;
      if (s && s.image) { try { doc.image(s.image, x, top, { fit: [140, 50] }); drawn = true; } catch { /* unreadable image → text below */ } }
      if (!drawn && s) doc.font('Helvetica-Oblique').fontSize(10).fillColor(NAVY).text(k === 'manager' ? 'Approved digitally' : 'Signed digitally', x, top + 20);
      doc.moveTo(x, top + 56).lineTo(x + 140, top + 56).lineWidth(0.7).strokeColor('#999').stroke();
      doc.font('Helvetica').fontSize(9).fillColor('#444').text(label, x, top + 60);
      if (s) doc.fontSize(7.5).fillColor('#888').text(ist(s.signed_at), x, top + 72);
    });

    doc.fontSize(7.5).fillColor('#888').text('This booking form is subject to the terms of the allotment letter and agreement for sale. Booking amount is subject to realisation.',
      48, 770, { width: 499, align: 'center' });
    doc.end();
  });
}

module.exports = { bookingPdf };
