# Mihir Group — Sales & Customer Portal

**Live:** https://mihir-sales-portal.vercel.app  ·  staff app `/app/`  ·  kiosk `/kiosk/?key=<KIOSK_KEY>`
Every push to `main` deploys automatically (Vercel project `mihir-sales-portal`, Mumbai region).

Walk-in to booking in one system: **reception kiosk → automatic sales assignment → WhatsApp hand-off →
site visit → booking form (real CRM inventory) → KYC → first payment → signatures → manager approval → Booked**.

**Stack:** Node 22 + Express on **Vercel**, data in **Supabase Postgres**. The portal runs inside the Mihir CRM's database, in its own `sales` schema:
- It reads the CRM's real projects, towers, wings and flats.
- Every walk-in lands in the CRM's `public.enquiries`, so CRM managers get their usual notification.
- The CRM row's status follows the sale: new → contacted → closed.
- Files (KYC, signatures, booking PDFs, profile photos) are stored in Postgres, so nothing needs a disk.

| Open | Path |
|---|---|
| Staff app (all roles) | `/app/` |
| Reception tablet kiosk | `/kiosk/?key=<KIOSK_KEY>` *(remembered on that tablet)* |
| A sales person's public e-card | `/card/ankit-deshmukh` |
| **Customer portal** — online enquiry for WhatsApp links | `/enquire/` · `/enquire/?rm=<staff-slug>` routes the lead to that person |
| Quotation link sent to a customer | `/q/<token>` *(valid 30 days)* |
| Landing page (first page) | `/` — customers, staff login and kiosk entry points |
| **Customer fills the booking application** | `/apply/?t=<token>`. Sent from the customer page via **Send form link**; valid 14 days |
| Customer's filled enquiry form (print/PDF) | `/f/<token>`. Shown after enquiring online or at the kiosk |
| Blank originals (print) | `/forms/enquiry.pdf`, `/forms/booking-application.pdf` |
| Health check | `/health` |

Demo staff (**PIN 1234 — change them on the Team page**):

| Role | Mobile | Name |
|---|---|---|
| Admin | 9000000001 | Admin |
| Reception | 9000000002 | Kavita More |
| Manager (approves bookings) | 9000000003 | Rajesh Nair |
| Accounts (verifies payments) | 9000000004 | Neha Gupta |
| Sales | 9822011223 / 9890144556 / 9765477889 / 9970022334 | Ankit / Priya / Rohan / Sneha |

## Two experiences

- **Customer portal** (`/enquire/`, kiosk, e-cards, quotation links): premium, mobile-first, enquiry-focused.
  Built for customers who open links from WhatsApp.
- **Admin sales dashboard** (`/app/`): data-rich. It covers:
  - customer records (sortable table, filters, CSV export) and the pipeline board;
  - **follow-ups** (overdue / today / upcoming, outcomes);
  - **quotations** (cost sheet with GST, stamp duty and registration, PDF, WhatsApp share);
  - team performance, lead sources and a 14-day walk-in trend.

Design: Inter for body text and Manrope for headings. Colours: indigo for brand and headings, copper for highlights,
aqua for buttons and links, pale aqua for enquiry sections, warm ivory for the background (`public/assets/styles.css`).

## How the day works

1. **Reception** hands the tablet to the customer. The kiosk asks for contact details, project (live from the CRM), configuration, budget, purpose, source (channel partner name if any), visit timing, and consent.
2. **Assignment (automatic):**
   1. A repeat customer (same mobile) goes back to their original sales person.
   2. A channel-partner lead goes to that partner's owner.
   3. Otherwise it goes to the *Available* sales person on that project with the fewest walk-ins today.
   4. Reception or the manager can reassign with a reason (logged).
3. The kiosk shows a **QR code** → WhatsApp opens to the company number with the enquiry ID. The bot replies with the sales person's details and e-card. The sales person gets a WhatsApp alert.
4. **Sales portal:**
   - Status (Available / With customer / On site visit / Off) and profile photo.
   - Share my details on WhatsApp.
   - E-visiting card (one Mihir format, with Save-contact).
   - Customer list and the full journey for each customer.
5. **Booking Application Form** (full screen, 12 sections, from `src/content/booking-form.js`):
   1. Applicant details: first and second applicant
   2. Residential & contact
   3. Booked flat: pick an available flat from the CRM inventory; carpet area, parking, MahaRERA number, possession date, agreement value and other charges give the total consideration
   4. First transaction
   5. Applicant bank details
   6. Home loan / loaning bank
   7. CLP payment plan: editable milestones, must total 100%, booking ≤ 10%
   8. Standard T&C
   9. Cancellation policy plus the **MahaRERA cancellation norms**:
      - deduction slabs: 0% within 15 days, up to 1% in 16–30 days, up to 1.5% in 31–60 days, up to 2% after 60 days
      - refund within 45 days
      - 10% advance cap
      - designated collection account
   10. Sales manager (auto-filled) & channel partner
   11. Customer declaration
   12. Signatures

   **Save draft** holds the flat for 48 h. **Submit** validates every required field (PAN, IFSC, PIN, CLP = 100%, declaration accepted) and moves the enquiry to KYC. **Preview PDF** works at any stage (it carries a DRAFT watermark until approval).
