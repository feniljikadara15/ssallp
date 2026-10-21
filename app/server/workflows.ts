// Re-implementations of the Retool workflows the app triggered, following the
// exported workflow sources:
//   [LIVE] Create Enquiry                 -> createEnquiryWorkflow
//   [LIVE] Zoho Books Invoicing Workflow  -> invoicingWorkflow
//   [LIVE] [v2] Loading Slip Generation   -> loadingSlipWorkflow
//   [LIVE] External Enquiry Form          -> externalEnquiryInput (+ createEnquiryWorkflow)
//   importSingleZBCustomer                -> importZohoCustomer
//   upsertProductsZB                      -> syncZohoProducts
import { isDemo, zohoConfigured } from "./config.js";
import { columnsOf, insertRow, one, q, updateRow, type Row } from "./db.js";
import { HttpError, num, optNum, str } from "./http.js";
import { zoho } from "./integrations.js";
import { signPath } from "./sign.js";

const stateCode = async (state: string | null) =>
  state ? (await one<{ code: string }>("SELECT code FROM state_codes WHERE LOWER(state_name) = LOWER($1) AND is_active = TRUE", [state]))?.code ?? null : null;

// Retool sent "" for empty optional fields and stored NULL for them.
const blank = (v: unknown) => (str(v) === "+91" ? null : str(v));

// ---------------------------------------------------------------- enquiry

