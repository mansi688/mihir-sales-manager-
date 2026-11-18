/**
 * Postgres (Supabase) access. The app connects as the `sales_portal` role whose search_path is
 * `sales, public`, so unqualified table names are the portal's own; CRM tables are written as public.*.
 * Use `?` placeholders — they're converted to $1, $2… here.
 */
const pgmod = require('postgres');
const postgres = pgmod.default || pgmod;
const config = require('./config');

if (!config.databaseUrl) {
  console.error('[db] DATABASE_URL is not set — see README.');
}

const sql = postgres(config.databaseUrl || 'postgres://invalid', {
  prepare: false,                          // required by the Supabase transaction pooler
  max: process.env.VERCEL ? 3 : 10,
  idle_timeout: 20,
  connect_timeout: 15,
  ssl: /localhost|127\.0\.0\.1/.test(config.databaseUrl || '') ? false : 'require',
  onnotice: () => {},
  types: { numeric: { to: 1700, from: [1700], serialize: (x) => String(x), parse: (x) => Number(x) } },
  transform: { undefined: null },
});

const STAGES = ['Walk-in', 'Attending', 'Site visit', 'Booking form', 'KYC', 'Payment', 'Signatures', 'Booked', 'Lost'];
const ROLES = ['sales', 'reception', 'manager', 'accounts', 'admin'];
const USER_STATUSES = ['Available', 'With customer', 'On site visit', 'Off'];

const toPg = (q) => { let i = 0; return q.replace(/\?/g, () => '$' + (++i)); };
const all = (q, ...p) => sql.unsafe(toPg(q), p);
const one = async (q, ...p) => (await all(q, ...p))[0];
const run = (q, ...p) => all(q, ...p);

async function logActivity(enquiryId, userId, type, note = '') {
  await run('INSERT INTO activities(enquiry_id,user_id,type,note) VALUES(?,?,?,?)', enquiryId, userId || null, type, note);
  await run('UPDATE enquiries SET updated_at=now() WHERE id=?', enquiryId);
}

/** Move an enquiry forward; never moves it backwards. */
async function advanceStage(enquiryId, to) {
  const e = await one('SELECT stage FROM enquiries WHERE id=?', enquiryId);
  if (!e) return;
  if (STAGES.indexOf(to) > STAGES.indexOf(e.stage)) await run('UPDATE enquiries SET stage=?, updated_at=now() WHERE id=?', to, enquiryId);
}

async function saveFile(kind, mime, name, buffer) {
  const r = await one('INSERT INTO files(kind,mime,name,data) VALUES(?,?,?,?) RETURNING id', kind, mime, name || '', buffer);
  return r.id;
}
const getFile = (id) => one('SELECT * FROM files WHERE id=?', id);

module.exports = { sql, all, one, run, STAGES, ROLES, USER_STATUSES, logActivity, advanceStage, saveFile, getFile };
