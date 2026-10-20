# Sambhavnath OMS (custom build)

Custom-coded replacement for the Retool "Order Management System" app (`../Order Management System.zip`).

Stack: React 18 + TypeScript + Vite + Tailwind CSS, Recharts for charts.

```bash
npm install
npm run dev          # local dev server
npm run build        # production build -> dist/
npm run build:single # single self-contained HTML -> dist-single/index.html
```

## Status

All Retool pages are rebuilt on the UI side:

- Dashboard: totals, month-over-month change, orders for the last 12 months
- Enquiries: Ongoing/Past/Deleted, new enquiry form, create order, delete/restore
- Orders: Ongoing/In-Transit/Delivered/Deleted, transport details, loading slips, dispatch, OTP delivery, invoice/cash bill, CSV export
- Cash Bills: Pending/Collected, collect payment, CSV export
- Loading Slips, Customers (with sites), Products, Warehouses (brands/transporters), Transporters (vehicles/warehouses), Warehouse Keepers, Transporter Vehicle Details

The data is sample data held in the browser (`src/data/store.tsx`, persisted to localStorage).
Next step: an API backed by the existing Postgres schema (queries in the Retool export `lib/*.sql`), plus the Zoho Books, WhatsApp and workflow integrations.
