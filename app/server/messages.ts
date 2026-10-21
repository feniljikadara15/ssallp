// WhatsApp notifications. Campaign names and template parameters match the
// AiSensy REST queries in the Retool app.
import { one } from "./db.js";
import { HttpError } from "./http.js";
import { phoneDigits, sendWhatsApp } from "./integrations.js";

// DD-MM-YYYY in India time, whether the column is a DATE ("YYYY-MM-DD") or a timestamp.
export function dmy(d: unknown, sep = "-") {
  if (!d) return "";
  if (typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)) return d.split("-").reverse().join(sep);
  const date = d instanceof Date ? d : new Date(String(d));
  if (Number.isNaN(date.getTime())) return String(d);
  return date.toLocaleDateString("en-GB", { timeZone: "Asia/Kolkata" }).replace(/\//g, sep);
}
const ddmmyyyy = (d: unknown) => dmy(d);

// getEnquirySummaryString / getOrderItemsString / getLoadingSlipItemsString
const SUMMARY = `STRING_AGG(CONCAT(p.category, ' - ', p.brand, ' - ', p.grade, ' for ', i.quantity, ' ', p.unit), ' ; ') AS output_string`;
export const enquirySummary = async (enquiryId: number) =>
  (await one(`SELECT ${SUMMARY} FROM enquiry_items i JOIN products p ON i.product_id = p.product_id WHERE i.enquiry_id = $1 AND i.quantity IS NOT NULL`, [enquiryId]))?.output_string ?? "";
export const orderItemsString = async (orderId: number, brand?: string) =>
  (await one(
    `SELECT ${SUMMARY} FROM order_items i JOIN products p ON i.product_id = p.product_id WHERE i.order_id = $1 AND i.quantity IS NOT NULL${brand ? " AND LOWER(p.brand) = LOWER($2)" : ""}`,
    brand ? [orderId, brand] : [orderId],
  ))?.output_string ?? "";

async function enquiryCtx(enquiryId: number) {
  const e = await one(
    `SELECT e.*, c.name AS customer_name, c.phone AS customer_phone, a.maps_link
       FROM enquiries e JOIN customers c ON c.customer_id = e.customer_id
       LEFT JOIN addresses a ON a.address_id = e.delivery_address_id
      WHERE e.enquiry_id = $1`,
    [enquiryId],
  );
  if (!e) throw new HttpError(404, "Enquiry not found");
  return e;
}

export async function sendEnquiryToTransporter(enquiryId: number) {
  const e = await enquiryCtx(enquiryId);
  const t = await one("SELECT * FROM transporters WHERE transporter_id = $1", [e.transporter_id]);
  if (!t) throw new HttpError(400, "Select a transporter first");
  return sendWhatsApp({
    campaignName: "[Live] New Enquiry Transporter Delivery Confirmation Request",
    destination: phoneDigits(t.phone_number),
    userName: t.name,
    templateParams: [t.name, await enquirySummary(enquiryId), ddmmyyyy(e.delivery_date), e.maps_link ? e.maps_link : "Not Available"],
    source: "retool",
    paramsFallbackValue: { FirstName: "Transporter" },
  });
}

export async function sendEnquiryRejectionToCustomer(enquiryId: number) {
  const e = await enquiryCtx(enquiryId);
  return sendWhatsApp({
    campaignName: "Enquiry Rejection Customer Notification",
    destination: phoneDigits(e.customer_phone),
    userName: e.customer_name,
    templateParams: [e.customer_name, await enquirySummary(enquiryId)],
    source: "Internal Enquiry",
    paramsFallbackValue: { FirstName: "Customer" },
  });
}

export async function sendEnquiryToCustomer(enquiryId: number) {
  const e = await enquiryCtx(enquiryId);
  return sendWhatsApp({
    campaignName: "customer_order_confirmation_notification",
    destination: phoneDigits(e.customer_phone),
    userName: e.customer_name,
    templateParams: [e.customer_name, await enquirySummary(enquiryId), ddmmyyyy(e.delivery_date)],
    source: "retool workflow",
    paramsFallbackValue: { FirstName: "Customer" },
  });
}

async function orderCtx(orderId: number) {
  const o = await one(
    `SELECT o.*, c.name AS customer_name, c.phone AS customer_phone, e.delivery_date,
            t.name AS transporter_name, t.phone_number AS transporter_phone, v.vehicle_number, w.name AS warehouse_name,
            s.site_person_contact, a.line1, a.line2, a.city, a.state, a.pincode, a.maps_link,
            i.zb_invoice_id, i.zb_invoice_number, i.zb_invoice_url
       FROM orders o
       JOIN customers c ON c.customer_id = o.customer_id
       LEFT JOIN enquiries e ON e.enquiry_id = o.enquiry_id
       LEFT JOIN transporters t ON t.transporter_id = o.transporter_id
       LEFT JOIN vehicles v ON v.vehicle_id = o.vehicle_id
       LEFT JOIN warehouses w ON w.warehouse_id = o.warehouse_id
       LEFT JOIN sites s ON s.site_id = e.site_id
       LEFT JOIN addresses a ON a.address_id = o.shipping_address_id
       LEFT JOIN invoices i ON i.invoice_id = o.invoice_id
      WHERE o.order_id = $1`,
    [orderId],
  );
  if (!o) throw new HttpError(404, "Order not found");
  return o;
}

const address = (o: Record<string, any>, empty = "Not available") => [o.line1, o.line2, o.city, o.state, o.pincode].map((v) => v || empty).join(", ");

