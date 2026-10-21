// Re-implementations of the Retool workflows the app triggered:
//   triggerEnquiryWorkflow    -> createEnquiryWorkflow
//   triggerInvoicingWorkflow  -> invoicingWorkflow
//   triggerLoadingSlipWorkflow-> loadingSlipWorkflow
//   importSingleZBCustomer    -> importZohoCustomer
//   upsertProductsZB          -> syncZohoProducts
// The workflow sources were not part of the Retool export, so these follow
// what the app passes in and reads back afterwards.
import { isDemo, zohoConfigured } from "./config.js";
import { columnsOf, insertRow, one, q, updateRow, type Row } from "./db.js";
import { HttpError, num, optNum, str } from "./http.js";
import { zoho } from "./integrations.js";
import { signPath } from "./sign.js";

const stateCode = async (state: string | null) =>
  state ? (await one<{ code: string }>("SELECT code FROM state_codes WHERE LOWER(state_name) = LOWER($1) AND is_active = TRUE", [state]))?.code ?? null : null;

const zohoAddress = (a: Row, attention?: string | null) => ({
  attention: attention ?? undefined,
  address: a.line1 ?? "",
  street2: a.line2 ?? "",
  city: a.city ?? "",
  state: a.state ?? "",
  state_code: a.state_code ?? undefined,
  zip: a.pincode ? String(a.pincode) : "",
  country: a.country || "India",
});

// ---------------------------------------------------------------- enquiry

export interface EnquiryInput {
  customerID: number | string;
  customerName: string;
  zb_customer_id?: string | null;
  customerPhone: string;
  additionalPhone1?: string | null;
  additionalPhone2?: string | null;
  pan?: string | null;
  gstin?: string | null;
  tcsStatus?: boolean;
  billingAddress: { line1: string; line2?: string; state: string; city: string; pincode: string };
  deliveryAddress: { siteId: number | string | null; siteName: string; line1?: string; line2?: string; state?: string; city?: string; pincode?: string; sitePersonName?: string; sitePersonPhone?: string; mapsLink?: string };
  items: { product_id?: number; category?: string; brand?: string; grade?: string; product_name?: string; quantity: number; unit_price?: number }[];
  deliveryDate: string;
  remarks?: string | null;
  source?: string;
}

// Items come with a product_id (internal form) or category/brand/grade names
// (external form); both resolve to an active product.
async function resolveItems(raw: EnquiryInput["items"]) {
  const out: { product_id: number; quantity: number; unit_price: number }[] = [];
  for (const it of raw as any[]) {
    let productId = optNum(it.product_id);
    if (!productId && (it.brand || it.grade || it.product_name)) {
      const p = await one(
        `SELECT product_id FROM products WHERE is_active = TRUE AND (
           (LOWER(brand) = LOWER($1) AND LOWER(grade) = LOWER($2) AND ($3::text IS NULL OR LOWER(category) = LOWER($3)))
           OR LOWER(product_name) = LOWER($4)) ORDER BY product_id LIMIT 1`,
        [str(it.brand) ?? "", str(it.grade) ?? "", str(it.category), str(it.product_name) ?? ""],
      );
      productId = p?.product_id ?? null;
    }
    if (!productId) throw new HttpError(400, `Unknown product: ${[it.category, it.brand, it.grade, it.product_name].filter(Boolean).join(" / ") || JSON.stringify(it)}`);
    const quantity = num(it.quantity, "quantity");
    if (quantity <= 0) throw new HttpError(400, "Item quantity must be more than zero");
    out.push({ product_id: productId, quantity, unit_price: optNum(it.unit_price) ?? 0 });
  }
  return out;
}

