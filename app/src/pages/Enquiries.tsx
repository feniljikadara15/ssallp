import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import clsx from "clsx";
import { Plus } from "lucide-react";
import { useGet } from "../api";
import { fmtDate, includes, inRange, num, stamp } from "../format";
import { useUrlState } from "../lib/urlState";
import { NewEnquiryModal } from "../components/NewEnquiryModal";
import { SplitList, SplitView } from "../components/SplitView";
import { Badge, Button, DateRange, ErrorBox, FilterBar, PageHeader, Select, Tabs, Toolbar, type Tone } from "../components/ui";
import EnquiryDetail from "./EnquiryDetail";

// Enquiries are customer requests. Picking a warehouse and transporter makes
// one ready to become an order; deleted ones can be restored.
export const ENQUIRY_STATUS_BADGE: Record<string, { label: string; tone: Tone }> = {
  "0": { label: "Ongoing", tone: "neutral" }, "1": { label: "Converted", tone: "success" }, "5": { label: "Deleted", tone: "neutral" },
};
const STATUS = [["0", "Ongoing"], ["1", "Converted"], ["5", "Deleted"]] as const;
const FILTERS = ["customer", "warehouse", "source", "ready", "from", "to", "q"] as const;
const ready = (e: any) => e.warehouse_id != null && e.transporter_id != null;

export default function Enquiries() {
  const navigate = useNavigate();
  const id = Number(useParams().id) || null;
  const enquiries = useGet<any[]>("enquiries", { refetchInterval: 60_000 });
  const customers = useGet<any[]>("customers");
  const warehouses = useGet<any[]>("warehouses");
  const [f, set, clear] = useUrlState({ status: "0", customer: "", warehouse: "", source: "", ready: "", from: "", to: "", q: "", new: "" });
  const all = enquiries.data ?? [];

  const rows = useMemo(() => all.filter((e) =>
    e.enquiry_status === f.status &&
    (!f.customer || String(e.customer_id) === f.customer) &&
    (!f.warehouse || String(e.warehouse_id) === f.warehouse) &&
    (!f.source || (e.type ?? "Internal") === f.source) &&
    (!f.ready || (f.ready === "yes" ? ready(e) : !ready(e))) &&
    inRange(e.enquiry_date, f.from, f.to) &&
    (includes(`${e.customer_name} ${e.site_name} EN-${e.enquiry_id} ${e.customer_phone ?? ""}`, f.q))), [all, f]);
  const filtered = FILTERS.some((k) => f[k]);
  const value = rows.reduce((s, e) => s + Number(e.items_value ?? 0), 0);
  const notReady = f.status === "0" ? rows.filter((e) => !ready(e)).length : 0;
  const statusLabel = STATUS.find(([v]) => v === f.status)?.[1] ?? "";

  return (
    <div className="page">
      <div className={clsx("flex flex-col gap-5", id && "hidden lg:flex")}>
        <PageHeader title="Enquiries" subtitle="Customer requests. Pick the warehouse and transporter, then create the order.">
          <Button variant="primary" icon={<Plus />} onClick={() => set({ new: "1" })}>New enquiry</Button>
        </PageHeader>
        <Toolbar>
          <Tabs value={f.status} onChange={(v) => set({ status: v, ready: "" })} tabs={STATUS.map(([value, label]) => ({ value, label, count: all.filter((e) => e.enquiry_status === value).length }))} />
        </Toolbar>
        <FilterBar active={filtered} onClear={() => clear(FILTERS)}>
          <Select className="w-full sm:w-56" value={f.customer} onChange={(e) => set({ customer: e.target.value })} placeholder="All customers"
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
      </div>

      <SplitView selected={!!id} backTo="/enquiries" backLabel="Enquiries" emptyText="Pick an enquiry to review it and turn it into an order"
        detail={id && <EnquiryDetail key={id} id={id} />}
        list={
          <SplitList title={`${statusLabel} enquiries`} items={rows.map((e) => ({
              key: e.enquiry_id, to: `/enquiries/${e.enquiry_id}`,
              title: e.customer_name ?? "-", right: fmtDate(e.enquiry_date),
              sub: [`EN-${e.enquiry_id}`, e.site_name].filter(Boolean).join(", "), rightSub: `₹${num(e.items_value)}`,
              tags: (e.type === "External" || (e.enquiry_status === "0" && !ready(e)) || e.order_id) && <>
                {e.enquiry_status === "0" && !ready(e) && <Badge tone="warning">Transport not picked</Badge>}
                {e.type === "External" && <Badge tone="info">Website</Badge>}
                {e.order_id && <Badge tone="neutral">Order #{e.order_id}</Badge>}
              </>,
            }))}
            selectedKey={id ?? undefined} loading={enquiries.isLoading}
            summary={<>₹{num(value)} total{notReady ? `, ${num(notReady)} without transport` : ""}</>}
            q={f.q} onSearch={(v) => set({ q: v })} placeholder="Customer, site, EN number or phone"
            empty={<><div className="text-[13.5px] font-medium text-ink">{filtered ? "No enquiries match these filters" : `No ${statusLabel.toLowerCase()} enquiries`}</div>
              {filtered && <button className="btn btn-sm mt-3" onClick={() => clear(FILTERS)}>Clear filters</button>}</>}
            exportInput={{
              title: `${statusLabel} enquiries`, filename: `${statusLabel} enquiries ${stamp()}`, totals: ["items_value"],
              rows: rows.map((e) => ({ ...e, en: `EN-${e.enquiry_id}`, source: e.type ?? "Internal" })),
              cols: [
                { key: "en", label: "Enquiry" }, { key: "customer_name", label: "Customer" }, { key: "site_name", label: "Site" },
                { key: "enquiry_date", label: "Received", kind: "date" }, { key: "delivery_date", label: "Deliver by", kind: "date" },
                { key: "item_count", label: "Items", kind: "int" }, { key: "warehouse_name", label: "Warehouse" }, { key: "transporter_name", label: "Transporter" },
                { key: "source", label: "Source" }, { key: "order_id", label: "Order #", kind: "int" }, { key: "items_value", label: "Value (₹)", kind: "money" },
              ],
            }} />
        } />

      {f.new && <NewEnquiryModal onClose={() => set({ new: "" })} onCreated={(nid) => { set({ new: "", status: "0" }); navigate(`/enquiries/${nid}`); }} />}
    </div>
  );
}
