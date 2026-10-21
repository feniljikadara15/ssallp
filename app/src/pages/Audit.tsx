import { useState } from "react";
import { Link } from "react-router-dom";
import { ExternalLink, RotateCcw } from "lucide-react";
import { post, useAction, useGet } from "../api";
import { dateTimeFull, fmtDate, num, stamp } from "../format";
import { useUrlState } from "../lib/urlState";
import { DataTable } from "../components/DataTable";
import { ask, Badge, Button, DateRange, ErrorBox, FilterBar, Input, KV, Modal, Notice, PageHeader, Select, StatStrip, Tabs, Toolbar, type Tone } from "../components/ui";

// Every change to the data, recorded by a database trigger: who made it, from
// which device and IP, and the fields before and after. Deletions can be
// restored for 30 days.

type Entry = {
  audit_id: number; at: string; table_name: string; record_id: string; action: string; actor: string; ip: string | null; device: string | null;
  request_id: string | null; changed: string[] | null; old_row: Record<string, unknown> | null; new_row: Record<string, unknown> | null;
  restored_at: string | null; restored_by: string | null; kind: Kind; restorable: boolean;
};
type Kind = "created" | "updated" | "deleted" | "restored";

const KINDS: { value: "" | Kind; label: string }[] = [{ value: "", label: "All changes" }, { value: "created", label: "Created" }, { value: "updated", label: "Updated" }, { value: "deleted", label: "Deleted" }, { value: "restored", label: "Restored" }];
const KIND_BADGE: Record<Kind, { label: string; tone: Tone }> = {
  created: { label: "Created", tone: "success" }, updated: { label: "Updated", tone: "info" }, deleted: { label: "Deleted", tone: "danger" }, restored: { label: "Restored", tone: "brand" },
};
const TABLE: Record<string, string> = {
  orders: "Order", order_items: "Order item", enquiries: "Enquiry", enquiry_items: "Enquiry item", customers: "Customer", addresses: "Address", sites: "Site",
  products: "Product", warehouses: "Warehouse", warehouse_keepers: "Warehouse keeper", warehouse_brands: "Warehouse brand", warehouse_companies: "Billing company",
  transporters: "Transporter", vehicles: "Vehicle", transporter_warehouses: "Transporter link", invoices: "Invoice", loading_slips: "Loading slip set",
  loading_slip_items: "Loading slip", cash_collected: "Cash payment", state_codes: "State code", zoho_taxes: "Zoho tax",
};
const tableLabel = (t: string) => TABLE[t] ?? t.replace(/_/g, " ");
const FIELD: Record<string, string> = { zb_customer_id: "Zoho customer ID", zb_item_id: "Zoho item ID", zb_invoice_id: "Zoho invoice ID", zb_invoice_number: "Invoice number", gstin: "GSTIN", pan: "PAN", hsn: "HSN", mrp: "MRP", otp: "OTP", tcs_status: "TCS", is_active: "Active", gst_rate: "GST rate", po_number: "PO number", url: "File link" };
const fieldLabel = (k: string) => FIELD[k] ?? k.replace(/_id$/, " #").replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
const STATUS: Record<string, Record<string, string>> = {
  order_status: { "1": "Ongoing", "2": "In transit", "3": "Delivered", "5": "Deleted" },
  enquiry_status: { "0": "Ongoing", "1": "Converted", "5": "Deleted" },
};
function show(k: string, v: unknown) {
  if (v === null || v === undefined || v === "") return <span className="text-faint">empty</span>;
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (STATUS[k]?.[String(v)]) return STATUS[k][String(v)];
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v)) return dateTimeFull(v);
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) return fmtDate(v);
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}
const row = (e: Entry) => (e.new_row ?? e.old_row ?? {}) as Record<string, any>;
const title = (e: Entry) => { const r = row(e); return r.name ?? r.product_name ?? r.site_name ?? r.vehicle_number ?? r.loading_slip_file_name ?? r.brand ?? r.company_name ?? r.zb_invoice_number ?? r.receipt_number ?? null; };

