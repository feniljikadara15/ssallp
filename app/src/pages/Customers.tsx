import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Download, Pencil, Plus, Import, Trash2 } from "lucide-react";
import { api, del, patch, post, useAction, useGet } from "../api";
import { exportRows } from "../format";
import { ask, Badge, Button, Card, Checkbox, DataTable, ErrorBox, Field, Input, Loading, Modal, PageHeader, SearchInput, Select, Textarea, toast } from "../components/ui";

export default function Customers() {
  const customers = useGet<any[]>("customers");
  const [q, setQ] = useState("");
  // ?q=<name> from global search
  const [params, setParams] = useSearchParams();
  useEffect(() => { const v = params.get("q"); if (v) { setQ(v); setParams({}, { replace: true }); } }, [params]); // eslint-disable-line react-hooks/exhaustive-deps
  const [active, setActive] = useState("");
  const [edit, setEdit] = useState<any | null>(null);
  const [importing, setImporting] = useState(false);

  const all = customers.data ?? [];
  const rows = useMemo(() => all
    .filter((c) => !active || String(c.is_active) === active)
    .filter((c) => !q.trim() || [c.name, c.phone, c.gstin, c.pan, c.zb_customer_id, c.customer_id].join(" ").toLowerCase().includes(q.trim().toLowerCase())), [all, q, active]);

  return (
    <div>
      <PageHeader title="Customers" description={customers.data ? `${all.filter((c) => c.is_active).length} active of ${all.length} customers` : "Parties, their billing details and sites"}>
        <Button variant="outline" icon={<Download />} onClick={() => exportRows(rows.map(({ customer_id, name, phone, gstin, pan, tcs_status, zb_customer_id, is_active }) => ({ customer_id, name, phone, gstin, pan, tcs: tcs_status ? "Yes" : "No", zb_customer_id, is_active })), "Customers", "csv").catch((e) => toast(e.message, "error"))}>Export</Button>
        <Button icon={<Import />} onClick={() => setImporting(true)}>Import from Zoho</Button>
      </PageHeader>
      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b border-black/[0.05] p-3">
          <div className="w-full sm:w-80"><SearchInput value={q} onChange={setQ} placeholder="Search name, phone, GSTIN or PAN" /></div>
          <div className="w-full sm:w-44"><Select value={active} onChange={(e) => setActive(e.target.value)} placeholder="All statuses" options={[{ value: "true", label: "Active" }, { value: "false", label: "Inactive" }]} /></div>
          <span className="ml-auto text-2xs text-gray-500">{rows.length} shown</span>
        </div>
        {customers.error && <div className="p-3"><ErrorBox error={customers.error} /></div>}
        {customers.isLoading ? <div className="p-4"><Loading variant="inline" /></div> : (
          <DataTable rows={rows} rowKey={(r: any) => r.customer_id} pageSize={15} onRowClick={(r: any) => setEdit(r)} empty="No customers match" columns={[
            { key: "name", label: "Customer", render: (r: any) => (
              <div className="flex min-w-[200px] items-center gap-3">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-secondary/[0.06] text-2xs font-semibold text-secondary/70">{String(r.name ?? "?").split(/\s+/).map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()}</div>
                <div className="min-w-0">
                  <div className="truncate font-medium text-secondary">{r.name}</div>
                  <div className="text-2xs text-gray-500">#{r.customer_id}{r.zb_customer_id ? " · In Zoho" : ""}</div>
                </div>
              </div>
            ) },
            { key: "phone", label: "Phone", className: "tabular" },
            { key: "gstin", label: "GSTIN", render: (r: any) => r.gstin || <span className="text-gray-300">—</span> },
            { key: "pan", label: "PAN", render: (r: any) => r.pan || <span className="text-gray-300">—</span> },
            { key: "tcs_status", label: "TCS", render: (r: any) => (r.tcs_status ? <Badge tone="purple">TCS</Badge> : <span className="text-gray-300">—</span>) },
            { key: "is_active", label: "Status", render: (r: any) => <Badge dot tone={r.is_active ? "green" : "gray"}>{r.is_active ? "Active" : "Inactive"}</Badge> },
            { key: "action", label: "", align: "right", render: (r: any) => <Button variant="ghost" aria-label={`Edit ${r.name}`} icon={<Pencil />} onClick={(e) => { e.stopPropagation(); setEdit(r); }} /> },
          ]} />
        )}
      </Card>
      {edit && <EditCustomerModal customer={edit} onClose={() => setEdit(null)} />}
      {importing && <ImportModal onClose={() => setImporting(false)} />}
    </div>
  );
}