export async function createEnquiryWorkflow(input: EnquiryInput) {
  if (!input.items?.length) throw new HttpError(400, "Add at least one item");
  if (!str(input.customerName) && !optNum(input.customerID)) throw new HttpError(400, "Customer is required");
  if (!str(input.customerPhone)) throw new HttpError(400, "Customer phone is required");
  const items = await resolveItems(input.items);

  // Customer: existing (numeric id) or new
  const existingId = optNum(input.customerID);
  const customerFields = {
    phone: str(input.customerPhone),
    additional_phone_1: str(input.additionalPhone1) === "+91" ? null : str(input.additionalPhone1),
    additional_phone_2: str(input.additionalPhone2) === "+91" ? null : str(input.additionalPhone2),
    gstin: str(input.gstin),
    pan: str(input.pan),
    tcs_status: !!input.tcsStatus,
    updated_at: new Date(),
  };
  // Reuse the customer picked in the form; otherwise match on the mobile number
  // (last 10 digits) so repeat enquiries don't create duplicate customers.
  const mobile = String(input.customerPhone ?? "").replace(/\D/g, "").slice(-10);
  const matchId = existingId && (await one("SELECT 1 FROM customers WHERE customer_id = $1", [existingId]))
    ? existingId
    : mobile.length === 10
      ? (await one("SELECT customer_id FROM customers WHERE RIGHT(regexp_replace(COALESCE(phone, ''), '\\D', '', 'g'), 10) = $1 ORDER BY is_active DESC, customer_id LIMIT 1", [mobile]))?.customer_id
      : undefined;
  let customer: Row;
  if (matchId) {
    await updateRow("customers", "customer_id", matchId, customerFields);
    customer = (await one("SELECT * FROM customers WHERE customer_id = $1", [matchId]))!;
  } else {
    customer = await insertRow("customers", {
      name: str(input.customerName),
      email: null,
      ...customerFields,
      customer_type: input.gstin ? "business" : "individual",
      zb_customer_id: str(input.zb_customer_id),
      created_at: new Date(),
      is_active: true,
    });
  }
  const customerId = customer.customer_id as number;

  // Billing address: update the customer's billing address or create it
  const b = input.billingAddress;
  const billingFields = { line1: str(b.line1), line2: str(b.line2), city: str(b.city), state: str(b.state), pincode: str(b.pincode), state_code: await stateCode(b.state), updated_at: new Date() };
  let billing = await one("SELECT * FROM addresses WHERE customer_id = $1 AND type = 'billing' AND is_active = TRUE ORDER BY address_id LIMIT 1", [customerId]);
  if (billing) await updateRow("addresses", "address_id", billing.address_id, billingFields);
  else billing = await insertRow("addresses", { customer_id: customerId, type: "billing", country: "India", ...billingFields, created_at: new Date(), is_active: true });
  billing = (await one("SELECT * FROM addresses WHERE address_id = $1", [billing!.address_id]))!;

  // Delivery site: existing site or a new site with its shipping address
  const d = input.deliveryAddress;
  const existingSite = optNum(d.siteId) ? await one("SELECT * FROM sites WHERE site_id = $1 AND customer_id = $2", [optNum(d.siteId), customerId]) : undefined;
  let site: Row, shipping: Row;
  if (existingSite) {
    site = existingSite;
    await updateRow("sites", "site_id", site.site_id, { site_person_name: str(d.sitePersonName) ?? site.site_person_name, site_person_contact: str(d.sitePersonPhone) ?? site.site_person_contact, updated_at: new Date() });
    shipping = (await one("SELECT * FROM addresses WHERE address_id = $1", [site.address_id]))!;
    if (shipping && (d.line1 || d.city)) {
      await updateRow("addresses", "address_id", shipping.address_id, { line1: str(d.line1) ?? shipping.line1, line2: str(d.line2) ?? shipping.line2, city: str(d.city) ?? shipping.city, state: str(d.state) ?? shipping.state, pincode: str(d.pincode) ?? shipping.pincode, maps_link: str(d.mapsLink) ?? shipping.maps_link, state_code: (await stateCode(str(d.state) ?? shipping.state)) ?? shipping.state_code, updated_at: new Date() });
      shipping = (await one("SELECT * FROM addresses WHERE address_id = $1", [site.address_id]))!;
    }
  } else {
    if (!str(d.siteName)) throw new HttpError(400, "Site is required");
    shipping = await insertRow("addresses", { customer_id: customerId, type: "shipping", line1: str(d.line1), line2: str(d.line2), city: str(d.city), state: str(d.state), pincode: str(d.pincode), country: "India", maps_link: str(d.mapsLink), state_code: await stateCode(str(d.state)), created_at: new Date(), updated_at: new Date(), is_active: true });
    site = await insertRow("sites", { customer_id: customerId, address_id: shipping.address_id, site_name: str(d.siteName), site_person_name: str(d.sitePersonName), site_person_contact: str(d.sitePersonPhone), created_at: new Date(), updated_at: new Date(), is_active: true });
  }

  // Keep Zoho Books contact and addresses in step (the old workflow created
  // the contact and the State_Code queries pushed state codes afterwards).
  if (zohoConfigured()) await syncZohoContact(customerId, billing, shipping);

  const enquiry = await insertRow("enquiries", {
    customer_id: customerId,
    enquiry_date: new Date(),
    enquiry_status: "0",
    type: input.source || "Internal",
    billing_address_id: billing.address_id,
    delivery_address_id: shipping?.address_id ?? null,
    site_id: site.site_id,
    remarks: str(input.remarks),
    delivery_date: str(input.deliveryDate),
    created_at: new Date(),
    updated_at: new Date(),
    is_active: true,
  });
  for (const it of items)
    await insertRow("enquiry_items", { enquiry_id: enquiry.enquiry_id, product_id: it.product_id, quantity: it.quantity, unit_price: it.unit_price, created_at: new Date(), updated_at: new Date(), is_active: true });
  return { enquiry_id: enquiry.enquiry_id as number, customer_id: customerId };
}