/** Where the changed record lives in the app, if it has a page. */
function linkOf(e: Entry) {
  const r = row(e), id = e.record_id;
  switch (e.table_name) {
    case "orders": return `/orders/${id}`;
    case "order_items": case "loading_slips": case "invoices": return r.order_id ? `/orders/${r.order_id}` : null;
    case "cash_collected": return r.order_id ? `/cash-bills/${r.order_id}` : null;
    case "enquiries": return `/enquiries/${id}`;
    case "enquiry_items": return r.enquiry_id ? `/enquiries/${r.enquiry_id}` : null;
    case "customers": return `/customers/${id}`;
    case "sites": case "addresses": return r.customer_id ? `/customers/${r.customer_id}` : null;
    case "warehouses": return `/warehouses/${id}`;
    case "warehouse_keepers": case "warehouse_brands": case "warehouse_companies": return r.warehouse_id ? `/warehouses/${r.warehouse_id}` : null;
    case "transporters": return `/transporters/${id}`;
    case "vehicles": case "transporter_warehouses": return r.transporter_id ? `/transporters/${r.transporter_id}` : null;
    default: return null;
  }
}
/** The fields that tell the story: changed ones on an update, filled ones otherwise. */
const fields = (e: Entry) => e.action === "UPDATE" ? (e.changed ?? []) : Object.keys(row(e)).filter((k) => row(e)[k] !== null && row(e)[k] !== "" && !["created_at", "updated_at"].includes(k));
const FILTERS = ["table", "actor", "record", "from", "to"] as const;

export default function Audit() {
  const [f, set, clear] = useUrlState({ kind: "", table: "", actor: "", record: "", from: "", to: "" });
  const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v) as [string, string][]);
  qs.set("limit", "1000");
  const { data, error, isLoading } = useGet<{ rows: Entry[]; count: number; actors: string[]; tables: string[] }>(`audit?${qs}`, { refetchInterval: 60_000 });
  const [open, setOpen] = useState<Entry | null>(null);
  const restore = useAction((id: number) => post(`audit/${id}/restore`), ["audit", "orders", "enquiries", "customers", "products", "warehouses", "transporters", "warehouse-keepers", "cash-bills", "loading-slips", "dashboard"], { onSuccess: () => setOpen(null) });
  const doRestore = async (e: Entry) => (await ask(`Restore ${tableLabel(e.table_name).toLowerCase()} #${e.record_id}?`, "Restore", { body: "It is put back as it was just before it was deleted." })) && restore.mutate(e.audit_id);
  const rows = data?.rows ?? [];
  const filtered = FILTERS.some((k) => f[k]);

  return (
    <div className="page">
      <PageHeader title="Audit log" subtitle="Every change to the data: who made it, from which device, and what changed. Deleted records can be restored for 30 days." />
      <Toolbar>
        <Tabs value={f.kind as "" | Kind} onChange={(v) => set({ kind: v })} tabs={KINDS} />
      </Toolbar>
      <FilterBar active={filtered} onClear={() => clear(FILTERS)}>
        <Select className="w-full sm:w-52" value={f.table} onChange={(e) => set({ table: e.target.value })} placeholder="All record types"
          options={(data?.tables ?? []).map((t) => ({ value: t, label: tableLabel(t) })).sort((a, b) => a.label.localeCompare(b.label))} />
        <Select className="w-full sm:w-60" value={f.actor} onChange={(e) => set({ actor: e.target.value })} placeholder="Anyone"
          options={(data?.actors ?? []).map((a) => ({ value: a, label: a === "system" ? "System (outside the app)" : a }))} />
        <Input className="w-full sm:w-36" inputMode="numeric" aria-label="Record number" placeholder="Record #" value={f.record} onChange={(e) => set({ record: e.target.value.replace(/\D/g, "") })} />
        <DateRange label="Changed" from={f.from} to={f.to} onFrom={(v) => set({ from: v })} onTo={(v) => set({ to: v })} className="w-full sm:w-auto" />
      </FilterBar>

      {error && <ErrorBox error={error} />}
      <StatStrip items={[
        { label: "Changes", value: num(data?.count ?? 0), hint: data && data.count > rows.length ? `Latest ${num(rows.length)} shown` : undefined },
        { label: "People", value: num(new Set(rows.map((r) => r.actor).filter((a) => a !== "system")).size) },
        { label: "Deletions", value: num(rows.filter((r) => r.kind === "deleted").length) },
        { label: "Can be restored", value: num(rows.filter((r) => r.restorable).length), hint: "Deleted in the last 30 days" },
      ]} />

      <DataTable title="Changes" filename={`Audit log ${stamp()}`} rowKey="audit_id" rows={rows} loading={isLoading} pageSize={50}
        filtersActive={filtered || !!f.kind} onClearFilters={() => clear([...FILTERS, "kind"])} onRowClick={(r) => setOpen(r as Entry)}
        empty={{ title: "No changes recorded", hint: "Changes made from now on appear here." }}
        rowActions={(r) => { const e = r as Entry; return [
          ...(linkOf(e) ? [{ kind: "open" as const, label: `Open ${tableLabel(e.table_name).toLowerCase()}`, icon: <ExternalLink />, href: linkOf(e)! }] : []),
          ...(e.restorable ? [{ kind: "restore" as const, label: `Restore ${tableLabel(e.table_name).toLowerCase()} #${e.record_id}`, icon: <RotateCcw />, onClick: () => doRestore(e), disabled: restore.isPending }] : []),
        ]; }}
        cols={[
          { key: "at", label: "When", kind: "datetime" },
          { key: "table_name", label: "Record", value: (e: any) => `${tableLabel(e.table_name)} #${e.record_id}`, sub: (e: any) => title(e) },
          { key: "kind", label: "Change", value: (e: any) => KIND_BADGE[e.kind as Kind].label,
            render: (e: any) => <span className="inline-flex items-center gap-1.5"><Badge dot tone={KIND_BADGE[e.kind as Kind].tone}>{KIND_BADGE[e.kind as Kind].label}</Badge>{e.restored_at && <span className="text-[12px] text-faint">restored later</span>}</span> },
          { key: "changed", label: "Fields", className: "max-w-[280px] truncate", value: (e: any) => fields(e).map(fieldLabel).join(", ") },
          { key: "actor", label: "By", sub: (e: any) => e.device },
          { key: "ip", label: "IP address", kind: "mono" },
        ]} />

      {open && <ChangeModal e={open} onClose={() => setOpen(null)} onRestore={() => doRestore(open)} restoring={restore.isPending} />}
    </div>
  );
}

