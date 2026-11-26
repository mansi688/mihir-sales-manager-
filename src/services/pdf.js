/**
 * Residential Flat Booking Application Form (A4, multi-page) → Buffer.
 * Sections and legal text come from src/content/booking-form.js so the PDF always matches the app.
 */
const PDFDocument = require('pdfkit');
const config = require('../config');
const LOGO = require('../assets/logo');
const BF = require('../content/booking-form');

const NAVY = '#23284A'; const NAVY2 = '#343A5E'; const COPPER = '#C4895A'; const LINE = '#D9D4CB'; const MUTED = '#6B6F80'; const SOFT = '#F6F2EC';
const M = 44; const W = 595.28 - M * 2; const BOTTOM = 841.89 - 52;

const rs = (n) => (n === null || n === undefined || n === '' || Number.isNaN(Number(n)) ? '' : 'Rs. ' + Number(n).toLocaleString('en-IN'));
const T = (s) => String(s ?? '').replace(/₹\s?/g, 'Rs. ');
const ist = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' }) : '');
const dmy = (s) => (/^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) ? s.split('-').reverse().join('-') : s || '');
const fmtPhone = (p) => { const d = String(p || '').replace(/\D/g, ''); return d.length === 12 ? `+91 ${d.slice(2, 7)} ${d.slice(7)}` : d.length === 10 ? `+91 ${d.slice(0, 5)} ${d.slice(5)}` : p || ''; };

