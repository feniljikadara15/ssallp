# Sambhavnath OMS

Custom-coded replacement for the Retool "Order Management System" app (`../Order Management System.zip`).

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, TanStack Query (`src/`)
- **Backend:** one Vercel serverless function (`api/main.ts` → `server/`) that runs the same SQL the Retool queries ran
- **Database:** the existing Retool DB (Postgres). Nothing is migrated: the app reads and writes the same tables.
- **Integrations:** Zoho Books v3 (contacts, items, invoices, invoice PDFs) and WhatsApp through AiSensy (the same 9 campaigns the app sent)

## Going live on Vercel

The Vercel project's Root Directory must be `app`. Then add these environment variables (Project → Settings → Environment Variables) and redeploy:

| Variable | Required | What it is |
| --- | --- | --- |
| `DATABASE_URL` | yes | Postgres connection string of the Retool DB. In Retool: Retool Database → Settings (gear) → Connection string. Use the pooled URL if offered. |
| `AUTH_SECRET` | yes | Any long random string; signs sessions and public PDF links. `openssl rand -base64 32` |
| `APP_USERS` | yes | Who can sign in: `email:password` pairs, comma separated. Better: hashed entries from `npm run hash-password -- you@example.com 'secret'`. |
| `AISENSY_API_KEY` | for WhatsApp | The AiSensy API key (the Retool app had it hard-coded in its REST queries). |
| `ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`, `ZOHO_REFRESH_TOKEN` | for Zoho | A Zoho "Self Client" from https://api-console.zoho.in with scope `ZohoBooks.fullaccess.all`; exchange its code for a refresh token (steps below). |
| `ZOHO_ORG_ID` | no | Defaults to `60031284196` (the org in the Retool queries). |
| `ENQUIRY_WEBHOOK_KEY` | for the external form | Any long random string. The WordPress external form sends it to create enquiries (see below). |
| `PUBLIC_BASE_URL` | no | e.g. `https://ssallp-seven.vercel.app`. Used in WhatsApp media links; defaults to the request's own host. |

**Supabase:** use the Transaction pooler connection string (Project → Connect → Transaction pooler, port 6543) as `DATABASE_URL`. On its first connection to an empty database the app creates all tables, turns on row level security (so Supabase's public REST API and anon key can't read them) and adds the state codes. To bring the Retool data across instead, run `scripts/copy-retool-to-supabase.sh` before the app first connects. The Supabase anon and service-role keys are not used.

**Sample data:** either paste `db/supabase-setup.sql` into Supabase → SQL Editor and run it (tables + row level security + fictional sample records), or set `SEED_DEMO_DATA=true` in Vercel and redeploy (the app then fills an *empty* database on its next start; a database with customers, orders or products is never touched). Remove the variable afterwards. Regenerate the file with `npx tsx scripts/gen-supabase-sql.ts`.

Without `DATABASE_URL` the app runs in **demo mode**: an embedded Postgres (PGlite) with sample data, no sign-in, and changes that reset when the server instance restarts.

### Zoho refresh token

1. https://api-console.zoho.in → Add Client → Self Client → note the client ID and secret.
2. Generate Code with scope `ZohoBooks.fullaccess.all`, duration 10 minutes.
3. Exchange it within 10 minutes:
   ```bash
   curl -X POST "https://accounts.zoho.in/oauth/v2/token?grant_type=authorization_code&client_id=ID&client_secret=SECRET&code=CODE"
   ```
4. Put the `refresh_token` from the response in `ZOHO_REFRESH_TOKEN`.

## WordPress external form

The external form used to call the "[LIVE] External Enquiry Form" Retool workflow. Point it at this app instead:

- **URL:** `POST https://<your-domain>/api/webhooks/enquiry`
- **Header:** `x-api-key: <ENQUIRY_WEBHOOK_KEY>`, plus `Content-Type: application/json`
- **Body:** the form's existing JSON, unchanged:

```json
{
  "first_name": "John", "last_name": "Doe", "phone": "9876543210", "gstin": "",
  "deliveryAddressLine1": "126, Jayanagar 4th T block", "deliveryAddressLine2": "Jayanagar",
  "deliveryCity": "Bengaluru", "deliveryState": "Karnataka", "deliveryPincode": "560041",
  "sitePersonName": "Uncle Sam", "sitePersonPhone": "1234567890",
  "billingDeliverySame": "true",
  "acc": [["Opc 43", "10"]], "ultratech": [["PPC", "30"]],
  "bindingWire": [["Mahaveer", "18 gauge", "20"]], "steel": "", "sand": ""
}
```

Cement brands are keys (`birlaShakti`, `acc`, `dalmia`, `zuari`, `penna`, `ramco`, `chettinad`, `mahaShakti`, `birlaSuper`, `panyam`, `ultratech`, `indiaCements`) holding `[grade, qty]` rows; `steel`, `blocks`, `rmc` and `bindingWire` hold `[brand, grade, qty]`; `sand` and `aggregates` hold `[grade, qty]`. Products are matched on brand + grade (ignoring case and spaces), quantities are kept and prices start at 0 for the team to fill in. Anything that doesn't match a product is listed in the enquiry's remarks instead of being dropped. The Retool version of this workflow was switched off and forced every quantity to 100 with placeholder prices; this one doesn't.