export interface EnquiryInput {
  customerID: number | string;
  customerName?: string;
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
  // External enquiries carry no customer ID; match a repeat customer on the
  // mobile number instead of creating a duplicate.
  matchByPhone?: boolean;
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

// upsertShippingAddress: the same address for the same customer is reused
// (Retool's ON CONFLICT on customer_id + address fields WHERE type = 'shipping').
async function upsertShippingAddress(customerId: number, d: EnquiryInput["deliveryAddress"]) {
  const fields = { line1: str(d.line1), line2: str(d.line2), city: str(d.city), state: str(d.state), pincode: str(d.pincode), country: "India" };
  const found = await one(
    `SELECT address_id FROM addresses WHERE customer_id = $1 AND type = 'shipping' AND line1 IS NOT DISTINCT FROM $2 AND line2 IS NOT DISTINCT FROM $3
        AND city IS NOT DISTINCT FROM $4 AND state IS NOT DISTINCT FROM $5 AND pincode::text IS NOT DISTINCT FROM $6 AND country IS NOT DISTINCT FROM 'India'
      ORDER BY address_id LIMIT 1`,
    [customerId, fields.line1, fields.line2, fields.city, fields.state, fields.pincode],
  );
  if (found) {
    await updateRow("addresses", "address_id", found.address_id, { maps_link: str(d.mapsLink), updated_at: new Date(), is_active: true });
    return found.address_id as number;
  }
  const row = await insertRow("addresses", { customer_id: customerId, type: "shipping", ...fields, maps_link: str(d.mapsLink), state_code: await stateCode(fields.state), created_at: new Date(), updated_at: new Date(), is_active: true });
  return row.address_id as number;
}

async function insertBilling(customerId: number, b: EnquiryInput["billingAddress"]) {
  const row = await insertRow("addresses", { customer_id: customerId, type: "billing", line1: str(b.line1), line2: str(b.line2), city: str(b.city), state: str(b.state), pincode: str(b.pincode), country: "India", state_code: await stateCode(str(b.state)), created_at: new Date(), updated_at: new Date(), is_active: true });
  return row.address_id as number;
}

export async function createEnquiryWorkflow(input: EnquiryInput) {
  if (!input.items?.length) throw new HttpError(400, "Add at least one item");
  if (!str(input.customerName) && !str(input.customerID)) throw new HttpError(400, "Customer is required");
  if (!str(input.customerPhone)) throw new HttpError(400, "Customer phone is required");
  const items = await resolveItems(input.items);
  const b = input.billingAddress ?? ({} as EnquiryInput["billingAddress"]);
  const d = input.deliveryAddress ?? ({} as EnquiryInput["deliveryAddress"]);

  // checkCustomer: a numeric customerID is an existing customer; anything else
  // is the name of a new one.
  const idText = String(input.customerID ?? "").trim();
  let customer = /^\d+$/.test(idText) ? await one("SELECT * FROM customers WHERE customer_id = $1", [Number(idText)]) : undefined;
  if (!customer && input.matchByPhone) {
    const mobile = String(input.customerPhone).replace(/\D/g, "").slice(-10);
    if (mobile.length === 10)
      customer = await one("SELECT * FROM customers WHERE RIGHT(regexp_replace(COALESCE(phone, ''), '\\D', '', 'g'), 10) = $1 ORDER BY is_active DESC, customer_id LIMIT 1", [mobile]);
  }

  let customerId: number, billingId: number, shippingId: number, siteId: number, isNew = false;
  if (customer) {
    customerId = customer.customer_id;
    // checkPhoneExists / updateCustomerPhone: only fills a missing phone
    if (!str(customer.phone)) await updateRow("customers", "customer_id", customerId, { phone: str(input.customerPhone), updated_at: new Date() });

    // updateBillingAddress (every billing row of the customer), or create one
    const billingFields = { line1: str(b.line1), line2: str(b.line2), city: str(b.city), state: str(b.state), pincode: str(b.pincode), country: "India", state_code: await stateCode(str(b.state)), updated_at: new Date() };
    const billing = await one("SELECT address_id FROM addresses WHERE customer_id = $1 AND type = 'billing' ORDER BY is_active DESC, address_id LIMIT 1", [customerId]);
    if (billing) {
      await q(`UPDATE addresses SET line1 = $2, line2 = $3, city = $4, state = $5, pincode = $6, country = 'India', updated_at = NOW() WHERE customer_id = $1 AND type = 'billing'`,
        [customerId, billingFields.line1, billingFields.line2, billingFields.city, billingFields.state, billingFields.pincode]);
      await updateRow("addresses", "address_id", billing.address_id, { state_code: billingFields.state_code });
      billingId = billing.address_id;
    } else billingId = await insertBilling(customerId, b);

    shippingId = await upsertShippingAddress(customerId, d);

    // checkSites: an existing site is updated (site_name from siteName); a new
    // one is named after the typed site (siteId holds the text in Retool).
    const sid = /^\d+$/.test(String(d.siteId ?? "").trim()) ? Number(d.siteId) : 0;
    const site = sid ? await one("SELECT site_id FROM sites WHERE site_id = $1", [sid]) : undefined;
    if (site) {
      await updateRow("sites", "site_id", site.site_id, { customer_id: customerId, address_id: shippingId, site_name: str(d.siteName), site_person_name: str(d.sitePersonName), site_person_contact: str(d.sitePersonPhone), updated_at: new Date(), is_active: true });
      siteId = site.site_id;
    } else {
      const name = str(d.siteName) ?? str(d.siteId);
      if (!name) throw new HttpError(400, "Site is required");
      siteId = (await insertRow("sites", { customer_id: customerId, address_id: shippingId, site_name: name, site_person_name: str(d.sitePersonName), site_person_contact: str(d.sitePersonPhone), created_at: new Date(), updated_at: new Date(), is_active: true })).site_id;
    }
  } else {
    // createCustomer + createAddressesNewCustomer + createSiteNewCustomer
    isNew = true;
    const name = str(input.customerName) ?? idText;
    customerId = (await insertRow("customers", {
      name,
      phone: str(input.customerPhone),
      additional_phone_1: blank(input.additionalPhone1),
      additional_phone_2: blank(input.additionalPhone2),
      gstin: blank(input.gstin),
      pan: blank(input.pan),
      tcs_status: !!input.tcsStatus,
      customer_type: blank(input.gstin) ? "business" : "individual",
      zb_customer_id: str(input.zb_customer_id),
      created_at: new Date(),
      updated_at: new Date(),
      is_active: true,
    })).customer_id;
    billingId = await insertBilling(customerId, b);
    shippingId = (await insertRow("addresses", { customer_id: customerId, type: "shipping", line1: str(d.line1), line2: str(d.line2), city: str(d.city), state: str(d.state), pincode: str(d.pincode), country: "India", maps_link: str(d.mapsLink), state_code: await stateCode(str(d.state)), created_at: new Date(), updated_at: new Date(), is_active: true })).address_id;
    const siteName = str(d.siteName) ?? str(d.siteId);
    if (!siteName) throw new HttpError(400, "Site is required");
    siteId = (await insertRow("sites", { customer_id: customerId, address_id: shippingId, site_name: siteName, site_person_name: str(d.sitePersonName), site_person_contact: str(d.sitePersonPhone), created_at: new Date(), updated_at: new Date(), is_active: true })).site_id;
  }

  // createEnquiry + insertItems
  const enquiry = await insertRow("enquiries", {
    customer_id: customerId,
    enquiry_date: new Date(),
    enquiry_status: "0",
    type: input.source || "Internal",
    billing_address_id: billingId,
    delivery_address_id: shippingId,
    delivery_date: str(input.deliveryDate),
    site_id: siteId,
    remarks: str(input.remarks) ?? "No remarks",
    created_at: new Date(),
    updated_at: new Date(),
    is_active: true,
  });
  for (const it of items)
    await insertRow("enquiry_items", { enquiry_id: enquiry.enquiry_id, product_id: it.product_id, quantity: it.quantity, unit_price: it.unit_price, total_price: it.quantity * it.unit_price, status: "0", created_at: new Date(), updated_at: new Date(), is_active: true });
  return { enquiry_id: enquiry.enquiry_id as number, customer_id: customerId, message: isNew ? "Enquiry Created for New Customer" : "Enquiry Created" };
}

// ---------------------------------------------------------------- external form

// The WordPress form posts the customer, addresses and one list per product
// family. Cement brands are keys with [grade, qty] rows; steel, blocks, RMC
// and binding wire are [brand, grade, qty]; sand and aggregates [grade, qty].
const CEMENT_KEYS: Record<string, string> = {
  birlaShakti: "Birla Shakti", acc: "ACC", dalmia: "Dalmia", zuari: "Zuari", penna: "Penna", ramco: "Ramco", chettinad: "Chettinad",
  mahaShakti: "Maha Shakti", birlaSuper: "Birla Super", panyam: "Panyam", ultratech: "Ultratech", indiaCements: "India Cements",
};
const FAMILY_KEYS: Record<string, string> = { steel: "Steel", blocks: "Blocks", rmc: "RMC", bindingWire: "Binding Wire" };
const GRADE_ONLY_KEYS: Record<string, string> = { sand: "Sand", aggregates: "Aggregates" };

export const isExternalFormPayload = (b: Row) =>
  b && typeof b === "object" && !b.items && (b.first_name !== undefined || b.phone !== undefined) && (Object.keys(CEMENT_KEYS).some((k) => k in b) || Object.keys(FAMILY_KEYS).some((k) => k in b) || Object.keys(GRADE_ONLY_KEYS).some((k) => k in b));

const rows = (v: unknown): unknown[][] => (Array.isArray(v) ? v.filter(Array.isArray) as unknown[][] : []);
const norm = (s: unknown) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

// Maps the form to the Create Enquiry input. Products are matched on
// brand + grade (and category for sand / aggregates), ignoring case and
// spacing. Prices start at 0 for the team to fill in; unknown products are
// listed in the remarks instead of failing the whole enquiry.
export async function externalEnquiryInput(b: Row): Promise<EnquiryInput> {
  const products = await q("SELECT product_id, category, brand, grade FROM products WHERE is_active = TRUE");
  const match = (brand: string | null, grade: unknown, category: string | null) =>
    products.find((p) => (!brand || norm(p.brand) === norm(brand)) && norm(p.grade) === norm(grade) && (!category || norm(p.category) === norm(category)));
  // Category names can differ slightly ("Binding Wire" / "Binding wires"), so
  // fall back to brand + grade when the category doesn't match.
  const find = (brand: string | null, grade: unknown, category: string) => match(brand, grade, category) ?? (brand ? match(brand, grade, null) : undefined);
  const items: EnquiryInput["items"] = [];
  const missing: string[] = [];
  const add = (label: string, p: Row | undefined, qty: unknown) => {
    const quantity = Number(qty);
    if (!(quantity > 0)) return;
    if (p) items.push({ product_id: p.product_id, quantity, unit_price: 0 });
    else missing.push(`${label} x ${quantity}`);
  };
  for (const [key, brand] of Object.entries(CEMENT_KEYS))
    for (const [grade, qty] of rows(b[key])) add(`${brand} ${grade}`, find(brand, grade, "Cement"), qty);
  for (const key of Object.keys(FAMILY_KEYS))
    for (const [brand, grade, qty] of rows(b[key])) add(`${FAMILY_KEYS[key]} ${brand} ${grade}`, find(String(brand), grade, FAMILY_KEYS[key]), qty);
  for (const [key, category] of Object.entries(GRADE_ONLY_KEYS))
    for (const [grade, qty] of rows(b[key])) add(`${category} ${grade}`, find(null, grade, category), qty);
  if (!items.length) throw new HttpError(400, missing.length ? `None of the products matched: ${missing.join(", ")}` : "No items in the enquiry");

  const name = [b.first_name, b.last_name].map((v) => str(v)).filter(Boolean).join(" ");
  const phone = (v: unknown) => { const d = String(v ?? "").replace(/\D/g, "").slice(-10); return d ? `+91${d}` : ""; };
  const same = b.billingDeliverySame === true || b.billingDeliverySame === "true" || b.billingDeliverySame === "yes";
  const delivery = {
    line1: str(b.deliveryAddressLine1) ?? "", line2: str(b.deliveryAddressLine2) ?? "",
    city: str(b.deliveryCity) ?? "", state: str(b.deliveryState) ?? "", pincode: str(b.deliveryPincode) ?? "",
  };
  const billing = same ? delivery : {
    line1: str(b.billingAddressLine1) ?? "", line2: str(b.billingAddressLine2) ?? "",
    city: str(b.billingCity) ?? "", state: str(b.billingState) ?? "", pincode: str(b.billingPincode) ?? "",
  };
  return {
    customerID: name,
    customerName: name,
    customerPhone: phone(b.phone),
    gstin: str(b.gstin),
    pan: str(b.gstin) && String(b.gstin).length === 15 ? String(b.gstin).slice(2, 12) : null,
    billingAddress: billing,
    deliveryAddress: {
      siteId: null,
      siteName: str(b.siteName) ?? ([delivery.line1, delivery.city].filter(Boolean).join(", ") || "Site"),
      ...delivery,
      sitePersonName: str(b.sitePersonName) ?? name,
      sitePersonPhone: phone(b.sitePersonPhone || b.phone),
      mapsLink: str(b.mapsLink) ?? undefined,
    },
    items,
    deliveryDate: str(b.deliveryDate) ?? new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }),
    remarks: missing.length ? `Not matched to a product: ${missing.join(", ")}` : null,
    source: "External",
    matchByPhone: true,
  };
}

