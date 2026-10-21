import { useMemo, useState } from "react";
import { Download, ExternalLink } from "lucide-react";
import { api, useGet } from "../api";
import { exportRows, includes, inRange, num, stamp } from "../format";
import { useUrlState } from "../lib/urlState";
import { DataTable } from "../components/DataTable";
import { Badge, Button, DateRange, ErrorBox, FilterBar, PageHeader, Select, StatStrip, Tabs, Toolbar, toast } from "../components/ui";
import { ORDER_STATUS_BADGE } from "./OrderDetail";

// Orders move Ongoing → In transit (billed) → Delivered (OTP verified).
// Deleted orders stay restorable from their own tab.
const STATUS = [["1", "Ongoing"], ["2", "In transit"], ["3", "Delivered"], ["5", "Deleted"]] as const;
const RETOOL_EXPORT: Record<string, string> = { "1": "Ongoing Orders", "2": "In Transit Orders", "3": "Delivered Orders" };

export default function Orders() {
  const orders = useGet<any[]>("orders", { refetchInterval: 60_000 });
  const customers = useGet<any[]>("customers");
  const warehouses = useGet<any[]>("warehouses");
  const [f, set, clear] = useUrlState({ status: "1", billing: "", customer: "", warehouse: "", slips: "", from: "", to: "" });
  const all = orders.data ?? [];

  const rows = useMemo(() => all.filter((o) =>
    o.order_status === f.status &&
    (!f.billing || o.payment_type === f.billing) &&
    (!f.customer || String(o.customer_id) === f.customer) &&
    (!f.warehouse || String(o.warehouse_id) === f.warehouse) &&
    (!f.slips || (f.slips === "none" ? !o.loading_slip_id : !!o.loading_slip_id)) &&
    inRange(o.order_date, f.from, f.to)), [all, f]);
  const filtered = !!(f.billing || f.customer || f.warehouse || f.slips || f.from || f.to);
  const value = rows.reduce((s, o) => s + Number(o.total_amount ?? o.items_value ?? 0), 0);
  const noSlip = rows.filter((o) => !o.loading_slip_id).length;
  const statusLabel = STATUS.find(([v]) => v === f.status)?.[1] ?? "";

  // The item-wise sheet the team used in Retool (one row per product, merged order columns).
  const [exporting, setExporting] = useState(false);
  const itemExport = async () => {
    setExporting(true);
    try {
      const data = await api(`orders-export?status=${f.status}&start=${f.from}&end=${f.to}`);
      await exportRows(data, `${RETOOL_EXPORT[f.status]} ${stamp()}`, "csv");
    } catch (e) { toast("Export failed", "error", (e as Error).message); }
    setExporting(false);
  };

  return (
    <div className="page">
      <PageHeader title="Orders" subtitle="Ongoing orders are dispatched and billed; in-transit orders close when the customer's delivery OTP is verified." />
      <Toolbar>
        <Tabs value={f.status} onChange={(v) => set({ status: v, slips: "" })} tabs={STATUS.map(([value, label]) => ({ value, label, count: all.filter((o) => o.order_status === value).length }))} />
        {f.status !== "1" && f.status !== "5" && <Tabs value={f.billing} onChange={(v) => set({ billing: v })} tabs={[{ value: "", label: "All billing" }, { value: "invoice", label: "Invoice" }, { value: "cash", label: "Cash bill" }]} />}
      </Toolbar>
      <FilterBar active={filtered} onClear={() => clear(["billing", "customer", "warehouse", "slips", "from", "to"])}>
        <Select className="w-full sm:w-60" value={f.customer} onChange={(e) => set({ customer: e.target.value })} placeholder="All customers"
          options={(customers.data ?? []).map((c) => ({ value: String(c.customer_id), label: c.name }))} />
        <Select className="w-full sm:w-52" value={f.warehouse} onChange={(e) => set({ warehouse: e.target.value })} placeholder="All warehouses"
          options={(warehouses.data ?? []).map((w) => ({ value: String(w.warehouse_id), label: w.name }))} />
        {f.status === "1" && <Select className="w-full sm:w-52" value={f.slips} onChange={(e) => set({ slips: e.target.value })} placeholder="Any loading slips"
          options={[{ value: "none", label: "No loading slips yet" }, { value: "made", label: "Loading slips created" }]} />}
        <DateRange label="Ordered" from={f.from} to={f.to} onFrom={(v) => set({ from: v })} onTo={(v) => set({ to: v })} className="w-full sm:w-auto" />
      </FilterBar>

      {orders.error && <ErrorBox error={orders.error} />}
      <StatStrip items={[
        { label: `${statusLabel} orders`, value: num(rows.length) },
        { label: f.status === "1" ? "Order value" : "Billed value", value: `₹${num(value)}` },
        f.status === "1"
          ? { label: "Without loading slips", value: num(noSlip), tone: noSlip ? "warning" : undefined, hint: noSlip ? "Can't be loaded or billed yet" : "All have slips" }
          : { label: "Invoice / cash bill", value: `${num(rows.filter((o) => o.payment_type !== "cash").length)} / ${num(rows.filter((o) => o.payment_type === "cash").length)}` },
      ]} />

      <DataTable title={`${statusLabel} orders`} filename={`${statusLabel} orders ${stamp()}`} rowKey="order_id" rows={rows} loading={orders.isLoading}
        filtersActive={filtered} onClearFilters={() => clear(["billing", "customer", "warehouse", "slips", "from", "to"])}
        rowLink={(r) => `/orders/${r.order_id}`}
        empty={{ title: f.status === "5" ? "No deleted orders" : `No ${statusLabel.toLowerCase()} orders`, hint: f.status === "1" ? "Orders are created from an enquiry." : undefined }}
        toolbar={f.status !== "5" && <Button size="sm" busy={exporting} icon={<Download />} onClick={itemExport} title="One row per product, in the Retool layout">Item-wise CSV</Button>}
        rowActions={(r) => [{ kind: "open", label: `Open order #${r.order_id}`, icon: <ExternalLink />, href: `/orders/${r.order_id}` }]}
        cols={[
          { key: "order_id", label: "Order #", kind: "int", align: "left", sub: (r) => r.order_number },
          { key: "customer_name", label: "Customer", sub: (r) => r.site_name },
          { key: "order_date", label: "Order date", kind: "date" },
          { key: "warehouse_name", label: "Warehouse", sub: (r) => [r.transporter_name, r.vehicle_number].filter(Boolean).join(" · ") },
          { key: "loading_slip_file_name", label: "Loading slips", value: (r) => (r.loading_slip_numbers ?? []).map((n: string) => `LS-${n}`).join(", ") || null,
            render: (r) => r.loading_slip_id ? <span>{(r.loading_slip_numbers ?? []).map((n: string) => `LS-${n}`).join(", ")}</span> : <Badge tone="warning">Not created</Badge> },
          ...(f.status !== "1" ? [{ key: "payment_type", label: "Billing", value: (r: any) => (r.payment_type === "cash" ? "Cash bill" : "Invoice"), sub: (r: any) => r.zb_invoice_number }] : []),
          { key: "order_status", label: "Status", value: (r) => ORDER_STATUS_BADGE[r.order_status]?.label, render: (r) => { const s = ORDER_STATUS_BADGE[r.order_status]; return s ? <Badge dot tone={s.tone}>{s.label}</Badge> : r.order_status; } },
          { key: "total_amount", label: "Amount (₹)", kind: "money", total: true, value: (r) => r.total_amount ?? r.items_value },
        ]} />
    </div>
  );
}
