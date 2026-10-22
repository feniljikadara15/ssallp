import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Download, ExternalLink, Wallet } from "lucide-react";
import { api, useGet } from "../api";
import { exportRows, inRange, num, stamp } from "../format";
import { useUrlState } from "../lib/urlState";
import { DataTable } from "../components/DataTable";
import { Button, DateRange, ErrorBox, FilterBar, PageHeader, Select, StatStrip, Tabs, Toolbar, toast } from "../components/ui";

// Orders billed as cash, and the money collected against them. A bill moves
// to Collected once its payments add up to the bill total.
const FILTERS = ["customer", "warehouse", "age", "from", "to"] as const;
const AGE = [{ value: "7", label: "Older than 7 days" }, { value: "30", label: "Older than 30 days" }, { value: "60", label: "Older than 60 days" }];
const daysSince = (d: string) => Math.floor((Date.now() - new Date(d).getTime()) / 864e5);

export default function CashBills() {
  const navigate = useNavigate();
  const pending = useGet<any[]>("cash-bills?tab=pending", { refetchInterval: 60_000 });
  const collected = useGet<any[]>("cash-bills?tab=collected");
  const customers = useGet<any[]>("customer-names");
  const warehouses = useGet<any[]>("warehouses");
  const [f, set, clear] = useUrlState({ tab: "pending", customer: "", warehouse: "", age: "", from: "", to: "" });
  const isPending = f.tab === "pending";
  const source = isPending ? pending : collected;

  const rows = useMemo(() => (source.data ?? []).filter((o) =>
    (!f.customer || String(o.customer_id) === f.customer) &&
    (!f.warehouse || String(o.warehouse_id) === f.warehouse) &&
    (!f.age || daysSince(o.order_date) > Number(f.age)) &&
    inRange(o.order_date, f.from, f.to)).map((o) => ({ ...o, due: Number(o.total_amount) - Number(o.total_collected) })), [source.data, f]);
  const filtered = FILTERS.some((k) => f[k]);
  const billed = rows.reduce((s, o) => s + Number(o.total_amount ?? 0), 0);
  const got = rows.reduce((s, o) => s + Number(o.total_collected ?? 0), 0);
  const oldest = rows.length ? Math.max(...rows.map((o) => daysSince(o.order_date))) : 0;

  // The sheet the accounts team used in Retool: one row per item and payment.
  const [exporting, setExporting] = useState(false);
  const detailExport = async () => {
    setExporting(true);
    try {
      const data = await api(`cash-bills-export?tab=${f.tab}&start=${f.from}&end=${f.to}`);
      const name = isPending ? "Cash Bills Pending" : "Cash Bills Collected";
      await exportRows(data, `${name} - ${stamp()}`, "xlsx", name);
    } catch (e) { toast("Export failed", "error", (e as Error).message); }
    setExporting(false);
  };

  return (
    <div className="page">
      <PageHeader title="Cash bills" subtitle="Orders billed as cash. Record each payment as it comes in; a bill moves to Collected when it is fully paid." />
      <Toolbar>
        <Tabs value={f.tab} onChange={(v) => set({ tab: v, age: "" })} tabs={[
          { value: "pending", label: "To collect", count: pending.data?.length },
          { value: "collected", label: "Collected", count: collected.data?.length },
        ]} />
      </Toolbar>
      <FilterBar active={filtered} onClear={() => clear(FILTERS)}>
        <Select className="w-full sm:w-60" value={f.customer} onChange={(e) => set({ customer: e.target.value })} placeholder="All customers"
          options={(customers.data ?? []).map((c) => ({ value: String(c.customer_id), label: c.name }))} />
        <Select className="w-full sm:w-52" value={f.warehouse} onChange={(e) => set({ warehouse: e.target.value })} placeholder="All warehouses"
          options={(warehouses.data ?? []).map((w) => ({ value: String(w.warehouse_id), label: w.name }))} />
        {isPending && <Select className="w-full sm:w-48" value={f.age} onChange={(e) => set({ age: e.target.value })} placeholder="Any age" options={AGE} />}
        <DateRange label="Billed" from={f.from} to={f.to} onFrom={(v) => set({ from: v })} onTo={(v) => set({ to: v })} className="w-full sm:w-auto" />
      </FilterBar>

      {source.error && <ErrorBox error={source.error} />}
      <StatStrip items={isPending ? [
        { label: "Bills to collect", value: num(rows.length) },
        { label: "Due", value: `₹${num(billed - got)}`, tone: billed - got > 0 ? "danger" : undefined, hint: `of ₹${num(billed)} billed` },
        { label: "Collected so far", value: `₹${num(got)}`, hint: "Part payments on these bills" },
        { label: "Oldest bill", value: rows.length ? `${num(oldest)} days` : "-", tone: oldest > 30 ? "warning" : undefined },
      ] : [
        { label: "Collected bills", value: num(rows.length) },
        { label: "Collected", value: `₹${num(got)}` },
      ]} />

      <DataTable title={isPending ? "Cash to collect" : "Collected cash bills"} filename={`${isPending ? "Cash to collect" : "Collected cash bills"} ${stamp()}`} rowKey="order_id" rows={rows} loading={source.isLoading}
        filtersActive={filtered} onClearFilters={() => clear(FILTERS)}
        rowLink={(r) => `/cash-bills/${r.order_id}`}
        empty={{ title: isPending ? "Nothing to collect" : "No collected bills", hint: isPending ? "Every cash bill is fully paid." : undefined }}
        toolbar={<Button size="sm" busy={exporting} icon={<Download />} onClick={detailExport} title="One row per item and payment, in the Retool layout">Detailed sheet</Button>}
        rowActions={(r) => [
          ...(isPending ? [{ kind: "edit" as const, label: `Record a payment for order #${r.order_id}`, icon: <Wallet />, onClick: () => navigate(`/cash-bills/${r.order_id}?collect=1`) }] : []),
          { kind: "open", label: `Open the cash bill for order #${r.order_id}`, icon: <ExternalLink />, href: `/cash-bills/${r.order_id}` },
        ]}
        cols={[
          { key: "order_id", label: "Order #", kind: "int", align: "left", sub: (r) => r.order_number },
          { key: "customer_name", label: "Customer", sub: (r) => r.site_name },
          { key: "order_date", label: "Billed", kind: "date", sub: (r) => isPending ? `${num(daysSince(r.order_date))} days ago` : undefined },
          { key: "loading_slip_file_name", label: "Loading slip", sub: (r) => r.warehouse_name },
          { key: "last_collected", label: "Last payment", kind: "date", sub: (r) => r.payments ? `${num(r.payments)} payment${r.payments === 1 ? "" : "s"}` : undefined },
          { key: "total_amount", label: "Bill (₹)", kind: "money", total: true },
          { key: "total_collected", label: "Collected (₹)", kind: "money", total: true },
          ...(isPending ? [{ key: "due", label: "Due (₹)", kind: "money" as const, total: true, className: "font-medium text-danger" }] : []),
        ]} />
    </div>
  );
}
