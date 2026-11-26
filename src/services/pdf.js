/**
 * Residential Flat Booking Application Form (A4, multi-page) → Buffer.
 * Sections and legal text come from src/content/booking-form.js so the PDF always matches the app.
 */
const PDFDocument = require('pdfkit');
// pdfkit loads its built-in fonts through package "imports" (#standard-fonts/…), which Vercel's file tracer
// does not follow. Static requires make sure the font files are bundled with the serverless function.
require('pdfkit/standard-fonts/Helvetica'); require('pdfkit/standard-fonts/HelveticaBold');
require('pdfkit/standard-fonts/HelveticaOblique'); require('pdfkit/standard-fonts/HelveticaBoldOblique');
const config = require('../config');
const LOGO = require('../assets/logo');
let LOGO_LIGHT = null; try { LOGO_LIGHT = require('../assets/logo-light'); } catch { /* optional */ }
const BF = require('../content/booking-form');

const NAVY = '#1B1E4B'; const NAVY2 = '#2A2E6E'; const COPPER = '#BC7A45'; const AQUA = '#0A8B97'; const AQUA_P = '#E9F7F7'; const LINE = '#DED8CC'; const MUTED = '#6F7290'; const SOFT = '#FAF7F0';
const M = 44; const W = 595.28 - M * 2; const BOTTOM = 841.89 - 52;

const rs = (n) => (n === null || n === undefined || n === '' || Number.isNaN(Number(n)) ? '' : 'Rs. ' + Number(n).toLocaleString('en-IN'));
const T = (s) => String(s ?? '').replace(/₹\s?/g, 'Rs. ');
const ist = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' }) : '');
const dmy = (s) => (/^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) ? s.split('-').reverse().join('-') : s || '');
const fmtPhone = (p) => { const d = String(p || '').replace(/\D/g, ''); return d.length === 12 ? `+91 ${d.slice(2, 7)} ${d.slice(7)}` : d.length === 10 ? `+91 ${d.slice(0, 5)} ${d.slice(5)}` : p || ''; };

