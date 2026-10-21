import { useState } from "react";
import { ChevronLeft, ChevronRight, Eye, Package } from "lucide-react";
import { useGet } from "../api";
import { fmtDate, inr, ORDER_STATUS } from "../format";
import { Badge, Button, Card, ErrorBox, Input, Loading, PageHeader, SearchInput, Select, Stat, DateInput } from "../components/ui";

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
      <PageHeader title="Loading Slips" />
      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <Stat label="Total Loading Slips" value={data?.count ?? "…"} icon={<Package className="h-5 w-5" />} />
      </div>
      <Card>
        <div className="grid gap-2 border-b p-3 sm:grid-cols-2 lg:grid-cols-5">
          <SearchInput value={q} onChange={reset(setQ)} placeholder="Search by Loading Slip Number" />
          <Select value={brand} onChange={(e) => reset(setBrand)(e.target.value)} placeholder="Select a Brand" options={[...new Set((products.data ?? []).map((p) => p.brand).filter(Boolean))].sort().map((b) => ({ value: b, label: b }))} />
          <Select value={wh} onChange={(e) => reset(setWh)(e.target.value)} placeholder="Select a warehouse" options={(warehouses.data ?? []).map((w) => ({ value: w.warehouse_id, label: w.name }))} />
          <DateInput aria-label="From date" value={from} onChange={(e) => reset(setFrom)(e.target.value)} />
          <DateInput aria-label="To date" value={to} onChange={(e) => reset(setTo)(e.target.value)} />
        </div>
        {error && <div className="p-3"><ErrorBox error={error} /></div>}
        {isLoading ? <Loading /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-gray-50 text-left text-gray-500">
                  {["Loading slip Number", "Order Date", "Order ID", "Customer", "Brand", "Warehouse", "Warehouse Keeper", "Status", "Payment type", "Order status", "Total amount", ""].map((h) => (
                    <th key={h} className={`whitespace-nowrap px-3 py-2 font-medium ${h === "Total amount" ? "text-right" : ""}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className={isFetching ? "opacity-60" : ""}>
                {data?.rows.map((r) => (
                  <tr key={r.loading_slip_item_id} className="border-b last:border-0">
                    <td className="whitespace-nowrap px-3 py-2"><a className="font-bold text-info underline" href={r.url} target="_blank" rel="noreferrer">{r.loading_slip_file_name}</a></td>
                    <td className="whitespace-nowrap px-3 py-2">{fmtDate(r.order_date_ist)}</td>
                    <td className="px-3 py-2">{r.order_id}</td>
                    <td className="whitespace-nowrap px-3 py-2">{r.customer_name}</td>
                    <td className="whitespace-nowrap px-3 py-2">{r.brand}</td>
                    <td className="whitespace-nowrap px-3 py-2">{r.warehouse_name}</td>
                    <td className="whitespace-nowrap px-3 py-2">{r.warehouse_keeper_name}{r.warehouse_keeper_phone && <span className="text-gray-400"> {r.warehouse_keeper_phone}</span>}</td>
                    <td className="px-3 py-2"><Badge tone={r.status === "Sent" ? "green" : r.status === "Cancelled" ? "red" : "gray"}>{r.status ?? "—"}</Badge></td>
                    <td className="px-3 py-2">{r.payment_type && <Badge tone={r.payment_type === "cash" ? "yellow" : "blue"}>{r.payment_type}</Badge>}</td>
                    <td className="whitespace-nowrap px-3 py-2">{ORDER_STATUS[r.order_status] ?? r.order_status}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{r.total_amount != null ? inr(r.total_amount) : "—"}</td>
                    <td className="px-3 py-2"><Button variant="ghost" icon={<Eye className="h-3.5 w-3.5" />} onClick={() => window.open(r.url, "_blank", "noopener")}>View</Button></td>
                  </tr>
                ))}
                {data && !data.rows.length && <tr><td colSpan={12} className="px-3 py-8 text-center text-gray-400">No loading slips match these filters</td></tr>}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex items-center justify-end gap-2 border-t px-3 py-2 text-xs text-gray-500">
          <span>Page {page + 1} of {pages}</span>
          <button aria-label="Previous page" disabled={page === 0} onClick={() => setPage(page - 1)} className="rounded p-1 hover:bg-black/5 disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
          <button aria-label="Next page" disabled={page >= pages - 1} onClick={() => setPage(page + 1)} className="rounded p-1 hover:bg-black/5 disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </Card>
    </div>
  );
}
