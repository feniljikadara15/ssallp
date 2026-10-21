import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, ExternalLink, FileText } from "lucide-react";
import { useGet } from "../api";
import { fmtDate, inr, ORDER_STATUS } from "../format";
import { Badge, Card, ErrorBox, Loading, PageHeader, SearchInput, Select, DateInput } from "../components/ui";

const PAGE = 15;

// getLoadingSlipsNew / getLoadingSlipCount: filtered and paged on the server.
export default function LoadingSlips() {
  const [q, setQ] = useState("");
  const [brand, setBrand] = useState("");
  const [wh, setWh] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(0);
  const products = useGet<any[]>("products?all=1");
  const warehouses = useGet<any[]>("warehouses");
  const params = new URLSearchParams({ search: q, brand, warehouse: wh, start: from, end: to, limit: String(PAGE), offset: String(page * PAGE) });
  const { data, error, isLoading, isFetching } = useGet<{ rows: any[]; count: number }>(`loading-slips?${params}`);
  const reset = <T,>(fn: (v: T) => void) => (v: T) => { fn(v); setPage(0); };
  const pages = Math.max(1, Math.ceil((data?.count ?? 0) / PAGE));

  return (
    <div>
      <PageHeader title="Loading Slips" description={data ? `${data.count.toLocaleString("en-IN")} slip${data.count === 1 ? "" : "s"}${q || brand || wh || from || to ? " match these filters" : " in total"}` : "Every slip sent to the warehouses"} />
      <Card>
        <div className="grid gap-2 border-b border-black/[0.05] p-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_repeat(4,minmax(0,1fr))]">
          <SearchInput value={q} onChange={reset(setQ)} placeholder="Slip no., order or customer" />
          <Select value={brand} onChange={(e) => reset(setBrand)(e.target.value)} placeholder="All brands" options={[...new Set((products.data ?? []).map((p) => p.brand).filter(Boolean))].sort().map((b) => ({ value: b, label: b }))} />
          <Select value={wh} onChange={(e) => reset(setWh)(e.target.value)} placeholder="All warehouses" options={(warehouses.data ?? []).map((w) => ({ value: w.warehouse_id, label: w.name }))} />
          <DateInput aria-label="From date" placeholder="From" value={from} onChange={(e) => reset(setFrom)(e.target.value)} />
          <DateInput aria-label="To date" placeholder="To" value={to} onChange={(e) => reset(setTo)(e.target.value)} />
        </div>
        {error && <div className="p-3"><ErrorBox error={error} /></div>}
        {isLoading ? <div className="p-4"><Loading variant="inline" /></div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-black/[0.06] bg-gray-50/70 text-left text-2xs uppercase tracking-wide text-gray-500">
                  {["Slip", "Customer", "Brand", "Warehouse", "Status", "Order", "Amount"].map((h) => (
                    <th key={h} className={`whitespace-nowrap px-4 py-2.5 font-medium ${h === "Amount" ? "text-right" : ""}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className={isFetching ? "opacity-60 transition-opacity" : "transition-opacity"}>
                {data?.rows.map((r) => (
                  <tr key={r.loading_slip_item_id} className="border-b border-black/[0.04] last:border-0 hover:bg-gray-50/80">
                    <td className="whitespace-nowrap px-4 py-2.5">
                      <a className="group inline-flex items-center gap-2 font-medium text-secondary hover:text-primary" href={r.url} target="_blank" rel="noreferrer">
                        <FileText className="h-3.5 w-3.5 text-gray-400 group-hover:text-primary" />{r.loading_slip_file_name}<ExternalLink className="h-3 w-3 opacity-0 transition group-hover:opacity-100" />
                      </a>
                      <div className="tabular pl-[22px] text-2xs text-gray-500">{fmtDate(r.order_date_ist)}</div>
                    </td>
                    <td className="max-w-[220px] px-4 py-2.5"><div className="truncate font-medium text-secondary">{r.customer_name}</div></td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-secondary">{r.brand}</td>
                    <td className="max-w-[220px] px-4 py-2.5">
                      <div className="truncate text-secondary">{r.warehouse_name}</div>
                      {r.warehouse_keeper_name && <div className="truncate text-2xs text-gray-500">{r.warehouse_keeper_name}</div>}
                    </td>
                    <td className="px-4 py-2.5"><Badge dot tone={r.status === "Sent" ? "green" : r.status === "Cancelled" ? "red" : "gray"}>{r.status === "Created" || r.status === "Active" || !r.status ? "Not sent" : r.status}</Badge></td>
                    <td className="whitespace-nowrap px-4 py-2.5">
                      <Link to={`/orders?id=${r.order_id}`} className="font-medium text-secondary hover:text-primary">#{r.order_id}</Link>
                      <div className="text-2xs text-gray-500">{[ORDER_STATUS[r.order_status] ?? r.order_status, r.payment_type === "cash" ? "Cash" : r.payment_type ? "Invoice" : null].filter(Boolean).join(" · ")}</div>
                    </td>
                    <td className="tabular whitespace-nowrap px-4 py-2.5 text-right font-medium text-secondary">{r.total_amount != null ? inr(r.total_amount) : "—"}</td>
                  </tr>
                ))}
                {data && !data.rows.length && <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400">No loading slips match these filters</td></tr>}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex items-center justify-end gap-2 border-t border-black/[0.05] px-4 py-2 text-xs text-gray-500">
          <span>Page {page + 1} of {pages}</span>
          <button aria-label="Previous page" disabled={page === 0} onClick={() => setPage(page - 1)} className="rounded p-1 hover:bg-black/5 disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
          <button aria-label="Next page" disabled={page >= pages - 1} onClick={() => setPage(page + 1)} className="rounded p-1 hover:bg-black/5 disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </Card>
    </div>
  );
}
