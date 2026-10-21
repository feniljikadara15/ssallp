// Enquiries, orders, loading slips and cash bills. Each handler notes the
// Retool queries it replaces.
import { randomInt, timingSafeEqual } from "node:crypto";
import { config, isDemo, zohoConfigured } from "../config.js";
import { columnsOf, insertRow, one, q, updateRow, type Row } from "../db.js";
import { HttpError, num, optNum, str } from "../http.js";
import { zoho } from "../integrations.js";
import * as msg from "../messages.js";
import { loadingSlipPdf } from "../pdf.js";
import { publicBase, route } from "../router.js";
import { signPath } from "../sign.js";
import { dmy } from "../messages.js";
import { createEnquiryWorkflow, externalEnquiryInput, fileSlug, invoicingWorkflow, isExternalFormPayload, loadingSlipWorkflow, slipUrl } from "../workflows.js";

const DATE_RANGE = (col: string, a: number, b: number) =>
  `(NULLIF($${a}::text, '') IS NULL OR ${col}::date >= $${a}::date) AND (NULLIF($${b}::text, '') IS NULL OR ${col}::date <= $${b}::date)`;

// ------------------------------------------------------------ dashboard

// Dashboard for a period (preset or custom from/to, India dates), billing type
// and warehouse. "Now" figures (open work, cash outstanding) ignore the period;
// sales figures use the order date of billed orders (in transit or delivered).
route("GET", "/api/dashboard", async ({ query }) => {
  const DAY = /^\d{4}-\d{2}-\d{2}$/;
  const today = new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
  const from = DAY.test(query.get("from") ?? "") ? query.get("from")! : today.slice(0, 8) + "01";
  const to = DAY.test(query.get("to") ?? "") ? query.get("to")! : today;
  const pay = ["invoice", "cash"].includes(query.get("payment") ?? "") ? query.get("payment")! : null;
  const wh = optNum(query.get("warehouse"));
  // The comparison window is the same length, immediately before.
  const days = Math.max(1, Math.round((Date.parse(to) - Date.parse(from)) / 864e5) + 1);
  const prevTo = new Date(Date.parse(from) - 864e5).toISOString().slice(0, 10);
  const prevFrom = new Date(Date.parse(from) - days * 864e5).toISOString().slice(0, 10);

  const D = `(o.order_date AT TIME ZONE 'Asia/Kolkata')::date`;
  const scope = `o.is_active = TRUE AND ($1::text IS NULL OR o.payment_type = $1) AND ($2::int IS NULL OR o.warehouse_id = $2)`;
  const billed = `${scope} AND o.order_status IN ('2', '3')`;
  const p = [pay, wh];

  const [k] = await q(`SELECT
      (SELECT COALESCE(SUM(o.total_amount), 0) FROM orders o WHERE ${billed} AND ${D} BETWEEN $3::date AND $4::date) AS sales,
      (SELECT COUNT(*)::int FROM orders o WHERE ${billed} AND ${D} BETWEEN $3::date AND $4::date) AS billed,
      (SELECT COALESCE(SUM(o.total_amount), 0) FROM orders o WHERE ${billed} AND ${D} BETWEEN $5::date AND $6::date) AS prev_sales,
      (SELECT COUNT(*)::int FROM orders o WHERE ${scope} AND o.order_status <> '5' AND ${D} BETWEEN $3::date AND $4::date) AS orders_created,
      (SELECT COUNT(*)::int FROM enquiries e WHERE e.is_active = TRUE AND ($2::int IS NULL OR e.warehouse_id = $2) AND (e.enquiry_date AT TIME ZONE 'Asia/Kolkata')::date BETWEEN $3::date AND $4::date) AS enquiries,
      (SELECT COUNT(*)::int FROM enquiries e WHERE e.is_active = TRUE AND e.enquiry_status = '1' AND ($2::int IS NULL OR e.warehouse_id = $2) AND (e.enquiry_date AT TIME ZONE 'Asia/Kolkata')::date BETWEEN $3::date AND $4::date) AS converted,
      (SELECT COUNT(*)::int FROM enquiries e WHERE e.is_active = TRUE AND e.enquiry_status = '0' AND ($2::int IS NULL OR e.warehouse_id = $2)) AS open_enquiries,
      (SELECT COUNT(*)::int FROM orders o WHERE ${scope} AND o.order_status = '1') AS to_dispatch,
      (SELECT COUNT(*)::int FROM orders o WHERE ${scope} AND o.order_status = '2') AS in_transit`,
    [...p, from, to, prevFrom, prevTo]);
  const [cash] = await q(`SELECT COUNT(*)::int AS count, COALESCE(SUM(o.total_amount - COALESCE(cc.paid, 0)), 0) AS due
      FROM orders o LEFT JOIN (SELECT order_id, SUM(amount) AS paid FROM cash_collected WHERE is_active = TRUE GROUP BY 1) cc ON cc.order_id = o.order_id
     WHERE o.is_active = TRUE AND o.payment_type = 'cash' AND o.order_status IN ('2', '3') AND ($1::int IS NULL OR o.warehouse_id = $1) AND COALESCE(cc.paid, 0) < o.total_amount`, [wh]);

  const monthly = await q(`SELECT TO_CHAR(m, 'Mon') AS label, TO_CHAR(m, 'Mon YYYY') AS title,
        COALESCE((SELECT SUM(o.total_amount) FROM orders o WHERE ${billed} AND DATE_TRUNC('month', ${D}) = m), 0)::float AS sales,
        (SELECT COUNT(*) FROM orders o WHERE ${scope} AND o.order_status <> '5' AND DATE_TRUNC('month', ${D}) = m)::int AS orders
      FROM generate_series(DATE_TRUNC('month', $3::date) - INTERVAL '11 months', DATE_TRUNC('month', $3::date), INTERVAL '1 month') m ORDER BY m`, [...p, to]);

  const inPeriod = `${billed} AND ${D} BETWEEN $3::date AND $4::date`;
  const byCustomer = await q(`SELECT c.name AS label, SUM(o.total_amount)::float AS value, COUNT(*)::int AS orders FROM orders o JOIN customers c ON c.customer_id = o.customer_id
      WHERE ${inPeriod} GROUP BY c.name ORDER BY value DESC LIMIT 8`, [...p, from, to]);
  const byBrand = await q(`SELECT COALESCE(p.brand, 'Other') AS label, SUM(oi.quantity * oi.unit_price)::float AS value FROM orders o
      JOIN order_items oi ON oi.order_id = o.order_id AND oi.is_active = TRUE JOIN products p ON p.product_id = oi.product_id
      WHERE ${inPeriod} GROUP BY 1 ORDER BY value DESC LIMIT 8`, [...p, from, to]);
  const byWarehouse = await q(`SELECT COALESCE(w.name, 'No warehouse') AS label, SUM(o.total_amount)::float AS value, COUNT(*)::int AS orders FROM orders o
      LEFT JOIN warehouses w ON w.warehouse_id = o.warehouse_id WHERE ${inPeriod} GROUP BY 1 ORDER BY value DESC`, [...p, from, to]);
  const split = await q(`SELECT COALESCE(o.payment_type, 'invoice') AS kind, SUM(o.total_amount)::float AS value FROM orders o WHERE ${inPeriod} GROUP BY 1`, [...p, from, to]);
  const billedRows = await q(`SELECT o.order_id, o.order_number, o.order_date, o.payment_type, o.order_status, o.total_amount, c.name AS customer_name, w.name AS warehouse_name, i.zb_invoice_number
      FROM orders o LEFT JOIN customers c ON c.customer_id = o.customer_id LEFT JOIN warehouses w ON w.warehouse_id = o.warehouse_id LEFT JOIN invoices i ON i.invoice_id = o.invoice_id
      WHERE ${inPeriod} ORDER BY o.order_date DESC LIMIT 1000`, [...p, from, to]);
  const cashRows = await q(`SELECT c.name AS customer_name, COUNT(*)::int AS bills, SUM(o.total_amount)::float AS billed, SUM(COALESCE(cc.paid, 0))::float AS collected,
        SUM(o.total_amount - COALESCE(cc.paid, 0))::float AS due, MIN(o.order_date) AS oldest
      FROM orders o JOIN customers c ON c.customer_id = o.customer_id
      LEFT JOIN (SELECT order_id, SUM(amount) AS paid FROM cash_collected WHERE is_active = TRUE GROUP BY 1) cc ON cc.order_id = o.order_id
     WHERE o.is_active = TRUE AND o.payment_type = 'cash' AND o.order_status IN ('2', '3') AND ($1::int IS NULL OR o.warehouse_id = $1) AND COALESCE(cc.paid, 0) < o.total_amount
     GROUP BY c.name ORDER BY due DESC`, [wh]);

  const [alerts] = await q(`SELECT
      (SELECT COUNT(*)::int FROM orders o WHERE ${scope} AND o.order_status = '1' AND o.loading_slip_id IS NULL) AS no_slip,
      (SELECT COUNT(*)::int FROM orders o WHERE ${scope} AND o.order_status = '2' AND o.updated_at < NOW() - INTERVAL '2 days') AS transit,
      (SELECT COUNT(*)::int FROM enquiries e WHERE e.is_active = TRUE AND e.enquiry_status = '0' AND ($2::int IS NULL OR e.warehouse_id = $2) AND e.enquiry_date < NOW() - INTERVAL '2 days') AS enquiry,
      (SELECT COUNT(*)::int FROM warehouse_brands wb WHERE wb.is_active IS NOT FALSE AND wb.warehouse_keeper_id IS NULL AND ($2::int IS NULL OR wb.warehouse_id = $2)) AS no_keeper`, p);

  return { period: { from, to, prevFrom, prevTo }, kpis: { ...k, cash_due: cash.due, cash_bills: cash.count }, monthly, byCustomer, byBrand, byWarehouse, split, billedRows, cashRows, alerts };
});