function EditCustomerModal({ customer, onClose }: { customer: any; onClose: () => void }) {
  const states = useGet<any[]>("state-codes");
  const sites = useGet<any[]>(`customers/${customer.customer_id}/sites`);
  const [c, setC] = useState({
    name: customer.name ?? "", email: customer.email ?? "", phone: customer.phone ?? "", additional_phone_1: customer.additional_phone_1 ?? "", additional_phone_2: customer.additional_phone_2 ?? "",
    gstin: customer.gstin ?? "", pan: customer.pan ?? "", customer_type: customer.customer_type ?? "", remarks: customer.remarks ?? "", tcs_status: !!customer.tcs_status, is_active: !!customer.is_active,
  });
  const [b, setB] = useState({ line1: customer.billing_line1 ?? "", line2: customer.billing_line2 ?? "", city: customer.billing_city ?? "", state: customer.billing_state ?? "", pincode: customer.billing_pincode ?? "" });
  const [site, setSite] = useState<any | null>(null);
  const save = useAction(() => patch(`customers/${customer.customer_id}`, { ...c, billing: b }), ["customers"], { onSuccess: onClose });
  const set = (p: Partial<typeof c>) => setC({ ...c, ...p });
  const stateOptions = (states.data ?? []).map((s) => ({ value: s.state_name, label: s.state_name }));

  return (
    <Modal open onClose={onClose} title={`Edit ${customer.name}`} size="xl"
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button busy={save.isPending} disabled={!c.name.trim()} onClick={() => save.mutate(undefined)}>Save</Button></>}>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Name"><Input id="c-name" value={c.name} onChange={(e) => set({ name: e.target.value })} /></Field>
        <Field label="Email"><Input id="c-email" value={c.email} onChange={(e) => set({ email: e.target.value })} /></Field>
        <Field label="Phone"><Input id="c-phone" value={c.phone} onChange={(e) => set({ phone: e.target.value })} /></Field>
        <Field label="Additional phone 1"><Input id="c-p1" value={c.additional_phone_1} onChange={(e) => set({ additional_phone_1: e.target.value })} /></Field>
        <Field label="Additional phone 2"><Input id="c-p2" value={c.additional_phone_2} onChange={(e) => set({ additional_phone_2: e.target.value })} /></Field>
        <Field label="GST"><Input id="c-gst" value={c.gstin} onChange={(e) => set({ gstin: e.target.value.toUpperCase() })} /></Field>
        <Field label="PAN"><Input id="c-pan" value={c.pan} onChange={(e) => set({ pan: e.target.value.toUpperCase() })} /></Field>
        <Field label="Customer type"><Input id="c-type" value={c.customer_type} onChange={(e) => set({ customer_type: e.target.value })} /></Field>
        <div className="flex flex-col justify-end gap-2 pb-1">
          <Checkbox label="TCS Applicability" checked={c.tcs_status} onChange={(v) => set({ tcs_status: v })} />
          <Checkbox label="Customer Active" checked={c.is_active} onChange={(v) => set({ is_active: v })} />
        </div>
        <Field label="Remarks" className="sm:col-span-3"><Textarea id="c-remarks" rows={2} value={c.remarks} onChange={(e) => set({ remarks: e.target.value })} /></Field>
      </div>

      <h4 className="mb-2 mt-5 text-xs font-bold uppercase tracking-wide text-gray-500">Billing Address</h4>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Address line 1"><Input id="b-l1" value={b.line1} onChange={(e) => setB({ ...b, line1: e.target.value })} /></Field>
        <Field label="Address line 2"><Input id="b-l2" value={b.line2} onChange={(e) => setB({ ...b, line2: e.target.value })} /></Field>
        <Field label="Pincode"><Input id="b-pin" value={b.pincode} onChange={(e) => setB({ ...b, pincode: e.target.value })} /></Field>
        <Field label="City"><Input id="b-city" value={b.city} onChange={(e) => setB({ ...b, city: e.target.value })} /></Field>
        <Field label="State"><Select id="b-state" value={b.state} onChange={(e) => setB({ ...b, state: e.target.value })} options={stateOptions} placeholder="Select a state" /></Field>
      </div>

      <div className="mb-2 mt-5 flex items-center justify-between">
        <h4 className="text-xs font-bold uppercase tracking-wide text-gray-500">Site Details</h4>
        <Button variant="outline" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setSite({})}>Add Site</Button>
      </div>
      <Card>
        {sites.isLoading ? <Loading /> : (
          <DataTable rows={sites.data ?? []} rowKey={(r: any) => r.site_id} empty="No sites" columns={[
            { key: "site_id", label: "Site ID" },
            { key: "site_name", label: "Site Name" },
            { key: "site_person_name", label: "Site Person Name" },
            { key: "site_person_contact", label: "Contact" },
            { key: "city", label: "City" },
            { key: "pincode", label: "Pincode" },
            { key: "maps_link", label: "Google Map Link", render: (r: any) => (r.maps_link ? <a className="text-info underline" href={r.maps_link} target="_blank" rel="noreferrer">Open</a> : "—") },
            { key: "action", label: "Action", render: (r: any) => <Button variant="ghost" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => setSite(r)}>Edit</Button> },
          ]} />
        )}
      </Card>
      {site && <SiteModal customerId={customer.customer_id} site={site} states={stateOptions} onClose={() => setSite(null)} />}
    </Modal>
  );
}