function bookingPdf({ enquiry, booking, payment, signatures, draft }) {
  const form = booking.extra || {};
  const a1 = form.a1 || {}; const a2 = form.a2 || {};
  const hasA2 = !!a2.name;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margins: { top: M, bottom: 30, left: M, right: M }, bufferPages: true,
      info: { Title: `Booking Application ${enquiry.id}`, Author: config.org.name } });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c)); doc.on('end', () => resolve(Buffer.concat(chunks))); doc.on('error', reject);

    const pageTop = () => {
      doc.image(LOGO, M, 26, { height: 40 });
      doc.font('Helvetica').fontSize(7.5).fillColor(MUTED).text(`${enquiry.id}  ·  ${config.org.name}  ·  ${config.org.website}`, M, 40, { width: W, align: 'right' });
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
        const cells = r.map((c) => T(c === undefined || c === null || c === '' ? '—' : c));
        const h = Math.max(16, ...cells.map((c, i) => doc.heightOfString(c, { width: ws[i] - pad * 2 }) + 8));
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
    const kv = [['Project Name', form.project || enquiry.project_name], ['Application / Booking No.', enquiry.id],
      ['Booking Date', ist(booking.created_at)], ['Unit Configuration', form.config || enquiry.config]];
    kv.forEach(([k, v], i) => {
      const x = M + 12 + (i % 2) * (W / 2); const y = box + 9 + Math.floor(i / 2) * 24;
      doc.font('Helvetica').fontSize(7.5).fillColor(MUTED).text(k.toUpperCase(), x, y, { characterSpacing: 0.5 });
      doc.font('Helvetica-Bold').fontSize(10.5).fillColor(NAVY).text(T(v || '—'), x, y + 9, { width: W / 2 - 24 });
    });
    doc.y = box + 66;

    section(1, 'Applicant Details');
    table(pairRows(sec('applicants')).map((r) => (/Aadhaar/.test(r[0]) ? r.map((c, i) => (i && c && c !== 'N/A' ? String(c).replace(/^(\d{8})/, 'XXXX XXXX ') : c)) : r)), heads);

    section(2, 'Residential & Contact Details');
    table(pairRows(sec('contact')), heads);
    table([['Correspondence Address (if different)', form.corrAddress || 'Same as residential address']]);

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
    table(payment ? [
      ['Booking Amount', rs(payment.amount)], ['Transaction Date', ist(payment.txn_date || payment.submitted_at)], ['Payment Mode', payment.mode],
      ['Cheque / UTR / Transaction No.', payment.ref], ['Bank Name', payment.bank_name], ['Branch', payment.branch],
      ['Transaction Status', payment.status + (payment.receipt_no ? ` · Receipt ${payment.receipt_no}` : '')], ['Amount in Words', BF.amountInWords(payment.amount)],
    ] : [['Booking Amount', 'Not yet received']]);

    section(5, 'Applicant Bank Details');
    table(pairRows(sec('bank')).map((r) => (/Account Number/.test(r[0]) ? r.map((c, i) => (i && c && c.length > 4 ? 'XXXX' + String(c).slice(-4) : c)) : r)), heads);
    doc.font('Helvetica-Oblique').fontSize(7.5).fillColor(MUTED).text(sec('bank').note, M, doc.y, { width: W }); doc.y += 4;

    section(6, 'Home Loan / Financing Details');
    table(form.funding && form.funding !== 'Self-Funded' ? [
      ['Funding Source', form.funding], ['Loaning Bank / NBFC', form.loanBank], ['Bank Branch', form.loanBranch], ['Bank Contact Person', form.loanOfficer],
      ['Bank Contact Number', form.loanPhone && fmtPhone(form.loanPhone)], ['Loan Amount Sanctioned / Applied', rs(form.loanAmount)], ['Sanction / Application Ref. No.', form.loanRef],
    ] : [['Funding Source', form.funding || 'Self-Funded']]);

    section(7, 'Cost Sheet & Construction Linked Payment Plan (CLP)');
    table([['Total Flat Consideration', rs(form.totalConsideration)], ['Payment Plan', 'Construction Linked Payment Plan (CLP)']]);
    {
      const cols = [0.07, 0.43, 0.13, 0.2, 0.17]; const xs = []; let x = M; for (const c of cols) { xs.push(x); x += c * W; }
      const head = ['Sr.', 'Payment Milestone', 'Payment %', 'Amount (Rs.)', 'Due Date'];
      space(20); let y = doc.y; doc.rect(M, y, W, 16).fill(SOFT);
      doc.font('Helvetica-Bold').fontSize(8).fillColor(NAVY2); head.forEach((h, i) => doc.text(h, xs[i] + 5, y + 4.5, { width: cols[i] * W - 10 })); doc.y = y + 16;
      const rows = (form.clp || []).map((r, i) => [String(i + 1), r.milestone, `${r.pct}%`, r.amount ? Number(r.amount).toLocaleString('en-IN') : '', dmy(r.due)]);
      const tot = (form.clp || []).reduce((t, r) => t + (Number(r.pct) || 0), 0);
      rows.push(['', 'Total', `${tot}%`, form.totalConsideration ? Number(form.totalConsideration).toLocaleString('en-IN') : '', '']);
      rows.forEach((r, ri) => {
        space(16); y = doc.y;
        doc.font(ri === rows.length - 1 ? 'Helvetica-Bold' : 'Helvetica').fontSize(8.5).fillColor('#1d1f2e');
        r.forEach((c, i) => doc.text(c || '—', xs[i] + 5, y + 4, { width: cols[i] * W - 10 }));
        doc.moveTo(M, y + 16).lineTo(M + W, y + 16).lineWidth(0.5).strokeColor(LINE).stroke(); doc.y = y + 16;
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
    table(form.cpName ? [['Channel Partner / Agency Name', form.cpName], ['CP Registration Code', form.cpCode], ['CP Representative Name', form.cpRep],
      ['Contact Number', form.cpPhone && fmtPhone(form.cpPhone)], ['Email ID', form.cpEmail]] : [['Channel Partner', 'Not applicable — direct booking']]);

    section(11, 'Customer Declaration & Undertaking');
    list(BF.DECLARATION, false);
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(form.declarationAccepted ? '#1F7A4D' : '#A12C2C')
      .text(form.declarationAccepted ? 'Accepted by the applicant(s) on the booking application.' : 'Declaration not yet accepted', M, doc.y, { width: W });
    doc.y += 6;

    section(12, 'Signatures');
    space(130);
    const sy = doc.y + 4;
    const boxes = [
      ['First Applicant', a1.name || enquiry.name, signatures.customer],
      ['Second Applicant', hasA2 ? a2.name : 'N/A', hasA2 ? signatures.co_applicant : null],
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
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#1d1f2e').text(T(name || '—'), x + 8, sy + 90, { width: bw - 16, height: 11, ellipsis: true });
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

module.exports = { bookingPdf };