async function syncZohoContact(customerId: number, billing: Row, shipping: Row | undefined) {
  const c = (await one("SELECT * FROM customers WHERE customer_id = $1", [customerId]))!;
  let contactId = c.zb_customer_id as string | null;
  if (!contactId) {
    const res = await zoho("POST", "contacts", {
      contact_name: c.name,
      contact_type: "customer",
      customer_sub_type: c.gstin ? "business" : "individual",
      gst_no: c.gstin ?? undefined,
      gst_treatment: c.gstin ? "business_gst" : "consumer",
      pan_no: c.pan ?? undefined,
      place_of_contact: billing.state_code ?? undefined,
      billing_address: zohoAddress(billing),
      shipping_address: shipping ? zohoAddress(shipping) : undefined,
      contact_persons: [{ first_name: c.name, mobile: c.phone, phone: c.additional_phone_1 ?? undefined, is_primary_contact: true }],
    });
    contactId = res.contact.contact_id;
    await updateRow("customers", "customer_id", customerId, { zb_customer_id: contactId });
    await updateRow("addresses", "address_id", billing.address_id, { zb_address_id: res.contact.billing_address?.address_id ?? null });
    if (shipping) await updateRow("addresses", "address_id", shipping.address_id, { zb_address_id: res.contact.shipping_address?.address_id ?? null });
    return;
  }
  for (const a of [billing, shipping]) {
    if (!a) continue;
    if (a.zb_address_id) await zoho("PUT", `contacts/${contactId}/address/${a.zb_address_id}`, zohoAddress(a));
    else {
      const res = await zoho("POST", `contacts/${contactId}/address`, zohoAddress(a));
      await updateRow("addresses", "address_id", a.address_id, { zb_address_id: res.address_info?.address_id ?? null });
    }
  }
}

// ---------------------------------------------------------------- invoicing