// ---------------------------------------------------------------- invoicing

const ZB_CUSTOM_FIELDS = {
  warehouseName: "1932341000000080054",
  poNumber: "1932341000000161055",
  pan: "1932341000000171001",
  vehicleNumber: "1932341000000279001",
  warehouse: "1932341000001864001",
  deliveryTerms: "1932341000000523035",
};
const ZB_AUTONUMBER_GROUP = "1932341000000522001";
const ZB_TCS_TAX_ID = "1932341000000522001";

const zbAddress = (a: Row | undefined) => ({ address: a?.line1 ?? "", street2: a?.line2 ?? "", city: a?.city ?? "", state: a?.state ?? "", zip: a?.pincode ?? "" });
// Phone numbers are stored as "+91XXXXXXXXXX"; Zoho gets the 10 digits.
const after91 = (v: unknown) => String(v ?? "").substring(3);

export async function invoicingWorkflow(orderId: number) {
  // getOrder (vehicle and its transporter), getOrderItems, getWarehouseName
  const order = await one(
    `SELECT o.*, v.vehicle_number, t.name AS transporter_name FROM orders o
       LEFT JOIN vehicles v ON o.vehicle_id = v.vehicle_id LEFT JOIN transporters t ON v.transporter_id = t.transporter_id
      WHERE o.order_id = $1`,
    [orderId],
  );
  if (!order) throw new HttpError(404, "Order not found");
  if (order.invoice_id) return { message: "Invoice already generated" };
  const orderItems = await q(
    `SELECT oi.*, p.zb_item_id, p.category, p.brand, p.grade, p.unit, p.gst_rate FROM order_items oi JOIN products p ON oi.product_id = p.product_id
      WHERE oi.order_id = $1 AND oi.is_active = TRUE`,
    [orderId],
  );
  if (!orderItems.length) throw new HttpError(400, "Order has no items");
  const warehouse = order.warehouse_id ? await one("SELECT * FROM warehouses WHERE warehouse_id = $1", [order.warehouse_id]) : undefined;

  // processItems: prices are stored tax-inclusive, Zoho gets the ex-tax rate
  const lineItems = orderItems.map((it) => ({
    item_id: it.zb_item_id,
    name: `${it.category} - ${it.brand} - ${it.grade}`,
    rate: (Number(it.unit_price) / (1 + Number(it.gst_rate ?? 0) / 100)).toFixed(3),
    quantity: Number(it.quantity),
    unit: it.unit ? String(it.unit).charAt(0).toUpperCase() + String(it.unit).slice(1) : undefined,
  }));
  // getTotalAmount
  const total = Math.round(lineItems.reduce((a, x) => a + Number(x.rate) * x.quantity, 0) * 1000) / 1000;

  let customer = await one("SELECT * FROM customers WHERE customer_id = $1 AND is_active = TRUE", [order.customer_id]);
  if (!customer) throw new HttpError(400, "The order's customer is inactive or missing");
  const tcs = !!customer.tcs_status;

  let inv: { zb_invoice_id: string; zb_invoice_number: string; zb_invoice_url: string | null };
  if (zohoConfigured()) {
    // getAddresses: [billing, shipping] by type, getSiteDetails
    const addrs = await q(
      `SELECT a.* FROM addresses a WHERE a.address_id = (SELECT s.address_id FROM sites s JOIN orders o ON s.site_id = o.site_id WHERE o.order_id = $1 AND s.customer_id = o.customer_id)
          OR a.address_id = (SELECT o.billing_address_id FROM orders o WHERE o.order_id = $1) ORDER BY a.type ASC`,
      [orderId],
    );
    const billing = addrs.find((a) => a.type === "billing");
    const shipping = addrs.find((a) => a.type === "shipping");
    const site = order.site_id ? await one("SELECT * FROM sites WHERE site_id = $1", [order.site_id]) : undefined;

    let contactId: string | null = customer.zb_customer_id && customer.zb_customer_id !== "{}" ? customer.zb_customer_id : null;
    if (contactId) {
      // checkCustomerInZB -> informZBIDIssue
      const found = await zoho("GET", `contacts/${encodeURIComponent(contactId)}`).catch(() => null);
      if (!found?.contact) throw new HttpError(409, "Invoice Generation failed due to Customer Conflict. Please contact Tech Admin");
    } else {
      // createZohoCustomerWithGst / createZohoCustomerWithoutGst + updateZohoCustomerToDb
      const res = await zoho("POST", "contacts", {
        contact_name: customer.name,
        ...(customer.gstin != null ? { gst_treatment: "business_gst", gst_no: customer.gstin } : { gst_treatment: "business_none" }),
        billing_address: { attention: customer.name, ...zbAddress(billing) },
        shipping_address: { attention: site?.site_name ?? "", ...zbAddress(shipping) },
      });
      contactId = res.contact?.contact_id ?? res.contacts?.[0]?.contact_id;
      if (!contactId) throw new HttpError(502, "Zoho Books did not return the new customer's ID");
      await q("UPDATE customers SET zb_customer_id = $1 WHERE customer_id = $2", [contactId, customer.customer_id]);
      customer = (await one("SELECT * FROM customers WHERE customer_id = $1", [customer.customer_id]))!;
    }

    // getZohoCustomer, then keep its phone and addresses in step with ours
    const contact = (await zoho("GET", `contacts/${contactId}`)).contact;
    if (!contact.phone) await zoho("POST", "contacts/contactpersons", { contact_id: contact.contact_id, phone: customer.phone }).catch(() => null);
    const zbBillingId = contact.billing_address?.address_id;
    if (zbBillingId) {
      await zoho("PUT", `contacts/${contact.contact_id}/address/${zbBillingId}`, { phone: after91(customer.phone) });
      await q("UPDATE addresses SET zb_address_id = $1, updated_at = NOW() WHERE customer_id = $2 AND type = 'billing'", [zbBillingId, customer.customer_id]);
      await zoho("PUT", `contacts/${contact.contact_id}/address/${zbBillingId}`, { ...zbAddress(billing), address_id: zbBillingId, country: "India" });
    }
    if (shipping) {
      // getCustomerAddresses + ZBShippingAddressCheck
      const existing = (await zoho("GET", `contacts/${contactId}/address`)).addresses ?? [];
      const body = { ...zbAddress(shipping), country: "India", attention: site?.site_name ?? "", phone: after91(site?.site_person_contact) };
      const known = shipping.zb_address_id && existing.some((a: Row) => a.address_id === String(shipping.zb_address_id));
      const res = known
        ? await zoho("PUT", `contacts/${contact.contact_id}/address/${shipping.zb_address_id}`, body)
        : await zoho("POST", `contacts/${contact.contact_id}/address`, { ...body, zip: Number(shipping.pincode) || shipping.pincode });
      await q("UPDATE addresses SET zb_address_id = $1, updated_at = NOW() WHERE address_id = $2", [res.address_info?.address_id ?? shipping.zb_address_id, shipping.address_id]);
    }
    // markCustomerActive
    await zoho("POST", `contacts/${contactId}/active`).catch(() => null);

    // getOrderAddresses (fresh zb_address_id) + createDraftInvoiceWith(out)Tcs
    const shippingZbId = shipping ? (await one("SELECT zb_address_id FROM addresses WHERE address_id = $1", [shipping.address_id]))?.zb_address_id : undefined;
    const customFields = [
      { customfield_id: ZB_CUSTOM_FIELDS.warehouseName, value: order.warehouse_name ?? null },
      { customfield_id: ZB_CUSTOM_FIELDS.poNumber, value: order.po_number ?? null },
      { customfield_id: ZB_CUSTOM_FIELDS.pan, value: customer.pan ?? null },
      { customfield_id: ZB_CUSTOM_FIELDS.vehicleNumber, value: order.vehicle_number ?? null },
      { customfield_id: ZB_CUSTOM_FIELDS.warehouse, value: warehouse?.name ?? null },
    ];
    // setDeliverytTerms
    const deliveryTerms = order.delivery_terms === "Delivery" ? "Delivery" : order.delivery_terms === "Ex warehouse" ? "Ex warehouse" : "";
    const res = await zoho("POST", "invoices", {
      customer_id: contactId,
      line_items: lineItems,
      shipping_address_id: shippingZbId ?? undefined,
      autonumbergenerationgroup_id: ZB_AUTONUMBER_GROUP,
      ...(tcs
        ? { custom_fields: customFields, is_tcs_amount_in_percent: true, tcs_percent: "0.10", tcs_tax_id: ZB_TCS_TAX_ID, dispatch_from_address: "ACC WH PEENYA" }
        : { custom_fields: [...customFields, { customfield_id: ZB_CUSTOM_FIELDS.deliveryTerms, value: deliveryTerms }] }),
    });
    inv = { zb_invoice_id: res.invoice.invoice_id, zb_invoice_number: res.invoice.invoice_number, zb_invoice_url: res.invoice.invoice_url ?? null };
  } else if (isDemo()) {
    const n = Number((await one("SELECT COUNT(*) AS n FROM invoices"))!.n) + 2201;
    inv = { zb_invoice_id: `DEMO-INV-${n}`, zb_invoice_number: `INV-${String(n).padStart(6, "0")}`, zb_invoice_url: null };
  } else {
    throw new HttpError(503, "Zoho Books is not configured. Set ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET and ZOHO_REFRESH_TOKEN.");
  }

  // updateInvoiceToDb, markInvoiceAsSent, updateOrderStatus
  const invoice = await insertRow("invoices", { amount: total, order_id: orderId, tcs_status: tcs, ...inv, invoice_date: new Date(), created_at: new Date(), updated_at: new Date(), is_active: true });
  if (zohoConfigured()) await zoho("POST", `invoices/${inv.zb_invoice_id}/status/sent`);
  await updateRow("orders", "order_id", orderId, { order_status: "2", total_amount: total, invoice_id: invoice.invoice_id, payment_type: "invoice", updated_at: new Date() });
  return { message: "Invoice generated", zb_invoice_number: inv.zb_invoice_number };
}