// ------------------------------------------------------------ enquiries

// getEnquiries (+ customer name for the list)
route("GET", "/api/enquiries", async () =>
  q(`SELECT e.enquiry_id, e.customer_id, e.enquiry_date, e.enquiry_status, e.type, e.billing_address_id, e.delivery_address_id, e.site_id,
            e.remarks, e.warehouse_id, e.transporter_id, e.delivery_date, c.name AS customer_name, c.phone AS customer_phone, s.site_name,
            w.name AS warehouse_name, t.name AS transporter_name, (SELECT o.order_id FROM orders o WHERE o.enquiry_id = e.enquiry_id ORDER BY o.order_id LIMIT 1) AS order_id,
            (SELECT COUNT(*)::int FROM enquiry_items ei WHERE ei.enquiry_id = e.enquiry_id AND ei.is_active = TRUE) AS item_count,
            (SELECT COALESCE(SUM(ei.quantity * ei.unit_price), 0) FROM enquiry_items ei WHERE ei.enquiry_id = e.enquiry_id AND ei.is_active = TRUE) AS items_value
       FROM enquiries e LEFT JOIN customers c ON c.customer_id = e.customer_id LEFT JOIN sites s ON s.site_id = e.site_id
       LEFT JOIN warehouses w ON w.warehouse_id = e.warehouse_id LEFT JOIN transporters t ON t.transporter_id = e.transporter_id
      WHERE e.is_active = TRUE ORDER BY e.enquiry_date DESC`));

route("GET", "/api/enquiries/:id", async ({ params }) => {
  const id = num(params.id);
  const enquiry = await one(
    `SELECT e.*, c.name AS customer_name, c.phone AS customer_phone, c.additional_phone_1, c.additional_phone_2, c.gstin, c.pan, c.tcs_status, c.zb_customer_id, c.email,
            s.site_name, s.site_person_name, s.site_person_contact, w.name AS warehouse_name, t.name AS transporter_name,
            (SELECT o.order_id FROM orders o WHERE o.enquiry_id = e.enquiry_id ORDER BY o.order_id LIMIT 1) AS order_id,
            row_to_json(b) AS billing_address, row_to_json(d) AS delivery_address
       FROM enquiries e
       LEFT JOIN warehouses w ON w.warehouse_id = e.warehouse_id
       LEFT JOIN transporters t ON t.transporter_id = e.transporter_id
       LEFT JOIN customers c ON c.customer_id = e.customer_id
       LEFT JOIN sites s ON s.site_id = e.site_id
       LEFT JOIN addresses b ON b.address_id = e.billing_address_id
       LEFT JOIN addresses d ON d.address_id = e.delivery_address_id
      WHERE e.enquiry_id = $1`,
    [id],
  );
  if (!enquiry) throw new HttpError(404, "Enquiry not found");
  // getEnquiryItems
  const items = await q(
    `SELECT ei.*, p.category, p.brand, p.grade, p.unit FROM enquiry_items ei LEFT JOIN products p ON p.product_id = ei.product_id WHERE ei.enquiry_id = $1 ORDER BY ei.enquiry_item_id`,
    [id],
  );
  return { ...enquiry, items };
});

// triggerEnquiryWorkflow
route("POST", "/api/enquiries", async ({ body }) => createEnquiryWorkflow(body));

// updateWarehouse / updateTransporter (enquiry)
route("PATCH", "/api/enquiries/:id/transport", async ({ params, body }) => {
  const id = num(params.id);
  if ("warehouse_id" in body) await q("UPDATE enquiries SET warehouse_id = $1, transporter_id = NULL WHERE enquiry_id = $2", [optNum(body.warehouse_id), id]);
  if ("transporter_id" in body) await q("UPDATE enquiries SET transporter_id = $1 WHERE enquiry_id = $2", [optNum(body.transporter_id), id]);
  return { ok: true };
});