6. **KYC:** PAN, Aadhaar and photo. Phone photos are compressed before upload.
7. **First payment:** amount, date, mode, cheque/UTR, bank and branch go to **Accounts**. The app **blocks any booking amount above 10% of the total consideration** (RERA).
8. **Signatures** open after Accounts verifies the payment: first applicant and second applicant on screen.
9. **Manager signs for the Developer / Authorised Representative and approves.** This:
   - Generates the signed multi-page Booking Application PDF (amount in words; Aadhaar and account numbers masked).
   - Marks the flat *Sold*.
   - Closes the CRM enquiry.
   - Sends WhatsApp confirmation with a 30-day PDF link.

> The legal text (T&C, cancellation policy, RERA norms, declaration) lives in `src/content/booking-form.js`. Have Mihir's legal team review it before go-live.

## Deploy (Supabase + Vercel)

1. **Database:** in the Supabase SQL editor of the CRM project, run in order:
   - `db/migrations/001_sales_schema.sql`
   - `db/migrations/002_seed_staff.sql`
   - `db/migrations/003_app_role.sql.template` (replace `__PASSWORD__` with a long random password first)
   - `db/migrations/004_booking_application.sql`
2. **Vercel:** import this GitHub repo (framework *Express* is detected; entry `src/server.js`, static files from `public/`).
3. Add these environment variables:
   - `DATABASE_URL` = `postgresql://sales_portal.<project-ref>:<password>@aws-0-ap-south-1.pooler.supabase.com:6543/postgres` (Supabase → Connect → *Transaction pooler*; the user is `sales_portal.<project-ref>`)
   - `JWT_SECRET`, `KIOSK_KEY`, `INTERNAL_WEBHOOK_SECRET`: long random strings
   - optional: `ORG_WHATSAPP`, the `WA_*` settings, `PUBLIC_URL` (defaults to the Vercel production domain)
4. Open `/health`. It should show `"ok": true` with the user count and flat count.

Local development needs a Postgres (Supabase or local) in `DATABASE_URL`: `npm install && npm run dev`.
Tests (`npm test`) build a throwaway database on a local Postgres (`TEST_ADMIN_URL`, default `postgres://postgres@127.0.0.1:5544/postgres`). They use `db/test/crm_fixture.sql` as a stand-in for the CRM tables.

## Going live — checklist

- [ ] Change demo PINs; add real staff and their projects on the Team page.
- [ ] Align the kiosk fields (`public/kiosk/kiosk.js`), the booking fields (`public/app/app.js`) and the PDF (`src/services/pdf.js`) with the official Mihir enquiry and booking forms.
- [ ] **WhatsApp:**
  - Set `WA_MODE=cloud`, `WA_PHONE_NUMBER_ID`, `WA_ACCESS_TOKEN` and `ORG_WHATSAPP`.
  - Register the webhook `/webhooks/whatsapp`.
  - Get the 3 templates approved (`docs/CRM_API.md`).
- [ ] Accounts: verify in the portal, or have the internal portal call `/webhooks/internal/payment` (`docs/CRM_API.md`).
- [ ] Supabase Pro (daily backups) once real customer KYC is stored.

## Project layout

```
src/server.js              Express app (Vercel entry) — /health, routes, errors
src/config.js              settings from environment
src/db.js                  Postgres pool (Supabase pooler), helpers, files in DB
src/auth.js                PIN login, session cookie, roles, kiosk key
src/routes/public.js       kiosk API, e-card + vCard, photos, shared PDF links
src/routes/staff.js        staff API (profile, enquiries, inventory, board, team, payments, outbox)
src/routes/webhooks.js     WhatsApp + internal-portal webhooks
src/services/workflow.js   every business step
src/services/assignment.js who gets the walk-in
src/services/integrations.js CRM (public.enquiries), inventory (CRM flats + sales.unit_status), accounts
src/services/whatsapp.js   Meta Cloud API adapter (mock / cloud)
src/services/pdf.js        booking form PDF
public/kiosk, public/app   tablet UI and staff app;  public/assets  logo + styles
db/migrations              schema, demo staff, app role
docs/CRM_API.md            how the portal connects to the CRM, accounts and WhatsApp
scripts/smoke-test.js      end-to-end test
```