export async function invoicingWorkflow(orderId: number) {
  const order = await one("SELECT * FROM orders WHERE order_id = $1", [orderId]);
  if (!order) throw new HttpError(404, "Order not found");
  if (order.invoice_id) return { message: "Invoice already generated" };
  const items = await q(
    `SELECT oi.*, p.product_name, p.zb_item_id, p.gst_rate, p.unit, p.hsn FROM order_items oi JOIN products p ON p.product_id = oi.product_id WHERE oi.order_id = $1 AND oi.is_active = TRUE`,
    [orderId],
  );
  if (!items.length) throw new HttpError(400, "Order has no items");
  const total = items.reduce((a, x) => a + Number(x.total_price ?? x.quantity * x.unit_price), 0);
  const customer = (await one("SELECT * FROM customers WHERE customer_id = $1", [order.customer_id]))!;

  let inv: { zb_invoice_id: string; zb_invoice_number: string; zb_invoice_url: string | null };
  if (zohoConfigured()) {
    if (!customer.zb_customer_id) throw new HttpError(400, `${customer.name} has no Zoho Books customer ID. Import or link the customer first.`);
    const billing = order.billing_address_id ? await one("SELECT * FROM addresses WHERE address_id = $1", [order.billing_address_id]) : undefined;
    const shipping = order.shipping_address_id ? await one("SELECT * FROM addresses WHERE address_id = $1", [order.shipping_address_id]) : undefined;
    const slips = await q("SELECT loading_slip_file_name FROM loading_slip_items WHERE loading_slip_id = $1 AND is_active = TRUE", [order.loading_slip_id]);
    const vehicle = order.vehicle_id ? await one("SELECT vehicle_number FROM vehicles WHERE vehicle_id = $1", [order.vehicle_id]) : undefined;
    const transporter = order.transporter_id ? await one("SELECT name FROM transporters WHERE transporter_id = $1", [order.transporter_id]) : undefined;
    const res = await zoho("POST", "invoices", {
      customer_id: customer.zb_customer_id,
      date: new Date().toISOString().slice(0, 10),
      reference_number: order.po_number || `Order ${orderId}`,
      billing_address_id: billing?.zb_address_id ?? undefined,
      shipping_address_id: shipping?.zb_address_id ?? undefined,
      place_of_supply: shipping?.state_code ?? billing?.state_code ?? undefined,
      is_inclusive_tax: true,
      line_items: items.map((it) => ({ item_id: it.zb_item_id ?? undefined, name: it.zb_item_id ? undefined : it.product_name, hsn_or_sac: it.hsn ?? undefined, quantity: Number(it.quantity), rate: Number(it.unit_price), unit: it.unit ?? undefined })),
      notes: [slips.length ? `Loading slips: ${slips.map((s) => s.loading_slip_file_name).join(", ")}` : "", transporter ? `Transporter: ${transporter.name}` : "", vehicle ? `Vehicle: ${vehicle.vehicle_number}` : "", order.delivery_terms ? `Delivery terms: ${order.delivery_terms}` : ""].filter(Boolean).join("\n"),
    });
    const zbId = res.invoice.invoice_id;
    await zoho("POST", `invoices/${zbId}/status/sent`).catch(() => null);
    const fresh = await zoho("GET", `invoices/${zbId}`).catch(() => res);
    inv = { zb_invoice_id: zbId, zb_invoice_number: fresh.invoice.invoice_number, zb_invoice_url: fresh.invoice.invoice_url ?? null };
  } else if (isDemo()) {
    const n = Number((await one("SELECT COUNT(*) AS n FROM invoices"))!.n) + 2201;
    inv = { zb_invoice_id: `DEMO-INV-${n}`, zb_invoice_number: `INV-${String(n).padStart(6, "0")}`, zb_invoice_url: null };
  } else {
    throw new HttpError(503, "Zoho Books is not configured. Set ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET and ZOHO_REFRESH_TOKEN.");
  }

  const invoice = await insertRow("invoices", { order_id: orderId, ...inv, created_at: new Date(), updated_at: new Date(), is_active: true });
  await updateRow("orders", "order_id", orderId, { invoice_id: invoice.invoice_id, payment_type: order.payment_type ?? "credit", total_amount: total, order_status: "2", updated_at: new Date() });
  return { message: `Invoice ${inv.zb_invoice_number} generated` };
}

// ---------------------------------------------------------------- loading slips

export async function loadingSlipWorkflow(orderId: number, slipDate: string) {
  const order = await one("SELECT * FROM orders WHERE order_id = $1", [orderId]);
  if (!order) throw new HttpError(404, "Order not found");
  if (!order.warehouse_id) throw new HttpError(400, "Select a warehouse and save the order details first");
  const brands = await q<{ brand: string }>(
    "SELECT DISTINCT p.brand FROM order_items oi JOIN products p ON p.product_id = oi.product_id WHERE oi.order_id = $1 AND oi.is_active = TRUE ORDER BY p.brand",
    [orderId],
  );
  if (!brands.length) throw new HttpError(400, "Order has no items");

  // A new set replaces the previous one, so an order always has one active slip.
  await q("UPDATE loading_slip_items SET is_active = FALSE WHERE loading_slip_id IN (SELECT loading_slip_id FROM loading_slips WHERE order_id = $1 AND is_active = TRUE)", [orderId]);
  await q("UPDATE loading_slips SET is_active = FALSE WHERE order_id = $1 AND is_active = TRUE", [orderId]);

  const slip = await insertRow("loading_slips", { order_id: orderId, warehouse_id: order.warehouse_id, transporter_id: order.transporter_id, loading_slip_date: slipDate, created_at: new Date(), updated_at: new Date(), is_active: true });
  const hasSeq = (await columnsOf("loading_slip_items")).has("loading_slip_number");
  for (const { brand } of brands) {
    let item = await insertRow("loading_slip_items", { loading_slip_id: slip.loading_slip_id, brand, status: "Created", created_at: new Date(), updated_at: new Date(), is_active: true });
    let number = item.loading_slip_number;
    if (hasSeq && (number === null || number === undefined)) {
      number = Number((await one("SELECT COALESCE(MAX(loading_slip_number), 3000) + 1 AS n FROM loading_slip_items"))!.n);
      await updateRow("loading_slip_items", "loading_slip_item_id", item.loading_slip_item_id, { loading_slip_number: number });
    }
    const fileName = `LS-${number ?? item.loading_slip_item_id}`;
    await updateRow("loading_slip_items", "loading_slip_item_id", item.loading_slip_item_id, { loading_slip_file_name: fileName, url: `PDF:${item.loading_slip_item_id}` });
  }
  await updateRow("orders", "order_id", orderId, { loading_slip_id: slip.loading_slip_id, updated_at: new Date() });
  return { loading_slip_id: slip.loading_slip_id as number, count: brands.length };
}