function bookingPdf({ enquiry, booking, payment, signatures, draft, blank }) {
  const form = booking.extra || {};
  const a1 = form.a1 || {}; const a2 = form.a2 || {};
  const hasA2 = blank || !!a2.name;
  const EMPTY = blank ? '' : '—';

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margins: { top: M, bottom: 30, left: M, right: M }, bufferPages: true,
      info: { Title: blank ? 'Booking Application Form (blank)' : `Booking Application ${enquiry.id}`, Author: config.org.name } });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c)); doc.on('end', () => resolve(Buffer.concat(chunks))); doc.on('error', reject);

    const pageTop = () => {
      doc.image(LOGO, M, 26, { height: 40 });
      doc.font('Helvetica').fontSize(7.5).fillColor(MUTED).text(`${blank ? 'Booking No. ____________' : enquiry.id}  ·  ${config.org.name}  ·  ${config.org.website}`, M, 40, { width: W, align: 'right' });
      doc.moveTo(M, 74).lineTo(M + W, 74).lineWidth(1.2).strokeColor(COPPER).stroke();
      doc.y = 86;
    };
    const space = (h) => { if (doc.y + h > BOTTOM) { doc.addPage(); pageTop(); } };

    const section = (no, title) => {
      space(60);
      doc.moveDown(0.4);
      const y = doc.y;
      doc.roundedRect(M, y, W, 20, 3).fill(NAVY2);
      doc.fillColor(COPPER).font('Helvetica-Bold').fontSize(9.5).text(String(no).padStart(2, '0'), M + 8, y + 6);
      doc.fillColor('#fff').text(title.toUpperCase(), M + 28, y + 6, { characterSpacing: 0.4 });
      doc.y = y + 26; doc.fillColor('#222');
    };
    const sub = (t) => { space(30); doc.font('Helvetica-Bold').fontSize(9).fillColor(NAVY2).text(t, M, doc.y + 2); doc.y += 4; };

    /** rows: [label, v1, v2?]; cols widths fractions */
    const table = (rows, heads) => {
      const cols = heads ? (heads.length === 3 ? [0.34, 0.33, 0.33] : [0.42, 0.58]) : [0.42, 0.58];
      const xs = []; let x = M; for (const c of cols) { xs.push(x); x += c * W; }
      const ws = cols.map((c) => c * W);
      const pad = 5;
      if (heads) {
        space(20);
        const y = doc.y;
        doc.rect(M, y, W, 16).fill(SOFT);
        doc.font('Helvetica-Bold').fontSize(8).fillColor(NAVY2);
        heads.forEach((h, i) => doc.text(h, xs[i] + pad, y + 4.5, { width: ws[i] - pad * 2 }));
        doc.y = y + 16;
      }
      for (const r of rows) {
        doc.font('Helvetica').fontSize(8.5);
        const cells = r.map((c) => T(c === undefined || c === null || c === '' ? EMPTY : c));
        const h = Math.max(blank ? 21 : 16, ...cells.map((c, i) => doc.heightOfString(c, { width: ws[i] - pad * 2 }) + 8));
        space(h);
        const y = doc.y;
        cells.forEach((c, i) => {
          doc.font(i === 0 ? 'Helvetica' : 'Helvetica-Bold').fillColor(i === 0 ? MUTED : '#1d1f2e').text(c, xs[i] + pad, y + 4, { width: ws[i] - pad * 2 });
        });
        doc.moveTo(M, y + h).lineTo(M + W, y + h).lineWidth(0.5).strokeColor(LINE).stroke();
        doc.y = y + h;
      }
      doc.y += 4;
    };
    const list = (items, numbered = true) => {
      doc.font('Helvetica').fontSize(8.5).fillColor('#2a2c3a');
      items.forEach((t, i) => {
        const h = doc.heightOfString(t, { width: W - 18 }) + 3;
        space(h);
        const y = doc.y;
        doc.fillColor(COPPER).font('Helvetica-Bold').text(numbered ? `${i + 1}.` : '•', M, y, { width: 16 });
        doc.fillColor('#2a2c3a').font('Helvetica').text(T(t), M + 18, y, { width: W - 18 });
        doc.y = Math.max(doc.y, y + h);
      });
      doc.y += 3;
    };
    const pairRows = (sec) => sec.fields.map((f) => {
      const v = (o) => (f.type === 'date' ? dmy(o[f.k]) : f.k === 'mobile' || f.k === 'altMobile' ? (o[f.k] ? fmtPhone(o[f.k]) : '') : o[f.k]);
      return hasA2 ? [f.label, f.only === 'a2' ? 'N/A' : v(a1), f.only === 'a1' ? 'N/A' : v(a2)] : (f.only === 'a2' ? null : [f.label, v(a1)]);
    }).filter(Boolean);
    const heads = hasA2 ? ['Particulars', 'First Applicant', 'Second Applicant'] : ['Particulars', 'First Applicant'];
    const sec = (id) => BF.SECTIONS.find((s) => s.id === id);

    /* ---------- Cover ---------- */
    pageTop();
    doc.font('Helvetica-Bold').fontSize(17).fillColor(NAVY).text('RESIDENTIAL FLAT BOOKING APPLICATION FORM', M, doc.y + 4, { width: W });
    doc.font('Helvetica').fontSize(8).fillColor(MUTED).text('CONFIDENTIAL  •  CUSTOMER BOOKING DOCUMENT', { characterSpacing: 1 });
    doc.y += 8;
    const box = doc.y;
    doc.roundedRect(M, box, W, 58, 4).fill(SOFT);
    const kv = blank ? [['Project Name', ''], ['Application / Booking No.', ''], ['Booking Date', ''], ['Unit Configuration', '']]
      : [['Project Name', form.project || enquiry.project_name], ['Application / Booking No.', enquiry.id],
        ['Booking Date', ist(booking.created_at)], ['Unit Configuration', form.config || enquiry.config]];
    kv.forEach(([k, v], i) => {
      const x = M + 12 + (i % 2) * (W / 2); const y = box + 9 + Math.floor(i / 2) * 24;
      doc.font('Helvetica').fontSize(7.5).fillColor(MUTED).text(k.toUpperCase(), x, y, { characterSpacing: 0.5 });
      if (blank) doc.moveTo(x, y + 21).lineTo(x + W / 2 - 34, y + 21).lineWidth(0.5).strokeColor('#B9B2A5').stroke();
      else doc.font('Helvetica-Bold').fontSize(10.5).fillColor(NAVY).text(T(v || '—'), x, y + 9, { width: W / 2 - 24 });
    });
    doc.y = box + 66;

    section(1, 'Applicant Details');
    table(pairRows(sec('applicants')).map((r) => (/Aadhaar/.test(r[0]) ? r.map((c, i) => (i && c && c !== 'N/A' ? String(c).replace(/^(\d{8})/, 'XXXX XXXX ') : c)) : r)), heads);

    section(2, 'Residential & Contact Details');
    table(pairRows(sec('contact')), heads);
    table([['Correspondence Address (if different)', blank ? '' : form.corrAddress || 'Same as residential address']]);

    section(3, 'Booked Flat Details');
    table([
      ['Project Name', form.project], ['MahaRERA Registration No.', form.reraNo], ['Building / Tower', form.tower], ['Wing', form.wing],
      ['Flat / Unit Number', form.unit], ['Floor', form.floor], ['Configuration', form.config],
      ['Carpet Area (Sq. M. / Sq. Ft.)', [form.carpetSqm && `${form.carpetSqm} sq m`, form.carpetSqft && `${form.carpetSqft} sq ft`].filter(Boolean).join(' / ')],
      ['Exclusive / Other Area (if applicable)', form.exclusiveArea], ['Parking Details', form.parking], ['Possession Date', dmy(form.possession)],
      ['Total Agreement Value', rs(form.agreementValue)], ['Other Applicable Charges', rs(form.otherCharges)],
      ['Total Consideration Value', rs(form.totalConsideration)],
    ]);

    section(4, 'First Transaction / Booking Payment Details');
    table(payment || blank ? [
      ['Booking Amount', blank ? 'Rs.' : rs(payment.amount)], ['Transaction Date', blank ? '' : ist(payment.txn_date || payment.submitted_at)], ['Payment Mode', blank ? 'UPI / NEFT / RTGS / IMPS / Cheque / DD' : payment.mode],
      ['Cheque / UTR / Transaction No.', blank ? '' : payment.ref], ['Bank Name', blank ? '' : payment.bank_name], ['Branch', blank ? '' : payment.branch],
      ['Transaction Status', blank ? '' : payment.status + (payment.receipt_no ? ` · Receipt ${payment.receipt_no}` : '')], ['Amount in Words', blank ? '' : BF.amountInWords(payment.amount)],
    ] : [['Booking Amount', 'Not yet received']]);

    section(5, 'Applicant Bank Details');
    table(pairRows(sec('bank')).map((r) => (/Account Number/.test(r[0]) ? r.map((c, i) => (i && c && c.length > 4 ? 'XXXX' + String(c).slice(-4) : c)) : r)), heads);
    doc.font('Helvetica-Oblique').fontSize(7.5).fillColor(MUTED).text(sec('bank').note, M, doc.y, { width: W }); doc.y += 4;

    section(6, 'Home Loan / Financing Details');
    table(blank || (form.funding && form.funding !== 'Self-Funded') ? [
      ['Funding Source', blank ? 'Self-Funded / Home Loan / Part Loan' : form.funding], ['Loaning Bank / NBFC', form.loanBank], ['Bank Branch', form.loanBranch], ['Bank Contact Person', form.loanOfficer],
      ['Bank Contact Number', form.loanPhone && fmtPhone(form.loanPhone)], ['Loan Amount Sanctioned / Applied', rs(form.loanAmount)], ['Sanction / Application Ref. No.', form.loanRef],
    ] : [['Funding Source', form.funding || 'Self-Funded']]);

    section(7, 'Cost Sheet & Construction Linked Payment Plan (CLP)');
    table([['Total Flat Consideration', rs(form.totalConsideration)], ['Payment Plan', 'Construction Linked Payment Plan (CLP)']]);
    {
      const cols = [0.07, 0.43, 0.13, 0.2, 0.17]; const xs = []; let x = M; for (const c of cols) { xs.push(x); x += c * W; }
      const head = ['Sr.', 'Payment Milestone', 'Payment %', 'Amount (Rs.)', 'Due Date'];
      space(20); let y = doc.y; doc.rect(M, y, W, 16).fill(SOFT);
      doc.font('Helvetica-Bold').fontSize(8).fillColor(NAVY2); head.forEach((h, i) => doc.text(h, xs[i] + 5, y + 4.5, { width: cols[i] * W - 10 })); doc.y = y + 16;
      const rows = (blank ? BF.DEFAULT_CLP.map((r) => ({ milestone: r.milestone })) : form.clp || []).map((r, i) => [String(i + 1), r.milestone, blank ? '' : `${r.pct}%`, r.amount ? Number(r.amount).toLocaleString('en-IN') : '', dmy(r.due)]);
      const tot = (form.clp || []).reduce((t, r) => t + (Number(r.pct) || 0), 0);
      rows.push(['', 'Total', blank ? '100%' : `${tot}%`, form.totalConsideration ? Number(form.totalConsideration).toLocaleString('en-IN') : '', '']);
      rows.forEach((r, ri) => {
        space(blank ? 21 : 16); y = doc.y;
        doc.font(ri === rows.length - 1 ? 'Helvetica-Bold' : 'Helvetica').fontSize(8.5).fillColor('#1d1f2e');
        r.forEach((c, i) => doc.text(c || EMPTY, xs[i] + 5, y + (blank ? 6 : 4), { width: cols[i] * W - 10 }));
        { const rh = blank ? 21 : 16; doc.moveTo(M, y + rh).lineTo(M + W, y + rh).lineWidth(0.5).strokeColor(LINE).stroke(); doc.y = y + rh; }
      });
      doc.y += 6;
    }

    section(8, 'Standard Terms & Conditions');
    list(BF.TERMS);

    section(9, 'Cancellation Policy');
    list(BF.CANCELLATION);
    sub('Cancellation & refund norms as per MahaRERA (model allotment letter)');
    doc.font('Helvetica').fontSize(8).fillColor('#2a2c3a').text('For buyer-initiated cancellation (where the Developer is not in default), deductions are capped by the time elapsed from issue of the allotment letter:', M, doc.y, { width: W });
    doc.y += 3;
    table(BF.RERA_SLABS.map(([a, b]) => [a, b]), ['Cancellation request received', 'Maximum deduction']);
    list(BF.RERA_NORMS, false);

    section(10, 'Sales & Channel Partner Details');
    sub('Sales Manager Details');
    table([['Sales Manager Name', form.smName], ['Employee ID', form.smEmpId], ['Contact Number', fmtPhone(form.smPhone)], ['Email ID', form.smEmail]]);
    sub('Channel Partner Details (if applicable)');
    table(form.cpName || blank ? [['Channel Partner / Agency Name', form.cpName], ['CP Registration Code', form.cpCode], ['CP Representative Name', form.cpRep],
      ['Contact Number', form.cpPhone && fmtPhone(form.cpPhone)], ['Email ID', form.cpEmail]] : [['Channel Partner', 'Not applicable — direct booking']]);

    section(11, 'Customer Declaration & Undertaking');
    list(BF.DECLARATION, false);
    if (blank) { const yy = doc.y + 2; doc.rect(M, yy, 9, 9).lineWidth(0.8).strokeColor(NAVY2).stroke(); doc.font('Helvetica-Bold').fontSize(8.5).fillColor(NAVY2).text('I/We have read and accept the declaration, terms & conditions and cancellation policy.', M + 15, yy, { width: W - 15 }); doc.y += 6; } else
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(form.declarationAccepted ? '#1F7A4D' : '#A12C2C')
      .text(form.declarationAccepted ? 'Accepted by the applicant(s) on the booking application.' : 'Declaration not yet accepted', M, doc.y, { width: W });
    doc.y += 6;

    space(175);
    section(12, 'Signatures');
    const sy = doc.y + 4;
    const boxes = [
      ['First Applicant', blank ? '' : a1.name || enquiry.name, signatures.customer],
      ['Second Applicant', blank ? '' : hasA2 ? a2.name : 'N/A', hasA2 ? signatures.co_applicant : null],
      ['For Developer / Authorised Representative', signatures.developer ? `${signatures.developer.name || ''}${signatures.developer.designation ? ', ' + signatures.developer.designation : ''}` : '', signatures.developer],
    ];
    const bw = (W - 20) / 3;
    boxes.forEach(([title, name, s], i) => {
      const x = M + i * (bw + 10);
      doc.roundedRect(x, sy, bw, 118, 4).lineWidth(0.6).strokeColor(LINE).stroke();
      doc.font('Helvetica-Bold').fontSize(8).fillColor(NAVY2).text(title, x + 8, sy + 7, { width: bw - 16 });
      let drawn = false;
      if (s && s.image) { try { doc.image(s.image, x + 10, sy + 26, { fit: [bw - 20, 46], align: 'center' }); drawn = true; } catch { /* unreadable */ } }
      if (!drawn && s) doc.font('Helvetica-Oblique').fontSize(9).fillColor(NAVY2).text('Signed digitally', x + 10, sy + 44);
      doc.moveTo(x + 8, sy + 76).lineTo(x + bw - 8, sy + 76).lineWidth(0.6).strokeColor('#9a9a9a').stroke();
      doc.font('Helvetica').fontSize(7.5).fillColor(MUTED).text('Name', x + 8, sy + 81);
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#1d1f2e').text(T(name || (blank ? '' : '—')), x + 8, sy + 90, { width: bw - 16, height: 11, ellipsis: true });
      doc.font('Helvetica').fontSize(7.5).fillColor(MUTED).text(`Date: ${s ? ist(s.signed_at) : '____________'}`, x + 8, sy + 104);
    });
    doc.y = sy + 126;

    // Footer + page numbers (+ DRAFT watermark)
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      doc.page.margins.bottom = 0; // footer sits below the normal content area
      if (draft) {
        doc.save().rotate(-35, { origin: [297, 420] }).font('Helvetica-Bold').fontSize(80).fillColor(COPPER).opacity(0.08).text('DRAFT', 120, 380, { lineBreak: false }).restore();
        doc.opacity(1);
      }
      doc.font('Helvetica').fontSize(7).fillColor(MUTED)
        .text(`Subject to the registered Agreement for Sale and applicable MahaRERA provisions.   Page ${i + 1} of ${range.count}`, M, 841.89 - 30, { width: W, align: 'center', lineBreak: false });
    }
    doc.end();
  });
}

