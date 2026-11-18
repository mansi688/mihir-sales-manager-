const crypto = require('crypto');
const multer = require('multer');

/** Start of "today" in India as an ISO timestamp. */
function todayStartUtc() {
  const IST = 5.5 * 3600 * 1000;
  const nowIst = new Date(Date.now() + IST);
  return new Date(Date.UTC(nowIst.getUTCFullYear(), nowIst.getUTCMonth(), nowIst.getUTCDate()) - IST).toISOString();
}

function rand(n = 10) { return crypto.randomBytes(n).toString('hex'); }

const okType = (allowPdf) => (_req, file, cb) => {
  const ok = /^image\/(png|jpe?g|webp)$/.test(file.mimetype) || (allowPdf && file.mimetype === 'application/pdf');
  cb(ok ? null : new Error('Only JPG, PNG, WEBP' + (allowPdf ? ' or PDF' : '') + ' files are allowed'), ok);
};
// Files are kept in Postgres; Vercel requests are capped at ~4.5 MB, so stay under that.
const uploadDoc = multer({ storage: multer.memoryStorage(), limits: { fileSize: 4 * 1024 * 1024 }, fileFilter: okType(true) });
const uploadPhoto = multer({ storage: multer.memoryStorage(), limits: { fileSize: 3 * 1024 * 1024 }, fileFilter: okType(false) });

/** "data:image/png;base64,..." → Buffer (validated). */
function pngFromDataUrl(dataUrl) {
  const m = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''));
  if (!m) throw httpError(400, 'Signature must be a PNG image');
  const buf = Buffer.from(m[1], 'base64');
  if (buf.length < 200 || buf.length > 1024 * 1024) throw httpError(400, 'Signature looks empty or too large');
  if (buf.readUInt32BE(0) !== 0x89504e47) throw httpError(400, 'Signature is not a valid PNG');
  return buf;
}

const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
function httpError(status, message) { return Object.assign(new Error(message), { status }); }
const iso = (d) => (d instanceof Date ? d.toISOString() : d);

module.exports = { todayStartUtc, rand, uploadDoc, uploadPhoto, pngFromDataUrl, ah, httpError, iso };