function ChangeModal({ e, onClose, onRestore, restoring }: { e: Entry; onClose: () => void; onRestore: () => void; restoring: boolean }) {
  const keys = fields(e);
  const link = linkOf(e);
  const k = KIND_BADGE[e.kind as Kind];
  return (
    <Modal open onClose={onClose} size="lg" title={`${tableLabel(e.table_name)} #${e.record_id}`}
      footer={<>
        {link && <Link to={link} onClick={onClose} className="btn mr-auto">Open {tableLabel(e.table_name).toLowerCase()}</Link>}
        <Button onClick={onClose}>Close</Button>
        {e.restorable && <Button variant="primary" busy={restoring} icon={<RotateCcw />} onClick={onRestore}>Restore</Button>}
      </>}>
      <div className="grid gap-x-6 gap-y-4 sm:grid-cols-3">
        <KV label="Change" value={<Badge dot tone={k.tone}>{k.label}</Badge>} />
        <KV label="When" value={dateTimeFull(e.at)} />
        <KV label="By" value={e.actor === "system" ? "System (outside the app)" : e.actor} />
        <KV label="Device" value={e.device} />
        <KV label="IP address" value={e.ip} />
        <KV label="Record" value={title(e) ?? `#${e.record_id}`} />
      </div>
      {e.restored_at && <Notice className="mt-4" tone="info">Restored {dateTimeFull(e.restored_at)} by {e.restored_by}.</Notice>}
      <div className="mt-5 overflow-hidden rounded-lg border border-line">
        <table className="tbl w-full text-[13px]">
          <thead className="bg-surface-alt text-left text-[12px] text-faint">
            <tr><th className="c px-3 py-2 font-medium">Field</th>{e.action !== "INSERT" && <th className="c px-3 py-2 font-medium">Before</th>}{e.action !== "DELETE" && <th className="c px-3 py-2 font-medium">After</th>}</tr>
          </thead>
          <tbody className="divide-y divide-line">
            {keys.map((key) => (
              <tr key={key} className="align-top">
                <td className="c whitespace-nowrap px-3 py-2 text-muted">{fieldLabel(key)}</td>
                {e.action !== "INSERT" && <td className="c break-all px-3 py-2">{e.action === "UPDATE" ? <span className="text-danger line-through decoration-danger/40">{show(key, e.old_row?.[key])}</span> : show(key, e.old_row?.[key])}</td>}
                {e.action !== "DELETE" && <td className="c break-all px-3 py-2">{e.action === "UPDATE" ? <span className="font-medium text-success">{show(key, e.new_row?.[key])}</span> : show(key, e.new_row?.[key])}</td>}
              </tr>
            ))}
            {!keys.length && <tr><td colSpan={3} className="px-3 py-6 text-center text-faint">No field values recorded</td></tr>}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}
