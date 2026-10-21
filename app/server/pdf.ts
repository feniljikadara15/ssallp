import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";

// Same content and layout as the HTML template in the Retool "[v2] Loading Slip
// Generation" workflow (rendered there by Browserless): a header with the
// company details, the slip / order / date table, the godown / vehicle / brand /
// product / sub dealer table, the items table and "Authorized Signatory".
export interface LoadingSlipPdf {
  fileName: string;
  date: string;
  orderNumber: string;
  godown: string | null;
  vehicle: string | null;
  brand: string;
  product: string | null;
  subDealer: string | null;
  items: { grade: string; quantity: number }[];
}

const COMPANY = "SRI SAMBAVANATH AGENCIES LLP";
const ADDRESS = "No: 14 & 15, N H School Road, V V Puram, BANGALORE";
const GSTIN = "GSTIN/UIN: 29ADBFS1921N1ZS";

// WinAnsi fonts can't draw ₹ or other non-Latin characters; replace them.
const safe = (s: unknown) => String(s ?? "").replace(/[^\x20-\x7E]/g, "");
const NAVY = rgb(0, 0, 0.5);

function wrap(s: string, font: PDFFont, size: number, width: number) {
  const lines: string[] = [];
  let line = "";
  for (const w of s.split(" ")) {
    const next = line ? `${line} ${w}` : w;
    if (line && font.widthOfTextAtSize(next, size) > width) { lines.push(line); line = w; }
    else line = next;
  }
  return [...lines, line];
}

// Draws a bordered table (header row + body rows) and returns the y below it.
function table(page: PDFPage, font: PDFFont, bold: PDFFont, top: number, cols: number[], head: string[], body: string[][]) {
  const x0 = 40, size = 10, pad = 5, lh = 13;
  let y = top;
  for (const [r, cells] of [head, ...body].entries()) {
    const f = r === 0 ? bold : font;
    const wrapped = cells.map((c, i) => wrap(safe(c), f, size, cols[i] - pad * 2));
    const h = Math.max(...wrapped.map((l) => l.length)) * lh + pad * 2 - 3;
    let x = x0;
    wrapped.forEach((lines, i) => {
      page.drawRectangle({ x, y: y - h, width: cols[i], height: h, borderColor: NAVY, borderWidth: 0.8 });
      lines.forEach((l, j) => page.drawText(l, { x: x + pad, y: y - pad - size - j * lh + 1, size, font: f, color: NAVY }));
      x += cols[i];
    });
    y -= h;
  }
  return y;
}

export async function loadingSlipPdf(d: LoadingSlipPdf) {
  const doc = await PDFDocument.create();
  doc.setTitle(`Loading Slip ${safe(d.fileName)}`);
  const page = doc.addPage([595, 842]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const center = (s: string, y: number, size: number, f: PDFFont) =>
    page.drawText(s, { x: (595 - f.widthOfTextAtSize(s, size)) / 2, y, size, font: f, color: NAVY });
  const heading = (s: string, y: number) => page.drawText(safe(s), { x: 48, y, size: 12, font: bold, color: NAVY });

  center("LOADING SLIP", 790, 20, bold);
  center(COMPANY, 768, 14, bold);
  center(ADDRESS, 751, 10, font);
  center(GSTIN, 737, 10, font);

  let y = 705;
  heading("Loading Slip Details", y); y -= 18;
  heading(`Brand: ${d.brand}`, y); y -= 18;
  heading(`Product: ${d.product ?? ""}`, y); y -= 12;
  y = table(page, font, bold, y, [172, 171, 172], ["Loading Slip #", "Order Number", "Date"], [[d.fileName, d.orderNumber, d.date]]);
  y -= 20;
  y = table(page, font, bold, y, [103, 103, 103, 103, 103], ["Godown", "Vehicle Number", "Brand", "Product", "Sub Dealer"],
    [[d.godown ?? "", d.vehicle ?? "", d.brand, d.product ?? "", d.subDealer ?? ""]]);
  y -= 24;
  heading("Items:", y); y -= 12;
  y = table(page, font, bold, y, [80, 260, 175], ["Sl No", "Grade", "Quantity"], d.items.map((it, i) => [String(i + 1), it.grade, String(it.quantity)]));

  const sig = "Authorized Signatory";
  page.drawText(sig, { x: 555 - bold.widthOfTextAtSize(sig, 11), y: Math.min(y - 40, 120), size: 11, font: bold, color: NAVY });
  return Buffer.from(await doc.save());
}
