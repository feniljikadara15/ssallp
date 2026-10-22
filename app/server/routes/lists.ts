import { q } from "../db.js";
import { route } from "../router.js";

// The big lists (orders, enquiries, customers) filtered, searched and paged in
// the database. With thousands of rows, sending everything to the browser to
// filter there made every page wait seconds. Registered before the older
// routes of the same path, so these answer.

type Where = { sql: string[]; params: unknown[] };
const where = (base: string): Where => ({ sql: [base], params: [] });
/** Adds a condition; each ? becomes the next $n with the given value. */
function add(w: Where, cond: string, ...values: unknown[]) {
  let i = 0;
  w.sql.push(cond.replace(/\?/g, () => { w.params.push(values[i++]); return `$${w.params.length}`; }));
}
// A timestamp's calendar day in India, whether the column has a time zone or not.
const istDay = (col: string) => `((${col})::timestamptz AT TIME ZONE 'Asia/Kolkata')::date`;
const opt = (v: string | null) => (v && v.trim() ? v.trim() : null);
const page = (query: URLSearchParams) => {
  const limit = Math.min(Math.max(Number(query.get("limit")) || 100, 1), 20000);
  const offset = Math.max(Number(query.get("offset")) || 0, 0);
  return `LIMIT ${limit} OFFSET ${offset}`;
};

// ------------------------------------------------------------ orders

const ORDER_FROM = `FROM orders o LEFT JOIN customers c ON c.customer_id = o.customer_id LEFT JOIN sites s ON s.site_id = o.site_id
  LEFT JOIN warehouses w ON w.warehouse_id = o.warehouse_id LEFT JOIN transporters t ON t.transporter_id = o.transporter_id
  LEFT JOIN vehicles v ON v.vehicle_id = o.vehicle_id LEFT JOIN invoices i ON i.invoice_id = o.invoice_id`;

function orderWhere(query: URLSearchParams, withStatus = true) {
  const w = where("o.is_active = TRUE");
  const g = (k: string) => opt(query.get(k));
  if (withStatus && g("status")) add(w, "o.order_status = ?", g("status"));
  if (g("billing")) add(w, "o.payment_type = ?", g("billing"));
  if (g("customer")) add(w, "o.customer_id = ?", Number(g("customer")));
  if (g("warehouse")) add(w, "o.warehouse_id = ?", Number(g("warehouse")));
  if (g("transporter")) add(w, "o.transporter_id = ?", Number(g("transporter")));
  if (g("slips") === "none") w.sql.push("o.loading_slip_id IS NULL");
  if (g("slips") === "made") w.sql.push("o.loading_slip_id IS NOT NULL");
  if (g("from")) add(w, `${istDay("o.order_date")} >= ?::date`, g("from"));
  if (g("to")) add(w, `${istDay("o.order_date")} <= ?::date`, g("to"));
  const s = g("q");
  if (s) {
    const digits = s.replace(/\D/g, "");
    add(w, `(c.name ILIKE ? OR s.site_name ILIKE ? OR o.order_number ILIKE ? OR i.zb_invoice_number ILIKE ? OR c.phone ILIKE ?
      OR (? <> '' AND (o.order_id::text = ? OR EXISTS (SELECT 1 FROM loading_slips ls JOIN loading_slip_items lsi ON lsi.loading_slip_id = ls.loading_slip_id
                                                       WHERE ls.order_id = o.order_id AND lsi.loading_slip_number::text = ?))))`,
      `%${s}%`, `%${s}%`, `%${s}%`, `%${s}%`, `%${digits || s}%`, digits, digits, digits);
  }
  return w;
}

