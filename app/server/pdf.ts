import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { config } from "./config.js";

export interface LoadingSlipPdf {
  number: number | string;
  fileName: string;
  date: string;
  orderId: number;
  orderNumber: string | null;
  customer: string;
  customerPhone: string | null;
  site: string | null;
  sitePerson: string | null;
  deliveryAddress: string;
  mapsLink: string | null;
  warehouse: string;
  keeper: string | null;
  transporter: string | null;
  transporterPhone: string | null;
  vehicle: string | null;
  deliveryTerms: string | null;
  subDealer: string | null;
  poNumber: string | null;
  brand: string;
  items: { category: string; brand: string; grade: string; quantity: number; unit: string }[];
}

// WinAnsi fonts can't draw ₹ or other non-Latin characters; replace them.
const safe = (s: unknown) => String(s ?? "").replace(/[^\x20-\x7E]/g, "");

export async function loadingSlipPdf(d: LoadingSlipPdf) {
  const doc = await PDFDocument.create();
  doc.setTitle(`Loading Slip ${d.fileName}`);
  const page = doc.addPage([595, 842]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const orange = rgb(0.95, 0.38, 0.13), navy = rgb(0.16, 0.18, 0.27), grey = rgb(0.45, 0.45, 0.5);
  let y = 800;
  const text = (s: unknown, x: number, size = 10, f = font, color = navy) => page.drawText(safe(s), { x, y, size, font: f, color });

  page.drawRectangle({ x: 0, y: 772, width: 595, height: 70, color: navy });
  y = 812; text(config.companyName, 40, 18, bold, rgb(1, 1, 1));
  y = 792; text("LOADING SLIP", 40, 11, font, orange);
  y = 812; text(`No. ${d.fileName}`, 400, 14, bold, rgb(1, 1, 1));
  y = 792; text(`Date: ${d.date}`, 400, 10, font, rgb(1, 1, 1));

  y = 740;
  const rows: [string, unknown][] = [
    ["Order", `#${d.orderId}${d.orderNumber ? `  (${d.orderNumber})` : ""}`],
    ["Party", d.customer + (d.customerPhone ? `  ${d.customerPhone}` : "")],
    ["Site", d.site],
    ["Site person", d.sitePerson],
    ["Delivery address", d.deliveryAddress],
    ["Map", d.mapsLink],
    ["Warehouse", d.warehouse],
    ["Warehouse keeper", d.keeper],
    ["Transporter", [d.transporter, d.transporterPhone].filter(Boolean).join("  ")],
    ["Vehicle", d.vehicle],
    ["Delivery terms", d.deliveryTerms],
    ["Sub dealer", d.subDealer],
    ["PO number", d.poNumber],
  ];
  for (const [k, v] of rows) {
    if (!v) continue;
    text(k, 40, 9, font, grey);
    const val = safe(v);
    // wrap long values
    const words = val.split(" ");
    let line = "";
    for (const w of words) {
      if (font.widthOfTextAtSize(line + w, 10) > 400) { text(line, 150); y -= 14; line = ""; }
      line += w + " ";
    }
    text(line, 150);
    y -= 20;
  }

  y -= 10;
  page.drawRectangle({ x: 40, y: y - 6, width: 515, height: 22, color: rgb(0.99, 0.95, 0.92) });
  text("Category", 48, 9, bold); text("Brand", 160, 9, bold); text("Grade", 290, 9, bold); text("Quantity", 470, 9, bold);
  y -= 26;
  for (const it of d.items) {
    text(it.category, 48); text(it.brand, 160); text(it.grade, 290); text(`${it.quantity} ${it.unit}`, 470);
    y -= 18;
    page.drawLine({ start: { x: 40, y: y + 10 }, end: { x: 555, y: y + 10 }, thickness: 0.5, color: rgb(0.9, 0.9, 0.9) });
  }

  y = 90;
  page.drawLine({ start: { x: 40, y: y + 20 }, end: { x: 220, y: y + 20 }, thickness: 0.5, color: grey });
  page.drawLine({ start: { x: 375, y: y + 20 }, end: { x: 555, y: y + 20 }, thickness: 0.5, color: grey });
  text("Warehouse keeper signature", 40, 9, font, grey);
  text("Driver signature", 375, 9, font, grey);
  return Buffer.from(await doc.save());
}