// ---------------------------------------------------------------- loading slips

// "[v2] Loading Slip Generation": replaces the order's slip with a new one that
// has one item per brand the order's warehouse stocks (warehouse_brands) and
// the order contains. Brands not set up for the warehouse get no slip, as in
// Retool; the response names them.
export async function loadingSlipWorkflow(orderId: number, slipDate: string) {
  const order = await one("SELECT * FROM orders WHERE order_id = $1", [orderId]);
  if (!order) throw new HttpError(404, "Order not found");
  if (!order.warehouse_id) throw new HttpError(400, "Select a warehouse and save the order details first");
  const orderBrands = (await q<{ brand: string }>(
    "SELECT DISTINCT p.brand FROM order_items oi JOIN products p ON p.product_id = oi.product_id WHERE oi.order_id = $1 AND oi.is_active = TRUE AND oi.quantity IS NOT NULL",
    [orderId],
  )).map((r) => r.brand);
  if (!orderBrands.length) throw new HttpError(400, "Order has no items");

  // getWarehouseBrands; brandWarehouseMatch decides which brands get a slip
  const warehouseBrands = (await q<{ brand: string }>("SELECT brand FROM warehouse_brands WHERE warehouse_id = $1 AND is_active IS NOT FALSE ORDER BY warehouse_brands_id", [order.warehouse_id])).map((r) => r.brand);
  const lower = (v: string | null) => String(v ?? "").toLowerCase();
  const skipped = orderBrands.filter((b) => !warehouseBrands.some((w) => lower(w) === lower(b)));
  if (skipped.length === orderBrands.length)
    throw new HttpError(400, `No loading slip created: ${skipped.join(", ")} ${skipped.length === 1 ? "is" : "are"} not set up for this warehouse. Add the brand on the Warehouses page.`);

  // removeExistingLS, deleteExistingLSItems, deleteLoadingSlipRecord
  await q("UPDATE orders SET loading_slip_id = NULL WHERE order_id = $1", [orderId]);
  await q("DELETE FROM loading_slip_items WHERE loading_slip_id IN (SELECT loading_slip_id FROM loading_slips WHERE order_id = $1)", [orderId]);
  await q("DELETE FROM loading_slips WHERE order_id = $1", [orderId]);

  // createLoadingSlip
  const slip = await insertRow("loading_slips", { order_id: orderId, regenerated_count: 0, loading_slip_date: slipDate, created_at: new Date(), updated_at: new Date(), is_active: true, warehouse_id: order.warehouse_id, transporter_id: order.transporter_id });

  // createLSForEachBrand -> createLoadingSlipForBrand
  const hasSeq = (await columnsOf("loading_slip_items")).has("loading_slip_number");
  const done = new Set<string>();
  for (const wb of warehouseBrands) {
    if (!orderBrands.some((b) => lower(b) === lower(wb)) || done.has(lower(wb))) continue; // logNoBrandInWH / checkExisitingLS
    done.add(lower(wb));
    const item = await insertRow("loading_slip_items", { loading_slip_id: slip.loading_slip_id, brand: wb, created_at: new Date(), updated_at: new Date(), is_active: true });
    // The Retool DB names the slip itself (loading_slip_file_name); otherwise
    // number it from the sequence.
    let fileName = item.loading_slip_file_name as string | null;
    if (!fileName) {
      let number = item.loading_slip_number;
      if (hasSeq && number == null) {
        number = Number((await one("SELECT COALESCE(MAX(loading_slip_number), 3000) + 1 AS n FROM loading_slip_items"))!.n);
        await updateRow("loading_slip_items", "loading_slip_item_id", item.loading_slip_item_id, { loading_slip_number: number });
      }
      fileName = `LS-${number ?? item.loading_slip_item_id}`;
    }
    // updateLoadingSlipItems: the PDF is rendered on request from "PDF:<id>"
    await updateRow("loading_slip_items", "loading_slip_item_id", item.loading_slip_item_id, { loading_slip_file_name: fileName, url: `PDF:${item.loading_slip_item_id}`, updated_at: new Date(), is_active: true, status: "Active" });
  }
  // updateLSinOrder
  await updateRow("orders", "order_id", orderId, { loading_slip_id: slip.loading_slip_id, updated_at: new Date() });
  return { loading_slip_id: slip.loading_slip_id as number, count: done.size, skipped };
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
