import { useMemo, useState } from "react";
import { Download, Pencil, Plus, Users, UserCheck, MapPin } from "lucide-react";
import { useStore, nextId, downloadCsv } from "../data/store";
import type { Customer, Site } from "../data/types";
import { Badge, Button, Card, DataTable, Field, Input, Modal, PageHeader, SearchInput, Select, Stat, Textarea, useToast } from "../components/ui";

const blank = (): Customer => ({ customer_id: 0, name: "", email: "", phone: "", additional_phone_1: "", additional_phone_2: "", gstin: "", pan: "", tcs_status: false, customer_type: "Business", zb_customer_id: "", remarks: "", is_active: true, created_at: new Date().toISOString() });

export default function Customers() {
  const { db } = useStore();
  const [q, setQ] = useState("");
  const [active, setActive] = useState("");
  const [edit, setEdit] = useState<Customer | null>(null);
  const [sitesFor, setSitesFor] = useState<Customer | null>(null);
  const toast = useToast();

  const rows = useMemo(
    () =>
      db.customers
        .filter((c) => !active || String(c.is_active) === active)
        .filter((c) => !q || [c.name, c.phone, c.gstin, c.pan, c.zb_customer_id].join(" ").toLowerCase().includes(q.toLowerCase())),
    [db.customers, q, active],
  );

  return (
    <div>
      <PageHeader title="Customers">
        <Button variant="outline" icon={<Download className="h-3.5 w-3.5" />} onClick={() => downloadCsv("customers.csv", rows as never)}>Download</Button>
        <Button variant="secondary" onClick={() => toast("Import from Zoho Books will connect once the backend API is live")}>Import Customer</Button>
        <Button icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setEdit(blank())}>Add Customer</Button>
      </PageHeader>
      <div className="mb-4 grid gap-4 sm:grid-cols-2">
        <Stat label="Active Customer Count" value={db.customers.filter((c) => c.is_active).length} icon={<UserCheck className="h-5 w-5" />} />
        <Stat label="Total Customer Count" value={db.customers.length} icon={<Users className="h-5 w-5" />} />
      </div>
      <Card>
        <div className="flex flex-wrap gap-2 border-b p-3">
          <div className="w-72"><SearchInput value={q} onChange={setQ} placeholder="Search Customers..." /></div>
          <div className="w-48"><Select value={active} onChange={(e) => setActive(e.target.value)} placeholder="Filter by Active/Inactive" options={[{ value: "true", label: "Active" }, { value: "false", label: "In Active" }]} /></div>
        </div>
        <DataTable rows={rows} rowKey={(r) => r.customer_id} pageSize={15} columns={[
          { key: "customer_id", label: "Customer ID" },
          { key: "name", label: "Name", render: (r) => <span className="font-medium">{r.name}</span> },
          { key: "phone", label: "Phone" },
          { key: "gstin", label: "GSTIN" },
          { key: "pan", label: "PAN" },
          { key: "tcs_status", label: "TCS", render: (r) => (r.tcs_status ? <Badge tone="purple">Yes</Badge> : <Badge>No</Badge>) },
          { key: "zb_customer_id", label: "ZB Customer ID" },
          { key: "is_active", label: "Is Active", render: (r) => <Badge tone={r.is_active ? "green" : "red"}>{r.is_active ? "Active" : "Inactive"}</Badge> },
          { key: "action", label: "Action", render: (r) => (
            <div className="flex gap-1">
              <Button variant="ghost" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => setEdit(r)}>Edit</Button>
              <Button variant="ghost" icon={<MapPin className="h-3.5 w-3.5" />} onClick={() => setSitesFor(r)}>Sites</Button>
            </div>
          ) },
        ]} />
      </Card>
      {edit && <CustomerModal customer={edit} onClose={() => setEdit(null)} />}
      {sitesFor && <SitesModal customer={sitesFor} onClose={() => setSitesFor(null)} />}
    </div>
  );
}

