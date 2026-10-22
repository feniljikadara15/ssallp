import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import clsx from "clsx";
import { ArrowLeft } from "lucide-react";
import { downloadCsv, downloadXlsx, printRows, type ExportInput } from "../lib/exportTable";
import { ExportMenu } from "./DataTable";
import { EmptyState, SearchInput, toast } from "./ui";

// List on the left, the full record on the right: the working view for
// enquiries and orders. The selected record lives in the URL (/orders/12), the
// filters in the query string, so moving between records keeps the filters.
// On phones the list and the record take turns, with a link back to the list.

const PAGE = 100;

export interface SplitItem { key: string | number; to: string; title: ReactNode; sub?: ReactNode; right?: ReactNode; rightSub?: ReactNode; tags?: ReactNode }

export function SplitView({ list, detail, selected, backTo, backLabel, emptyText }: {
  list: ReactNode; detail: ReactNode; selected: boolean; backTo: string; backLabel: string; emptyText: string;
}) {
  const { search } = useLocation();
  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(300px,360px)_minmax(0,1fr)]">
      <div className={clsx("min-w-0 lg:sticky lg:top-0", selected && "hidden lg:block")}>{list}</div>
      <div className={clsx("min-w-0", !selected && "hidden lg:block")}>
        {selected ? (
          <>
            <Link to={`${backTo}${search}`} className="mb-3 inline-flex items-center gap-1 text-[12px] text-faint hover:text-ink hover:underline lg:hidden"><ArrowLeft className="h-3 w-3" />{backLabel}</Link>
            {detail}
          </>
        ) : <div className="card"><EmptyState title={emptyText} hint="The full record opens here." /></div>}
      </div>
    </div>
  );
}

export function SplitList({ title, summary, items, total, onMore, selectedKey, loading, empty, q, onSearch, placeholder, exportInput, actions }: {
  title: string; summary?: ReactNode; items: SplitItem[]; selectedKey?: string | number; loading?: boolean; empty: ReactNode;
  /** Paged from the server: how many match in all, and how to load the next page. */
  total?: number; onMore?: () => void;
  q: string; onSearch: (v: string) => void; placeholder: string; exportInput: ExportInput | (() => Promise<ExportInput>); actions?: ReactNode;
}) {
  const { search } = useLocation();
  const [busy, setBusy] = useState(false);
  // Thousands of orders: draw them a page at a time. Search and filters still cover them all.
  const [shown, setShown] = useState(PAGE);
  useEffect(() => setShown(PAGE), [q, title, onMore ? 0 : items.length]);
  const input = async () => (typeof exportInput === "function" ? exportInput() : exportInput);
  const count = total ?? items.length;
  const visible = onMore ? items : items.slice(0, shown);
  const left = count - visible.length;
  const run = (fn: () => unknown) => async () => {
    setBusy(true);
    try { await fn(); } catch (e) { toast("Export failed", "error", (e as Error).message); }
    setBusy(false);
  };
  return (
    <div className="card flex flex-col overflow-hidden lg:max-h-[calc(100dvh-56px)]">
      <div className="card-head shrink-0">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2"><h2 className="card-title">{title}</h2><span className="count">{count.toLocaleString("en-IN")}</span></div>
          {summary && <div className="mt-0.5 truncate text-[12px] text-faint">{summary}</div>}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {actions}
          <ExportMenu busy={busy} onXlsx={run(async () => downloadXlsx(await input()))} onCsv={run(async () => downloadCsv(await input()))} onPrint={run(async () => printRows(await input()))} />
        </div>
      </div>
      <div className="shrink-0 border-b border-line p-3"><SearchInput size="sm" value={q} onChange={onSearch} placeholder={placeholder} /></div>
      <div className="min-h-0 flex-1 divide-y divide-line overflow-y-auto">
        {loading && !items.length && Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="space-y-2 px-4 py-3"><div className="skeleton h-3 w-2/3 rounded" /><div className="skeleton h-3 w-1/3 rounded" /></div>
        ))}
        {visible.map((it) => {
          const active = it.key === selectedKey;
          return (
            <Link key={it.key} to={`${it.to}${search}`} aria-current={active ? "page" : undefined}
              className={clsx("block px-4 py-3 transition-colors", active ? "bg-hover" : "hover:bg-surface-alt")}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-[13.5px] font-medium text-ink">{it.title}</span>
                {it.right && <span className="shrink-0 text-[12px] text-faint">{it.right}</span>}
              </div>
              {(it.sub || it.rightSub) && (
                <div className="mt-0.5 flex items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate text-[12.5px] text-faint">{it.sub}</span>
                  {it.rightSub && <span className="tabular shrink-0 text-[12.5px] font-medium text-ink">{it.rightSub}</span>}
                </div>
              )}
              {it.tags && <div className="mt-1.5 flex flex-wrap gap-1">{it.tags}</div>}
            </Link>
          );
        })}
        {left > 0 && (
          <div className="p-3 text-center">
            <button type="button" className="btn btn-sm w-full" disabled={loading} onClick={() => (onMore ? onMore() : setShown((n) => n + PAGE))}>
              {loading ? "Loading..." : <>Show {Math.min(PAGE, left).toLocaleString("en-IN")} more <span className="text-faint">({left.toLocaleString("en-IN")} left)</span></>}
            </button>
          </div>
        )}
        {!loading && !items.length && <div className="px-4 py-10 text-center">{empty}</div>}
      </div>
    </div>
  );
}
