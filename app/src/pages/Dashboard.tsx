import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { useGet, type Health } from "../api";
import { fmtDate, num, plural } from "../format";
import { useUrlState } from "../lib/urlState";
import { Bars, ChartCard, HBars, Split } from "../components/Charts";
import { DataTable } from "../components/DataTable";
import { Badge, DateRange, ErrorBox, FilterBar, Loading, PageHeader, Select, StatStrip, Tabs, Toolbar } from "../components/ui";

// The dashboard answers, for the billing type, warehouse and period picked at
// the top: what was sold, what came in, what is waiting on the team, and what
// cash is still to collect. "Today" is India time.

type Data = {
  period: { from: string; to: string; prevFrom: string; prevTo: string };
  kpis: { sales: number; billed: number; prev_sales: number; orders_created: number; enquiries: number; converted: number; open_enquiries: number; to_dispatch: number; in_transit: number; cash_due: number; cash_bills: number };
  monthly: { label: string; title: string; sales: number; orders: number }[];
  byCustomer: { label: string; value: number; orders: number }[];
  byBrand: { label: string; value: number }[];
  byWarehouse: { label: string; value: number; orders: number }[];
  split: { kind: string; value: number }[];
  billedRows: Record<string, any>[];
  cashRows: Record<string, any>[];
  alerts: { no_slip: number; transit: number; enquiry: number; no_keeper: number };
};

const PERIODS = [["month", "This month"], ["last", "Last month"], ["3m", "Last 3 months"], ["year", "This year"]] as const;
const BILLING = [["", "All billing"], ["invoice", "Invoice"], ["cash", "Cash"]] as const;

/** The period as India dates. A custom from/to wins over the preset. */
function period(key: string, from: string, to: string) {
  const now = new Date(Date.now() + 5.5 * 3600e3);
  const y = now.getUTCFullYear(), m = now.getUTCMonth();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const first = (yy: number, mm: number) => new Date(Date.UTC(yy, mm, 1));
  const today = iso(now);
  if (from || to) return { key: "custom", from: from || "2020-01-01", to: to || today };
  switch (key) {
    case "last": return { key, from: iso(first(y, m - 1)), to: iso(new Date(first(y, m).getTime() - 864e5)) };
    case "3m": return { key, from: iso(first(y, m - 2)), to: today };
    case "year": return { key, from: `${y}-01-01`, to: today };
    default: return { key: "month", from: iso(first(y, m)), to: today };
  }
}

export default function Dashboard() {
  const [f, set, clear] = useUrlState({ period: "month", payment: "", warehouse: "", from: "", to: "" });
  const p = period(f.period, f.from, f.to);
  const qs = new URLSearchParams({ from: p.from, to: p.to, ...(f.payment ? { payment: f.payment } : {}), ...(f.warehouse ? { warehouse: f.warehouse } : {}) });
  const { data, error, isLoading } = useGet<Data>(`dashboard?${qs}`, { refetchInterval: 120_000 });
  const warehouses = useGet<any[]>("warehouses");
  const whName = warehouses.data?.find((w) => String(w.warehouse_id) === f.warehouse)?.name;
  const health = useGet<Health>("health");
  const billingName = f.payment === "cash" ? "Cash bills" : f.payment === "invoice" ? "Invoiced orders" : "All billing";

  return (
    <div className="page">
      {/* Connection status, top right. */}
      <PageHeader title="Dashboard" aside={<>
          {health.data && <>
            <Badge size="lg" dot tone={health.data.zoho ? "success" : "danger"}>Zoho Books {health.data.zoho ? "connected" : "not connected"}</Badge>
            <Badge size="lg" dot tone={health.data.whatsapp ? "success" : "danger"}>WhatsApp {health.data.whatsapp ? "connected" : "not connected"}</Badge>
          </>}
      </>} subtitle={`${billingName}, ${whName ?? "all warehouses"}, ${fmtDate(p.from)} to ${fmtDate(p.to)}`}>
          <Link to="/enquiries?new=1" className="btn-primary"><Plus className="h-4 w-4" />New enquiry</Link>
      </PageHeader>

      <Toolbar>
        <Tabs value={f.payment as "" | "invoice" | "cash"} onChange={(v) => set({ payment: v })} tabs={BILLING.map(([value, label]) => ({ value, label }))} />
        <Tabs value={p.key} onChange={(v) => set({ period: v, from: "", to: "" })}
          tabs={[...PERIODS.map(([value, label]) => ({ value, label })), ...(p.key === "custom" ? [{ value: "custom", label: "Custom dates" }] : [])]} />
      </Toolbar>
      <FilterBar active={!!(f.warehouse || f.from || f.to)} onClear={() => clear(["warehouse", "from", "to"])}>
        <Select className="w-full sm:w-56" value={f.warehouse} onChange={(e) => set({ warehouse: e.target.value })} placeholder="All warehouses"
          options={(warehouses.data ?? []).map((w) => ({ value: String(w.warehouse_id), label: w.name }))} />
        <DateRange label="Dates" from={f.from} to={f.to} onFrom={(v) => set({ from: v })} onTo={(v) => set({ to: v })} className="w-full sm:w-auto" />
      </FilterBar>

      {error && <ErrorBox error={error} />}
      {isLoading || !data ? (!error && <Loading />) : <Body d={data} />}
    </div>
  );
}

