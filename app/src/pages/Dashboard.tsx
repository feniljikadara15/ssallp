import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ClipboardCheck, MessagesSquare, Users, TrendingUp, TrendingDown } from "lucide-react";
import { useGet } from "../api";
import { Card, ErrorBox, Loading, PageHeader, Stat } from "../components/ui";

interface DashboardData {
  stats: { total_orders: number; orders_pct: number | null; total_enquiries: number; enquiries_pct: number | null; total_customers: number; customers_pct: number | null };
  chart: { month_start: string; month_label: string; order_count: number }[];
}

// Percentage change of the latest month with data vs. the month before (getDashboardStats).
function Trend({ pct }: { pct: number | null }) {
  if (pct === null || pct === undefined) return <span className="text-gray-400">No data for the previous month</span>;
  const up = pct >= 0;
  return (
    <span className={up ? "text-success" : "text-red-700"}>
      {up ? <TrendingUp className="mr-1 inline h-3 w-3" /> : <TrendingDown className="mr-1 inline h-3 w-3" />}
      {Math.abs(pct)}% this month
    </span>
  );
}

export default function Dashboard() {
  const { data, error, isLoading } = useGet<DashboardData>("dashboard");

  // chartOrders only returns months with orders; fill the gaps so the axis covers 12 months.
  const chart = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 13 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 12 + i, 1);
      const label = d.toLocaleString("en-US", { month: "short", year: "numeric" });
      const hit = data?.chart.find((c) => c.month_label === label);
      return { month: label, count: hit?.order_count ?? 0 };
    });
  }, [data]);

  return (
    <div>
      <PageHeader title="Dashboard" />
      {error && <ErrorBox error={error} />}
      {isLoading ? <Loading /> : data && (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Stat label="Total Orders" value={data.stats.total_orders} icon={<ClipboardCheck className="h-5 w-5" />} sub={<Trend pct={data.stats.orders_pct} />} />
            <Stat label="Total Enquiries" value={data.stats.total_enquiries} icon={<MessagesSquare className="h-5 w-5" />} sub={<Trend pct={data.stats.enquiries_pct} />} />
            <Stat label="Total Customers" value={data.stats.total_customers} icon={<Users className="h-5 w-5" />} sub={<Trend pct={data.stats.customers_pct} />} />
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
        </>
      )}
    </div>
  );
}