// Zoho's public invoice link carries a CInvoiceID used as the template's URL button.
function invoiceButton(url: string | null) {
  let id: string | null = null;
  try { id = url ? new URL(url).searchParams.get("CInvoiceID") : null; } catch {}
  return [{ type: "button", sub_type: "URL", index: 0, parameters: [{ type: "text", text: id?.startsWith("2-") ? id : null }] }];
}

export async function notifyTransporter(orderId: number) {
  const o = await orderCtx(orderId);
  if (!o.transporter_id) throw new HttpError(400, "Select a transporter first");
  return sendWhatsApp({
    campaignName: "[Live] Order Pickup Transporter Notification",
    destination: phoneDigits(o.transporter_phone),
    userName: o.transporter_name || "Transporter",
    templateParams: [o.transporter_name || "Transporter", o.customer_name || "", o.site_person_contact || "", address(o), await orderItemsString(orderId), o.warehouse_name || "", ddmmyyyy(o.delivery_date)],
    source: "retool app",
    paramsFallbackValue: { FirstName: "Transporter" },
  });
}

// notifyCustomer3: the invoice PDF to the customer ("Send Invoice to... > Customer").
// The second parameter is the Zoho invoice ID, as in the Retool query.
export async function sendInvoicePdfToCustomer(orderId: number, pdfUrl: string) {
  const o = await orderCtx(orderId);
  return sendWhatsApp({
    campaignName: "new_invoice_pdf",
    destination: phoneDigits(o.customer_phone),
    userName: o.customer_name || "Customer",
    templateParams: [o.customer_name || "Customer", String(o.zb_invoice_id || ""), await orderItemsString(orderId), ddmmyyyy(o.delivery_date), o.transporter_name || "", o.transporter_phone || "", o.vehicle_number || ""],
    source: "ssallp-retool",
    media: { url: pdfUrl, filename: "invoice pdf" },
    paramsFallbackValue: { FirstName: "user" },
  });
}

// sendDeliveryOTP: the delivery OTP, also used as the template's URL button parameter.
export async function sendDeliveryOtp(orderId: number) {
  const o = await orderCtx(orderId);
  if (!o.otp) throw new HttpError(400, "This order has no delivery OTP yet");
  return sendWhatsApp({
    campaignName: "deliver_otp_new",
    destination: phoneDigits(o.customer_phone),
    userName: o.customer_name,
    templateParams: [String(o.otp)],
    source: "ssallp-retool",
    buttons: [{ type: "button", sub_type: "URL", index: 0, parameters: [{ type: "text", text: String(o.otp) }] }],
    paramsFallbackValue: { FirstName: "Customer" },
  });
}

// Older "[LIVE] Customer Order & OTP Details Notification" template, kept for reference;
// the Retool app's Send Invoice menu had moved to new_invoice_pdf + deliver_otp_new.
export async function notifyCustomer(orderId: number) {
  const o = await orderCtx(orderId);
  return sendWhatsApp({
    campaignName: "[LIVE] Customer Order & OTP Details Notification",
    destination: phoneDigits(o.customer_phone),
    userName: o.customer_name || "Customer",
    templateParams: [o.customer_name || "Customer", String(o.zb_invoice_number || ""), await orderItemsString(orderId), ddmmyyyy(o.delivery_date), o.transporter_name || "", o.transporter_phone || "", o.vehicle_number || "", o.otp || ""],
    source: "retool app",
    buttons: invoiceButton(o.zb_invoice_url),
    paramsFallbackValue: { FirstName: "Customer" },
  });
}

export async function sendInvoiceToTransporter(orderId: number) {
  const o = await orderCtx(orderId);
  if (!o.transporter_id) throw new HttpError(400, "Order has no transporter");
  return sendWhatsApp({
    campaignName: "[Live] Transporter Invoice Notification",
    destination: phoneDigits(o.transporter_phone),
    userName: o.transporter_name,
    templateParams: [o.transporter_name, String(o.zb_invoice_number || ""), await orderItemsString(orderId), ddmmyyyy(o.delivery_date), address(o), o.maps_link || "Not available", o.customer_name || "", o.vehicle_number || ""],
    source: "retool",
    buttons: invoiceButton(o.zb_invoice_url),
    paramsFallbackValue: { FirstName: "Transporter" },
  });
}

export async function sendLoadingSlipToKeeper(row: { order_id: number; brand: string; warehouse_keeper_name: string; warehouse_keeper_phone: string; loading_slip_file_name: string }, url: string) {
  return sendWhatsApp({
    campaignName: "[Live] Loading Slip Warehouse Keeper Notification",
    destination: phoneDigits(row.warehouse_keeper_phone),
    userName: row.warehouse_keeper_name || "Warehouse Keeper",
    templateParams: [row.warehouse_keeper_name || "Warehouse Keeper", await orderItemsString(row.order_id, row.brand)],
    source: "retool-app",
    media: { url, filename: row.loading_slip_file_name || "loading-slip" },
    paramsFallbackValue: { FirstName: row.warehouse_keeper_name || "Warehouse Keeper" },
  });
}

export async function cancelLoadingSlipNotification(row: { warehouse_keeper_name: string; warehouse_keeper_phone: string; loading_slip_file_name: string }) {
  return sendWhatsApp({
    campaignName: "Cancel Loading Slip",
    destination: phoneDigits(row.warehouse_keeper_phone),
    userName: String(row.warehouse_keeper_name),
    templateParams: [String(row.warehouse_keeper_name), String(row.loading_slip_file_name)],
    source: "retool app",
    paramsFallbackValue: { FirstName: String(row.warehouse_keeper_name) },
  });
}