// Stored "PDF:<id>" urls are generated on request; anything else is an
// external link (for example slips created by the old Retool workflow).
export const fileSlug = (s: string) => String(s).replace(/[^A-Za-z0-9._-]+/g, "-");
export const slipUrl = (origin: string, row: Row): string =>
  !row.url || String(row.url).startsWith("PDF:")
    ? origin + signPath(`/api/files/loading-slips/${row.loading_slip_item_id}/${fileSlug(row.loading_slip_file_name || "loading-slip")}.pdf`)
    : row.url;

// ---------------------------------------------------------------- Zoho imports

export async function importZohoCustomer(zbCustomerId: string) {
  const res = await zoho("GET", `contacts/${encodeURIComponent(zbCustomerId)}`);
  const c = res.contact;
  const primary = (c.contact_persons ?? []).find((p: any) => p.is_primary_contact) ?? c.contact_persons?.[0] ?? {};
  const phone = primary.mobile || c.mobile || primary.phone || c.phone || null;
  const fields = {
    name: c.contact_name,
    email: c.email || primary.email || null,
    phone,
    gstin: c.gst_no || null,
    pan: c.pan_no || null,
    customer_type: c.customer_sub_type || null,
    zb_customer_id: c.contact_id,
    updated_at: new Date(),
    is_active: c.status !== "inactive",
  };
  const existing = await one("SELECT customer_id FROM customers WHERE zb_customer_id = $1", [c.contact_id]);
  const customerId = existing ? (await updateRow("customers", "customer_id", existing.customer_id, fields), existing.customer_id) : (await insertRow("customers", { ...fields, created_at: new Date() })).customer_id;

  const upsertAddress = async (a: any, type: "billing" | "shipping") => {
    if (!a || !(a.address || a.city)) return null;
    const row = { customer_id: customerId, type, line1: a.address || null, line2: a.street2 || null, city: a.city || null, state: a.state || null, pincode: a.zip || null, country: a.country || "India", state_code: a.state_code || null, zb_address_id: a.address_id || null, updated_at: new Date(), is_active: true };
    const found = a.address_id ? await one("SELECT address_id FROM addresses WHERE zb_address_id = $1", [a.address_id]) : undefined;
    if (found) { await updateRow("addresses", "address_id", found.address_id, row); return found.address_id; }
    return (await insertRow("addresses", { ...row, created_at: new Date() })).address_id;
  };
  await upsertAddress(c.billing_address, "billing");
  const shippingId = await upsertAddress(c.shipping_address, "shipping");
  if (shippingId && !(await one("SELECT 1 FROM sites WHERE address_id = $1", [shippingId])))
    await insertRow("sites", { customer_id: customerId, address_id: shippingId, site_name: c.shipping_address.attention || c.shipping_address.city || "Site", site_person_name: c.shipping_address.attention || null, site_person_contact: c.shipping_address.phone || null, created_at: new Date(), updated_at: new Date(), is_active: true });
  return { customer_id: customerId, name: c.contact_name };
}

export async function syncZohoProducts() {
  let page = 1, created = 0, updated = 0;
  for (;;) {
    const res = await zoho("GET", `items?page=${page}&per_page=200`);
    for (const it of res.items ?? []) {
      const fields = { product_name: it.name, description: it.description || null, brand: it.brand || null, sku: it.sku || null, hsn: it.hsn_or_sac || null, mrp: it.rate ?? null, unit: it.unit || null, zb_item_id: it.item_id, is_active: it.status === "active", updated_at: new Date() };
      const found = await one("SELECT product_id FROM products WHERE zb_item_id = $1", [it.item_id]);
      if (found) { await updateRow("products", "product_id", found.product_id, fields); updated++; }
      else { await insertRow("products", { ...fields, created_at: new Date() }); created++; }
    }
    if (!res.page_context?.has_more_page) break;
    page++;
  }
  return { message: `Products synced with Zoho Books (${created} added, ${updated} updated)` };
}

export async function zohoTaxId(rate: number | string, type: "inter" | "intra") {
  return (await one<{ zb_tax_id: string }>("SELECT zb_tax_id FROM zoho_taxes WHERE tax_rate = $1 AND tax_type = $2 AND is_active = TRUE", [String(Number(rate)), type]))?.zb_tax_id;
}
