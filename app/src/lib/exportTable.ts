// Downloads and printouts of a table. They follow the table exactly: the same
// filters, search and sort, every page of rows, so a file never holds more or
// less than the screen said it would.

export type ExportCol = { key: string; label: string; kind?: "text" | "int" | "money" | "num" | "date" | "datetime" | "mono" };
export type ExportInput = { title: string; filename: string; cols: ExportCol[]; rows: Record<string, unknown>[]; note?: string; totals?: string[] };

const IST = 330 * 60000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const p2 = (n: number) => String(n).padStart(2, "0");
function istDate(v: unknown): Date | null {
  if (v === null || v === undefined || v === "") return null;
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) { const [y, m, d] = s.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d)); }
  const t = new Date(s).getTime();
  return Number.isNaN(t) ? null : new Date(t + IST);
}
const dateText = (v: unknown, withTime = false) => {
  const d = istDate(v);
  if (!d) return "";
  const base = `${p2(d.getUTCDate())} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  return withTime ? `${base}, ${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}` : base;
};
const stampNow = () => dateText(new Date().toISOString(), true);
const safeName = (s: string) => s.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim() || "export";
const isNum = (k?: ExportCol["kind"]) => k === "int" || k === "money" || k === "num";

/** A cell as the reader sees it, for CSV and print. */
export function plainValue(v: unknown, kind?: ExportCol["kind"]): string {
  if (v === null || v === undefined) return "";
  if (kind === "date") return dateText(v);
  if (kind === "datetime") return dateText(v, true);
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (Array.isArray(v)) return v.join(", ");
  return String(v);
}

function download(blob: Blob, filename: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

export function downloadCsv(x: ExportInput) {
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const lines = [x.cols.map((c) => esc(c.label)).join(","), ...x.rows.map((r) => x.cols.map((c) => esc(isNum(c.kind) && r[c.key] !== null && r[c.key] !== undefined && r[c.key] !== "" ? String(Number(r[c.key])) : plainValue(r[c.key], c.kind))).join(","))];
  // BOM so Excel opens ₹ and Indian names correctly.
  download(new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" }), `${safeName(x.filename)}.csv`);
}

/** A formatted workbook: title, when it was made, filters, a styled frozen header, number formats and totals. */
export async function downloadXlsx(x: ExportInput) {
  const { default: ExcelJS } = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  wb.creator = "Sambhavnath OMS";
  const ws = wb.addWorksheet(safeName(x.title).slice(0, 31), { views: [{ state: "frozen", ySplit: 4 }] });
  const n = x.cols.length;
  ws.mergeCells(1, 1, 1, Math.max(1, n));
  ws.getCell(1, 1).value = x.title;
  ws.getCell(1, 1).font = { bold: true, size: 14, color: { argb: "FF111827" } };
  ws.mergeCells(2, 1, 2, Math.max(1, n));
  ws.getCell(2, 1).value = `Sambhavnath Agencies LLP · Exported ${stampNow()} IST · ${x.rows.length} row${x.rows.length === 1 ? "" : "s"}${x.note ? ` · ${x.note}` : ""}`;
  ws.getCell(2, 1).font = { size: 10, color: { argb: "FF6B7280" } };
  const header = ws.getRow(4);
  x.cols.forEach((c, i) => {
    const cell = header.getCell(i + 1);
    cell.value = c.label;
    cell.font = { bold: true, color: { argb: "FF111827" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F4F6" } };
    cell.border = { bottom: { style: "thin", color: { argb: "FFD5D9E0" } } };
    cell.alignment = { vertical: "middle", horizontal: isNum(c.kind) ? "right" : "left" };
  });
  header.height = 20;
  x.rows.forEach((r, ri) => {
    const row = ws.getRow(5 + ri);
    x.cols.forEach((c, i) => {
      const v = r[c.key];
      const cell = row.getCell(i + 1);
      if (v === null || v === undefined || v === "") return;
      if (isNum(c.kind) && Number.isFinite(Number(v))) {
        cell.value = Number(v);
        cell.numFmt = c.kind === "money" ? '"₹"#,##,##0.00' : c.kind === "int" ? "#,##,##0" : "#,##,##0.###";
      } else if (c.kind === "date" || c.kind === "datetime") {
        const d = istDate(v);
        if (d) { cell.value = d; cell.numFmt = c.kind === "date" ? "dd mmm yyyy" : "dd mmm yyyy, hh:mm"; }
      } else cell.value = plainValue(v, c.kind);
    });
  });
  const last = 4 + x.rows.length;
  if (x.totals?.length && x.rows.length) {
    const row = ws.getRow(last + 1);
    x.cols.forEach((c, i) => {
      const cell = row.getCell(i + 1);
      if (x.totals!.includes(c.key)) {
        const col = ws.getColumn(i + 1).letter;
        cell.value = { formula: `SUM(${col}5:${col}${last})` };
        cell.numFmt = c.kind === "money" ? '"₹"#,##,##0.00' : c.kind === "int" ? "#,##,##0" : "#,##,##0.###";
      } else if (i === 0) cell.value = "Total";
      cell.font = { bold: true };
      cell.border = { top: { style: "thin", color: { argb: "FF9CA3AF" } } };
    });
  }
  // Widths from the content, within limits.
  x.cols.forEach((c, i) => {
    const longest = Math.max(c.label.length, ...x.rows.slice(0, 500).map((r) => (isNum(c.kind) ? String(r[c.key] ?? "").length + 4 : plainValue(r[c.key], c.kind).length)));
    ws.getColumn(i + 1).width = Math.min(48, Math.max(10, longest + 2));
  });
  if (x.rows.length) ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: last, column: n } };
  const buf = await wb.xlsx.writeBuffer();
  download(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `${safeName(x.filename)}.xlsx`);
}

/** A clean A4 printout of the rows (Print, or Save as PDF from the print dialog). */
export function printRows(x: ExportInput) {
  const w = window.open("", "_blank", "noopener=no");
  if (!w) throw new Error("The print window was blocked. Allow pop-ups for this site, then try again.");
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
  const fmt = (v: unknown, k?: ExportCol["kind"]) => isNum(k) && v !== null && v !== undefined && v !== "" ? Number(v).toLocaleString("en-IN", { maximumFractionDigits: k === "int" ? 0 : 2 }) : plainValue(v, k);
  const totals = x.totals?.length ? `<tfoot><tr>${x.cols.map((c, i) => `<td class="${isNum(c.kind) ? "r" : ""}">${x.totals!.includes(c.key) ? fmt(x.rows.reduce((s, r) => s + Number(r[c.key] || 0), 0), c.kind) : i === 0 ? "Total" : ""}</td>`).join("")}</tr></tfoot>` : "";
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(x.title)}</title><style>
    @page { size: A4 ${x.cols.length > 7 ? "landscape" : "portrait"}; margin: 12mm; }
    body { font: 11px/1.4 Inter, system-ui, sans-serif; color: #111827; margin: 0; }
    h1 { font-size: 16px; margin: 0 0 2px; } .meta { color: #6b7280; margin-bottom: 12px; }
    table { width: 100%; border-collapse: collapse; } th, td { padding: 5px 6px; border-bottom: 1px solid #e7e9ee; text-align: left; vertical-align: top; }
    th { background: #f3f4f6; font-weight: 600; } .r { text-align: right; font-variant-numeric: tabular-nums; }
    tfoot td { font-weight: 600; border-top: 1px solid #9ca3af; } thead { display: table-header-group; } tr { break-inside: avoid; }
  </style></head><body><h1>${esc(x.title)}</h1><div class="meta">Sambhavnath Agencies LLP · Printed ${stampNow()} IST · ${x.rows.length} row${x.rows.length === 1 ? "" : "s"}${x.note ? ` · ${esc(x.note)}` : ""}</div>
  <table><thead><tr>${x.cols.map((c) => `<th class="${isNum(c.kind) ? "r" : ""}">${esc(c.label)}</th>`).join("")}</tr></thead>
  <tbody>${x.rows.map((r) => `<tr>${x.cols.map((c) => `<td class="${isNum(c.kind) ? "r" : ""}">${esc(fmt(r[c.key], c.kind))}</td>`).join("")}</tr>`).join("")}</tbody>${totals}</table>
  <script>window.onload = () => { window.print(); };</script></body></html>`);
  w.document.close();
}
