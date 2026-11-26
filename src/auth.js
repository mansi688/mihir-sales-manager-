const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const config = require('./config');
const { one } = require('./db');

const COOKIE = 'mg_session';

function normalizePhone(p) {
  let d = String(p || '').replace(/\D/g, '');
  if (d.length === 10) d = '91' + d;
  return d;
}

/** Sign in with a username or a mobile number, plus a password or PIN. */
async function login(id, secret) {
  const s = String(id || '').trim();
  const u = /[a-z]/i.test(s)
    ? await one('SELECT * FROM users WHERE lower(username)=lower(?) AND active', s)
    : await one('SELECT * FROM users WHERE phone=? AND active', normalizePhone(s));
  if (!u || !bcrypt.compareSync(String(secret || ''), u.pin_hash)) return null;
  return u;
}
/** A 4–6 digit PIN, or a password of 8–64 characters. */
const validSecret = (v) => /^\d{4,6}$/.test(String(v || '')) || (String(v || '').length >= 8 && String(v || '').length <= 64);

function issue(res, user) {
  const token = jwt.sign({ uid: user.id }, config.jwtSecret, { expiresIn: '12h' });
  res.cookie(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: config.publicUrl.startsWith('https'), maxAge: 12 * 3600 * 1000 });
}
function clear(res) { res.clearCookie(COOKIE); }

/** Attaches req.user if the session cookie is valid. */
async function session(req, _res, next) {
  const t = req.cookies && req.cookies[COOKIE];
  if (!t) return next();
  try {
    const { uid } = jwt.verify(t, config.jwtSecret);
    const u = await one('SELECT * FROM users WHERE id=? AND active', uid);
    if (u) req.user = u;
  } catch (err) {
    if (err.name !== 'JsonWebTokenError' && err.name !== 'TokenExpiredError') return next(err);
  }
  next();
}

function requireAuth(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Please log in' });
    if (roles.length && !roles.includes(req.user.role) && req.user.role !== 'admin') return res.status(403).json({ error: 'Not allowed for your role' });
    next();
  };
}

function requireKiosk(req, res, next) {
  const key = req.get('X-Kiosk-Key') || req.query.key;
  if (key !== config.kioskKey) return res.status(401).json({ error: 'Kiosk not authorised — open the kiosk with ?key=…' });
  next();
}

module.exports = { validSecret, login, issue, clear, session, requireAuth, requireKiosk, normalizePhone };
