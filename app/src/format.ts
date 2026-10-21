// Display helpers. Dates are shown in India time as "09 Oct 2026"; plain
// 'YYYY-MM-DD' values are calendar dates and are never shifted.

const IST = "Asia/Kolkata";
const IST_MS = 330 * 60000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const p2 = (n: number) => String(n).padStart(2, "0");

function parts(v: unknown) {
  if (v === null || v === undefined || v === "") return null;
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) { const [y, m, d] = s.split("-").map(Number); return { y, m: m - 1, d, h: 0, mi: 0, s: 0 }; }
  const t = new Date(s).getTime();
  if (Number.isNaN(t)) return null;
  const x = new Date(t + IST_MS);
  return { y: x.getUTCFullYear(), m: x.getUTCMonth(), d: x.getUTCDate(), h: x.getUTCHours(), mi: x.getUTCMinutes(), s: x.getUTCSeconds() };
}

/** 09 Oct 2026 */
export function fmtDate(v: unknown) {
  const q = parts(v);
  return q ? `${p2(q.d)} ${MONTHS[q.m]} ${q.y}` : v ? String(v) : "";
}
/** 09 Oct, 14:05 */
export const dateTime = (v: unknown) => { const q = parts(v); return q ? `${p2(q.d)} ${MONTHS[q.m]}, ${p2(q.h)}:${p2(q.mi)}` : ""; };
/** 09 Oct 2026, 14:05:09 IST: the exact moment, for the audit log. */
export const dateTimeFull = (v: unknown) => { const q = parts(v); return q ? `${p2(q.d)} ${MONTHS[q.m]} ${q.y}, ${p2(q.h)}:${p2(q.mi)}:${p2(q.s)} IST` : ""; };

/** Indian digit grouping without a currency sign: 12,34,567 */
export const num = (v: unknown, digits = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString("en-IN", { minimumFractionDigits: digits, maximumFractionDigits: digits }) : "-";
};
/** "1 order", "3 orders": explicit singular and plural, never a bare "s". */
export const plural = (n: number, one: string, many = `${one}s`) => `${num(n)} ${n === 1 ? one : many}`;
/** "Rows 1 to 50 of 312"; refuses to describe an empty page. */
export function rowRange(page: number, size: number, total: number) {
  if (total <= 0) return "No rows";
  return `Rows ${num(Math.min(total, page * size + 1))} to ${num(Math.min(total, (page + 1) * size))} of ${num(total)}`;
}

// YYYY-MM-DD of a timestamp in India time, for comparing with date inputs.
export function istDay(v: unknown) {
  if (!v) return "";
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return new Date(s).toLocaleDateString("en-CA", { timeZone: IST });
}

export const today = () => new Date().toLocaleDateString("en-CA", { timeZone: IST });

export const inr = (n: unknown) => "₹" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });

export const inRange = (v: unknown, from: string, to: string) => {
  const d = istDay(v);
  return (!from || d >= from) && (!to || d <= to);
};

export const includes = (hay: unknown, needle: string) => !needle.trim() || String(hay ?? "").toLowerCase().includes(needle.trim().toLowerCase());

export function stamp() {
  return new Date().toLocaleString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true, timeZone: IST }).replace(/\//g, "-").replace(",", "");
}

export async function exportRows(rows: Record<string, unknown>[], name: string, type: "csv" | "xlsx", sheetName = "Sheet1") {
  if (!rows.length) throw new Error("Nothing to export");
  if (type === "csv") {
    const cols = Object.keys(rows[0]);
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [cols.map(esc).join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
    download(new Blob([csv], { type: "text/csv" }), `${name}.csv`);
    return;
  }
  const XLSX = await import("xlsx");
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), sheetName.slice(0, 31));
  const out = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  download(new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `${name}.xlsx`);
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

// Enquiry and order status codes stored in the database.
export const ENQUIRY_STATUS: Record<string, string> = { "0": "Ongoing", "1": "Converted", "5": "Deleted" };
export const ORDER_STATUS: Record<string, string> = { "1": "Ongoing", "2": "In transit", "3": "Delivered", "5": "Deleted" };

// Compact rupees for cards and chart axes: ₹950, ₹12.4K, ₹9.6L, ₹1.2Cr.
export function inrShort(n: unknown) {
  const v = Number(n || 0), a = Math.abs(v);
  const f = (x: number) => (x >= 100 ? x.toFixed(0) : x >= 10 ? x.toFixed(1) : x.toFixed(2)).replace(/\.0+$|(\.\d*[1-9])0+$/, "$1");
  if (a >= 1e7) return `₹${f(v / 1e7)}Cr`;
  if (a >= 1e5) return `₹${f(v / 1e5)}L`;
  if (a >= 1e3) return `₹${f(v / 1e3)}K`;
  return `₹${Math.round(v)}`;
}
