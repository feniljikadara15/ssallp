import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import clsx from "clsx";
import { Download } from "lucide-react";
import { api, useGet } from "../api";
import { exportRows, fmtDate, includes, inRange, num, stamp } from "../format";
import { useUrlState } from "../lib/urlState";
import { SplitList, SplitView } from "../components/SplitView";
import { Badge, DateRange, ErrorBox, FilterBar, PageHeader, Select, Tabs, Toolbar, toast } from "../components/ui";
import OrderDetail from "./OrderDetail";

// Orders move Ongoing → In transit (billed) → Delivered (OTP verified).
// Deleted orders stay restorable from their own tab.
const STATUS = [["1", "Ongoing"], ["2", "In transit"], ["3", "Delivered"], ["5", "Deleted"]] as const;
const RETOOL_EXPORT: Record<string, string> = { "1": "Ongoing Orders", "2": "In Transit Orders", "3": "Delivered Orders" };
const FILTERS = ["billing", "customer", "warehouse", "slips", "from", "to", "q"] as const;
const slipNames = (o: any) => (o.loading_slip_numbers ?? []).map((n: string) => `LS-${n}`).join(", ");

export default function Orders() {
  const id = Number(useParams().id) || null;
  const orders = useGet<any[]>("orders", { refetchInterval: 60_000 });
  const customers = useGet<any[]>("customers");
  const warehouses = useGet<any[]>("warehouses");
  const [f, set, clear] = useUrlState({ status: "1", billing: "", customer: "", warehouse: "", slips: "", from: "", to: "", q: "" });
  const all = orders.data ?? [];

  const rows = useMemo(() => all.filter((o) =>
    o.order_status === f.status &&
    (!f.billing || o.payment_type === f.billing) &&
    (!f.customer || String(o.customer_id) === f.customer) &&
    (!f.warehouse || String(o.warehouse_id) === f.warehouse) &&
    (!f.slips || (f.slips === "none" ? !o.loading_slip_id : !!o.loading_slip_id)) &&
    inRange(o.order_date, f.from, f.to) &&
    includes(`${o.customer_name} ${o.site_name} #${o.order_id} ${o.order_number} ${o.zb_invoice_number ?? ""} ${slipNames(o)}`, f.q)), [all, f]);
  const filtered = FILTERS.some((k) => f[k]);
  const value = rows.reduce((s, o) => s + Number(o.total_amount ?? o.items_value ?? 0), 0);
  const noSlip = f.status === "1" ? rows.filter((o) => !o.loading_slip_id).length : 0;
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
      <div className={clsx("flex flex-col gap-5", id && "hidden lg:flex")}>
        <PageHeader title="Orders" subtitle="Ongoing orders are dispatched and billed; in-transit orders close when the customer's delivery OTP is verified." />
        <Toolbar>
          <Tabs value={f.status} onChange={(v) => set({ status: v, slips: "", billing: "" })} tabs={STATUS.map(([value, label]) => ({ value, label, count: all.filter((o) => o.order_status === value).length }))} />
          {(f.status === "2" || f.status === "3") && <Tabs value={f.billing} onChange={(v) => set({ billing: v })} tabs={[{ value: "", label: "All billing" }, { value: "invoice", label: "Invoice" }, { value: "cash", label: "Cash bill" }]} />}
        </Toolbar>
        <FilterBar active={filtered} onClear={() => clear(FILTERS)}>
          <Select className="w-full sm:w-56" value={f.customer} onChange={(e) => set({ customer: e.target.value })} placeholder="All customers"
            options={(customers.data ?? []).map((c) => ({ value: String(c.customer_id), label: c.name }))} />
          <Select className="w-full sm:w-52" value={f.warehouse} onChange={(e) => set({ warehouse: e.target.value })} placeholder="All warehouses"
            options={(warehouses.data ?? []).map((w) => ({ value: String(w.warehouse_id), label: w.name }))} />
          {f.status === "1" && <Select className="w-full sm:w-52" value={f.slips} onChange={(e) => set({ slips: e.target.value })} placeholder="Any loading slips"
            options={[{ value: "none", label: "No loading slips yet" }, { value: "made", label: "Loading slips created" }]} />}
          <DateRange label="Ordered" from={f.from} to={f.to} onFrom={(v) => set({ from: v })} onTo={(v) => set({ to: v })} className="w-full sm:w-auto" />
        </FilterBar>
        {orders.error && <ErrorBox error={orders.error} />}
      </div>

      <SplitView selected={!!id} backTo="/orders" backLabel="Orders" emptyText="Pick an order to see its transport, loading slips, billing and items"
        detail={id && <OrderDetail key={id} id={id} />}
        list={
          <SplitList title={`${statusLabel} orders`} items={rows.map((o) => ({
              key: o.order_id, to: `/orders/${o.order_id}`,
              title: o.customer_name ?? "-", right: fmtDate(o.order_date),
              sub: [`#${o.order_id}`, o.site_name].filter(Boolean).join(", "), rightSub: `₹${num(o.total_amount ?? o.items_value)}`,
              tags: <>
                {o.order_status === "1" && !o.loading_slip_id && <Badge tone="warning">No loading slips</Badge>}
                {o.order_status === "1" && o.loading_slip_id && <Badge tone="neutral">{slipNames(o) || "Slips created"}</Badge>}
                {o.order_status !== "1" && o.order_status !== "5" && <Badge tone="neutral">{o.payment_type === "cash" ? "Cash bill" : o.zb_invoice_number ?? "Invoice"}</Badge>}
                {o.warehouse_name && <Badge tone="neutral">{o.warehouse_name}</Badge>}
              </>,
            }))}
            selectedKey={id ?? undefined} loading={orders.isLoading}
            summary={<>₹{num(value)} total{noSlip ? `, ${num(noSlip)} without loading slips` : ""}</>}
            q={f.q} onSearch={(v) => set({ q: v })} placeholder="Customer, order, invoice or slip number"
            actions={f.status !== "5" && <button type="button" className="btn btn-sm px-2" disabled={exporting} onClick={itemExport} title="Item-wise CSV: one row per product, in the Retool layout" aria-label="Item-wise CSV"><Download className="h-4 w-4" /><span className="hidden xl:inline">Items</span></button>}
            empty={<><div className="text-[13.5px] font-medium text-ink">{filtered ? "No orders match these filters" : `No ${statusLabel.toLowerCase()} orders`}</div>
              {filtered && <button className="btn btn-sm mt-3" onClick={() => clear(FILTERS)}>Clear filters</button>}</>}
            exportInput={{
              title: `${statusLabel} orders`, filename: `${statusLabel} orders ${stamp()}`, totals: ["amount"],
              rows: rows.map((o) => ({ ...o, slips: slipNames(o), billing: o.order_status === "1" ? "Not billed" : o.payment_type === "cash" ? "Cash bill" : "Invoice", amount: o.total_amount ?? o.items_value })),
              cols: [
                { key: "order_id", label: "Order #", kind: "int" }, { key: "order_number", label: "Order number" }, { key: "customer_name", label: "Customer" },
                { key: "site_name", label: "Site" }, { key: "order_date", label: "Order date", kind: "date" }, { key: "warehouse_name", label: "Warehouse" },
                { key: "transporter_name", label: "Transporter" }, { key: "vehicle_number", label: "Vehicle" }, { key: "slips", label: "Loading slips" },
                { key: "billing", label: "Billing" }, { key: "zb_invoice_number", label: "Invoice number" }, { key: "amount", label: "Amount (₹)", kind: "money" },
              ],
            }} />
        } />
    </div>
  );
}