The Create Enquiry JSON (`customerName`, `customerPhone`, `billingAddress`, `deliveryAddress`, `items` with `product_id` or category/brand/grade) is accepted too. A customer with the same mobile number is reused, so repeat enquiries don't create duplicates. The reply is `201 {"success": true, "enquiry_id": ..., "customer_id": ...}`. Send the request from the server side (a form plugin's webhook setting or PHP), never from browser JavaScript, so the key stays private.

## WhatsApp messages

Sent through AiSensy with the same campaign names and parameters as the Retool queries:

| When | Campaign |
| --- | --- |
| Enquiry › Notify Transporter | `[Live] New Enquiry Transporter Delivery Confirmation Request` |
| Enquiry › Delete Enquiry | `Enquiry Rejection Customer Notification` |
| Enquiry › Create Order | `customer_order_confirmation_notification` |
| Order › Notify Transporter | `[Live] Order Pickup Transporter Notification` |
| Loading slip › Send | `[Live] Loading Slip Warehouse Keeper Notification` (with the slip PDF) |
| Loading slip › Cancel | `Cancel Loading Slip` |
| Order › Send Invoice to › Customer | `new_invoice_pdf` (with the invoice PDF), then `deliver_otp_new` |
| Order › Send Invoice to › Customer & Transporter | the two above, then `[Live] Transporter Invoice Notification` |
| Cash bill › Send Delivery OTP | `deliver_otp_new` |

A message counts as sent only when AiSensy replies `success: "true"`; anything else shows the reason on screen. 10-digit numbers get the 91 country code added.

## Local development

```bash
npm install
npm run dev            # http://localhost:5173, frontend + API, demo data
DATABASE_URL=postgres://... APP_USERS=me@x.com:pw AUTH_SECRET=dev npm run dev   # against a real database
npm run typecheck
```

`db/schema.sql` creates the same tables for a fresh database (`npm run gen:schema` after editing it, to refresh the demo copy in `server/schemaSql.ts`).

## How the Retool pieces map

| Retool | Here |
| --- | --- |
| `lib/*.sql` queries | `server/routes/operations.ts`, `server/routes/masters.ts` (each handler names the queries it replaces) |
| AiSensy REST queries | `server/messages.ts` |
| Zoho Books REST queries | `server/integrations.ts`, `server/routes/masters.ts`, `server/workflows.ts` |
| [LIVE] Create Enquiry | `createEnquiryWorkflow` in `server/workflows.ts` |
| [LIVE] External Enquiry Form | `externalEnquiryInput` + `/api/webhooks/enquiry` |
| [LIVE] Zoho Books Invoicing Workflow | `invoicingWorkflow` |
| [LIVE] [v2] Loading Slip Generation (and the older Loading Slip Workflow) | `loadingSlipWorkflow`; the PDF layout is in `server/pdf.ts` |
| Workflow: import Zoho customer | `importZohoCustomer` |
| Workflow: sync products with Zoho | `syncZohoProducts` |
| Retool Storage (invoice PDFs) | streamed from Zoho Books on request through a signed link |
| Retool user login | `APP_USERS` sign-in |

Status codes are the ones already in the database: enquiries `0` ongoing, `1` past, `5` deleted; orders `1` ongoing, `2` in transit, `3` delivered, `5` deleted.

The workflows follow their Retool exports step by step:

- **Create Enquiry:** an existing customer (numeric ID) only gets a missing phone filled in; GSTIN, PAN and TCS are not overwritten. The billing address is updated, the shipping address is reused when identical, and the site is updated or created. New customers get billing and shipping addresses and a site. Items are stored with `total_price` and status `0`. No Zoho calls.
- **Zoho Books invoicing:** creates the Zoho contact if the customer has none (GST or non-GST treatment), syncs the phone, billing and shipping addresses, marks the contact active, then creates the invoice with ex-tax rates (`unit_price / (1 + gst_rate/100)`, 3 decimals), the same custom fields (warehouse, PO number, PAN, vehicle number, delivery terms) and the TCS variant for TCS customers. It saves the invoice (amount, TCS flag, Zoho ID, number, URL), marks it sent, and sets the order to in transit with payment type `invoice`. A Zoho customer ID that no longer exists in Zoho gives "Invoice Generation failed due to Customer Conflict".
- **Loading slips:** deletes the order's previous slip and creates one slip item per brand that the order contains **and** the warehouse is set up for (Warehouses → brands), as Retool did. Brands not set up for the warehouse are named in the response. The PDF matches the Retool HTML template.

`total_price` on enquiry and order items works whether it is a generated column or a plain one (it's plain in the Retool DB).

## Before switching off Retool

- [ ] Set the environment variables above and redeploy.
- [ ] Sign in and check the order, enquiry and customer counts match Retool.
- [ ] Put the Zoho credentials in Vercel (`ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`, `ZOHO_REFRESH_TOKEN`), then generate a new client secret and refresh token in the Zoho API console: the old ones are written in plain text inside the invoicing workflow export.
- [ ] Check every brand the warehouses dispatch is listed on the Warehouses page, or those brands get no loading slip.
- [ ] Run one real order end to end: enquiry → order → loading slips → invoice → WhatsApp to customer and transporter → delivery OTP.
- [ ] Rotate the AiSensy API key (it was stored in plain text inside the Retool export).
