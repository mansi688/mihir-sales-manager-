/**
 * Express app. On Vercel this file is the serverless entry (module.exports = app) and files in
 * public/ are served by Vercel's CDN. Locally, `npm start` listens on PORT and serves public/ itself.
 */
const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const config = require('./config');
const { one } = require('./db');
const auth = require('./auth');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(express.json({ limit: '4mb' }));
app.use(cookieParser());
app.use((_req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Referrer-Policy', 'same-origin');
  next();
});

app.get('/health', async (_req, res) => {
  try {
    const r = await one('SELECT current_user u, (SELECT count(*)::int FROM users) users, (SELECT count(*)::int FROM public.flats) flats');
    res.json({ ok: true, db: r, wa: config.wa.mode, crm: config.crm.mode });
  } catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});

app.use(require('./routes/webhooks'));
app.use(auth.session);
app.use(require('./routes/public'));
app.use(require('./routes/staff'));

app.get('/', (_req, res) => res.redirect('/app/'));
// Local only — on Vercel the CDN serves public/ before requests reach this function.
app.use(express.static(path.join(__dirname, '..', 'public'), { extensions: ['html'] }));

app.use((err, req, res, _next) => {
  const status = err.status || (err.code === 'LIMIT_FILE_SIZE' ? 413 : (err.name === 'MulterError' || /files are allowed/.test(err.message) ? 400 : 500));
  if (status >= 500) console.error(err);
  const msg = status === 413 ? 'File is too large (max 4 MB)' : status >= 500 ? 'Something went wrong — please try again' : err.message;
  if (req.path.startsWith('/api/')) return res.status(status).json({ error: msg });
  res.status(status).send(msg);
});

if (require.main === module) {
  app.listen(config.port, () => {
    console.log(`Mihir Sales Portal on ${config.publicUrl}`);
    console.log(`  Staff app : ${config.publicUrl}/app/`);
    console.log(`  Kiosk     : ${config.publicUrl}/kiosk/?key=${config.kioskKey}`);
    console.log(`  WhatsApp=${config.wa.mode}  CRM=${config.crm.mode}  Accounts=${config.internal.mode}`);
  });
}

module.exports = app;
