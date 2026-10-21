import { useMemo, useState } from "react";
import { ExternalLink, Import, Pencil } from "lucide-react";
import { useGet } from "../api";
import { num, stamp } from "../format";
import { useUrlState } from "../lib/urlState";
import { DataTable } from "../components/DataTable";
import { Badge, Button, ErrorBox, FilterBar, PageHeader, Select, StatStrip, Tabs, Toolbar } from "../components/ui";
import { EditCustomerModal, ImportModal } from "./CustomerDetail";

// Customers come from Zoho Books (import) or the enquiry form. Each opens
// to its own page with sites, orders and money owed.
const FILTERS = ["tcs", "gst", "zoho", "orders"] as const;

export default function Customers() {
  const customers = useGet<any[]>("customers");
  const [f, set, clear] = useUrlState({ status: "true", tcs: "", gst: "", zoho: "", orders: "" });
  const [edit, setEdit] = useState<any | null>(null);
  const [importing, setImporting] = useState(false);
  const all = customers.data ?? [];

  const rows = useMemo(() => all.filter((c) =>
    (!f.status || String(!!c.is_active) === f.status) &&
    (!f.tcs || String(!!c.tcs_status) === f.tcs) &&
    (!f.gst || (f.gst === "yes" ? !!c.gstin : !c.gstin)) &&
    (!f.zoho || (f.zoho === "yes" ? !!c.zb_customer_id : !c.zb_customer_id)) &&
    (!f.orders || (f.orders === "yes" ? c.order_count > 0 : !c.order_count))), [all, f]);
  const filtered = FILTERS.some((k) => f[k]);

  return (
    <div className="page">
      <PageHeader title="Customers" subtitle="Parties, their billing details and sites. Import new ones from Zoho Books, or they are added from an enquiry.">
        <Button variant="primary" icon={<Import />} onClick={() => setImporting(true)}>Import from Zoho</Button>
      </PageHeader>
      <Toolbar>
        <Tabs value={f.status} onChange={(v) => set({ status: v })} tabs={[
          { value: "true", label: "Active", count: all.filter((c) => c.is_active).length },
          { value: "false", label: "Inactive", count: all.filter((c) => !c.is_active).length },
          { value: "", label: "All", count: all.length },
        ]} />
      </Toolbar>
      <FilterBar active={filtered} onClear={() => clear(FILTERS)}>
        <Select className="w-full sm:w-44" value={f.gst} onChange={(e) => set({ gst: e.target.value })} placeholder="Any GST status"
          options={[{ value: "yes", label: "GST registered" }, { value: "no", label: "No GSTIN" }]} />
        <Select className="w-full sm:w-44" value={f.tcs} onChange={(e) => set({ tcs: e.target.value })} placeholder="Any TCS"
          options={[{ value: "true", label: "TCS applies" }, { value: "false", label: "No TCS" }]} />
        <Select className="w-full sm:w-48" value={f.zoho} onChange={(e) => set({ zoho: e.target.value })} placeholder="Any Zoho link"
          options={[{ value: "yes", label: "Linked to Zoho" }, { value: "no", label: "Not in Zoho" }]} />
        <Select className="w-full sm:w-44" value={f.orders} onChange={(e) => set({ orders: e.target.value })} placeholder="Any orders"
          options={[{ value: "yes", label: "Has orders" }, { value: "no", label: "No orders yet" }]} />
      </FilterBar>

      {customers.error && <ErrorBox error={customers.error} />}
      <StatStrip items={[
        { label: "Customers", value: num(rows.length) },
        { label: "GST registered", value: num(rows.filter((c) => c.gstin).length) },
        { label: "TCS applies", value: num(rows.filter((c) => c.tcs_status).length) },
        { label: "Billed to date", value: `₹${num(rows.reduce((s, c) => s + Number(c.billed_value ?? 0), 0))}` },
      ]} />

      <DataTable title="Customers" filename={`Customers ${stamp()}`} rowKey="customer_id" rows={rows} loading={customers.isLoading}
        filtersActive={filtered} onClearFilters={() => clear(FILTERS)}
        rowLink={(r) => `/customers/${r.customer_id}`}
        empty={{ title: "No customers", hint: "Import one from Zoho Books." }}
        rowActions={(r) => [
          { kind: "open", label: `Open ${r.name}`, icon: <ExternalLink />, href: `/customers/${r.customer_id}` },
          { kind: "edit", label: `Edit ${r.name}`, icon: <Pencil />, onClick: () => setEdit(r) },
        ]}
        cols={[
          { key: "name", label: "Customer", sub: (r) => [`#${r.customer_id}`, r.customer_type].filter(Boolean).join(", ") },
          { key: "phone", label: "Phone", kind: "mono" },
          { key: "gstin", label: "GSTIN", kind: "mono", sub: (r) => r.pan },
          { key: "billing_city", label: "City", sub: (r) => r.billing_state },
          { key: "site_count", label: "Sites", kind: "int" },
          { key: "order_count", label: "Orders", kind: "int", total: true },
          { key: "last_order", label: "Last order", kind: "date" },
          { key: "tcs_status", label: "TCS", value: (r) => (r.tcs_status ? "Applies" : "No"), render: (r) => r.tcs_status ? <Badge tone="info">TCS</Badge> : null },
          { key: "zb_customer_id", label: "Zoho", value: (r) => (r.zb_customer_id ? "Linked" : "Not linked"), render: (r) => r.zb_customer_id ? <Badge tone="success">Linked</Badge> : <Badge tone="neutral">Not linked</Badge> },
          { key: "billed_value", label: "Billed (₹)", kind: "money", total: true },
        ]} />

      {edit && <EditCustomerModal customer={edit} onClose={() => setEdit(null)} />}
      {importing && <ImportModal onClose={() => setImporting(false)} />}
    </div>
  );
}