/**
 * Walk-in Enquiry Form — blank (for paper backup at reception) or filled from an enquiry.
 * opts: { enquiry?, projects: [{name, configs}], sources, budgets, purposes, visitPrefs, salesName? }
 */
function enquiryPdf(o) {
  const e = o.enquiry || null;
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margins: { top: M, bottom: 20, left: M, right: M }, info: { Title: e ? `Enquiry ${e.id}` : 'Walk-in Enquiry Form', Author: config.org.name } });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c)); doc.on('end', () => resolve(Buffer.concat(chunks))); doc.on('error', reject);

    doc.rect(0, 0, 595.28, 96).fill(NAVY);
    doc.image(LOGO_LIGHT || LOGO, M, 18, { height: 60 });
    doc.font('Helvetica-Bold').fontSize(17).fillColor('#fff').text('WALK-IN ENQUIRY FORM', 0, 32, { width: 595.28 - M, align: 'right' });
    doc.font('Helvetica').fontSize(8.5).fillColor('#E9D6C2').text(`${config.org.tagline.toUpperCase()}   ·   ${config.org.website}`, 0, 54, { width: 595.28 - M, align: 'right', characterSpacing: 1 });
    doc.rect(0, 96, 595.28, 3).fill(COPPER);
    let y = 114;

    const head = (n, t) => { doc.font('Helvetica-Bold').fontSize(9.5).fillColor(COPPER).text(n, M, y); doc.fillColor(NAVY2).text(t.toUpperCase(), M + 20, y, { characterSpacing: 0.6 }); y += 16; };
    const line = (label, value, x, w) => {
      doc.font('Helvetica').fontSize(7.5).fillColor(MUTED).text(label, x, y);
      if (value) doc.font('Helvetica-Bold').fontSize(10.5).fillColor('#1d1f2e').text(T(value), x, y + 10, { width: w, height: 13, ellipsis: true });
      doc.moveTo(x, y + 25).lineTo(x + w, y + 25).lineWidth(0.6).strokeColor('#B9B2A5').stroke();
    };
    const boxes = (label, list, chosen) => {
      doc.font('Helvetica').fontSize(7.5).fillColor(MUTED).text(label, M, y); y += 12;
      let x = M;
      for (const item of list) {
        doc.font('Helvetica').fontSize(9.5);
        const w = doc.widthOfString(item) + 26;
        if (x + w > M + W) { x = M; y += 18; }
        doc.roundedRect(x, y, 11, 11, 2).lineWidth(0.8).strokeColor(NAVY2).stroke();
        if (chosen && String(chosen) === String(item)) { doc.moveTo(x + 2.5, y + 6).lineTo(x + 4.8, y + 8.6).lineTo(x + 9, y + 2.6).lineWidth(1.6).strokeColor(COPPER).stroke(); }
        doc.fillColor('#1d1f2e').text(item, x + 16, y + 1);
        x += w + 8;
      }
      y += 24;
    };

    head('01', 'About you');
    line('Full name', e && e.name, M, W); y += 34;
    line('Mobile (WhatsApp)', e && '+91 ' + e.mobile, M, W / 2 - 10); line('Email', e && e.email, M + W / 2 + 10, W / 2 - 10); y += 34;
    line('Current residence (area, city)', e && e.residence, M, W); y += 40;

    head('02', 'What are you looking for?');
    boxes('Project', o.projects.map((p) => p.name), e && e.project_name);
    const configs = [...new Set(o.projects.flatMap((p) => p.configs))];
    boxes('Configuration', configs, e && e.config);
    boxes('Budget', o.budgets.map((b) => b.replace(/₹/g, 'Rs. ')), e && e.budget.replace(/₹/g, 'Rs. '));
    boxes('Purpose', o.purposes, e && e.purpose);

    head('03', 'How did you hear about us?');
    boxes('Source', o.sources, e && e.source);
    line('Channel partner name (if any)', e && e.cp_name, M, W); y += 36;
    boxes('Preferred site / sample-flat visit', o.visitPrefs, e && e.visit_pref);

    y += 2;
    doc.roundedRect(M, y, W, 40, 6).fill(SOFT);
    doc.rect(M + 10, y + 13, 10, 10).lineWidth(0.8).strokeColor(NAVY2).stroke();
    if (e && e.consent) doc.moveTo(M + 12, y + 18).lineTo(M + 14.5, y + 21).lineTo(M + 19, y + 15).lineWidth(1.6).strokeColor(COPPER).stroke();
    doc.font('Helvetica').fontSize(8.5).fillColor('#2a2c3a').text(`I agree that ${config.org.name} may contact me on WhatsApp, phone and email about this enquiry.`, M + 28, y + 14, { width: W - 40 });
    y += 52;
    line('Customer signature', '', M, W / 2 - 10); line('Date', e && ist(e.created_at), M + W / 2 + 10, W / 2 - 10); y += 42;

    doc.roundedRect(M, y, W, 66, 6).lineWidth(0.8).dash(3, { space: 3 }).strokeColor(COPPER).stroke().undash();
    doc.font('Helvetica-Bold').fontSize(8).fillColor(COPPER).text('FOR OFFICE USE', M + 10, y + 8, { characterSpacing: 1 });
    y += 24;
    const cw = (W - 40) / 3;
    line('Enquiry no.', e && e.id, M + 10, cw); line('Assigned sales person', o.salesName || (e && e.assigned_name), M + 20 + cw, cw); line('Time in', e && new Date(e.created_at).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' }), M + 30 + cw * 2, cw);

    doc.font('Helvetica').fontSize(7).fillColor(MUTED).text(`${config.org.name} · Your details are used only to assist you with this enquiry.`, M, 841.89 - 34, { width: W, align: 'center', lineBreak: false });
    doc.end();
  });
}

