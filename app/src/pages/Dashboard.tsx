import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import clsx from "clsx";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Plus } from "lucide-react";
import { useGet } from "../api";
import { fmtDate, inr, inrShort } from "../format";
import { Badge, Button, Card, ErrorBox, Loading, PageHeader, Section } from "../components/ui";

interface DashboardData {
  kpis: { open_enquiries: number; ongoing_orders: number; in_transit: number; delivered_month: number; sales_month: number; sales_prev_to_date: number; billed_month: number };
  cash: { count: number; due: number };
  attention: { kind: Queue; id: number; customer_name: string | null; since: string; total_amount: number | null }[];
  attentionCounts: Record<Queue, number>;
  chart: { month_start: string; month_label: string; order_count: number; sales: number }[];
  recent: { order_id: number; order_status: string; order_date: string; total_amount: number | null; items_value: number; payment_type: string | null; customer_name: string | null }[];
}
type Queue = "no_slip" | "transit" | "enquiry";

const STATUS: Record<string, { label: string; tone: "orange" | "blue" | "green" | "red" }> = {
  "1": { label: "Ongoing", tone: "orange" }, "2": { label: "In transit", tone: "blue" }, "3": { label: "Delivered", tone: "green" }, "5": { label: "Deleted", tone: "red" },
};

const QUEUES: { kind: Queue; title: string; note: string; all: string; item: (id: number) => string; ref: (id: number) => string }[] = [
  { kind: "no_slip", title: "Orders without loading slips", note: "Warehouse can't load until slips are sent", all: "/orders", item: (id) => `/orders?id=${id}`, ref: (id) => `#${id}` },
  { kind: "transit", title: "In transit over 2 days", note: "Confirm delivery or follow up", all: "/orders?tab=2", item: (id) => `/orders?id=${id}`, ref: (id) => `#${id}` },
  { kind: "enquiry", title: "Enquiries open over 2 days", note: "Convert to an order or close", all: "/enquiries", item: (id) => `/enquiries?id=${id}`, ref: (id) => `EN-${id}` },
];

const age = (v: string) => {
  const d = Math.floor((Date.now() - new Date(v).getTime()) / 86_400_000);
  return d <= 0 ? "Today" : `${d}d`;
};

export default function Dashboard() {
  const { data, error, isLoading, dataUpdatedAt } = useGet<DashboardData>("dashboard", { refetchInterval: 120_000 });
  const asOf = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" })
    : null;

  return (
    <div>
      <PageHeader title="Dashboard" description={asOf ? `Figures as of ${asOf} IST` : "Overview of sales, dispatch and collections"}>
        <Link to="/enquiries?new=1"><Button icon={<Plus />}>New enquiry</Button></Link>
      </PageHeader>
      {error && <ErrorBox error={error} />}
      {isLoading ? <Loading /> : data && <Body data={data} />}
    </div>
  );
}

function Kpi({ label, value, foot, to }: { label: string; value: React.ReactNode; foot: React.ReactNode; to?: string }) {
  const body = (
    <>
      <div className="text-2xs font-medium uppercase tracking-wide text-gray-500">{label}</div>
      <div className="tabular mt-2 text-[22px] font-semibold leading-none tracking-tight text-secondary">{value}</div>
      <div className="mt-2 truncate text-2xs text-gray-500">{foot}</div>
    </>
  );
  const cls = "block min-w-0 px-5 py-4";
  return to ? <Link to={to} className={clsx(cls, "transition-colors hover:bg-gray-50/80")}>{body}</Link> : <div className={cls}>{body}</div>;
}

