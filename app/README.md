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
| `PUBLIC_BASE_URL` | no | e.g. `https://ssallp-seven.vercel.app`. Used in WhatsApp media links; defaults to the request's own host. |

Without `DATABASE_URL` the app runs in **demo mode**: an embedded Postgres (PGlite) with sample data, no sign-in, and changes that reset when the server instance restarts.

### Zoho refresh token

1. https://api-console.zoho.in → Add Client → Self Client → note the client ID and secret.
2. Generate Code with scope `ZohoBooks.fullaccess.all`, duration 10 minutes.
3. Exchange it within 10 minutes:
   ```bash
   curl -X POST "https://accounts.zoho.in/oauth/v2/token?grant_type=authorization_code&client_id=ID&client_secret=SECRET&code=CODE"
   ```
4. Put the `refresh_token` from the response in `ZOHO_REFRESH_TOKEN`.

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
| Workflow: create enquiry | `createEnquiryWorkflow` in `server/workflows.ts` |
| Workflow: invoicing | `invoicingWorkflow` |
| Workflow: loading slips | `loadingSlipWorkflow` (PDFs are generated on request by `server/pdf.ts`) |
| Workflow: import Zoho customer | `importZohoCustomer` |
| Workflow: sync products with Zoho | `syncZohoProducts` |
| Retool Storage (invoice PDFs) | streamed from Zoho Books on request through a signed link |
| Retool user login | `APP_USERS` sign-in |

Status codes are the ones already in the database: enquiries `0` ongoing, `1` past, `5` deleted; orders `1` ongoing, `2` in transit, `3` delivered, `5` deleted.

The five workflows' own source was not in the Retool export, so they are rebuilt from what the app sends them and reads back. Compare them with the Retool originals (Retool → Workflows → export JSON) before switching over, especially the Zoho invoice fields and the loading slip numbering.
