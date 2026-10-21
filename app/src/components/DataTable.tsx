import clsx from "clsx";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Download, Printer, Search, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { fmtDate, dateTime, num, rowRange } from "../format";
import { downloadCsv, downloadXlsx, printRows, type ExportCol } from "../lib/exportTable";
import { EmptyState, toast } from "./ui";
import { Select, usePopover } from "./pickers";

// The one table. It owns header and row height, padding, type and borders, and
// gives every list the same tools: search, sort, Excel/CSV, print, totals,
// paging, a fixed actions column and honest empty states.

type Row = Record<string, any>;

export type Col = {
  key: string;
  label: string;
  /** How the value is shown, sorted and exported. */
  kind?: "text" | "int" | "money" | "num" | "date" | "datetime" | "mono";
  align?: "left" | "right" | "center";
  /** Sum this column in the footer (and in the Excel file). */
  total?: boolean;
  /** Custom cell; the plain value is still used for search, sort and export. */
  render?: (row: Row) => ReactNode;
  /** A second line under the value, in the quiet colour. */
  sub?: (row: Row) => ReactNode;
  /** The value used for search, sort and export when it differs from row[key]. */
  value?: (row: Row) => unknown;
  /** Leave out of exports (e.g. a progress bar). */
  noExport?: boolean;
  className?: string;
  width?: string;
};

/** A row action. The same icons in the same order on every table: open, edit, print, restore, delete. */
export type RowAction = { kind: "open" | "edit" | "print" | "send" | "restore" | "delete"; label: string; icon: ReactNode; onClick?: () => void; href?: string; disabled?: boolean };
const ACTION_ORDER = ["open", "edit", "print", "send", "restore", "delete"];

const cellValue = (c: Col, r: Row) => (c.value ? c.value(r) : r[c.key]);
const isNum = (c: Col) => c.kind === "int" || c.kind === "money" || c.kind === "num";

function Cell({ c, r }: { c: Col; r: Row }) {
  if (c.render) return <>{c.render(r)}</>;
  const v = cellValue(c, r);
  if (v === null || v === undefined || v === "") return <span className="text-line-hover">-</span>;
  switch (c.kind) {
    case "money": return <>₹{num(v, 2).replace(/\.00$/, "")}</>;
    case "int": return <>{num(v)}</>;
    case "num": return <>{Number(v).toLocaleString("en-IN", { maximumFractionDigits: 3 })}</>;
    case "date": return <>{fmtDate(v)}</>;
    case "datetime": return <>{dateTime(v)}</>;
    case "mono": return <span className="font-mono text-[12px]">{String(v)}</span>;
    default: return <>{String(v)}</>;
  }
}