function CustomerModal({ customer, onClose }: { customer: Customer; onClose: () => void }) {
  const { db, update } = useStore();
  const toast = useToast();
  const [c, setC] = useState(customer);
  const addr0 = db.addresses.find((a) => a.customer_id === customer.customer_id);
  const [addr, setAddr] = useState({ line1: addr0?.line1 ?? "", line2: addr0?.line2 ?? "", city: addr0?.city ?? "", state: addr0?.state ?? "Gujarat", pincode: addr0?.pincode ?? "" });
  const set = (p: Partial<Customer>) => setC({ ...c, ...p });
  const isNew = !customer.customer_id;
  const save = () => {
    update((d) => {
      if (isNew) {
        const id = nextId(d.customers, "customer_id");
        d.customers.push({ ...c, customer_id: id });
        d.addresses.push({ address_id: nextId(d.addresses, "address_id"), customer_id: id, ...addr });
      } else {
        Object.assign(d.customers.find((x) => x.customer_id === c.customer_id)!, c);
        const a = d.addresses.find((x) => x.customer_id === c.customer_id);
        if (a) Object.assign(a, addr);
        else d.addresses.push({ address_id: nextId(d.addresses, "address_id"), customer_id: c.customer_id, ...addr });
      }
    });
    toast(isNew ? "Customer created" : "Customer updated");
    onClose();
  };
  return (
    <Modal open onClose={onClose} title={isNew ? "Add Customer" : `Edit ${customer.name}`} size="lg" footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={!c.name || !c.phone} onClick={save}>Save</Button></>}>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Name" className="sm:col-span-2"><Input value={c.name} onChange={(e) => set({ name: e.target.value })} /></Field>
        <Field label="Customer Type"><Select value={c.customer_type} onChange={(e) => set({ customer_type: e.target.value as Customer["customer_type"] })} options={[{ value: "Business", label: "Business" }, { value: "Individual", label: "Individual" }]} /></Field>
        <Field label="Phone"><Input value={c.phone} onChange={(e) => set({ phone: e.target.value })} /></Field>
        <Field label="Additional Phone 1"><Input value={c.additional_phone_1} onChange={(e) => set({ additional_phone_1: e.target.value })} /></Field>
        <Field label="Additional Phone 2"><Input value={c.additional_phone_2} onChange={(e) => set({ additional_phone_2: e.target.value })} /></Field>
        <Field label="Email"><Input value={c.email} onChange={(e) => set({ email: e.target.value })} /></Field>
        <Field label="GSTIN"><Input value={c.gstin} onChange={(e) => set({ gstin: e.target.value.toUpperCase() })} /></Field>
        <Field label="PAN"><Input value={c.pan} onChange={(e) => set({ pan: e.target.value.toUpperCase() })} /></Field>
        <Field label="ZB Customer ID"><Input value={c.zb_customer_id} onChange={(e) => set({ zb_customer_id: e.target.value })} /></Field>
        <Field label="TCS Applicable?"><Select value={String(c.tcs_status)} onChange={(e) => set({ tcs_status: e.target.value === "true" })} options={[{ value: "false", label: "No" }, { value: "true", label: "Yes" }]} /></Field>
        <Field label="Status"><Select value={String(c.is_active)} onChange={(e) => set({ is_active: e.target.value === "true" })} options={[{ value: "true", label: "Active" }, { value: "false", label: "Inactive" }]} /></Field>
      </div>
      <h4 className="mb-2 mt-5 text-xs font-bold uppercase tracking-wide text-gray-500">Billing Address</h4>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Address Line 1" className="sm:col-span-2"><Input value={addr.line1} onChange={(e) => setAddr({ ...addr, line1: e.target.value })} /></Field>
        <Field label="Address Line 2"><Input value={addr.line2} onChange={(e) => setAddr({ ...addr, line2: e.target.value })} /></Field>
        <Field label="City"><Input value={addr.city} onChange={(e) => setAddr({ ...addr, city: e.target.value })} /></Field>
        <Field label="State"><Input value={addr.state} onChange={(e) => setAddr({ ...addr, state: e.target.value })} /></Field>
        <Field label="Pincode"><Input value={addr.pincode} onChange={(e) => setAddr({ ...addr, pincode: e.target.value })} /></Field>
      </div>
      <Field label="Remarks" className="mt-3"><Textarea rows={2} value={c.remarks} onChange={(e) => set({ remarks: e.target.value })} /></Field>
    </Modal>
  );
}

function SitesModal({ customer, onClose }: { customer: Customer; onClose: () => void }) {
  const { db, update } = useStore();
  const empty: Omit<Site, "site_id" | "customer_id"> = { site_name: "", site_person_name: "", site_person_contact: "", maps_link: "", line1: "", city: "", state: "Gujarat", pincode: "" };
  const [form, setForm] = useState(empty);
  const sites = db.sites.filter((s) => s.customer_id === customer.customer_id);
  return (
    <Modal open onClose={onClose} title={`Sites · ${customer.name}`} size="lg">
      <Card>
        <DataTable rows={sites} rowKey={(r) => r.site_id} empty="No sites" columns={[
          { key: "site_name", label: "Site" },
          { key: "site_person_name", label: "Site Person" },
          { key: "site_person_contact", label: "Contact" },
          { key: "city", label: "City" },
          { key: "maps_link", label: "Map", render: (r) => r.maps_link ? <a className="text-info underline" href={r.maps_link} target="_blank" rel="noreferrer">Open</a> : "—" },
          { key: "del", label: "", render: (r) => <Button variant="ghost" className="text-red-700" onClick={() => update((d) => { d.sites = d.sites.filter((s) => s.site_id !== r.site_id); })}>Delete</Button> },
        ]} />
      </Card>
      <h4 className="mb-2 mt-4 text-xs font-bold uppercase tracking-wide text-gray-500">Add Site</h4>
      <div className="grid gap-2 sm:grid-cols-3">
        <Input placeholder="Site name" value={form.site_name} onChange={(e) => setForm({ ...form, site_name: e.target.value })} />
        <Input placeholder="Site person name" value={form.site_person_name} onChange={(e) => setForm({ ...form, site_person_name: e.target.value })} />
        <Input placeholder="Site person phone" value={form.site_person_contact} onChange={(e) => setForm({ ...form, site_person_contact: e.target.value })} />
        <Input placeholder="Address" value={form.line1} onChange={(e) => setForm({ ...form, line1: e.target.value })} />
        <Input placeholder="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
        <Input placeholder="Google Maps link" value={form.maps_link} onChange={(e) => setForm({ ...form, maps_link: e.target.value })} />
      </div>
      <div className="mt-3 text-right">
        <Button disabled={!form.site_name} icon={<Plus className="h-3.5 w-3.5" />} onClick={() => { update((d) => { d.sites.push({ ...form, site_id: nextId(d.sites, "site_id"), customer_id: customer.customer_id }); }); setForm(empty); }}>Add Site</Button>
      </div>
    </Modal>
  );
}