function SiteModal({ customerId, site, states, onClose }: { customerId: number; site: any; states: { value: string; label: string }[]; onClose: () => void }) {
  const isNew = !site.site_id;
  const [f, setF] = useState({
    site_name: site.site_name ?? "", site_person_name: site.site_person_name ?? "", site_person_contact: site.site_person_contact ?? "+91",
    line1: site.line1 ?? "", line2: site.line2 ?? "", city: site.city ?? "", state: site.state ?? "Gujarat", pincode: site.pincode ?? "", maps_link: site.maps_link ?? "",
  });
  const keys = [`customers/${customerId}/sites`, "customers"];
  const save = useAction(() => (isNew ? post(`customers/${customerId}/sites`, f) : patch(`sites/${site.site_id}`, f)), keys, { onSuccess: onClose });
  const remove = useAction(() => del(`sites/${site.site_id}`), keys, { onSuccess: onClose });
  const set = (p: Partial<typeof f>) => setF({ ...f, ...p });
  return (
    <Modal open onClose={onClose} title={isNew ? "Add Site" : "Edit Site Details"} size="lg" footer={
      <>
        {!isNew && <Button variant="danger" className="mr-auto" busy={remove.isPending} icon={<Trash2 className="h-3.5 w-3.5" />} onClick={async () => (await ask(`Delete site ${site.site_name}?`, "Delete")) && remove.mutate(undefined)}>Delete</Button>}
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button busy={save.isPending} disabled={!f.site_name.trim()} onClick={() => save.mutate(undefined)}>Save</Button>
      </>
    }>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Site name"><Input id="s-name" value={f.site_name} onChange={(e) => set({ site_name: e.target.value })} /></Field>
        <Field label="Site person name"><Input id="s-person" value={f.site_person_name} onChange={(e) => set({ site_person_name: e.target.value })} /></Field>
        <Field label="Site person contact"><Input id="s-contact" value={f.site_person_contact} onChange={(e) => set({ site_person_contact: e.target.value })} /></Field>
        <Field label="Address line 1"><Textarea id="s-l1" rows={2} value={f.line1} onChange={(e) => set({ line1: e.target.value })} /></Field>
        <Field label="Address line 2"><Textarea id="s-l2" rows={2} value={f.line2} onChange={(e) => set({ line2: e.target.value })} /></Field>
        <Field label="Map link"><Input id="s-map" value={f.maps_link} onChange={(e) => set({ maps_link: e.target.value })} /></Field>
        <Field label="City"><Input id="s-city" value={f.city} onChange={(e) => set({ city: e.target.value })} /></Field>
        <Field label="State"><Select id="s-state" value={f.state} onChange={(e) => set({ state: e.target.value })} options={states} placeholder="Select a state" /></Field>
        <Field label="Pincode"><Input id="s-pin" value={f.pincode} onChange={(e) => set({ pincode: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}

function ImportModal({ onClose }: { onClose: () => void }) {
  const [zbId, setZbId] = useState("");
  const [check, setCheck] = useState<{ valid: boolean; message: string; name?: string } | null>(null);
  const [checking, setChecking] = useState(false);
  const imp = useAction(() => post("customers/import", { zb_customer_id: zbId.trim() }), ["customers"], { onSuccess: onClose });
  const validate = async () => {
    setChecking(true);
    try { setCheck(await api(`zoho/contacts/${encodeURIComponent(zbId.trim())}`)); } catch (e) { setCheck({ valid: false, message: (e as Error).message }); }
    setChecking(false);
  };
  return (
    <Modal open onClose={onClose} title="Import single customer from Zoho Books" footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button busy={imp.isPending} disabled={!zbId.trim() || check?.valid === false} onClick={() => imp.mutate(undefined)}>Import</Button></>}>
      <Field label="Zoho Books customer ID">
        <div className="flex gap-2">
          <Input id="imp-zb" value={zbId} onChange={(e) => { setZbId(e.target.value); setCheck(null); }} placeholder="e.g. 1234567000000123456" />
          <Button variant="outline" busy={checking} disabled={!zbId.trim()} onClick={validate}>Check Validity</Button>
        </div>
      </Field>
      {check && <div className="mt-3"><Badge tone={check.valid ? "green" : "red"}>{check.valid ? "Valid" : "Invalid"}</Badge> <span className="text-xs text-gray-600">{check.name ? `${check.name} · ` : ""}{check.message}</span></div>}
      <p className="mt-3 text-[11px] text-gray-500">Imports the contact with its billing and shipping addresses. Importing an existing customer again updates it.</p>
    </Modal>
  );
}
