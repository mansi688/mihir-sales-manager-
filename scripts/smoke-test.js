/**
 * End-to-end check of the whole journey against a throwaway database.
 *   npm test
 */
const os = require('os');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

/* Needs a local Postgres. TEST_ADMIN_URL must be a superuser URL, e.g. postgres://postgres@127.0.0.1:5544/postgres */
const { execFileSync } = require('child_process');
const ADMIN = process.env.TEST_ADMIN_URL || 'postgres://postgres@127.0.0.1:5544/postgres';
const DB = 'mihir_smoke_' + process.pid;
const root = path.join(__dirname, '..');
const psql = (url, ...args) => execFileSync('psql', [url, '-v', 'ON_ERROR_STOP=1', '-q', ...args], { stdio: ['ignore', 'ignore', 'inherit'] });
psql(ADMIN, '-c', `create database ${DB}`);
const dbUrl = ADMIN.replace(/\/[^/]*$/, '/' + DB);
for (const f of ['db/test/crm_fixture.sql', 'db/migrations/001_sales_schema.sql', 'db/migrations/002_seed_staff.sql', 'db/migrations/004_booking_application.sql']) psql(dbUrl, '-f', path.join(root, f));
const roleSql = fs.readFileSync(path.join(root, 'db/migrations/003_app_role.sql.template'), 'utf8').replace(/__PASSWORD__/g, 'smokepass');
const tmpSql = path.join(os.tmpdir(), DB + '.sql'); fs.writeFileSync(tmpSql, roleSql); psql(dbUrl, '-f', tmpSql); fs.rmSync(tmpSql);
psql(dbUrl, '-f', path.join(root, 'db/migrations/005_followups_quotations.sql'));
psql(dbUrl, '-f', path.join(root, 'db/migrations/006_customer_forms.sql'));
psql(dbUrl, '-f', path.join(root, 'db/migrations/007_usernames.sql'));
const u = new URL(dbUrl); u.username = 'sales_portal'; u.password = 'smokepass';
Object.assign(process.env, {
  DATABASE_URL: u.toString(), KIOSK_KEY: 'test-key', WA_MODE: 'mock', CRM_MODE: 'supabase', INTERNAL_MODE: 'mock', INTERNAL_WEBHOOK_SECRET: 'whsec', JWT_SECRET: 'test',
});
const app = require('../src/server');

let PNG; // real PNG (a QR code) used as a stand-in signature / KYC image
let base;
function client() {
  let cookie = '';
  return async (method, p, body, headers = {}) => {
    const opts = { method, headers: { ...headers, cookie } };
    if (body instanceof FormData) opts.body = body;
    else if (body !== undefined) { opts.body = JSON.stringify(body); opts.headers['Content-Type'] = 'application/json'; }
    const r = await fetch(base + p, opts);
    const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
    const ct = r.headers.get('content-type') || '';
    const data = ct.includes('json') ? await r.json() : await r.text();
    return { status: r.status, data, headers: r.headers };
  };
}
const ok = (r, label) => { if (r.status >= 400) { console.error(label, r.status, r.data); process.exit(1); } console.log('  ✓', label); return r.data; };

