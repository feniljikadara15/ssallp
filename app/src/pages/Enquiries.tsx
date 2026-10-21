import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ExternalLink, Plus } from "lucide-react";
import { useGet } from "../api";
import { inRange, num, stamp } from "../format";
import { useUrlState } from "../lib/urlState";
import { DataTable } from "../components/DataTable";
import { NewEnquiryModal } from "../components/NewEnquiryModal";
import { Badge, Button, DateRange, ErrorBox, FilterBar, PageHeader, Select, StatStrip, Tabs, Toolbar, type Tone } from "../components/ui";

// Enquiries are customer requests. Picking a warehouse and transporter makes
// one ready to become an order; deleted ones can be restored.
export const ENQUIRY_STATUS_BADGE: Record<string, { label: string; tone: Tone }> = {
  "0": { label: "Ongoing", tone: "neutral" }, "1": { label: "Converted", tone: "success" }, "5": { label: "Deleted", tone: "neutral" },
};
const STATUS = [["0", "Ongoing"], ["1", "Converted"], ["5", "Deleted"]] as const;
const FILTERS = ["customer", "warehouse", "source", "ready", "from", "to"] as const;

export default function Enquiries() {
  const navigate = useNavigate();
  const enquiries = useGet<any[]>("enquiries", { refetchInterval: 60_000 });
  const customers = useGet<any[]>("customers");
  const warehouses = useGet<any[]>("warehouses");
  const [f, set, clear] = useUrlState({ status: "0", customer: "", warehouse: "", source: "", ready: "", from: "", to: "", new: "" });
  const all = enquiries.data ?? [];

  const rows = useMemo(() => all.filter((e) =>
    e.enquiry_status === f.status &&
    (!f.customer || String(e.customer_id) === f.customer) &&
    (!f.warehouse || String(e.warehouse_id) === f.warehouse) &&
    (!f.source || (e.type ?? "Internal") === f.source) &&
    (!f.ready || (f.ready === "yes" ? e.warehouse_id != null && e.transporter_id != null : e.warehouse_id == null || e.transporter_id == null)) &&
    inRange(e.enquiry_date, f.from, f.to)), [all, f]);
  const filtered = FILTERS.some((k) => f[k]);
  const value = rows.reduce((s, e) => s + Number(e.items_value ?? 0), 0);
  const notReady = rows.filter((e) => e.warehouse_id == null || e.transporter_id == null).length;
  const statusLabel = STATUS.find(([v]) => v === f.status)?.[1] ?? "";
  const received = all.filter((e) => e.enquiry_status !== "5" && inRange(e.enquiry_date, f.from, f.to));
  const conv = received.length ? Math.round((received.filter((e) => e.enquiry_status === "1").length / received.length) * 100) : null;

  return (
    <div className="page">
      <PageHeader title="Enquiries" subtitle="Customer requests. Pick the warehouse and transporter, then create the order.">
        <Button variant="primary" icon={<Plus />} onClick={() => set({ new: "1" })}>New enquiry</Button>
      </PageHeader>
      <Toolbar>
        <Tabs value={f.status} onChange={(v) => set({ status: v, ready: "" })} tabs={STATUS.map(([value, label]) => ({ value, label, count: all.filter((e) => e.enquiry_status === value).length }))} />
      </Toolbar>
      <FilterBar active={filtered} onClear={() => clear(FILTERS)}>
        <Select className="w-full sm:w-60" value={f.customer} onChange={(e) => set({ customer: e.target.value })} placeholder="All customers"
          options={(customers.data ?? []).map((c) => ({ value: String(c.customer_id), label: c.name }))} />
        <Select className="w-full sm:w-52" value={f.warehouse} onChange={(e) => set({ warehouse: e.target.value })} placeholder="All warehouses"
          options={(warehouses.data ?? []).map((w) => ({ value: String(w.warehouse_id), label: w.name }))} />
        <Select className="w-full sm:w-44" value={f.source} onChange={(e) => set({ source: e.target.value })} placeholder="Any source"
          options={[{ value: "Internal", label: "Internal" }, { value: "External", label: "External (website)" }]} />
        {f.status === "0" && <Select className="w-full sm:w-52" value={f.ready} onChange={(e) => set({ ready: e.target.value })} placeholder="Any transport"
          options={[{ value: "yes", label: "Ready to order" }, { value: "no", label: "Transport not picked" }]} />}
        <DateRange label="Received" from={f.from} to={f.to} onFrom={(v) => set({ from: v })} onTo={(v) => set({ to: v })} className="w-full sm:w-auto" />
      </FilterBar>

      {enquiries.error && <ErrorBox error={enquiries.error} />}
      <StatStrip items={[
        { label: `${statusLabel} enquiries`, value: num(rows.length) },
        { label: "Enquiry value", value: `₹${num(value)}` },
        f.status === "0"
          ? { label: "Transport not picked", value: num(notReady), tone: notReady ? "warning" : undefined, hint: notReady ? "Can't become orders yet" : "All ready to order" }
          : { label: "Conversion", value: conv === null ? "-" : `${conv}%`, hint: "Received enquiries that became orders" },
      ]} />

      <DataTable title={`${statusLabel} enquiries`} filename={`${statusLabel} enquiries ${stamp()}`} rowKey="enquiry_id" rows={rows} loading={enquiries.isLoading}
        filtersActive={filtered} onClearFilters={() => clear(FILTERS)}
        rowLink={(r) => `/enquiries/${r.enquiry_id}`}
        empty={{ title: f.status === "5" ? "No deleted enquiries" : `No ${statusLabel.toLowerCase()} enquiries`,
          action: f.status === "0" ? <Button size="sm" variant="primary" icon={<Plus />} onClick={() => set({ new: "1" })}>New enquiry</Button> : undefined }}
        rowActions={(r) => [{ kind: "open", label: `Open enquiry EN-${r.enquiry_id}`, icon: <ExternalLink />, href: `/enquiries/${r.enquiry_id}` }]}
        cols={[
          { key: "enquiry_id", label: "Enquiry", kind: "int", align: "left", render: (r) => `EN-${r.enquiry_id}` },
          { key: "customer_name", label: "Customer", sub: (r) => r.site_name },
          { key: "enquiry_date", label: "Received", kind: "date" },
          { key: "delivery_date", label: "Deliver by", kind: "date" },
          { key: "item_count", label: "Items", kind: "int" },
          { key: "warehouse_name", label: "Warehouse", render: (r) => r.warehouse_name ?? (r.enquiry_status === "0" ? <Badge tone="warning">Not picked</Badge> : null),
            sub: (r) => r.transporter_name ?? (r.warehouse_id != null && r.enquiry_status === "0" ? "No transporter yet" : undefined) },
          { key: "type", label: "Source", value: (r) => r.type ?? "Internal", render: (r) => <Badge tone={r.type === "External" ? "info" : "neutral"}>{r.type ?? "Internal"}</Badge> },
          ...(f.status === "1" ? [{ key: "order_id", label: "Order", kind: "int" as const, align: "left" as const,
            render: (r: any) => r.order_id ? <Link onClick={(e) => e.stopPropagation()} to={`/orders/${r.order_id}`} className="font-medium text-ink underline decoration-line-strong underline-offset-2 hover:decoration-ink">#{r.order_id}</Link> : null }] : []),
          { key: "items_value", label: "Value (₹)", kind: "money", total: true },
        ]} />

      {f.new && <NewEnquiryModal onClose={() => set({ new: "" })} onCreated={(id) => navigate(`/enquiries/${id}`)} />}
    </div>
  );
}
