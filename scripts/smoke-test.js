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