route("POST", "/api/enquiries/:id/notify-transporter", async ({ params }) => msg.sendEnquiryToTransporter(num(params.id)));

// deleteEnquiry + sendEnquiryRejectionToCustomer
route("POST", "/api/enquiries/:id/delete", async ({ params }) => {
  const id = num(params.id);
  await q("UPDATE enquiries SET enquiry_status = '5' WHERE enquiry_id = $1", [id]);
  const sent = await msg.sendEnquiryRejectionToCustomer(id).catch((e) => ({ sent: false, note: `Rejection message failed: ${e.message}` }));
  return { message: "Enquiry deleted", whatsapp: sent };
});

// restoreEnquiry
route("POST", "/api/enquiries/:id/restore", async ({ params }) => {
  await q("UPDATE enquiries SET enquiry_status = '0' WHERE enquiry_id = $1", [num(params.id)]);
  return { message: "Enquiry restored" };
});

// createOrder + insertOrderItems + updateEnquiryStatus + sendEnquiryToCustomer
route("POST", "/api/enquiries/:id/create-order", async ({ params }) => {
  const id = num(params.id);
  const e = await one("SELECT * FROM enquiries WHERE enquiry_id = $1", [id]);
  if (!e) throw new HttpError(404, "Enquiry not found");
  if (e.enquiry_status !== "0") throw new HttpError(400, "Only ongoing enquiries can become orders");
  if (e.warehouse_id == null || e.transporter_id == null) throw new HttpError(400, "Set the warehouse and transporter first");
  const order = await one(
    `INSERT INTO orders (enquiry_id, customer_id, order_date, order_status, billing_address_id, shipping_address_id, site_id, transporter_id, warehouse_id, created_at, updated_at, is_active)
     VALUES ($1, $2, NOW(), '1', $3, $4, $5, $6, $7, NOW(), NOW(), TRUE) RETURNING order_id`,
    [id, e.customer_id, e.billing_address_id, e.delivery_address_id, e.site_id, e.transporter_id, e.warehouse_id],
  );
  // total_price is a generated column in some databases and a plain one in others
  const tp = (await columnsOf("order_items")).has("total_price");
  await q(
    `INSERT INTO order_items (order_id, product_id, quantity, unit_price, remarks, created_at, updated_at, is_active${tp ? ", total_price" : ""})
     SELECT $1, ei.product_id, ei.quantity, ei.unit_price, 'No remarks', NOW(), NOW(), TRUE${tp ? ", ei.quantity * ei.unit_price" : ""} FROM enquiry_items ei WHERE ei.enquiry_id = $2`,
    [order!.order_id, id],
  );
  await q("UPDATE enquiries SET enquiry_status = '1' WHERE enquiry_id = $1", [id]);
  const sent = await msg.sendEnquiryToCustomer(id).catch((err) => ({ sent: false, note: `Confirmation message failed: ${err.message}` }));
  return { order_id: order!.order_id, message: `Order #${order!.order_id} created`, whatsapp: sent };
});

// Data for the New Enquiry form once a customer is picked:
// getBillingAddressIndividual, getCustomerSites, getAddresses
route("GET", "/api/customers/:id/enquiry-defaults", async ({ params }) => {
  const id = num(params.id);
  const customer = await one("SELECT * FROM customers WHERE customer_id = $1", [id]);
  const billing = await one("SELECT * FROM addresses WHERE customer_id = $1 AND is_active = TRUE AND type = 'billing' ORDER BY address_id LIMIT 1", [id]);
  const sites = await q(
    `SELECT s.*, a.line1, a.line2, a.city, a.state, a.pincode, a.maps_link FROM sites s LEFT JOIN addresses a ON a.address_id = s.address_id
      WHERE s.customer_id = $1 AND s.is_active = TRUE ORDER BY s.site_id`,
    [id],
  );
  return { customer, billing, sites };
});

// getLtp: last price this customer paid for the product
route("GET", "/api/last-price", async ({ query }) => {
  const row = await one(
    `SELECT oi.unit_price, o.order_date FROM order_items oi JOIN orders o ON oi.order_id = o.order_id JOIN customers c ON o.customer_id = c.customer_id
      WHERE oi.product_id = $1 AND (c.customer_id = $2 OR c.phone = $3) ORDER BY o.order_date DESC LIMIT 1`,
    [optNum(query.get("product_id")), optNum(query.get("customer_id")), str(query.get("phone"))],
  );
  return { json: row ?? null };
});

// checkZBCustomer / checkZBCustomerValidity
route("GET", "/api/zoho/contacts/:id", async ({ params }) => {
  if (!zohoConfigured()) {
    if (isDemo()) return { valid: true, name: "Demo contact", message: "Demo mode: Zoho Books check skipped" };
    throw new HttpError(503, "Zoho Books is not configured");
  }
  try {
    const res = await zoho("GET", `contacts/${encodeURIComponent(params.id)}`);
    const local = await one("SELECT customer_id, name FROM customers WHERE zb_customer_id = $1", [params.id]);
    return { valid: true, name: res.contact.contact_name, message: local ? `Matches ${local.name}` : "Valid, not yet imported" };
  } catch (e: any) {
    return { valid: false, message: e.message };
  }
});

// ------------------------------------------------------------ orders

// getOrders + getAllLoadingSlipItems (for list labels and loading slip search)
route("GET", "/api/orders", async () =>
  q(`SELECT o.order_id, o.order_number, o.enquiry_id, o.order_date, o.payment_type, o.order_status, o.total_amount, o.customer_id, o.loading_slip_id,
            o.invoice_id, o.warehouse_id, o.transporter_id, o.updated_at, c.name AS customer_name, s.site_name, w.name AS warehouse_name, t.name AS transporter_name,
            v.vehicle_number, i.zb_invoice_number,
            (SELECT COALESCE(SUM(oi.quantity * oi.unit_price), 0) FROM order_items oi WHERE oi.order_id = o.order_id AND oi.is_active = TRUE) AS items_value,
            (SELECT lsi.loading_slip_file_name FROM loading_slip_items lsi WHERE lsi.loading_slip_id = o.loading_slip_id ORDER BY lsi.loading_slip_item_id LIMIT 1) AS loading_slip_file_name,
            (SELECT ARRAY_AGG(lsi.loading_slip_number::text) FROM loading_slips ls JOIN loading_slip_items lsi ON lsi.loading_slip_id = ls.loading_slip_id WHERE ls.order_id = o.order_id) AS loading_slip_numbers
       FROM orders o LEFT JOIN customers c ON c.customer_id = o.customer_id LEFT JOIN sites s ON s.site_id = o.site_id
       LEFT JOIN warehouses w ON w.warehouse_id = o.warehouse_id LEFT JOIN transporters t ON t.transporter_id = o.transporter_id
       LEFT JOIN vehicles v ON v.vehicle_id = o.vehicle_id LEFT JOIN invoices i ON i.invoice_id = o.invoice_id
      WHERE o.is_active = TRUE ORDER BY o.order_date DESC`));