function Body({ d }: { d: Data }) {
  const k = d.kpis;
  const change = k.prev_sales > 0 ? ((k.sales - k.prev_sales) / k.prev_sales) * 100 : null;
  const conv = k.enquiries ? Math.round((k.converted / k.enquiries) * 100) : null;
  const splitParts = useMemo(() => [
    { label: "Invoice", value: d.split.find((s) => s.kind === "invoice")?.value ?? 0, color: "#3a4260" },
    { label: "Cash bill", value: d.split.find((s) => s.kind === "cash")?.value ?? 0, color: "#b9bfcf" },
  ], [d]);

  return (
    <>
      <StatStrip items={[
        { label: `Sales, ${plural(k.billed, "order")} billed`, value: `₹${num(k.sales)}`,
          hint: change === null ? "No sales in the previous period" : <><span className={change >= 0 ? "text-success" : "text-danger"}>{change >= 0 ? "+" : "-"}{Math.abs(change).toFixed(1)}%</span> vs. {fmtDate(d.period.prevFrom)} to {fmtDate(d.period.prevTo)}</> },
        { label: "Enquiries received", value: num(k.enquiries), hint: conv === null ? "None in this period" : `${num(k.converted)} became orders (${conv}%)`, to: "/enquiries" },
        { label: "Open enquiries", value: num(k.open_enquiries), hint: "Waiting to become orders, now", to: "/enquiries" },
        { label: "Orders to dispatch", value: num(k.to_dispatch), hint: "Confirmed, not yet billed, now", to: "/orders" },
        { label: "In transit", value: num(k.in_transit), hint: "Billed, awaiting delivery, now", to: "/orders?status=2" },
        { label: "Cash outstanding", value: `₹${num(k.cash_due)}`, hint: `${plural(k.cash_bills, "cash bill")} with a balance`, to: "/cash-bills", tone: k.cash_due > 0 ? "danger" : undefined },
      ]} />


      {/* Cards side by side are always the same height: each grid cell stretches and its card fills it. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 [&>*]:flex [&>*]:min-w-0 [&>*>*]:flex-1">
        <div><ChartCard title="Sales per month" subtitle="Billed value, last 12 months"><Bars money highlightLast data={d.monthly.map((m) => ({ label: m.label, title: m.title, value: m.sales }))} /></ChartCard></div>
        <div><ChartCard title="Orders per month" subtitle="Orders created, last 12 months"><Bars highlightLast data={d.monthly.map((m) => ({ label: m.label, title: m.title, value: m.orders }))} /></ChartCard></div>
        <div><ChartCard title="Top customers" subtitle="By billed value in the period"><HBars money data={d.byCustomer.map((c) => ({ label: c.label, value: c.value, hint: plural(c.orders, "order") }))} /></ChartCard></div>
        <div><ChartCard title="Sales by brand" subtitle="Item value of billed orders in the period"><HBars money data={d.byBrand} /></ChartCard></div>
        <div><ChartCard title="Sales by warehouse" subtitle="Billed value in the period"><HBars money data={d.byWarehouse.map((w) => ({ label: w.label, value: w.value, hint: plural(w.orders, "order") }))} /></ChartCard></div>
        <div><ChartCard title="Invoice and cash" subtitle="How the period's sales were billed"><Split money parts={splitParts} /></ChartCard></div>
      </div>

      <DataTable title="Billed in the period" filename={`Billed orders ${d.period.from} to ${d.period.to}`} rowKey="order_id" pageSize={10}
        note={`${fmtDate(d.period.from)} to ${fmtDate(d.period.to)}`} rows={d.billedRows} rowLink={(r) => `/orders/${r.order_id}`}
        empty={{ title: "Nothing billed in this period", hint: "Pick a longer period, or clear the filters." }}
        cols={[
          { key: "order_id", label: "Order #", kind: "int", align: "left" },
          { key: "customer_name", label: "Customer" },
          { key: "order_date", label: "Order date", kind: "date" },
          { key: "warehouse_name", label: "Warehouse" },
          { key: "payment_type", label: "Billing", value: (r) => (r.payment_type === "cash" ? "Cash bill" : "Invoice"), sub: (r) => r.zb_invoice_number },
          { key: "order_status", label: "Status", value: (r) => (r.order_status === "3" ? "Delivered" : "In transit"), render: (r) => <Badge dot tone={r.order_status === "3" ? "success" : "info"}>{r.order_status === "3" ? "Delivered" : "In transit"}</Badge> },
          { key: "total_amount", label: "Amount (₹)", kind: "money", total: true },
        ]} />

      <DataTable title="Cash still to collect" filename="Cash outstanding by customer" rowKey="customer_name" pageSize={10} rows={d.cashRows}
        empty={{ title: "No cash outstanding", hint: "Every cash bill is fully collected." }}
        cols={[
          { key: "customer_name", label: "Customer" },
          { key: "bills", label: "Bills", kind: "int", total: true },
          { key: "oldest", label: "Oldest bill", kind: "date" },
          { key: "billed", label: "Billed (₹)", kind: "money", total: true },
          { key: "collected", label: "Collected (₹)", kind: "money", total: true },
          { key: "due", label: "Due (₹)", kind: "money", total: true, className: "font-medium" },
        ]}
        actions={<Link to="/cash-bills" className="btn btn-sm">Open cash bills</Link>} />
    </>
  );
}
