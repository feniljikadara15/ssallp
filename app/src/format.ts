// Display helpers. Dates show as DD-MM-YYYY in India time, like the Retool app.

const IST = "Asia/Kolkata";

export function fmtDate(v: unknown) {
  if (!v) return "";
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s.split("-").reverse().join("-");
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString("en-GB", { timeZone: IST }).replace(/\//g, "-");
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
export const ENQUIRY_STATUS: Record<string, string> = { "0": "Ongoing", "1": "Past", "5": "Deleted" };
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