route("GET", "/api/orders", async ({ query }) => {
  const w = orderWhere(query);
  const paged = query.has("paged");
  const rowsQ = q(
    `WITH p AS (
       SELECT o.order_id, o.order_number, o.enquiry_id, o.order_date, o.payment_type, o.order_status, o.total_amount, o.customer_id, o.loading_slip_id,
              o.invoice_id, o.warehouse_id, o.transporter_id, o.updated_at, c.name AS customer_name, c.phone AS customer_phone, s.site_name,
              w.name AS warehouse_name, t.name AS transporter_name, v.vehicle_number, i.zb_invoice_number
         ${ORDER_FROM} WHERE ${w.sql.join(" AND ")} ORDER BY o.order_date DESC, o.order_id DESC ${paged ? page(query) : ""})
     SELECT p.*,
            (SELECT COALESCE(SUM(oi.quantity * oi.unit_price), 0) FROM order_items oi WHERE oi.order_id = p.order_id AND oi.is_active = TRUE) AS items_value,
            (SELECT lsi.loading_slip_file_name FROM loading_slip_items lsi WHERE lsi.loading_slip_id = p.loading_slip_id ORDER BY lsi.loading_slip_item_id LIMIT 1) AS loading_slip_file_name,
            (SELECT ARRAY_AGG(lsi.loading_slip_number::text) FROM loading_slips ls JOIN loading_slip_items lsi ON lsi.loading_slip_id = ls.loading_slip_id WHERE ls.order_id = p.order_id) AS loading_slip_numbers
       FROM p ORDER BY p.order_date DESC, p.order_id DESC`, w.params);
  if (!paged) return rowsQ;
  const sumQ = q(
    `SELECT COUNT(*)::int AS total, COALESCE(SUM(COALESCE(o.total_amount, iv.v)), 0)::float AS value, COUNT(*) FILTER (WHERE o.loading_slip_id IS NULL)::int AS no_slip
       ${ORDER_FROM} LEFT JOIN (SELECT order_id, SUM(quantity * unit_price) AS v FROM order_items WHERE is_active = TRUE GROUP BY order_id) iv ON iv.order_id = o.order_id
      WHERE ${w.sql.join(" AND ")}`, w.params);
  const [rows, [sum], counts] = await Promise.all([rowsQ, sumQ, q("SELECT order_status AS s, COUNT(*)::int AS n FROM orders WHERE is_active = TRUE GROUP BY 1")]);
  return { rows, ...sum, counts: Object.fromEntries(counts.map((c) => [c.s, c.n])) };
});

// ------------------------------------------------------------ enquiries

const ENQ_FROM = `FROM enquiries e LEFT JOIN customers c ON c.customer_id = e.customer_id LEFT JOIN sites s ON s.site_id = e.site_id
  LEFT JOIN warehouses w ON w.warehouse_id = e.warehouse_id LEFT JOIN transporters t ON t.transporter_id = e.transporter_id`;

function enquiryWhere(query: URLSearchParams) {
  const w = where("e.is_active = TRUE");
  const g = (k: string) => opt(query.get(k));
  if (g("status")) add(w, "e.enquiry_status = ?", g("status"));
  if (g("customer")) add(w, "e.customer_id = ?", Number(g("customer")));
  if (g("warehouse")) add(w, "e.warehouse_id = ?", Number(g("warehouse")));
  if (g("source")) add(w, "COALESCE(e.type, 'Internal') = ?", g("source"));
  if (g("ready") === "yes") w.sql.push("e.warehouse_id IS NOT NULL AND e.transporter_id IS NOT NULL");
  if (g("ready") === "no") w.sql.push("(e.warehouse_id IS NULL OR e.transporter_id IS NULL)");
  if (g("from")) add(w, `${istDay("e.enquiry_date")} >= ?::date`, g("from"));
  if (g("to")) add(w, `${istDay("e.enquiry_date")} <= ?::date`, g("to"));
  const s = g("q");
  if (s) {
    const digits = s.replace(/\D/g, "");
    add(w, "(c.name ILIKE ? OR s.site_name ILIKE ? OR c.phone ILIKE ? OR (? <> '' AND e.enquiry_id::text = ?))", `%${s}%`, `%${s}%`, `%${digits || s}%`, digits, digits);
  }
  return w;
}