async function loadingSlipItems(orderId: number) {
  // getLoadingSlips + getLoadingSlipItems
  return q(
    `SELECT lsi.*, ls.order_id, COALESCE(wk.name, '') AS warehouse_keeper_name, COALESCE(wk.phone, '') AS warehouse_keeper_phone
       FROM loading_slips ls
       JOIN loading_slip_items lsi ON lsi.loading_slip_id = ls.loading_slip_id AND lsi.is_active = TRUE
       LEFT JOIN warehouse_brands wb ON LOWER(lsi.brand) = LOWER(wb.brand) AND wb.warehouse_id = ls.warehouse_id
       LEFT JOIN warehouse_keepers wk ON wb.warehouse_keeper_id = wk.warehouse_keeper_id
      WHERE ls.order_id = $1 AND ls.is_active = TRUE
      ORDER BY lsi.loading_slip_item_id`,
    [orderId],
  );
}

route("GET", "/api/orders/:id", async (req) => {
  const id = num(req.params.id);
  const order = await one(
    `SELECT o.*, c.name AS customer_name, c.phone AS customer_phone, c.gstin, c.pan, c.tcs_status, c.zb_customer_id, c.email,
            e.delivery_date, e.enquiry_date, s.site_name, s.site_person_name, s.site_person_contact,
            row_to_json(b) AS billing_address, row_to_json(sa) AS shipping_address,
            i.zb_invoice_id, i.zb_invoice_number, i.zb_invoice_url,
            (SELECT COALESCE(SUM(amount), 0) FROM cash_collected cc WHERE cc.order_id = o.order_id AND cc.is_active = TRUE) AS total_collected,
            v.vehicle_number, t.name AS transporter_name, w.name AS warehouse_name
       FROM orders o
       LEFT JOIN customers c ON c.customer_id = o.customer_id
       LEFT JOIN vehicles v ON v.vehicle_id = o.vehicle_id
       LEFT JOIN transporters t ON t.transporter_id = o.transporter_id
       LEFT JOIN warehouses w ON w.warehouse_id = o.warehouse_id
       LEFT JOIN enquiries e ON e.enquiry_id = o.enquiry_id
       LEFT JOIN sites s ON s.site_id = o.site_id
       LEFT JOIN addresses b ON b.address_id = o.billing_address_id
       LEFT JOIN addresses sa ON sa.address_id = o.shipping_address_id
       LEFT JOIN invoices i ON i.invoice_id = o.invoice_id
      WHERE o.order_id = $1`,
    [id],
  );
  if (!order) throw new HttpError(404, "Order not found");
  // getOrderItems
  const items = await q(
    `SELECT oi.*, p.category, p.brand, p.grade, p.unit FROM order_items oi LEFT JOIN products p ON p.product_id = oi.product_id WHERE oi.order_id = $1 AND oi.is_active = TRUE ORDER BY oi.order_item_id`,
    [id],
  );
  const slips = (await loadingSlipItems(id)).map((r): Row => ({ ...r, url: slipUrl(publicBase(req), r) }));
  return { ...order, items, loading_slip_items: slips, loading_slip_count: new Set(slips.map((s) => s.loading_slip_id)).size };
});

// orderItemsTableSaveHandler / enquiryItemsTableSaveHandler: Retool let people edit
// quantity and unit price inline while an order or enquiry was still ongoing.
async function saveItems(table: "order_items" | "enquiry_items", parent: "order_id" | "enquiry_id", parentId: number, items: unknown) {
  if (!Array.isArray(items) || !items.length) throw new HttpError(400, "No item changes to save");
  const key = table === "order_items" ? "order_item_id" : "enquiry_item_id";
  for (const it of items as Record<string, unknown>[]) {
    const quantity = num(it.quantity, "Quantity"), unitPrice = num(it.unit_price, "Unit price");
    if (quantity <= 0 || unitPrice < 0) throw new HttpError(400, "Quantity must be more than zero and price can't be negative");
    const tp = (await columnsOf(table)).has("total_price") ? ", total_price = $1::numeric * $2::numeric" : "";
    const res = await q(`UPDATE ${table} SET quantity = $1, unit_price = $2${tp}, updated_at = NOW() WHERE ${key} = $3 AND ${parent} = $4 RETURNING ${key}`, [quantity, unitPrice, num(it[key], "Item"), parentId]);
    if (!res.length) throw new HttpError(404, "Item not found on this record");
  }
}

route("PATCH", "/api/orders/:id/items", async ({ params, body }) => {
  const id = num(params.id);
  const o = await one("SELECT order_status FROM orders WHERE order_id = $1", [id]);
  if (!o) throw new HttpError(404, "Order not found");
  if (o.order_status !== "1") throw new HttpError(400, "Items can only be changed while the order is ongoing");
  await saveItems("order_items", "order_id", id, body.items);
  return { message: "Order items updated" };
});

route("PATCH", "/api/enquiries/:id/items", async ({ params, body }) => {
  const id = num(params.id);
  const e = await one("SELECT enquiry_status FROM enquiries WHERE enquiry_id = $1", [id]);
  if (!e) throw new HttpError(404, "Enquiry not found");
  if (e.enquiry_status !== "0") throw new HttpError(400, "Items can only be changed while the enquiry is ongoing");
  await saveItems("enquiry_items", "enquiry_id", id, body.items);
  return { message: "Enquiry items updated" };
});

// updateOrderParameters
route("PATCH", "/api/orders/:id", async ({ params, body }) => {
  const id = num(params.id);
  await updateRow("orders", "order_id", id, {
    warehouse_id: optNum(body.warehouse_id),
    transporter_id: optNum(body.transporter_id),
    vehicle_id: optNum(body.vehicle_id),
    delivery_terms: str(body.delivery_terms),
    po_number: str(body.po_number),
    sub_dealer: str(body.sub_dealer),
  });
  return { message: "Order details saved" };
});

route("POST", "/api/orders/:id/delete", async ({ params }) => {
  await q("UPDATE orders SET order_status = '5' WHERE order_id = $1", [num(params.id)]);
  return { message: "Order deleted" };
});

route("POST", "/api/orders/:id/restore", async ({ params }) => {
  await q("UPDATE orders SET order_status = '1' WHERE order_id = $1", [num(params.id)]);
  return { message: "Order restored" };
});

route("POST", "/api/orders/:id/notify-transporter", async ({ params }) => msg.notifyTransporter(num(params.id)));

