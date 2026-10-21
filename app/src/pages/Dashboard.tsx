import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowRight, ArrowUpRight, ArrowDownRight, Banknote, CheckCircle2, ClipboardCheck, IndianRupee, MessagesSquare, PackageX, Plus, Timer, Truck } from "lucide-react";
import { useGet, type Session } from "../api";
import { fmtDate, inr, inrShort } from "../format";
import { Badge, Button, Card, ErrorBox, Loading, PageHeader, Section, Stat } from "../components/ui";

interface DashboardData {
  kpis: { open_enquiries: number; ongoing_orders: number; in_transit: number; delivered_month: number; sales_month: number; sales_prev_to_date: number; billed_month: number };
  cash: { count: number; due: number };
  attention: { kind: "no_slip" | "transit" | "enquiry"; id: number; customer_name: string | null; since: string; total_amount: number | null }[];
  attentionCounts: { no_slip: number; transit: number; enquiry: number };
  chart: { month_start: string; month_label: string; order_count: number; sales: number }[];
  recent: { order_id: number; order_status: string; order_date: string; total_amount: number | null; items_value: number; payment_type: string | null; customer_name: string | null }[];
}

const STATUS: Record<string, { label: string; tone: "orange" | "blue" | "green" | "red" }> = {
  "1": { label: "Ongoing", tone: "orange" }, "2": { label: "In transit", tone: "blue" }, "3": { label: "Delivered", tone: "green" }, "5": { label: "Deleted", tone: "red" },
};

const ATTENTION = {
  no_slip: { title: "Orders without loading slips", icon: PackageX, to: (id: number) => `/orders?id=${id}`, hint: "Create slips so the warehouse can load" },
  transit: { title: "In transit for over 2 days", icon: Timer, to: (id: number) => `/orders?id=${id}`, hint: "Confirm delivery or follow up with the transporter" },
  enquiry: { title: "Enquiries waiting over 2 days", icon: MessagesSquare, to: (id: number) => `/enquiries?id=${id}`, hint: "Convert to an order or close" },
} as const;

const ago = (v: string) => {
  const days = Math.floor((Date.now() - new Date(v).getTime()) / 86_400_000);
  return days <= 0 ? "today" : days === 1 ? "1 day" : `${days} days`;
};

function greeting() {
  const h = Number(new Date().toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: "Asia/Kolkata" }));
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export default function Dashboard() {
  const { data, error, isLoading } = useGet<DashboardData>("dashboard", { refetchInterval: 120_000 });
  const session = useGet<Session>("session");
  const first = session.data?.user?.name?.split(" ")[0];

  // The query only returns months with orders; fill the gaps so the axis covers 12 months.
  const chart = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
      const label = d.toLocaleString("en-US", { month: "short", year: "numeric" });
      const hit = data?.chart.find((c) => c.month_label === label);
      return { month: d.toLocaleString("en-US", { month: "short" }), full: label, orders: hit?.order_count ?? 0, sales: Number(hit?.sales ?? 0) };
    });
  }, [data]);

  const today = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Kolkata" });

  return (
    <div>
      <PageHeader title={first ? `${greeting()}, ${first}` : "Dashboard"} description={today}>
        <Link to="/enquiries?new=1"><Button icon={<Plus />}>New enquiry</Button></Link>
      </PageHeader>
      {error && <ErrorBox error={error} />}
      {isLoading ? <Loading /> : data && <Body data={data} chart={chart} />}
    </div>
  );
}