route("GET", "/api/enquiries", async ({ query }) => {
  const w = enquiryWhere(query);
  const paged = query.has("paged");
  const rowsQ = q(
    `WITH p AS (
       SELECT e.enquiry_id, e.customer_id, e.enquiry_date, e.enquiry_status, e.type, e.billing_address_id, e.delivery_address_id, e.site_id,
              e.remarks, e.warehouse_id, e.transporter_id, e.delivery_date, c.name AS customer_name, c.phone AS customer_phone, s.site_name,
              w.name AS warehouse_name, t.name AS transporter_name
         ${ENQ_FROM} WHERE ${w.sql.join(" AND ")} ORDER BY e.enquiry_date DESC, e.enquiry_id DESC ${paged ? page(query) : ""})
     SELECT p.*,
            (SELECT o.order_id FROM orders o WHERE o.enquiry_id = p.enquiry_id ORDER BY o.order_id LIMIT 1) AS order_id,
            (SELECT COUNT(*)::int FROM enquiry_items ei WHERE ei.enquiry_id = p.enquiry_id AND ei.is_active = TRUE) AS item_count,
            (SELECT COALESCE(SUM(ei.quantity * ei.unit_price), 0) FROM enquiry_items ei WHERE ei.enquiry_id = p.enquiry_id AND ei.is_active = TRUE) AS items_value
       FROM p ORDER BY p.enquiry_date DESC, p.enquiry_id DESC`, w.params);
  if (!paged) return rowsQ;
  const sumQ = q(
    `SELECT COUNT(*)::int AS total, COALESCE(SUM(iv.v), 0)::float AS value,
            COUNT(*) FILTER (WHERE e.warehouse_id IS NULL OR e.transporter_id IS NULL)::int AS not_ready
       ${ENQ_FROM} LEFT JOIN (SELECT enquiry_id, SUM(quantity * unit_price) AS v FROM enquiry_items WHERE is_active = TRUE GROUP BY enquiry_id) iv ON iv.enquiry_id = e.enquiry_id
      WHERE ${w.sql.join(" AND ")}`, w.params);
  const [rows, [sum], counts] = await Promise.all([rowsQ, sumQ, q("SELECT enquiry_status AS s, COUNT(*)::int AS n FROM enquiries WHERE is_active = TRUE GROUP BY 1")]);
  return { rows, ...sum, counts: Object.fromEntries(counts.map((c) => [c.s, c.n])) };
});

// ------------------------------------------------------------ customers

// One pass over orders and sites instead of four lookups per customer.
const CUSTOMERS = (filter: string) => `
  SELECT c.*, b.address_id AS billing_address_id, b.line1 AS billing_line1, b.line2 AS billing_line2, b.city AS billing_city,
         b.state AS billing_state, b.pincode AS billing_pincode,
         COALESCE(sc.n, 0)::int AS site_count, COALESCE(os.n, 0)::int AS order_count, COALESCE(os.billed, 0)::float AS billed_value, os.last_order
    FROM customers c
    LEFT JOIN (SELECT DISTINCT ON (customer_id) customer_id, address_id, line1, line2, city, state, pincode FROM addresses
                WHERE type = 'billing' AND is_active = TRUE ORDER BY customer_id, address_id) b ON b.customer_id = c.customer_id
    LEFT JOIN (SELECT customer_id, COUNT(*) AS n FROM sites WHERE is_active = TRUE GROUP BY customer_id) sc ON sc.customer_id = c.customer_id
    LEFT JOIN (SELECT customer_id, COUNT(*) FILTER (WHERE order_status <> '5') AS n, SUM(total_amount) FILTER (WHERE order_status IN ('2', '3')) AS billed,
                      MAX(order_date) FILTER (WHERE order_status <> '5') AS last_order
                 FROM orders WHERE is_active = TRUE GROUP BY customer_id) os ON os.customer_id = c.customer_id
   ${filter} ORDER BY c.name`;

route("GET", "/api/customers", async () => q(CUSTOMERS("")));
route("GET", "/api/customers/:id", async ({ params }) => (await q(CUSTOMERS("WHERE c.customer_id = $1"), [Number(params.id)]))[0] ?? null);
// Names only, for pickers and filters.
route("GET", "/api/customer-names", async () => q("SELECT customer_id, name, phone, is_active FROM customers ORDER BY name"));
