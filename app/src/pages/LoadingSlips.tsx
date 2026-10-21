import { useMemo } from "react";
import { ExternalLink, FileText } from "lucide-react";
import { useGet } from "../api";
import { num, stamp } from "../format";
import { useUrlState } from "../lib/urlState";
import { DataTable } from "../components/DataTable";
import { Badge, DateRange, ErrorBox, FilterBar, PageHeader, Select, StatStrip, Tabs, Toolbar } from "../components/ui";
import { ORDER_STATUS_BADGE } from "./OrderDetail";

// Every loading slip sent to the warehouses, one row per brand slip.
// Brand, warehouse and dates filter on the server; status and search here.
const FILTERS = ["brand", "warehouse", "keeper", "from", "to"] as const;
const statusOf = (s?: string) => (s === "Sent" || s === "Cancelled" ? s : "Not sent");

export default function LoadingSlips() {
  const [f, set, clear] = useUrlState({ status: "", brand: "", warehouse: "", keeper: "", from: "", to: "" });
  const products = useGet<any[]>("products?all=1");
  const warehouses = useGet<any[]>("warehouses");
  const keepers = useGet<any[]>("warehouse-keepers");
  const params = new URLSearchParams({ search: "", brand: f.brand, warehouse: f.warehouse, start: f.from, end: f.to, limit: "5000", offset: "0" });
  const { data, error, isLoading } = useGet<{ rows: any[]; count: number }>(`loading-slips?${params}`);
  const all = data?.rows ?? [];
  const scoped = useMemo(() => all.filter((r) => !f.keeper || r.warehouse_keeper_name === f.keeper), [all, f.keeper]);
  const rows = useMemo(() => scoped.filter((r) => !f.status || statusOf(r.status) === f.status), [scoped, f.status]);
  const filtered = FILTERS.some((k) => f[k]);
  const count = (s: string) => scoped.filter((r) => statusOf(r.status) === s).length;
  const brands = [...new Set((products.data ?? []).map((p) => p.brand).filter(Boolean))].sort();

  return (
    <div className="page">
      <PageHeader title="Loading slips" subtitle="One slip per brand of an order, sent to that brand's warehouse keeper on WhatsApp." />
      <Toolbar>
        <Tabs value={f.status} onChange={(v) => set({ status: v })} tabs={[
          { value: "", label: "All", count: scoped.length },
          { value: "Not sent", label: "Not sent", count: count("Not sent") },
          { value: "Sent", label: "Sent", count: count("Sent") },
          { value: "Cancelled", label: "Cancelled", count: count("Cancelled") },
        ]} />
      </Toolbar>
      <FilterBar active={filtered} onClear={() => clear(FILTERS)}>
        <Select className="w-full sm:w-44" value={f.brand} onChange={(e) => set({ brand: e.target.value })} placeholder="All brands" options={brands.map((b) => ({ value: b, label: b }))} />
        <Select className="w-full sm:w-52" value={f.warehouse} onChange={(e) => set({ warehouse: e.target.value, keeper: "" })} placeholder="All warehouses"
          options={(warehouses.data ?? []).map((w) => ({ value: String(w.warehouse_id), label: w.name }))} />
        <Select className="w-full sm:w-52" value={f.keeper} onChange={(e) => set({ keeper: e.target.value })} placeholder="All warehouse keepers"
          options={(keepers.data ?? []).filter((k) => !f.warehouse || String(k.warehouse_id) === f.warehouse).map((k) => ({ value: k.name, label: k.name }))} />
        <DateRange label="Ordered" from={f.from} to={f.to} onFrom={(v) => set({ from: v })} onTo={(v) => set({ to: v })} className="w-full sm:w-auto" />
      </FilterBar>

      {error && <ErrorBox error={error} />}
      <StatStrip items={[
        { label: "Slips", value: num(scoped.length) },
        { label: "Sent to keepers", value: num(count("Sent")) },
        { label: "Not sent yet", value: num(count("Not sent")), tone: count("Not sent") ? "warning" : undefined, hint: count("Not sent") ? "The warehouse hasn't been told" : "All sent" },
        { label: "Orders", value: num(new Set(scoped.map((r) => r.order_id)).size) },
      ]} />

      <DataTable title={f.status ? `${f.status} slips` : "Loading slips"} filename={`Loading slips ${stamp()}`} rowKey="loading_slip_item_id" rows={rows} loading={isLoading}
        filtersActive={filtered || !!f.status} onClearFilters={() => clear([...FILTERS, "status"])}
        rowLink={(r) => `/orders/${r.order_id}`}
        empty={{ title: "No loading slips", hint: "Slips are created from an ongoing order." }}
        rowActions={(r) => [
          { kind: "open", label: `Open order #${r.order_id}`, icon: <ExternalLink />, href: `/orders/${r.order_id}` },
          ...(r.url ? [{ kind: "print" as const, label: `Open slip ${r.loading_slip_file_name}`, icon: <FileText />, href: r.url }] : []),
        ]}
        cols={[
          { key: "order_id", label: "Order #", kind: "int", align: "left", sub: (r) => ORDER_STATUS_BADGE[r.order_status]?.label },
          { key: "loading_slip_file_name", label: "Slip", kind: "mono",
            render: (r) => r.url ? <a href={r.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="underline decoration-line-strong underline-offset-2 hover:decoration-ink">{r.loading_slip_file_name}</a> : r.loading_slip_file_name },
          { key: "order_date_ist", label: "Ordered", kind: "date", value: (r) => String(r.order_date_ist ?? "").slice(0, 10) || null },
          { key: "customer_name", label: "Customer" },
          { key: "brand", label: "Brand" },
          { key: "warehouse_name", label: "Warehouse", sub: (r) => r.warehouse_keeper_name },
          { key: "status", label: "Status", value: (r) => statusOf(r.status),
            render: (r) => <Badge dot tone={r.status === "Sent" ? "success" : r.status === "Cancelled" ? "danger" : "warning"}>{statusOf(r.status)}</Badge> },
          { key: "payment_type", label: "Billing", value: (r) => (r.payment_type === "cash" ? "Cash bill" : r.order_status === "1" ? "Not billed" : "Invoice") },
          { key: "total_amount", label: "Order (₹)", kind: "money" },
        ]} />
    </div>
  );
}