function Body({ data }: { data: DashboardData }) {
  const k = data.kpis;
  const change = k.sales_prev_to_date > 0 ? ((k.sales_month - k.sales_prev_to_date) / k.sales_prev_to_date) * 100 : null;
  const [metric, setMetric] = useState<"sales" | "orders">("sales");

  // The query only returns months with orders; fill the gaps so the axis covers 12 months.
  const chart = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
      const label = d.toLocaleString("en-US", { month: "short", year: "numeric" });
      const hit = data.chart.find((c) => c.month_label === label);
      return { month: d.toLocaleString("en-US", { month: "short" }), full: d.toLocaleString("en-IN", { month: "long", year: "numeric" }), orders: hit?.order_count ?? 0, sales: Number(hit?.sales ?? 0) };
    });
  }, [data]);
  const yearSales = chart.reduce((a, c) => a + c.sales, 0);
  const yearOrders = chart.reduce((a, c) => a + c.orders, 0);
  const queued = QUEUES.reduce((a, q) => a + data.attentionCounts[q.kind], 0);

  return (
    <div className="space-y-5">
      <Card className="grid grid-cols-2 divide-black/[0.06] overflow-hidden max-xl:[&>*]:border-b max-xl:[&>*]:border-black/[0.06] max-sm:[&>*:last-child]:col-span-2 sm:grid-cols-3 xl:grid-cols-5 xl:divide-x">
        <Kpi label="Sales, month to date" value={inr(k.sales_month)}
          foot={change === null ? `${k.billed_month} orders billed` : (
            <><span className={change >= 0 ? "font-medium text-emerald-700" : "font-medium text-red-700"}>{change >= 0 ? "+" : "−"}{Math.abs(change).toFixed(1)}%</span> vs. same period last month</>
          )} />
        <Kpi to="/enquiries" label="Open enquiries" value={k.open_enquiries} foot="Awaiting conversion" />
        <Kpi to="/orders" label="Orders to dispatch" value={k.ongoing_orders} foot="Confirmed, not yet billed" />
        <Kpi to="/orders?tab=2" label="In transit" value={k.in_transit} foot={`${k.delivered_month} delivered this month`} />
        <Kpi to="/cash-bills" label="Cash outstanding" value={inr(data.cash.due)} foot={`${data.cash.count} cash bill${data.cash.count === 1 ? "" : "s"} with a balance`} />
      </Card>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="min-w-0 space-y-5">
          <Section
            title={metric === "sales" ? "Monthly sales" : "Monthly orders"}
            description={metric === "sales" ? `${inr(yearSales)} billed in the last 12 months` : `${yearOrders} orders created in the last 12 months`}
            actions={
              <div role="tablist" className="flex rounded-md border border-black/[0.08] p-0.5 text-2xs font-medium">
                {(["sales", "orders"] as const).map((m) => (
                  <button key={m} role="tab" aria-selected={metric === m} onClick={() => setMetric(m)}
                    className={clsx("rounded px-2.5 py-1 transition", metric === m ? "bg-secondary text-white" : "text-gray-500 hover:text-secondary")}>
                    {m === "sales" ? "Sales" : "Orders"}
                  </button>
                ))}
              </div>
            }
          >
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chart} margin={{ left: 0, right: 4, top: 4 }}>
                  <CartesianGrid vertical={false} stroke="#eceef2" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#8a90a0" }} tickLine={false} axisLine={{ stroke: "#e2e5ea" }} />
                  <YAxis allowDecimals={false} tickFormatter={(v) => (metric === "sales" ? inrShort(v) : String(v))} tick={{ fontSize: 11, fill: "#8a90a0" }} tickLine={false} axisLine={false} width={52} />
                  <Tooltip cursor={{ fill: "rgba(41,47,69,0.04)" }} content={<ChartTip metric={metric} />} />
                  <Bar dataKey={metric} radius={[2, 2, 0, 0]} maxBarSize={28}>
                    {chart.map((_, i) => <Cell key={i} fill={i === chart.length - 1 ? "#f26222" : "#3a4260"} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Section>

          <Section title="Recent orders" actions={<Link to="/orders" className="text-xs font-medium text-primary hover:underline">View all orders</Link>} bodyClassName="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-black/[0.06] bg-gray-50/70 text-left text-2xs uppercase tracking-wide text-gray-500">
                    <th className="px-4 py-2.5 font-medium">Order</th><th className="px-4 py-2.5 font-medium">Customer</th><th className="px-4 py-2.5 font-medium">Date</th>
                    <th className="px-4 py-2.5 font-medium">Status</th><th className="px-4 py-2.5 font-medium">Billing</th><th className="px-4 py-2.5 text-right font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent.map((o) => (
                    <tr key={o.order_id} className="border-b border-black/[0.04] last:border-0 hover:bg-gray-50/80">
                      <td className="px-4 py-2.5"><Link to={`/orders?id=${o.order_id}`} className="font-medium text-secondary hover:text-primary hover:underline">#{o.order_id}</Link></td>
                      <td className="max-w-[240px] truncate px-4 py-2.5 text-secondary">{o.customer_name}</td>
                      <td className="tabular px-4 py-2.5 text-gray-500">{fmtDate(o.order_date)}</td>
                      <td className="px-4 py-2.5"><Badge tone={STATUS[o.order_status]?.tone}>{STATUS[o.order_status]?.label ?? o.order_status}</Badge></td>
                      <td className="px-4 py-2.5 text-gray-500">{o.payment_type === "cash" ? "Cash" : o.payment_type ? "Invoice" : "—"}</td>
                      <td className="tabular px-4 py-2.5 text-right font-medium text-secondary">{inr(o.total_amount ?? o.items_value)}</td>
                    </tr>
                  ))}
                  {!data.recent.length && <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-400">No orders yet</td></tr>}
                </tbody>
              </table>
            </div>
          </Section>
        </div>

        <Section title="Work queue" description={queued ? `${queued} item${queued === 1 ? "" : "s"} waiting on the team` : "Nothing waiting"} bodyClassName="p-0">
          {QUEUES.map((q) => {
            const n = data.attentionCounts[q.kind];
            const rows = data.attention.filter((r) => r.kind === q.kind).slice(0, 3);
            return (
              <div key={q.kind} className="border-b border-black/[0.05] px-4 py-3.5 last:border-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-secondary">{q.title}</div>
                    <div className="text-2xs text-gray-500">{q.note}</div>
                  </div>
                  <span className={clsx("tabular shrink-0 text-lg font-semibold leading-none", n ? "text-secondary" : "text-gray-300")}>{n}</span>
                </div>
                {rows.length > 0 && (
                  <table className="mt-2.5 w-full text-xs">
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.id} className="border-t border-black/[0.04]">
                          <td className="w-14 py-1.5 pr-2"><Link to={q.item(r.id)} className="tabular font-medium text-secondary hover:text-primary hover:underline">{q.ref(r.id)}</Link></td>
                          <td className="max-w-0 truncate py-1.5 pr-2 text-gray-600">{r.customer_name ?? "—"}</td>
                          <td className="tabular w-12 py-1.5 text-right text-gray-500">{age(r.since)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {n > 0 && <Link to={q.all} className="mt-1.5 inline-block text-2xs font-medium text-primary hover:underline">Review {n > rows.length ? `all ${n}` : n === 1 ? "it" : "them"}</Link>}
              </div>
            );
          })}
        </Section>
      </div>
    </div>
  );
}

function ChartTip({ active, payload, metric }: { active?: boolean; payload?: { payload: { full: string; sales: number; orders: number } }[]; metric: "sales" | "orders" }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-md border border-black/[0.08] bg-white px-3 py-2 text-xs shadow-lift">
      <div className="text-2xs text-gray-500">{p.full}</div>
      <div className="tabular mt-0.5 font-semibold text-secondary">{metric === "sales" ? inr(p.sales) : `${p.orders} order${p.orders === 1 ? "" : "s"}`}</div>
      <div className="tabular text-2xs text-gray-500">{metric === "sales" ? `${p.orders} orders` : inr(p.sales)}</div>
    </div>
  );
}