// triggerLoadingSlipWorkflow
route("POST", "/api/orders/:id/loading-slips", async ({ params, body }) => {
  const res = await loadingSlipWorkflow(num(params.id), str(body.date) ?? new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }));
  const skipped = res.skipped.length ? `. Not set up for this warehouse, so no slip: ${res.skipped.join(", ")}` : "";
  return { message: `${res.count} loading slip${res.count === 1 ? "" : "s"} created${skipped}` };
});

async function slipRow(itemId: number) {
  const row = await one(
    `SELECT lsi.*, ls.order_id, ls.warehouse_id, COALESCE(wk.name, '') AS warehouse_keeper_name, COALESCE(wk.phone, '') AS warehouse_keeper_phone
       FROM loading_slip_items lsi JOIN loading_slips ls ON ls.loading_slip_id = lsi.loading_slip_id
       LEFT JOIN warehouse_brands wb ON LOWER(lsi.brand) = LOWER(wb.brand) AND wb.warehouse_id = ls.warehouse_id
       LEFT JOIN warehouse_keepers wk ON wb.warehouse_keeper_id = wk.warehouse_keeper_id
      WHERE lsi.loading_slip_item_id = $1`,
    [itemId],
  );
  if (!row) throw new HttpError(404, "Loading slip not found");
  return row;
}

// sendLoadingSlipToWarehouseKeeper + updateLoadingSlipStatus. As in Retool, the slip
// is only marked Sent when AiSensy confirms the message.
route("POST", "/api/loading-slip-items/:id/send", async (req) => {
  const row = await slipRow(num(req.params.id));
  if (row.status === "Cancelled") throw new HttpError(400, `Loading Slip ${row.loading_slip_file_name} is cancelled`);
  if (!row.warehouse_keeper_phone) throw new HttpError(400, `No warehouse keeper phone number is assigned for ${row.brand} at this warehouse. Set it on the Warehouses page.`);
  const res = await msg.sendLoadingSlipToKeeper(row as any, slipUrl(publicBase(req), row));
  if (res.sent || isDemo()) await q("UPDATE loading_slip_items SET status = 'Sent', updated_at = NOW() WHERE loading_slip_item_id = $1", [row.loading_slip_item_id]);
  return { message: `Loading Slip ${row.loading_slip_file_name} sent to Warehouse Keeper`, whatsapp: res };
});

// cancelLoadingSlip + cancelLoadingSlipNotification
route("POST", "/api/loading-slip-items/:id/cancel", async ({ params }) => {
  const row = await slipRow(num(params.id));
  await q("UPDATE loading_slip_items SET status = 'Cancelled', updated_at = NOW() WHERE loading_slip_item_id = $1", [row.loading_slip_item_id]);
  const res = row.warehouse_keeper_phone
    ? await msg.cancelLoadingSlipNotification(row as any).catch((e) => ({ sent: false, note: e.message }))
    : { sent: false, note: "No warehouse keeper to notify" };
  return { message: `Loading Slip ${row.loading_slip_file_name} cancelled`, whatsapp: res };
});

// processItems + generateLSHTML from the "[v2] Loading Slip Generation"
// workflow; the PDF is built on request rather than stored in Retool Storage.
async function slipPdf(itemId: number) {
  const row = await slipRow(itemId);
  const o = (await one(
    `SELECT o.order_id, o.order_number, o.sub_dealer, w.name AS godown, v.vehicle_number, to_jsonb(ls) ->> 'loading_slip_date' AS loading_slip_date
       FROM orders o JOIN loading_slips ls ON ls.loading_slip_id = $2
       LEFT JOIN warehouses w ON w.warehouse_id = o.warehouse_id LEFT JOIN vehicles v ON v.vehicle_id = o.vehicle_id
      WHERE o.order_id = $1`,
    [row.order_id, row.loading_slip_id],
  ))!;
  const items = await q(
    `SELECT p.product_name, p.grade, oi.quantity FROM order_items oi JOIN products p ON p.product_id = oi.product_id
      WHERE oi.order_id = $1 AND oi.is_active = TRUE AND oi.quantity IS NOT NULL AND LOWER(p.brand) = LOWER($2) ORDER BY oi.order_item_id`,
    [row.order_id, row.brand],
  );
  const pdf = await loadingSlipPdf({
    fileName: row.loading_slip_file_name ?? "",
    date: dmy(o.loading_slip_date ?? row.created_at ?? new Date(), "/"),
    orderNumber: o.order_number ?? `ON${o.order_id}`,
    godown: o.godown,
    vehicle: o.vehicle_number,
    brand: row.brand,
    product: items[0]?.product_name ?? null,
    subDealer: o.sub_dealer,
    items: items.map((i) => ({ grade: i.grade, quantity: Number(i.quantity) })),
  });
  return { binary: { data: pdf, contentType: "application/pdf", filename: `${fileSlug(row.loading_slip_file_name || "loading-slip")}.pdf` } };
}

// downloadInvoice: the Zoho invoice PDF, streamed instead of copied to Retool Storage
async function invoicePdf(orderId: number) {
  const inv = await one("SELECT i.* FROM orders o JOIN invoices i ON i.invoice_id = o.invoice_id WHERE o.order_id = $1", [orderId]);
  if (!inv) throw new HttpError(404, "This order has no invoice");
  if (!zohoConfigured()) throw new HttpError(503, isDemo() ? "Demo mode: invoice PDFs come from Zoho Books" : "Zoho Books is not configured");
  const pdf = await zoho<Buffer>("GET", `invoices/pdf?invoice_ids=${inv.zb_invoice_id}`, undefined, true);
  return { binary: { data: pdf, contentType: "application/pdf", filename: `${inv.zb_invoice_number || inv.zb_invoice_id}.pdf` } };
}

// Signed in-app links and public links ending in .pdf (what WhatsApp is sent).
route("GET", "/api/loading-slip-items/:id/pdf", async ({ params }) => slipPdf(num(params.id)));
route("GET", "/api/files/loading-slips/:id/:name", async ({ params }) => slipPdf(num(params.id)));
route("GET", "/api/orders/:id/invoice.pdf", async ({ params }) => invoicePdf(num(params.id)));
route("GET", "/api/files/invoices/:id/:name", async ({ params }) => invoicePdf(num(params.id)));

async function invoicePublicUrl(origin: string, orderId: number) {
  const inv = await one("SELECT i.invoice_id, i.zb_invoice_id, i.zb_invoice_number FROM orders o JOIN invoices i ON i.invoice_id = o.invoice_id WHERE o.order_id = $1", [orderId]);
  if (!inv) throw new HttpError(400, "Generate the invoice first");
  return { inv, url: origin + signPath(`/api/files/invoices/${orderId}/${fileSlug(inv.zb_invoice_number || inv.zb_invoice_id || "invoice")}.pdf`) };
}

