# How the Sales Portal connects to the CRM, Accounts and WhatsApp

## CRM — same Supabase database (`CRM_MODE=supabase`)

The portal runs in the Mihir CRM Supabase project, in its own `sales` schema, as the database role `sales_portal`.
That role can only:

| CRM table | Access | Used for |
|---|---|---|
| `public.projects`, `towers`, `wings`, `flats` | read | kiosk project list, configurations (distinct `flat_type`), unit picker |
| `public.enquiries` | read, insert, update | one row per walk-in, kept in step with the sale |

Row-level-security policies named `sales_portal_*` grant exactly this; nothing else in the CRM changes.

**Enquiry row written by the portal:**
`page = 'sales-portal'`, `name`, `phone` (+91 …), `email`, `project_id`, and a `message` with the walk-in summary.
The CRM's own triggers stamp it `new` and notify CRM managers.

| Portal stage | CRM `status` |
|---|---|
| Walk-in | new |
| Attending → Site visit → Booking form → KYC → Payment → Signatures | contacted |
| Booked / Lost | closed |

`notes` always holds `Sales portal MG-1041 · Stage: … · Owner: … · Unit: …` plus the last few visit, payment and approval notes.

**Unit status** lives in `sales.unit_status` (On hold until a time / Sold), keyed by `public.flats.id`.
If the CRM later adds its own sale status to `flats`, switch `inventory` in `src/services/integrations.js` to use it.

## Accounts (internal portal)

* `INTERNAL_MODE=mock` (default): Accounts verify payments in the portal's **Payments** page.
* `INTERNAL_MODE=rest`: the portal also POSTs each receipt to `INTERNAL_BASE_URL/accounts/receipts`:
  `{ "ref": "MG-1041", "paymentId": 12, "amount": 500000, "mode": "NEFT/RTGS", "utrOrCheque": "UTR998877" }`
* The internal portal reports back with
  `POST /webhooks/internal/payment` and header `X-Webhook-Secret: <INTERNAL_WEBHOOK_SECRET>`.
  Body: `{ "paymentId": 12, "status": "Received", "receiptNo": "RCPT-1001" }` or `{ "paymentId": 12, "status": "Rejected", "remarks": "…" }`

## WhatsApp Business (Meta Cloud API)

* Webhook URL: `<site>/webhooks/whatsapp`, verify token = `WA_VERIFY_TOKEN`, subscribe to **messages**.
* Templates (category **Utility**, language `en`):

| Name | Body (example wording) |
|---|---|
| `new_walkin_alert` | 🔔 Hi {{1}}, new walk-in {{2}} assigned to you. Customer: {{3}} ({{4}}). Interest: {{5}}, budget {{6}}. Source: {{7}}. They are waiting at reception. |
| `walkin_reassigned` | Hi {{1}}, walk-in {{2}} ({{3}}) has been moved to another colleague. Reason: {{4}}. |
| `booking_confirmed` | Congratulations {{1}}! Your booking of {{2}} at {{3}} is confirmed. Your relationship manager {{4}} will share the next steps. |

The customer's welcome reply (sales person's name, number, e-card link) is a normal text message, which is allowed because the customer messaged first after scanning the kiosk QR.
