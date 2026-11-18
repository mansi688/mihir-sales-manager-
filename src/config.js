const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });

const env = (k, d) => (process.env[k] !== undefined && process.env[k] !== '' ? process.env[k] : d);
const vercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : null;

const config = {
  port: Number(env('PORT', 3000)),
  publicUrl: env('PUBLIC_URL', vercelUrl || 'http://localhost:3000').replace(/\/$/, ''),
  databaseUrl: env('DATABASE_URL', ''),
  jwtSecret: env('JWT_SECRET', 'dev-secret-change-me'),
  kioskKey: env('KIOSK_KEY', 'kiosk-demo-key'),
  unitHoldHours: Number(env('UNIT_HOLD_HOURS', 48)),
  org: {
    name: env('ORG_NAME', 'Mihir Group'),
    website: env('ORG_WEBSITE', 'www.mihirgroup.com'),
    tagline: env('ORG_TAGLINE', 'Live Beyond Time'),
    whatsapp: env('ORG_WHATSAPP', '919800000000'),
  },
  wa: {
    mode: env('WA_MODE', 'mock'),
    phoneNumberId: env('WA_PHONE_NUMBER_ID', ''),
    token: env('WA_ACCESS_TOKEN', ''),
    version: env('WA_API_VERSION', 'v20.0'),
    verifyToken: env('WA_VERIFY_TOKEN', 'mihir-verify-token'),
    tplSalesAlert: env('WA_TPL_SALES_ALERT', 'new_walkin_alert'),
    tplReassign: env('WA_TPL_REASSIGN', 'walkin_reassigned'),
    tplBooked: env('WA_TPL_BOOKING_CONFIRMED', 'booking_confirmed'),
    lang: env('WA_TPL_LANG', 'en'),
  },
  // crm: "supabase" writes walk-ins into the CRM's public.enquiries (same database); "mock" only logs.
  crm: { mode: env('CRM_MODE', 'supabase') },
  // accounts: "mock" logs only; "rest" posts receipts to the internal portal.
  internal: {
    mode: env('INTERNAL_MODE', 'mock'),
    baseUrl: env('INTERNAL_BASE_URL', ''),
    apiKey: env('INTERNAL_API_KEY', ''),
    webhookSecret: env('INTERNAL_WEBHOOK_SECRET', 'change-me'),
  },
};

if (process.env.VERCEL_ENV === 'production' && config.jwtSecret.startsWith('dev-secret')) {
  console.warn('[config] WARNING: JWT_SECRET is not set.');
}

module.exports = config;