route("GET", "/api/orders/:id/invoice-link", async (req) => ({ url: (await invoicePublicUrl(publicBase(req), num(req.params.id))).url }));

const newOtp = () => String(randomInt(100000, 1000000));

// triggerInvoicingWorkflow + createOtp
route("POST", "/api/orders/:id/invoice", async ({ params }) => {
  const id = num(params.id);
  const res = await invoicingWorkflow(id);
  await q("UPDATE orders SET otp = $1 WHERE order_id = $2 AND otp IS NULL", [newOtp(), id]);
  return res;
});

// getTotalAmount + generateCashBill
route("POST", "/api/orders/:id/cash-bill", async ({ params }) => {
  const id = num(params.id);
  const slips = await one("SELECT COUNT(*)::int AS n FROM loading_slips WHERE order_id = $1 AND is_active = TRUE", [id]);
  if (slips!.n !== 1) throw new HttpError(400, "Create the loading slips first");
  await q(
    `UPDATE orders SET total_amount = (SELECT COALESCE(SUM(total_price), 0) FROM order_items WHERE order_id = $1 AND is_active = TRUE),
            payment_type = 'cash', updated_at = CURRENT_TIMESTAMP, order_status = '2', otp = COALESCE(otp, $2)
      WHERE order_id = $1`,
    [id, newOtp()],
  );
  return { message: "Cash bill generated" };
});

// markAsDelivered after the OTP check in deliveryModal
route("POST", "/api/orders/:id/deliver", async ({ params, body }) => {
  const id = num(params.id);
  const o = await one("SELECT otp, order_status FROM orders WHERE order_id = $1", [id]);
  if (!o) throw new HttpError(404, "Order not found");
  if (o.order_status !== "2") throw new HttpError(400, "Only in-transit orders can be marked as delivered");
  if (!o.otp || String(body.otp ?? "").trim() !== String(o.otp)) throw new HttpError(400, "Incorrect OTP");
  await q("UPDATE orders SET order_status = '3' WHERE order_id = $1", [id]);
  return { message: "Order marked as delivered" };
});

// "Send Invoice to..." menu. Same steps as the Retool scripts: invoice PDF link
// (stored in invoices.pdf_invoice_url) → new_invoice_pdf to the customer →
// deliver_otp_new → for the second option, the transporter's invoice message.
// Stops at the first failure and reports what was already sent.
route("POST", "/api/orders/:id/send-invoice", async (req) => {
  const id = num(req.params.id);
  const { inv, url } = await invoicePublicUrl(publicBase(req), id);
  if (zohoConfigured()) await invoicePdf(id); // fail early if Zoho can't produce the PDF
  await q("UPDATE invoices SET pdf_invoice_url = $1 WHERE invoice_id = $2", [url, inv.invoice_id]);
  const done: string[] = [];
  const step = async (label: string, fn: () => Promise<{ sent: boolean; note: string }>) => {
    try {
      const r = await fn();
      done.push(r.sent ? label : `${label} (${r.note})`);
    } catch (e: any) {
      throw new HttpError(e.status ?? 502, `${e.message}${done.length ? `. Already sent: ${done.join(", ")}` : ""}`);
    }
  };
  await step("invoice to customer", () => msg.sendInvoicePdfToCustomer(id, url));
  await step("delivery OTP", () => msg.sendDeliveryOtp(id));
  if (req.body.to === "customer_transporter") await step("invoice to transporter", () => msg.sendInvoiceToTransporter(id));
  return { message: `Sent: ${done.join(", ")}` };
});

// Cash bills have no Zoho invoice, so the OTP goes on its own.
route("POST", "/api/orders/:id/send-otp", async ({ params }) => {
  const r = await msg.sendDeliveryOtp(num(params.id));
  return { message: r.sent ? "Delivery OTP sent to the customer" : r.note, whatsapp: r };
});

// ongoing / transit / deliveredOrderDetailsForExport
route("GET", "/api/orders-export", async ({ query }) => {
  const status = String(query.get("status") ?? "1");
  if (!["1", "2", "3"].includes(status)) throw new HttpError(400, "Unknown status");
  const cols = [
    `CASE WHEN ROW_NUMBER() OVER (PARTITION BY o.order_id ORDER BY p.brand, oi.order_item_id) = 1 THEN o.order_id::text ELSE '' END AS "Order No"`,
    `p.brand AS "Brand Name"`, `p.grade AS "Brand Grade"`, `oi.quantity AS "Number of Bags"`,
    ...(status === "1" ? [] : [`o.total_amount AS "Total Price"`]),
    `c.name AS "Party Name"`, `s.site_person_contact AS "Site Person Number"`, `s.site_name AS "Site Name"`,
    `a.line2 AS "Location Line 2"`, `t.name AS "Assigned Transporter"`,
    ...(status === "1" ? [] : [
      `(SELECT STRING_AGG(wk.name, ', ') FROM loading_slip_items lsi LEFT JOIN warehouse_brands wb ON LOWER(lsi.brand) = LOWER(wb.brand) AND wb.warehouse_id = o.warehouse_id
          LEFT JOIN warehouse_keepers wk ON wk.warehouse_keeper_id = wb.warehouse_keeper_id WHERE lsi.loading_slip_id = o.loading_slip_id AND lsi.is_active = TRUE) AS "Warehouse Keepers"`,
      `o.sub_dealer AS "Sub Dealer"`,
      `(SELECT STRING_AGG(lsi.loading_slip_file_name, ', ') FROM loading_slip_items lsi WHERE lsi.loading_slip_id = o.loading_slip_id AND lsi.is_active = TRUE) AS "Loading Slip Number"`,
      `o.delivery_terms AS "Delivery Terms"`,
    ]),
  ];
  return q(
    `SELECT ${cols.join(",\n      ")}
     FROM orders o JOIN order_items oi ON o.order_id = oi.order_id JOIN products p ON oi.product_id = p.product_id
     LEFT JOIN sites s ON o.site_id = s.site_id LEFT JOIN addresses a ON s.address_id = a.address_id
     LEFT JOIN customers c ON o.customer_id = c.customer_id LEFT JOIN transporters t ON o.transporter_id = t.transporter_id
     WHERE o.order_status = $1 AND ${DATE_RANGE("o.order_date", 2, 3)}
     ORDER BY o.order_id DESC, p.brand, oi.order_item_id`,
    [status, query.get("start") ?? "", query.get("end") ?? ""],
  );
});

// ------------------------------------------------------------ loading slips page

