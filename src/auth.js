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

async function login(phone, pin) {
  const u = await one('SELECT * FROM users WHERE phone=? AND active', normalizePhone(phone));
  if (!u || !bcrypt.compareSync(String(pin || ''), u.pin_hash)) return null;
  return u;
}

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

module.exports = { login, issue, clear, session, requireAuth, requireKiosk, normalizePhone };