(async () => {
  const server = app.listen(0); await new Promise((res) => server.once('listening', res));
  base = `http://127.0.0.1:${server.address().port}`;
  PNG = await require('qrcode').toDataURL('signature');
  const kiosk = client(); const sales = client(); const desk = client(); const mgr = client(); const acc = client(); const anon = client();

  console.log('Kiosk');
  const cfg = ok(await kiosk('GET', '/api/public/config'), 'public config');
  const heights = cfg.projects.find((p) => p.name === 'Mihir Amara');
  assert.strictEqual(cfg.projects.length, 4); assert.ok(heights.configs.includes('2 BHK'));
  assert.strictEqual((await kiosk('POST', '/api/kiosk/enquiries', {})).status, 401, 'kiosk key required');
  const bad = await kiosk('POST', '/api/kiosk/enquiries', { name: 'X', mobile: '123' }, { 'X-Kiosk-Key': 'test-key' });
  assert.strictEqual(bad.status, 400); console.log('  ✓ validation rejects bad mobile');
  const sub = ok(await kiosk('POST', '/api/kiosk/enquiries', {
    name: 'Rahul Sharma', mobile: '9876543210', email: 'rahul@example.com', residence: 'Baner, Pune', projectId: heights.id,
    config: '2 BHK', budget: '₹75 L – 1 Cr', purpose: 'Self use', source: 'Newspaper', visitPref: 'Right now', consent: true,
  }, { 'X-Kiosk-Key': 'test-key' }), 'enquiry submitted');
  assert.match(sub.id, /^MG-\d+$/); assert.ok(sub.qr.startsWith('data:image/png')); assert.ok(sub.sales && sub.sales.name);
  assert.ok(sub.whatsappLink.includes(encodeURIComponent(sub.id)));
  console.log(`  → ${sub.id} assigned to ${sub.sales.name}`);

  const cp = ok(await kiosk('POST', '/api/kiosk/enquiries', {
    name: 'CP Lead', mobile: '9811111111', projectId: heights.id, config: '1 BHK', budget: 'Below ₹50 L', source: 'Channel partner', cpName: 'prime realty', consent: true,
  }, { 'X-Kiosk-Key': 'test-key' }), 'channel-partner enquiry');
  assert.strictEqual(cp.sales.name, 'Ankit Deshmukh', 'CP owner gets the lead'); console.log('  ✓ CP lead routed to CP owner');
  const rep = ok(await kiosk('POST', '/api/kiosk/enquiries', {
    name: 'Rahul Sharma', mobile: '9876543210', projectId: cfg.projects[0].id, config: cfg.projects[0].configs[0], budget: 'Below ₹50 L', source: 'Walk-by', consent: true,
  }, { 'X-Kiosk-Key': 'test-key' }), 'repeat visit');
  assert.strictEqual(rep.sales.name, sub.sales.name); console.log('  ✓ repeat customer goes to original owner');

  console.log('WhatsApp');
  ok(await anon('POST', '/webhooks/whatsapp', { entry: [{ changes: [{ value: { messages: [{ from: '919876543210', text: { body: `Hi, my enquiry ID is ${sub.id}` } }] } }] }] }), 'inbound message webhook');
  const verify = await anon('GET', '/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=mihir-verify-token&hub.challenge=42');
  assert.strictEqual(verify.data, '42'); console.log('  ✓ webhook verification');

  console.log('Staff');
  assert.strictEqual((await sales('POST', '/api/auth/login', { phone: '9822011223', pin: '0000' })).status, 401); console.log('  ✓ wrong PIN rejected');
  const sp = { 'Ankit Deshmukh': '9822011223', 'Priya Kulkarni': '9890144556', 'Rohan Patil': '9765477889', 'Sneha Joshi': '9970022334' }[sub.sales.name];
  ok(await sales('POST', '/api/auth/login', { phone: sp, pin: '1234' }), 'sales login');
  ok(await desk('POST', '/api/auth/login', { phone: '9000000002', pin: '1234' }), 'reception login');
  const u1 = client(); ok(await u1('POST', '/api/auth/login', { username: 'Kavita', password: '1234' }), 'login with username');
  assert.strictEqual((await u1('POST', '/api/auth/login', { username: 'nobody', password: '1234' })).status, 401); console.log('  ✓ unknown username rejected');
  ok(await mgr('POST', '/api/auth/login', { phone: '9000000003', pin: '1234' }), 'manager login (pre)');
  ok(await mgr('POST', '/api/auth/login', { phone: '9000000003', pin: '1234' }), 'manager login');
  ok(await acc('POST', '/api/auth/login', { phone: '9000000004', pin: '1234' }), 'accounts login');

  const board = ok(await desk('GET', '/api/board'), 'reception board');
  assert.ok(board.stats.walkins >= 3);
  assert.strictEqual((await sales('GET', '/api/board')).status, 403); console.log('  ✓ sales cannot open the board');
  const mine = ok(await sales('GET', '/api/enquiries'), 'my customers');
  assert.ok(mine.enquiries.every((e) => e.assigned_to === mine.enquiries[0].assigned_to));
  let e = ok(await sales('GET', `/api/enquiries/${sub.id}`), 'enquiry detail').enquiry;
  assert.ok(e.wa_linked_at, 'WhatsApp linked');
  assert.ok(e.crm_enquiry_id, 'CRM enquiry created');

  console.log('Journey');
  ok(await sales('POST', `/api/enquiries/${sub.id}/attend`, {}), 'attend');
  ok(await sales('POST', `/api/enquiries/${sub.id}/visit`, { units: 'A-1204', feedback: 'Hot — ready to book' }), 'site visit');
  const units = ok(await sales('GET', `/api/projects/${heights.id}/units`), 'project units').units;
  assert.ok(units.length > 0 && units.every((x) => x.status === 'Available'));
  const flat = units.find((x) => x.flat_type === '2 BHK');
  const form = {
    a1: { name: 'Rahul Sharma', relation: 'Suresh Sharma', dob: '1990-05-12', gender: 'Male', pan: 'abcde1234f', aadhaar: '1234 1234 1234', nationality: 'Indian',
      address: 'Flat 12, Shanti Apts, Baner Road', city: 'Pune, Maharashtra', pin: '411045', mobile: '9876543210', email: 'rahul@example.com',
      holder: 'Rahul Sharma', bank: 'HDFC Bank', branch: 'Baner', accountNo: '50100012345678', ifsc: 'HDFC0001234', accountType: 'Savings' },
    a2: { name: 'Priya Sharma', relation: 'Rahul Sharma', relationship: 'Spouse', dob: '1992-01-02', gender: 'Female', pan: 'PQRSX5678K', address: 'Same', city: 'Pune', pin: '411045', mobile: '9876500000' },
    agreementValue: '11800000', otherCharges: '200000', parking: '1 covered', funding: 'Home Loan', loanBank: 'SBI', loanAmount: '8000000',
    declarationAccepted: false,
  };
  e = ok(await sales('PUT', `/api/enquiries/${sub.id}/booking`, { flatId: flat.id, form }), 'booking application draft + unit hold').enquiry;
  assert.strictEqual(e.stage, 'Booking form'); assert.ok(e.booking.hold_until); assert.strictEqual(e.booking.unit, flat.flat_no);
  assert.strictEqual(e.booking.total_consideration, 12000000); assert.strictEqual(e.booking.extra.a1.pan, 'ABCDE1234F');
  assert.strictEqual(e.booking.extra.smName, sub.sales.name); assert.strictEqual(e.booking.extra.clp[0].amount, 1200000);
  const notYet = await sales('PUT', `/api/enquiries/${sub.id}/booking`, { flatId: flat.id, form, submit: true });
  assert.strictEqual(notYet.status, 400); assert.ok(notYet.data.errors.some((x) => /declaration/.test(x))); console.log('  ✓ submit blocked until declaration accepted');
  const badClp = await sales('PUT', `/api/enquiries/${sub.id}/booking`, { flatId: flat.id, form: { ...form, declarationAccepted: true, clp: [{ milestone: 'Booking Amount', pct: 20 }, { milestone: 'Rest', pct: 80 }] }, submit: true });
  assert.ok(badClp.data.errors.some((x) => /10%/.test(x))); console.log('  ✓ CLP booking above 10% rejected (RERA)');
  e = ok(await sales('PUT', `/api/enquiries/${sub.id}/booking`, { flatId: flat.id, form: { ...form, declarationAccepted: true }, submit: true }), 'booking application submitted').enquiry;
  assert.strictEqual(e.stage, 'KYC');
  const prev = await sales('GET', `/api/enquiries/${sub.id}/application.pdf`);
  assert.strictEqual(prev.status, 200); assert.ok(String(prev.data).startsWith('%PDF')); console.log('  ✓ application PDF preview');
  const after = ok(await sales('GET', `/api/projects/${heights.id}/units`), 'units after hold').units;
  assert.strictEqual(after.find((x) => x.id === flat.id).status, 'On hold');
  const clash = await sales('PUT', `/api/enquiries/${cp.id}/booking`, { flatId: flat.id });
  assert.ok([403, 409].includes(clash.status)); console.log('  ✓ double-booking blocked');
  assert.strictEqual((await sales('POST', `/api/enquiries/${sub.id}/kyc/complete`, {})).status, 400); console.log('  ✓ KYC incomplete rejected');
  for (const kind of ['pan', 'aadhaar', 'photo']) {
    const fd = new FormData(); fd.append('kind', kind); fd.append('file', new Blob([Buffer.from(PNG.split(',')[1], 'base64')], { type: 'image/png' }), `${kind}.png`);
    ok(await sales('POST', `/api/enquiries/${sub.id}/kyc`, fd), `upload ${kind}`);
  }
  ok(await sales('POST', `/api/enquiries/${sub.id}/kyc/complete`, {}), 'KYC complete');
  assert.strictEqual((await sales('POST', `/api/enquiries/${sub.id}/signatures`, { customer: PNG })).status, 400); console.log('  ✓ signatures locked until payment verified');
  const over = await sales('POST', `/api/enquiries/${sub.id}/payments`, { amount: '15,00,000', mode: 'NEFT/RTGS', ref: 'UTR1' });
  assert.strictEqual(over.status, 400); assert.ok(/RERA/.test(over.data.error)); console.log('  ✓ payment above 10% blocked (RERA)');
  e = ok(await sales('POST', `/api/enquiries/${sub.id}/payments`, { amount: '12,00,000', mode: 'NEFT/RTGS', ref: 'UTR123456', txnDate: '2026-11-26', bankName: 'HDFC Bank', branch: 'Baner' }), 'payment submitted').enquiry;
  assert.strictEqual(e.payments[0].bank_name, 'HDFC Bank');
  const pay = ok(await acc('GET', '/api/payments'), 'accounts queue').payments.find((p) => p.enquiry_id === sub.id);
  assert.ok(pay);
  ok(await anon('POST', '/webhooks/internal/payment', { paymentId: pay.id, status: 'Received', receiptNo: 'RCPT-9001' }, { 'X-Webhook-Secret': 'whsec' }), 'payment verified via internal-portal webhook');
  assert.strictEqual((await mgr('POST', `/api/enquiries/${sub.id}/approve`, {})).status, 400); console.log('  ✓ approval needs signatures');
  ok(await sales('POST', `/api/enquiries/${sub.id}/signatures`, { customer: PNG }), 'first applicant signature');
  assert.strictEqual((await mgr('POST', `/api/enquiries/${sub.id}/approve`, { developer: PNG })).status, 400); console.log('  ✓ approval needs second applicant signature');
  ok(await sales('POST', `/api/enquiries/${sub.id}/signatures`, { coApplicant: PNG }), 'second applicant signature');
  assert.strictEqual((await mgr('POST', `/api/enquiries/${sub.id}/approve`, {})).status, 400); console.log('  ✓ approval needs developer signature');
  assert.strictEqual((await sales('POST', `/api/enquiries/${sub.id}/approve`, {})).status, 403); console.log('  ✓ sales cannot self-approve');
  e = ok(await mgr('POST', `/api/enquiries/${sub.id}/approve`, { developer: PNG }), 'manager signs & approves').enquiry;
  assert.ok(e.signatures.developer && e.signatures.co_applicant);
  assert.strictEqual(e.stage, 'Booked'); assert.ok(e.booking.pdf_file_id);
  const sold = ok(await sales('GET', `/api/projects/${heights.id}/units`), 'units after booking').units;
  assert.strictEqual(sold.find((x) => x.id === flat.id).status, 'Sold'); console.log('  ✓ unit marked Sold');
  const kycFile = await sales('GET', `/api/files/${e.kyc[0].file_id}`);
  assert.strictEqual(kycFile.status, 200);
  assert.strictEqual((await anon('GET', `/api/files/${e.kyc[0].file_id}`)).status, 401); console.log('  ✓ KYC files need login');
  const pdf = await sales('GET', `/api/enquiries/${sub.id}/booking.pdf`);
  assert.strictEqual(pdf.status, 200); assert.ok(String(pdf.data).startsWith('%PDF')); console.log('  ✓ booking PDF generated');
  const link = ok(await sales('GET', `/api/enquiries/${sub.id}/share-link`), 'share link').url;
  const shared = await anon('GET', link.replace(/^https?:\/\/[^/]+/, ''));
  assert.strictEqual(shared.status, 200); console.log('  ✓ customer link opens PDF without login');

  console.log('Follow-ups, quotations, analytics, customer portal');
  ok(await sales('POST', `/api/enquiries/${rep.id}/followups`, { kind: 'Call', dueAt: new Date(Date.now() - 3600e3).toISOString(), note: 'Share floor plans' }), 'schedule follow-up');
  const fl = ok(await sales('GET', '/api/followups'), 'list follow-ups').followups;
  assert.ok(fl.some((f) => f.enquiry_id === rep.id));
  const st = ok(await sales('GET', '/api/stats'), 'stats'); assert.ok(st.followupsOverdue >= 1); console.log('  ✓ overdue follow-up counted');
  ok(await sales('POST', `/api/followups/${fl[0].id}/done`, { outcome: 'Spoke — interested' }), 'follow-up done');
  assert.strictEqual((await sales('POST', `/api/followups/${fl[0].id}/done`, {})).status, 400); console.log('  ✓ cannot complete twice');
  const qt = ok(await sales('POST', `/api/enquiries/${rep.id}/quotations`, { carpet: 900, floor: 5, rate: 9000, floorRise: 25, parking: 300000, otherCharges: 150000 }), 'create quotation');
  assert.match(qt.id, /^Q-\d+$/);
  const qrow = await require('../src/db').one('SELECT total, data FROM quotations WHERE id=?', qt.id);
  // 900*9000=8,100,000 + floor rise 900*25*4=90,000 + parking 300,000 = 8,490,000 AV; GST 424,500; stamp 509,400; reg 30,000; other 150,000
  assert.strictEqual(Number(qrow.total), 8490000 + 424500 + 509400 + 30000 + 150000); console.log('  ✓ quotation maths');
  assert.strictEqual((await sales('POST', `/api/enquiries/${rep.id}/quotations`, { rate: 9000 })).status, 400); console.log('  ✓ quotation needs area');
  const qpdf = await sales('GET', `/api/quotations/${qt.id}.pdf`); assert.strictEqual(qpdf.status, 200); console.log('  ✓ quotation PDF');
  const qpub = await anon('GET', qt.url.replace(/^https?:\/\/[^/]+/, '')); assert.strictEqual(qpub.status, 200); console.log('  ✓ customer quotation link');
  const det = ok(await sales('GET', `/api/enquiries/${rep.id}`), 'detail with follow-ups').enquiry; assert.strictEqual(det.quotations.length, 1); assert.strictEqual(det.followups.length, 1);
  const an = ok(await mgr('GET', '/api/analytics?days=30'), 'analytics'); assert.ok(an.totals.leads >= 3 && an.byPerson.length && an.bySource.length);
  assert.strictEqual((await sales('GET', '/api/analytics')).status, 403); console.log('  ✓ analytics is for managers / desk');
  const rmSlug = 'sneha-joshi';
  const onl = ok(await anon('POST', '/api/public/enquiries', { name: 'Online Lead', mobile: '9822334455', projectId: cfg.projects[0].id, config: cfg.projects[0].configs[0], budget: '₹50 – 75 L', consent: true, rm: rmSlug }), 'online enquiry via RM link');
  assert.strictEqual(onl.sales.name, 'Sneha Joshi'); console.log('  ✓ online lead goes to the RM whose link was used');
  const spam = ok(await anon('POST', '/api/public/enquiries', { name: 'Bot', mobile: '9822334456', website: 'http://spam' }), 'honeypot'); assert.strictEqual(spam.id, 'MG-0000'); console.log('  ✓ honeypot ignored');
  const rmInfo = ok(await anon('GET', `/api/public/rm/${rmSlug}`), 'RM public profile'); assert.strictEqual(rmInfo.name, 'Sneha Joshi');

  console.log('Customer fills forms in the app');
  assert.ok(sub.formUrl && sub.formUrl.includes('/f/'));
  const fpdf = await anon('GET', sub.formUrl.replace(/^https?:\/\/[^/]+/, '')); assert.strictEqual(fpdf.status, 200); console.log('  ✓ customer prints filled enquiry form');
  for (const u of ['/forms/enquiry.pdf', '/forms/booking-application.pdf']) assert.strictEqual((await anon('GET', u)).status, 200);
  console.log('  ✓ blank originals are public');
  const { url: applyLink } = ok(await sales('POST', `/api/enquiries/${rep.id}/apply-link`, {}), 'apply link');
  const tok = new URL(applyLink).searchParams.get('t');
  const ap = ok(await anon('GET', `/api/apply/${tok}`), 'customer opens application');
  assert.strictEqual(ap.form.a1.mobile, '9876543210'); assert.ok(!ap.locked);
  ok(await anon('PUT', `/api/apply/${tok}`, { form: { a1: { relation: 'Suresh Sharma' } } }), 'customer saves progress');
  const badA = await anon('PUT', `/api/apply/${tok}`, { form: {}, submit: true }); assert.strictEqual(badA.status, 400); assert.ok(badA.data.errors.length); console.log('  ✓ incomplete submit rejected with reasons');
  ok(await anon('PUT', `/api/apply/${tok}`, { submit: true, form: { a1: { name: 'Rahul Sharma', relation: 'Suresh Sharma', dob: '1990-05-12', gender: 'Male', pan: 'ABCDE1234F', address: 'Baner Road', city: 'Pune', pin: '411045', mobile: '9876543210' }, funding: 'Self-Funded', declarationAccepted: true } }), 'customer submits application');
  const seen = ok(await sales('GET', `/api/enquiries/${rep.id}`), 'staff sees it').enquiry;
  assert.ok(seen.customerForm && seen.customerForm.submitted_at && seen.customerForm.data.a1.pan === 'ABCDE1234F'); assert.ok(!('agreementValue' in seen.customerForm.data), 'customer cannot set staff fields');
  const apdf = await anon('GET', `/api/apply/${tok}/application.pdf`); assert.strictEqual(apdf.status, 200); console.log('  ✓ customer prints filled booking application');
  const { url: lockedLink } = ok(await sales('POST', `/api/enquiries/${sub.id}/apply-link`, {}), 'link for booked customer');
  const lt = new URL(lockedLink).searchParams.get('t');
  assert.ok(ok(await anon('GET', `/api/apply/${lt}`), 'booked application opens').locked);
  assert.strictEqual((await anon('PUT', `/api/apply/${lt}`, { form: {} })).status, 400); console.log('  ✓ booked application is read-only');
  assert.strictEqual((await anon('GET', '/api/apply/garbage')).status, 410); console.log('  ✓ bad link rejected');

  console.log('Edits, corrections, profile, allotment letter');
  const ed = ok(await sales('PATCH', `/api/enquiries/${rep.id}`, { email: 'rahul.new@example.com', reason: 'typo' }), 'edit enquiry details');
  assert.deepStrictEqual(ed.changes, ['Email']); assert.ok(ed.enquiry.activities.some((a) => a.type === 'correction' && /Email/.test(a.note))); console.log('  ✓ edit is logged with the changed field');
  assert.strictEqual((await sales('PATCH', `/api/enquiries/${rep.id}`, { mobile: '123' })).status, 400); console.log('  ✓ bad mobile rejected');
  const booked = ok(await mgr('GET', `/api/enquiries/${sub.id}`), 'booked detail').enquiry;
  const fixed = JSON.parse(JSON.stringify(booked.booking.extra)); fixed.a1.occupation = 'Software Engineer';
  assert.strictEqual((await sales('PUT', `/api/enquiries/${sub.id}/booking/correct`, { form: fixed, reason: 'x' })).status, 403); console.log('  ✓ sales cannot correct a booked application');
  assert.strictEqual((await mgr('PUT', `/api/enquiries/${sub.id}/booking/correct`, { form: fixed })).status, 400); console.log('  ✓ reason required after booking');
  const cr = ok(await mgr('PUT', `/api/enquiries/${sub.id}/booking/correct`, { form: fixed, reason: 'Customer updated occupation' }), 'manager corrects booked application');
  assert.ok(cr.changes.includes('First applicant — Occupation')); assert.strictEqual(cr.enquiry.booking.extra.a1.occupation, 'Software Engineer');
  assert.strictEqual(cr.enquiry.booking.extra.unit, booked.booking.extra.unit, 'unit stays fixed');
  assert.notStrictEqual(cr.enquiry.booking.pdf_file_id, booked.booking.pdf_file_id); console.log('  ✓ signed PDF re-issued after correction');
  assert.strictEqual((await mgr('GET', `/api/enquiries/${sub.id}/booking.pdf`)).status, 200);
  assert.strictEqual((await mgr('GET', `/api/enquiries/${sub.id}/allotment.pdf`)).status, 200); console.log('  ✓ allotment letter (MahaRERA format)');
  assert.strictEqual((await sales('GET', `/api/enquiries/${rep.id}/allotment.pdf`)).status, 400); console.log('  ✓ no allotment letter before payment');
  const al = ok(await mgr('GET', `/api/enquiries/${sub.id}/allotment-link`), 'allotment link');
  assert.strictEqual((await anon('GET', al.url.replace(/^https?:\/\/[^/]+/, ''))).status, 200); console.log('  ✓ customer opens allotment letter');
  const prof = ok(await sales('GET', `/api/enquiries/${rep.id}/profile`), 'customer profile'); assert.ok(prof.others.some((o) => o.id === sub.id)); console.log('  ✓ profile links other enquiries');
  const list = ok(await mgr('GET', '/api/enquiries'), 'forms register'); const row = list.enquiries.find((x) => x.id === sub.id); assert.ok(row.has_booking && row.has_paid);

  console.log('Reassign & cards');
  const other = board.team.find((t) => t.name !== cp.sales.name);
  ok(await desk('POST', `/api/enquiries/${cp.id}/reassign`, { userId: other.id, reason: 'Customer asked for someone else' }), 'reception reassign');
  const card = await anon('GET', '/card/ankit-deshmukh');
  assert.strictEqual(card.status, 200); assert.ok(card.data.includes('Ankit Deshmukh')); console.log('  ✓ public e-card');
  const vcf = await anon('GET', '/card/ankit-deshmukh.vcf');
  assert.ok(String(vcf.data).includes('BEGIN:VCARD')); console.log('  ✓ vCard download');

  const out = ok(await mgr('GET', '/api/outbox'), 'outbox');
  const kinds = out.sync.map((s) => s.action);
  for (const a of ['upsertLead', 'holdUnit', 'submitReceipt', 'markSold', 'booked', 'setOwner']) assert.ok(kinds.includes(a), a);
  const failed = out.sync.filter((x) => x.status === 'failed'); assert.ok(!failed.length, 'failed syncs: ' + JSON.stringify(failed));
  const crmRow = await require('../src/db').one("SELECT status, notes FROM public.enquiries WHERE page='sales-portal' AND notes LIKE ?", `%${sub.id}%`);
  assert.strictEqual(crmRow.status, 'closed'); assert.ok(crmRow.notes.includes('Booked')); console.log('  ✓ CRM enquiry closed with booking notes');
  console.log(`  ✓ ${out.whatsapp.length} WhatsApp messages, ${out.sync.length} sync calls recorded`);

  console.log('\nAll checks passed.');
  server.close(); await require('../src/db').pool.end();
  psql(ADMIN, '-c', `drop database ${DB}`);
})().catch((err) => { console.error(err); process.exit(1); });