// getLoadingSlipsNew + getLoadingSlipCount
route("GET", "/api/loading-slips", async (req) => {
  const { query } = req;
  const where = `lsi.is_active = TRUE
    AND (NULLIF($1::text, '') IS NULL OR lsi.loading_slip_file_name ILIKE '%' || $1::text || '%')
    AND (NULLIF($2::text, '') IS NULL OR LOWER(lsi.brand) = LOWER($2::text))
    AND (NULLIF($3::text, '') IS NULL OR LOWER(w.name) = LOWER($3::text) OR ls.warehouse_id::text = $3::text)
    AND (NULLIF($4::text, '') IS NULL OR (o.order_date AT TIME ZONE 'Asia/Kolkata') >= $4::date)
    AND (NULLIF($5::text, '') IS NULL OR (o.order_date AT TIME ZONE 'Asia/Kolkata') < ($5::date + INTERVAL '1 day'))`;
  const from = `FROM loading_slip_items lsi LEFT JOIN loading_slips ls ON lsi.loading_slip_id = ls.loading_slip_id
    LEFT JOIN orders o ON ls.order_id = o.order_id LEFT JOIN warehouses w ON ls.warehouse_id = w.warehouse_id
    LEFT JOIN customers c ON c.customer_id = o.customer_id
    LEFT JOIN warehouse_brands wb ON LOWER(lsi.brand) = LOWER(wb.brand) AND wb.warehouse_id = ls.warehouse_id
    LEFT JOIN warehouse_keepers wk ON wb.warehouse_keeper_id = wk.warehouse_keeper_id`;
  const args = ["search", "brand", "warehouse", "start", "end"].map((k) => query.get(k) ?? "");
  const limit = Math.min(Number(query.get("limit") ?? 15), 200), offset = Number(query.get("offset") ?? 0);
  const rows = await q(
    `SELECT lsi.loading_slip_item_id, lsi.loading_slip_id, lsi.loading_slip_number, lsi.loading_slip_file_name, lsi.brand, lsi.status, lsi.url,
            ls.order_id, ls.transporter_id, ls.warehouse_id, o.enquiry_id, o.order_number, o.order_status, o.payment_type, o.total_amount, o.customer_id,
            o.invoice_id, o.po_number, o.vehicle_id, (o.order_date AT TIME ZONE 'Asia/Kolkata') AS order_date_ist, c.name AS customer_name,
            w.name AS warehouse_name, COALESCE(wk.name, '') AS warehouse_keeper_name, COALESCE(wk.phone, '') AS warehouse_keeper_phone
       ${from} WHERE ${where} ORDER BY order_date_ist DESC NULLS LAST, lsi.loading_slip_item_id DESC LIMIT ${limit} OFFSET ${offset}`,
    args,
  );
  const count = await one(`SELECT COUNT(*)::int AS count ${from} WHERE ${where}`, args);
  return { rows: rows.map((r) => ({ ...r, url: slipUrl(publicBase(req), r as any) })), count: count!.count };
});

// ------------------------------------------------------------ cash bills

const CASH_BASE = `SELECT o.order_id, o.order_number, o.order_date, o.total_amount, o.customer_id, o.order_status, c.name AS customer_name,
    o.warehouse_id, w.name AS warehouse_name, s.site_name, cc.last_collected, cc.payments,
    lsi.loading_slip_file_name, lsi.loading_slip_number, COALESCE(cc.total_collected, 0) AS total_collected
  FROM orders o
  LEFT JOIN customers c ON c.customer_id = o.customer_id
  LEFT JOIN warehouses w ON w.warehouse_id = o.warehouse_id
  LEFT JOIN sites s ON s.site_id = o.site_id
  LEFT JOIN (SELECT order_id, SUM(amount) AS total_collected, MAX(collection_date) AS last_collected, COUNT(*)::int AS payments FROM cash_collected WHERE is_active = TRUE GROUP BY order_id) cc ON o.order_id = cc.order_id
  LEFT JOIN loading_slips ls ON ls.order_id = o.order_id AND ls.is_active = TRUE
  LEFT JOIN (SELECT DISTINCT ON (loading_slip_id) loading_slip_id, loading_slip_file_name, loading_slip_number FROM loading_slip_items
             WHERE is_active = TRUE ORDER BY loading_slip_id, loading_slip_item_id ASC) lsi ON lsi.loading_slip_id = ls.loading_slip_id`;

// getCashBillsPending / getCashBillsCollected
route("GET", "/api/cash-bills", async ({ query }) => {
  const collected = query.get("tab") === "collected";
  return q(
    `${CASH_BASE} WHERE o.payment_type = 'cash' AND o.is_active = TRUE AND o.order_status <> '5'
       AND ${collected ? "o.total_amount = cc.total_collected" : "(cc.total_collected IS NULL OR cc.total_collected < o.total_amount)"}
       AND ${DATE_RANGE("o.order_date", 1, 2)}
     ORDER BY o.order_date DESC`,
    [query.get("start") ?? "", query.get("end") ?? ""],
  );
});

// getCashBillItems + getCashPayments
route("GET", "/api/cash-bills/:id", async ({ params }) => {
  const id = num(params.id);
  const order = await one(`${CASH_BASE} WHERE o.order_id = $1`, [id]);
  if (!order) throw new HttpError(404, "Cash bill not found");
  const items = await q(`SELECT oi.*, p.category, p.brand, p.grade, p.unit FROM order_items oi LEFT JOIN products p ON p.product_id = oi.product_id WHERE oi.order_id = $1 ORDER BY oi.order_item_id`, [id]);
  const payments = await q("SELECT * FROM cash_collected WHERE order_id = $1 AND is_active = TRUE ORDER BY collection_date, cash_collected_id", [id]);
  return { ...order, items, payments };
});

// addCashCollected
route("POST", "/api/cash-bills/:id/payments", async ({ params, body }) => {
  const id = num(params.id);
  const amount = num(body.amount, "Amount");
  if (amount <= 0) throw new HttpError(400, "Amount must be more than zero");
  await insertRow("cash_collected", { order_id: id, collection_date: str(body.collection_date), amount, payment_mode: "Cash", receipt_number: str(body.receipt_number), created_at: new Date(), updated_at: new Date(), is_active: true });
  return { message: "Payment recorded" };
});

