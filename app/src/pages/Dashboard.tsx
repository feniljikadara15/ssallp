import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ClipboardCheck, MessagesSquare, Users, TrendingUp, TrendingDown } from "lucide-react";
import { useStore } from "../data/store";
import { Card, PageHeader, Stat } from "../components/ui";

// Month-over-month change of the latest month vs. the one before (mirrors getDashboardStats).
function pctChange(dates: string[]) {
  const key = (d: Date) => `${d.getFullYear()}-${d.getMonth()}`;
  const counts = new Map<string, number>();
  dates.forEach((d) => counts.set(key(new Date(d)), (counts.get(key(new Date(d))) ?? 0) + 1));
  const now = new Date();
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const a = counts.get(key(now)) ?? 0;
  const b = counts.get(key(prev)) ?? 0;
  return b === 0 ? null : Math.round(((a - b) / b) * 10000) / 100;
}

function Trend({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-gray-400">No data for last month</span>;
  const up = pct >= 0;
  return (
    <span className={up ? "text-success" : "text-red-700"}>
      {up ? <TrendingUp className="mr-1 inline h-3 w-3" /> : <TrendingDown className="mr-1 inline h-3 w-3" />}
      {Math.abs(pct)}% vs last month
    </span>
  );
}

export default function Dashboard() {
  const { db } = useStore();
  const chart = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
      const count = db.orders.filter((o) => {
        const od = new Date(o.order_date);
        return od.getFullYear() === d.getFullYear() && od.getMonth() === d.getMonth();
      }).length;
      return { month: d.toLocaleString("en-US", { month: "short", year: "numeric" }), count };
    });
  }, [db.orders]);

  return (
    <div>
      <PageHeader title="Dashboard" />
      <div className="grid gap-4 md:grid-cols-3">
        <Stat label="Total Orders" value={db.orders.length} icon={<ClipboardCheck className="h-5 w-5" />} sub={<Trend pct={pctChange(db.orders.map((o) => o.order_date))} />} />
        <Stat label="Total Enquiries" value={db.enquiries.length} icon={<MessagesSquare className="h-5 w-5" />} sub={<Trend pct={pctChange(db.enquiries.map((e) => e.enquiry_date))} />} />
        <Stat label="Total Customers" value={db.customers.length} icon={<Users className="h-5 w-5" />} sub={<Trend pct={pctChange(db.customers.map((c) => c.created_at))} />} />
      </div>
      <Card className="mt-4 p-5">
        <h2 className="mb-4 text-sm font-medium text-secondary">Orders (Last 12 Months)</h2>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart} margin={{ left: -20 }}>
              <CartesianGrid vertical={false} stroke="#eee" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip cursor={{ fill: "rgba(242,98,34,0.06)" }} />
              <Bar dataKey="count" name="Orders" fill="#f26222" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