function Body({ data, chart }: { data: DashboardData; chart: { month: string; full: string; orders: number; sales: number }[] }) {
  const k = data.kpis;
  const change = k.sales_prev_to_date > 0 ? ((k.sales_month - k.sales_prev_to_date) / k.sales_prev_to_date) * 100 : null;
  const totalAttention = data.attentionCounts.no_slip + data.attentionCounts.transit + data.attentionCounts.enquiry;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Stat label="Sales this month" tone="orange" icon={<IndianRupee />} value={inrShort(k.sales_month)}
          sub={change === null ? `${k.billed_month} orders billed` : (
            <span className="inline-flex items-center gap-1">
              <span className={change >= 0 ? "inline-flex items-center font-medium text-emerald-600" : "inline-flex items-center font-medium text-red-600"}>
                {change >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}{Math.abs(change).toFixed(0)}%
              </span>
              vs same days last month
            </span>
          )} />
        <Link to="/enquiries" className="block transition hover:-translate-y-0.5"><Stat label="Open enquiries" tone="navy" icon={<MessagesSquare />} value={k.open_enquiries} sub="Waiting to become orders" /></Link>
        <Link to="/orders" className="block transition hover:-translate-y-0.5"><Stat label="Orders to dispatch" tone="amber" icon={<ClipboardCheck />} value={k.ongoing_orders} sub="Ongoing, not yet billed" /></Link>
        <Link to="/orders?tab=2" className="block transition hover:-translate-y-0.5"><Stat label="In transit" tone="blue" icon={<Truck />} value={k.in_transit} sub={`${k.delivered_month} delivered this month`} /></Link>
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Section title="Sales and orders" description="Billed value and orders created, last 12 months">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chart} margin={{ left: 0, right: 0, top: 8 }}>
                <CartesianGrid vertical={false} stroke="#eef0f3" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#8a90a0" }} tickLine={false} axisLine={false} />
                <YAxis yAxisId="s" tickFormatter={(v) => inrShort(v)} tick={{ fontSize: 11, fill: "#8a90a0" }} tickLine={false} axisLine={false} width={56} />
                <YAxis yAxisId="o" orientation="right" allowDecimals={false} tick={{ fontSize: 11, fill: "#8a90a0" }} tickLine={false} axisLine={false} width={28} />
                <Tooltip cursor={{ fill: "rgba(242,98,34,0.05)" }} content={<ChartTip />} />
                <Bar yAxisId="s" dataKey="sales" name="Sales" fill="#f26222" radius={[5, 5, 0, 0]} maxBarSize={36} />
                <Line yAxisId="o" dataKey="orders" name="Orders" type="monotone" stroke="#292f45" strokeWidth={2} dot={{ r: 2.5, fill: "#292f45" }} activeDot={{ r: 4 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex items-center gap-4 text-2xs text-gray-500">
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-primary" />Sales (₹)</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-3 rounded bg-secondary" />Orders</span>
          </div>
        </Section>

        <div className="space-y-5">
          <Section title="Needs attention" description={totalAttention ? `${totalAttention} item${totalAttention === 1 ? "" : "s"} waiting` : "Nothing waiting"} bodyClassName="p-2">
            {totalAttention === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-emerald-50 text-emerald-600"><CheckCircle2 className="h-5 w-5" /></div>
                <div className="text-xs text-gray-500">All caught up.</div>
              </div>
            ) : (
              (Object.keys(ATTENTION) as (keyof typeof ATTENTION)[]).filter((kind) => data.attentionCounts[kind] > 0).map((kind) => {
                const a = ATTENTION[kind];
                const rows = data.attention.filter((r) => r.kind === kind).slice(0, 3);
                const more = data.attentionCounts[kind] - rows.length;
                return (
                  <div key={kind} className="mb-1 last:mb-0">
                    <div className="flex items-center gap-2 px-2 pb-1 pt-2">
                      <a.icon className="h-3.5 w-3.5 text-gray-400" />
                      <span className="flex-1 text-2xs font-medium text-gray-600">{a.title}</span>
                      <Badge tone={kind === "transit" ? "blue" : kind === "no_slip" ? "orange" : "gray"}>{data.attentionCounts[kind]}</Badge>
                    </div>
                    {rows.map((r) => (
                      <Link key={`${kind}${r.id}`} to={a.to(r.id)} className="group flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-gray-50">
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-xs font-medium text-secondary">{r.customer_name ?? "—"}</div>
                          <div className="text-2xs text-gray-500">{kind === "enquiry" ? `EN-${r.id}` : `Order #${r.id}`} · {ago(r.since)}</div>
                        </div>
                        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-gray-300 transition group-hover:translate-x-0.5 group-hover:text-primary" />
                      </Link>
                    ))}
                    {more > 0 && <Link to={kind === "enquiry" ? "/enquiries" : kind === "transit" ? "/orders?tab=2" : "/orders"} className="block px-2 py-1 text-2xs font-medium text-primary hover:underline">+ {more} more</Link>}
                  </div>
                );
              })
            )}
          </Section>

          <Link to="/cash-bills" className="block">
            <Card className="flex items-center gap-4 p-4 transition hover:shadow-lift">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-600"><Banknote className="h-5 w-5" /></div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium text-gray-500">Cash to collect</div>
                <div className="tabular text-lg font-semibold text-secondary">{inr(data.cash.due)}</div>
                <div className="text-2xs text-gray-500">{data.cash.count} cash bill{data.cash.count === 1 ? "" : "s"} with a balance</div>
              </div>
              <ArrowRight className="h-4 w-4 text-gray-300" />
            </Card>
          </Link>
        </div>
      </div>

      <Section title="Recent orders" actions={<Link to="/orders" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">View all <ArrowRight className="h-3.5 w-3.5" /></Link>} bodyClassName="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-black/[0.06] bg-gray-50/70 text-left text-2xs uppercase tracking-wide text-gray-500">
                <th className="px-4 py-2.5 font-medium">Order</th><th className="px-4 py-2.5 font-medium">Customer</th><th className="px-4 py-2.5 font-medium">Date</th>
                <th className="px-4 py-2.5 font-medium">Status</th><th className="px-4 py-2.5 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {data.recent.map((o) => (
                <tr key={o.order_id} className="border-b border-black/[0.04] last:border-0 hover:bg-gray-50/80">
                  <td className="px-4 py-2.5"><Link to={`/orders?id=${o.order_id}`} className="font-medium text-secondary hover:text-primary">#{o.order_id}</Link></td>
                  <td className="max-w-[240px] truncate px-4 py-2.5 text-secondary">{o.customer_name}</td>
                  <td className="tabular px-4 py-2.5 text-gray-500">{fmtDate(o.order_date)}</td>
                  <td className="px-4 py-2.5"><Badge dot tone={STATUS[o.order_status]?.tone}>{STATUS[o.order_status]?.label ?? o.order_status}</Badge></td>
                  <td className="tabular px-4 py-2.5 text-right font-medium text-secondary">{inr(o.total_amount ?? o.items_value)}</td>
                </tr>
              ))}
              {!data.recent.length && <tr><td colSpan={5} className="px-4 py-10 text-center text-gray-400">No orders yet</td></tr>}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}

function ChartTip({ active, payload }: { active?: boolean; payload?: { payload: { full: string; sales: number; orders: number } }[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border border-black/[0.06] bg-white px-3 py-2 text-xs shadow-lift">
      <div className="mb-1 font-medium text-secondary">{p.full}</div>
      <div className="tabular text-gray-600">Sales <span className="font-medium text-secondary">{inr(p.sales)}</span></div>
      <div className="tabular text-gray-600">Orders <span className="font-medium text-secondary">{p.orders}</span></div>
    </div>
  );
}