export function DataTable({
  title, meta, cols, rows, rowKey, filename, pageSize = 25, search = true, exportable = true, actions, toolbar, filters,
  rowActions, onRowClick, rowLink, empty, filtersActive, onClearFilters, maxHeight, embedded, loading, rowClass, note, onVisible,
}: {
  title?: string; meta?: ReactNode; cols: Col[]; rows: Row[]; rowKey: string | ((r: Row) => string | number); filename?: string; pageSize?: number;
  search?: boolean; exportable?: boolean;
  /** The view's one primary action, last in the header. */ actions?: ReactNode;
  /** Extra controls before the search box. */ toolbar?: ReactNode;
  /** Filter controls in a second row inside the card. */ filters?: ReactNode;
  rowActions?: (r: Row) => RowAction[]; onRowClick?: (r: Row) => void; rowLink?: (r: Row) => string;
  empty?: { title: string; hint?: ReactNode; action?: ReactNode }; filtersActive?: boolean; onClearFilters?: () => void;
  maxHeight?: string; embedded?: boolean; loading?: boolean; rowClass?: (r: Row) => string | undefined;
  /** Shown in exports and printouts, e.g. the active filters as a sentence. */ note?: string;
  onVisible?: (rows: Row[]) => void;
}) {
  const key = useCallback((r: Row) => String(typeof rowKey === "function" ? rowKey(r) : r[rowKey]), [rowKey]);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);
  const [size, setSize] = useState(pageSize);
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let out = needle ? rows.filter((r) => cols.some((c) => String(cellValue(c, r) ?? "").toLowerCase().includes(needle))) : rows;
    if (sort) {
      const c = cols.find((x) => x.key === sort.key);
      out = [...out].sort((a, b) => {
        const x = c ? cellValue(c, a) : a[sort.key], y = c ? cellValue(c, b) : b[sort.key];
        if (x === y) return 0; if (x === null || x === undefined || x === "") return 1; if (y === null || y === undefined || y === "") return -1;
        const nx = Number(x), ny = Number(y);
        return (c && isNum(c) && Number.isFinite(nx) && Number.isFinite(ny) ? nx - ny : String(x).localeCompare(String(y), undefined, { numeric: true })) * sort.dir;
      });
    }
    return out;
  }, [rows, cols, q, sort]);
  useEffect(() => { onVisible?.(filtered); }, [filtered, onVisible]);
  useEffect(() => setPage(0), [rows]);

  const pages = Math.max(1, Math.ceil(filtered.length / size));
  const cur = Math.min(page, pages - 1);
  const visible = filtered.slice(cur * size, cur * size + size);
  const totals = useMemo(() => Object.fromEntries(cols.filter((c) => c.total).map((c) => [c.key, filtered.reduce((s, r) => s + Number(cellValue(c, r) || 0), 0)])), [filtered, cols]);
  const hasTotals = Object.keys(totals).length > 0 && filtered.length > 0;
  const align = (c: Col) => c.align ?? (isNum(c) ? "right" : "left");
  const ta = (c: Col) => ({ left: "text-left", right: "text-right", center: "text-center" })[align(c)];
  const span = cols.length + 1 + (rowActions ? 1 : 0);

  const exportInput = () => {
    const ec = cols.filter((c) => !c.noExport);
    return {
      title: title ?? "Export", filename: filename ?? title ?? "export",
      cols: ec.map((c): ExportCol => ({ key: c.key, label: c.label, kind: c.kind })),
      rows: filtered.map((r) => Object.fromEntries(ec.map((c) => [c.key, cellValue(c, r)]))),
      note: [note, q.trim() && `Search: ${q.trim()}`].filter(Boolean).join(" · ") || undefined,
      totals: ec.filter((c) => c.total).map((c) => c.key),
    };
  };
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => void | Promise<void>) => {
    if (!filtered.length) { toast("Nothing to export", "info", "No rows match, so no file was made."); return; }
    setBusy(true);
    try { await fn(); } catch (e) { toast("Export failed", "error", (e as Error).message); } finally { setBusy(false); }
  };

  const head = !embedded && (title || search || exportable || actions || toolbar);
  return (
    <div className={clsx(!embedded && "card", "flex min-w-0 flex-col overflow-hidden")}>
      {head && (
        <div className="card-head no-print">
          <div className="flex min-w-[10rem] flex-1 flex-wrap items-baseline gap-x-2 gap-y-0.5">
            {title && <h2 className="card-title break-words">{title}</h2>}
            <span className="count shrink-0">{meta ?? `${num(filtered.length)} ${filtered.length === 1 ? "row" : "rows"}`}</span>
          </div>
          <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
            {toolbar}
            {search && (
              <div className="relative order-last w-full sm:order-none sm:w-56">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
                <input value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} placeholder="Search" aria-label={`Search ${title ?? "rows"}`} className={clsx("input input-sm pl-8", q && "pr-8")} />
                {q && <button type="button" aria-label="Clear search" onClick={() => setQ("")} className="btn-icon btn-icon-sm absolute right-0.5 top-1/2 -translate-y-1/2"><X className="h-3.5 w-3.5" /></button>}
              </div>
            )}
            {exportable && <ExportMenu busy={busy} onXlsx={() => run(() => downloadXlsx(exportInput()))} onCsv={() => run(() => downloadCsv(exportInput()))} onPrint={() => run(() => printRows(exportInput()))} />}
            {actions}
          </div>
        </div>
      )}
      {filters && <div className="no-print flex flex-wrap items-center gap-2 border-b border-line bg-surface-alt px-4 py-2.5">{filters}</div>}
      <div className="overflow-auto" style={{ maxHeight }}>
        <table className="tbl w-full text-[13px]">
          <thead className={clsx("bg-surface-alt", maxHeight && "sticky top-0 z-10")}>
            <tr className="border-b border-line">
              {cols.map((c) => (
                <th key={c.key} style={{ width: c.width }} onClick={() => { setSort((s) => ({ key: c.key, dir: s?.key === c.key && s.dir === 1 ? -1 : 1 })); setPage(0); }}
                  aria-sort={sort?.key === c.key ? (sort.dir === 1 ? "ascending" : "descending") : undefined}
                  className={clsx("c cursor-pointer select-none whitespace-nowrap px-3 py-2.5 text-[12px] font-medium text-faint transition-colors first:pl-4 hover:text-ink", ta(c))}>
                  {c.label}<span className="ml-1 text-faint">{sort?.key === c.key ? (sort.dir === 1 ? "↑" : "↓") : ""}</span>
                </th>
              ))}
              {/* Spare width collects here, so columns sit next to their data instead of spreading apart. */}
              <th aria-hidden className="w-full p-0" />
              {rowActions && <th className="c no-print whitespace-nowrap bg-surface-alt px-3 py-2.5 pr-4 text-right text-[12px] font-medium text-faint shadow-[-1px_0_0_theme(colors.line.DEFAULT)] sm:sticky sm:right-0">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {loading && !rows.length && Array.from({ length: 6 }, (_, i) => (
              <tr key={`sk${i}`}><td colSpan={span} className="h-10 px-4"><div className="skeleton h-3 rounded" style={{ width: `${60 - i * 6}%` }} /></td></tr>
            ))}
            {visible.map((r) => {
              const link = rowLink?.(r);
              const click = onRowClick ? () => onRowClick(r) : undefined;
              return (
                <tr key={key(r)} onClick={click} className={clsx("transition-colors hover:bg-surface-alt", (click || link) && "cursor-pointer", rowClass?.(r))}>
                  {cols.map((c, i) => (
                    <td key={c.key} className={clsx("c h-10 whitespace-nowrap px-3 py-1.5 first:pl-4", ta(c), isNum(c) && "tabular-nums", c.className)}>
                      {i === 0 && link
                        ? <Link to={link} className="font-medium text-ink underline decoration-line-strong underline-offset-2 hover:decoration-ink" onClick={(e) => e.stopPropagation()}><Cell c={c} r={r} /></Link>
                        : <Cell c={c} r={r} />}
                      {c.sub && <div className="mt-0.5 text-[12px] leading-snug text-faint">{c.sub(r)}</div>}
                    </td>
                  ))}
                  <td aria-hidden className="p-0" />
                  {rowActions && (
                    <td className="c no-print h-10 whitespace-nowrap bg-surface px-2 pr-3 text-right shadow-[-1px_0_0_theme(colors.line.DEFAULT)] sm:sticky sm:right-0" onClick={(e) => e.stopPropagation()}>
                      <span className="inline-flex items-center gap-0.5">
                        {rowActions(r).sort((a, b) => ACTION_ORDER.indexOf(a.kind) - ACTION_ORDER.indexOf(b.kind)).map((a) => {
                          const cls = clsx("btn-icon [&>svg]:h-4 [&>svg]:w-4", a.kind === "delete" && "btn-icon-danger");
                          return a.href
                            ? (a.href.startsWith("/api/") || a.href.startsWith("http")
                              ? <a key={a.label} href={a.href} target="_blank" rel="noreferrer" className={cls} aria-label={a.label} title={a.label}>{a.icon}</a>
                              : <Link key={a.label} to={a.href} className={cls} aria-label={a.label} title={a.label}>{a.icon}</Link>)
                            : <button key={a.label} type="button" disabled={a.disabled} onClick={a.onClick} className={cls} aria-label={a.label} title={a.label}>{a.icon}</button>;
                        })}
                      </span>
                    </td>
                  )}
                </tr>
              );
            })}
            {!loading && !filtered.length && (
              <tr><td colSpan={span} className="p-0">
                {q ? <EmptyState title={`Nothing matches "${q}"`} hint="Check the spelling, or clear the search." action={<button className="btn btn-sm" onClick={() => setQ("")}>Clear search</button>} />
                  : filtersActive ? <EmptyState title="No rows match these filters" hint="Rows exist, but the filters hide them." action={onClearFilters ? <button className="btn btn-sm" onClick={onClearFilters}>Clear filters</button> : undefined} />
                  : <EmptyState title={empty?.title ?? "Nothing here yet"} hint={empty?.hint} action={empty?.action} />}
              </td></tr>
            )}
          </tbody>
          {hasTotals && (
            <tfoot className={clsx("bg-surface-alt", maxHeight && "sticky bottom-0")}>
              <tr className="border-t border-line-strong font-medium">
                {cols.map((c, i) => (
                  <td key={c.key} className={clsx("c h-10 whitespace-nowrap px-3 first:pl-4 tabular-nums", ta(c))}>
                    {c.key in totals ? (c.kind === "money" ? `₹${num(totals[c.key], 2).replace(/\.00$/, "")}` : c.kind === "int" ? num(totals[c.key]) : Number(totals[c.key]).toLocaleString("en-IN", { maximumFractionDigits: 3 })) : i === 0 ? "Total" : ""}
                  </td>
                ))}
                <td aria-hidden className="p-0" />{rowActions && <td className="c no-print" />}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {/* Pager only when there is more than one page's worth: a short table needs no paging chrome. */}
      {filtered.length > Math.min(size, 25) && (
        <div className="no-print flex flex-wrap items-center gap-3 border-t border-line px-4 py-2.5 text-[12px] text-muted">
          <span>{rowRange(cur, size, filtered.length)}</span>
          <label className="flex items-center gap-1.5">Per page
            <Select size="sm" required className="w-20" value={String(size)} onChange={(e) => { setSize(Number(e.target.value)); setPage(0); }}
              options={[...new Set([10, 25, 50, 100, 250, size])].sort((a, b) => a - b).map((n) => ({ value: String(n), label: String(n) }))} aria-label="Rows per page" />
          </label>
          <div className="ml-auto flex items-center gap-1">
            <button className="btn btn-sm w-8 px-0" disabled={cur === 0} onClick={() => setPage(0)} aria-label="First page" title="First page"><ChevronsLeft className="h-4 w-4" /></button>
            <button className="btn btn-sm w-8 px-0" disabled={cur === 0} onClick={() => setPage(cur - 1)} aria-label="Previous page" title="Previous page"><ChevronLeft className="h-4 w-4" /></button>
            <span className="px-2 tabular-nums">Page {num(cur + 1)} of {num(pages)}</span>
            <button className="btn btn-sm w-8 px-0" disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)} aria-label="Next page" title="Next page"><ChevronRight className="h-4 w-4" /></button>
            <button className="btn btn-sm w-8 px-0" disabled={cur >= pages - 1} onClick={() => setPage(pages - 1)} aria-label="Last page" title="Last page"><ChevronsRight className="h-4 w-4" /></button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Download menu: formatted Excel, plain CSV, or a printout (which also saves as PDF). */
function ExportMenu({ busy, onXlsx, onCsv, onPrint }: { busy: boolean; onXlsx: () => void; onCsv: () => void; onPrint: () => void }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const { anchor, render } = usePopover<HTMLButtonElement>(open, close, 256);
  const pick = (fn: () => void) => () => { setOpen(false); fn(); };
  const item = (title: string, hint: string, fn: () => void, icon: ReactNode) => (
    <button type="button" role="menuitem" className="flex w-full items-start gap-2.5 px-3 py-2 text-left hover:bg-hover" onClick={pick(fn)}>
      <span className="mt-0.5 text-faint [&>svg]:h-4 [&>svg]:w-4">{icon}</span>
      <span><span className="block text-[13.5px] font-medium text-ink">{title}</span><span className="block text-[12px] text-faint">{hint}</span></span>
    </button>
  );
  return (
    <>
      <button ref={anchor} type="button" className="btn btn-sm" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} disabled={busy} title="Export or print">
        <Download className="h-4 w-4" /><span className="hidden sm:inline">{busy ? "Preparing..." : "Export"}</span><ChevronDown className={clsx("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
      </button>
      {render(
        <div role="menu" className="py-1" onKeyDown={(e) => e.key === "Escape" && setOpen(false)}>
          {item("Excel workbook (.xlsx)", "Formatted, with totals", onXlsx, <Download />)}
          {item("CSV (.csv)", "Plain values, opens anywhere", onCsv, <Download />)}
          {item("Print or save as PDF", "A4, with the current filters", onPrint, <Printer />)}
        </div>,
      )}
    </>
  );
}
