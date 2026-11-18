/**
 * Postgres (Supabase) access via `pg`. The app connects as the `sales_portal` role whose search_path is
 * `sales, public`, so unqualified table names are the portal's own; CRM tables are written as public.*.
 * Use `?` placeholders — they're converted to $1, $2… here.
 */
const { Pool, types } = require('pg');
const config = require('./config');

types.setTypeParser(1700, (v) => (v === null ? null : Number(v))); // numeric → number
types.setTypeParser(20, (v) => (v === null ? null : Number(v)));   // bigint (ids, counts) → number

if (!config.databaseUrl) console.error('[db] DATABASE_URL is not set — see README.');

const local = /localhost|127\.0\.0\.1/.test(config.databaseUrl || '');
const pool = new Pool({
  connectionString: config.databaseUrl || undefined,
  max: process.env.VERCEL ? 3 : 10,
  idleTimeoutMillis: 20000,
  connectionTimeoutMillis: 15000,
  ssl: local ? false : { rejectUnauthorized: false },
});
pool.on('error', (err) => console.error('[db] idle client error', err.message));

const STAGES = ['Walk-in', 'Attending', 'Site visit', 'Booking form', 'KYC', 'Payment', 'Signatures', 'Booked', 'Lost'];
const ROLES = ['sales', 'reception', 'manager', 'accounts', 'admin'];
const USER_STATUSES = ['Available', 'With customer', 'On site visit', 'Off'];

const toPg = (q) => { let i = 0; return q.replace(/\?/g, () => '$' + (++i)); };
const helpers = (runner) => {
  const all = async (q, ...p) => (await runner.query(toPg(q), p)).rows;
  return { all, one: async (q, ...p) => (await all(q, ...p))[0], run: all };
};
const { all, one, run } = helpers(pool);

/** Run fn({all, one, run}) inside a transaction. */
async function tx(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const out = await fn(helpers(client));
    await client.query('COMMIT');
    return out;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally { client.release(); }
}

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
  return (await one('INSERT INTO files(kind,mime,name,data) VALUES(?,?,?,?) RETURNING id', kind, mime, name || '', buffer)).id;
}
const getFile = (id) => one('SELECT * FROM files WHERE id=?', id);

module.exports = { pool, all, one, run, tx, STAGES, ROLES, USER_STATUSES, logActivity, advanceStage, saveFile, getFile };