// getCashPendingExportData / getCashCollectedDetailsExport
route("GET", "/api/cash-bills-export", async ({ query }) => {
  if (query.get("tab") === "collected")
    return q(`WITH lsn AS (SELECT o.order_id, STRING_AGG(DISTINCT lsi.loading_slip_file_name, ', ') AS loading_slip_numbers FROM orders o
                 JOIN loading_slip_items lsi ON lsi.loading_slip_id = o.loading_slip_id AND lsi.is_active = TRUE GROUP BY o.order_id),
       wka AS (SELECT o.order_id, STRING_AGG(DISTINCT wk.name, ', ') AS warehouse_keepers FROM orders o JOIN order_items oi ON o.order_id = oi.order_id
                 JOIN products p ON oi.product_id = p.product_id JOIN warehouse_brands wb ON LOWER(wb.brand) = LOWER(p.brand) AND wb.warehouse_id = o.warehouse_id
                 JOIN warehouse_keepers wk ON wb.warehouse_keeper_id = wk.warehouse_keeper_id GROUP BY o.order_id),
       detail AS (SELECT c.order_id,
           CASE WHEN ROW_NUMBER() OVER (PARTITION BY c.order_id ORDER BY c.collection_date DESC, p.brand) = 1 THEN (c.order_id::text || ' - ' || cu.name) ELSE '' END AS "Order",
           c.collection_date::text AS "Collection Date", c.amount AS "Amount", c.payment_mode AS "Payment Mode", c.receipt_number AS "Receipt Number",
           p.brand AS "Brand Name", p.grade AS "Brand Grade", oi.quantity AS "Number of Bags", oi.total_price AS "Price", s.site_name AS "Site Name",
           t.name AS "Assigned Transporter", o.sub_dealer AS "Sub Dealer", o.delivery_terms AS "Delivery Terms",
           lsn.loading_slip_numbers AS "Loading Slip Number", wka.warehouse_keepers AS "Warehouse Keeper"
         FROM cash_collected c JOIN orders o ON c.order_id = o.order_id AND o.payment_type = 'cash' JOIN customers cu ON o.customer_id = cu.customer_id
         JOIN order_items oi ON o.order_id = oi.order_id JOIN products p ON oi.product_id = p.product_id
         LEFT JOIN sites s ON o.site_id = s.site_id LEFT JOIN transporters t ON o.transporter_id = t.transporter_id
         LEFT JOIN lsn ON o.order_id = lsn.order_id LEFT JOIN wka ON o.order_id = wka.order_id WHERE c.payment_mode = 'Cash'),
       totals AS (SELECT c.order_id, ''::text, 'Total'::text, SUM(c.amount)::numeric, ''::text, ''::text, ''::text, ''::text, NULL::numeric, NULL::numeric,
           ''::text, ''::text, ''::text, ''::text, ''::text, ''::text
         FROM cash_collected c JOIN orders o ON c.order_id = o.order_id AND o.payment_type = 'cash' WHERE c.payment_mode = 'Cash' GROUP BY c.order_id)
      SELECT "Order", "Collection Date", "Amount", "Payment Mode", "Receipt Number", "Brand Name", "Brand Grade", "Number of Bags", "Price", "Site Name",
             "Assigned Transporter", "Sub Dealer", "Delivery Terms", "Loading Slip Number", "Warehouse Keeper"
        FROM (SELECT * FROM detail UNION ALL SELECT * FROM totals) combined
       ORDER BY order_id DESC, ("Collection Date" = 'Total') ASC, "Collection Date" DESC NULLS LAST`);
  return q(
    `WITH cs AS (SELECT order_id, SUM(amount) AS total_collected FROM cash_collected WHERE is_active = TRUE GROUP BY order_id),
       lsa AS (SELECT o.order_id, STRING_AGG(DISTINCT lsi.loading_slip_number::text, ', ' ORDER BY lsi.loading_slip_number::text) AS loading_slip_numbers
                 FROM orders o JOIN loading_slip_items lsi ON lsi.loading_slip_id = o.loading_slip_id AND lsi.is_active = TRUE GROUP BY o.order_id),
       base AS (SELECT o.order_id, o.order_date, p.brand, p.grade, oi.quantity, oi.total_price, c.name AS party_name, s.site_name, t.name AS transporter_name,
                 wk.name AS warehouse_keeper, o.sub_dealer, lsa.loading_slip_numbers, o.delivery_terms,
                 ROW_NUMBER() OVER (PARTITION BY o.order_id ORDER BY p.brand) AS rn
            FROM orders o LEFT JOIN cs ON cs.order_id = o.order_id JOIN order_items oi ON o.order_id = oi.order_id JOIN products p ON oi.product_id = p.product_id
            LEFT JOIN customers c ON o.customer_id = c.customer_id LEFT JOIN sites s ON o.site_id = s.site_id LEFT JOIN transporters t ON o.transporter_id = t.transporter_id
            LEFT JOIN warehouse_brands wb ON LOWER(wb.brand) = LOWER(p.brand) AND wb.warehouse_id = o.warehouse_id AND wb.is_active = TRUE
            LEFT JOIN warehouse_keepers wk ON wk.warehouse_keeper_id = wb.warehouse_keeper_id LEFT JOIN lsa ON lsa.order_id = o.order_id
           WHERE o.payment_type = 'cash' AND (cs.total_collected IS NULL OR cs.total_collected < o.total_amount) AND ${DATE_RANGE("o.order_date", 1, 2)})
     SELECT CASE WHEN rn = 1 THEN order_id::text ELSE '' END AS "Order No", TO_CHAR(order_date::date, 'DD-MM-YYYY') AS "Order Date", brand AS "Brand Name",
            grade AS "Brand Grade", quantity AS "Number of Bags", total_price AS "Price", party_name AS "Party Name", site_name AS "Site Name",
            transporter_name AS "Assigned Transporter", warehouse_keeper AS "Warehouse Keeper", sub_dealer AS "Sub Dealer",
            loading_slip_numbers AS "Loading Slip Number", delivery_terms AS "Delivery Terms"
       FROM base ORDER BY order_id DESC, brand`,
    [query.get("start") ?? "", query.get("end") ?? ""],
  );
});

// ------------------------------------------------------------ external enquiries

// Replaces the Retool workflow webhooks used by the WordPress external form.
// Accepts the WordPress form's own JSON ("[LIVE] External Enquiry Form") or the
// Create Enquiry JSON. Send the key in an "x-api-key" header (or ?key=).
route("POST", "/api/webhooks/enquiry", async ({ headers, query, body }) => {
  if (!config.enquiryWebhookKey) throw new HttpError(503, "External enquiries are not enabled. Set ENQUIRY_WEBHOOK_KEY.");
  const given = String(headers["x-api-key"] ?? query.get("key") ?? "");
  const a = Buffer.from(given), b = Buffer.from(config.enquiryWebhookKey);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new HttpError(401, "Invalid API key");
  const input = isExternalFormPayload(body)
    ? await externalEnquiryInput(body)
    : {
        ...body,
        customerID: body.customerID ?? body.customerName,
        deliveryAddress: { siteId: null, siteName: body.deliveryAddress?.siteName || body.deliveryAddress?.city || "Site", ...(body.deliveryAddress ?? {}) },
        billingAddress: body.billingAddress ?? {},
        source: body.source && body.source !== "Internal" ? body.source : "External",
        matchByPhone: body.customerID == null || !/^\d+$/.test(String(body.customerID)),
      };
  const res = await createEnquiryWorkflow(input);
  return { status: 201, json: { success: true, ...res } };
}, { isPublic: true });