/* ---------- Quotation / cost sheet (single A4 page) ---------- */
function quotationPdf({ q, enquiry, rm }) {
  const c = q.data; const inp = c.inputs || {};
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margins: { top: M, bottom: 20, left: M, right: M }, info: { Title: `Quotation ${q.id}`, Author: config.org.name } });
    const chunks = [];
    doc.on('data', (x) => chunks.push(x)); doc.on('end', () => resolve(Buffer.concat(chunks))); doc.on('error', reject);
    const R = 595.28 - M;

    doc.rect(0, 0, 595.28, 96).fill(NAVY);
    doc.image(LOGO_LIGHT || LOGO, M, 18, { height: 60 });
    doc.font('Helvetica-Bold').fontSize(18).fillColor('#fff').text('QUOTATION', 0, 28, { width: R, align: 'right', characterSpacing: 1 });
    doc.font('Helvetica').fontSize(9).fillColor('#E9CDB3').text(`${q.id}   ·   ${ist(q.created_at)}   ·   Valid till ${ist(q.valid_until)}`, 0, 52, { width: R, align: 'right' });
    doc.rect(0, 96, 595.28, 3).fill(COPPER);

    let y = 116;
    const block = (x, w, title, rows) => {
      doc.font('Helvetica-Bold').fontSize(8).fillColor(COPPER).text(title.toUpperCase(), x, y, { characterSpacing: 0.8 });
      let yy = y + 14;
      for (const [k, v] of rows) {
        doc.font('Helvetica').fontSize(7.5).fillColor(MUTED).text(k, x, yy);
        doc.font('Helvetica-Bold').fontSize(10).fillColor('#1d1f2e').text(T(v || '—'), x, yy + 9, { width: w, height: 13, ellipsis: true });
        yy += 27;
      }
      return yy;
    };
    const half = (W - 20) / 2;
    const y1 = block(M, half, 'Prepared for', [['Name', enquiry.name], ['Mobile', '+91 ' + enquiry.mobile], ['Enquiry', enquiry.id]]);
    const y2 = block(M + half + 20, half, 'Property', [['Project', enquiry.project_name], ['Unit', q.unit_label || '—'], ['Configuration · Carpet area', `${enquiry.config} · ${inp.carpet || '—'} sq ft (RERA)`]]);
    y = Math.max(y1, y2) + 6;

    // cost table
    const groups = [['agreement', 'A. Agreement value'], ['govt', 'B. Government taxes & charges'], ['other', 'C. Other charges']];
    const sums = { agreement: c.agreement, govt: c.gst + c.stamp + c.reg, other: inp.otherCharges || 0 };
    doc.roundedRect(M, y, W, 22, 3).fill(NAVY2);
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#fff').text('PARTICULARS', M + 10, y + 7).text('AMOUNT', M, y + 7, { width: W - 10, align: 'right' });
    y += 28;
    for (const [g, title] of groups) {
      const lines = c.lines.filter((l) => l.group === g); if (!lines.length) continue;
      doc.font('Helvetica-Bold').fontSize(9).fillColor(NAVY2).text(title, M + 4, y); y += 15;
      for (const l of lines) {
        doc.font('Helvetica').fontSize(9.5).fillColor('#2a2c3a').text(T(l.label), M + 14, y, { width: W - 160 });
        doc.font('Helvetica-Bold').text(rs(l.amount), M, y, { width: W - 10, align: 'right' });
        y += 17; doc.moveTo(M + 14, y - 4).lineTo(M + W, y - 4).lineWidth(0.4).strokeColor(LINE).stroke();
      }
      doc.rect(M, y - 2, W, 18).fill(SOFT);
      doc.font('Helvetica-Bold').fontSize(9).fillColor(NAVY2).text(`Sub-total ${title.slice(0, 1)}`, M + 14, y + 3).text(rs(sums[g]), M, y + 3, { width: W - 10, align: 'right' });
      y += 24;
    }
    doc.roundedRect(M, y, W, 40, 4).fill(NAVY);
    doc.font('Helvetica').fontSize(8).fillColor('#C9CBE6').text('TOTAL COST (A + B + C)', M + 14, y + 9, { characterSpacing: 0.8 });
    doc.font('Helvetica-Bold').fontSize(16).fillColor('#fff').text(rs(c.total), M, y + 12, { width: W - 14, align: 'right' });
    y += 52;

    doc.roundedRect(M, y, W, 34, 4).fill(AQUA_P);
    doc.font('Helvetica-Bold').fontSize(9).fillColor(AQUA).text(`Booking amount: up to ${rs(c.bookingAmount)}`, M + 12, y + 7);
    doc.font('Helvetica').fontSize(8).fillColor('#2a2c3a').text('As per RERA, not more than 10% of the agreement value is collected before registering the Agreement for Sale. The balance follows the construction-linked plan.', M + 12, y + 19, { width: W - 24 });
    y += 46;

    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(NAVY2).text('Terms', M, y); y += 12;
    const terms = [
      `This quotation is valid till ${ist(q.valid_until)} and is subject to unit availability at the time of booking.`,
      'Government taxes and charges are at prevailing rates and are payable at actuals; any change in rates will be applicable.',
      'Stamp duty concession, if any (e.g. for women buyers), is applied at registration as per Government notification.',
      'This is an indicative cost sheet, not an offer or allotment. The Agreement for Sale shall prevail.',
    ];
    doc.font('Helvetica').fontSize(7.8).fillColor('#3a3c4a');
    terms.forEach((t, i) => { doc.text(`${i + 1}. ${t}`, M, y, { width: W }); y = doc.y + 2; });

    // relationship manager footer
    const fy = 841.89 - 92;
    doc.moveTo(M, fy).lineTo(M + W, fy).lineWidth(1).strokeColor(COPPER).stroke();
    doc.font('Helvetica').fontSize(7.5).fillColor(MUTED).text('YOUR RELATIONSHIP MANAGER', M, fy + 10, { characterSpacing: 0.8 });
    doc.font('Helvetica-Bold').fontSize(11).fillColor(NAVY).text(rm ? rm.name : config.org.name, M, fy + 22);
    doc.font('Helvetica').fontSize(8.5).fillColor('#3a3c4a').text(rm ? `${rm.designation}  ·  ${fmtPhone(rm.phone)}  ·  ${rm.email}` : '', M, fy + 37);
    doc.font('Helvetica').fontSize(8).fillColor(MUTED).text(`${config.org.name} · ${config.org.website}`, M, fy + 22, { width: W, align: 'right' });
    doc.font('Helvetica-Oblique').fontSize(8).fillColor(COPPER).text(config.org.tagline, M, fy + 37, { width: W, align: 'right' });
    doc.end();
  });
}

module.exports = { bookingPdf, enquiryPdf, quotationPdf };
