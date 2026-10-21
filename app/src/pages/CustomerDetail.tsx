import { useState } from "react";
import { useParams } from "react-router-dom";
import { ExternalLink, MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { api, del, patch, post, useAction, useGet } from "../api";
import { fmtDate, num } from "../format";
import { DataTable } from "../components/DataTable";
import { ask, Badge, Button, Checkbox, ErrorBox, Field, Input, KV, Loading, Modal, Notice, PageHeader, Section, Select, StatStrip, Textarea } from "../components/ui";
import { ORDER_STATUS_BADGE } from "./OrderDetail";
import { ENQUIRY_STATUS_BADGE } from "./Enquiries";

const link = "underline decoration-line-strong underline-offset-2 hover:decoration-ink";
const H = ({ children }: { children: string }) => (
  <h3 className="mb-3 mt-6 flex items-center gap-3 text-[12px] font-semibold uppercase tracking-wider text-muted first:mt-0">{children}<span className="h-px flex-1 bg-line" /></h3>
);

export default function CustomerDetail() {
  const id = Number(useParams().id);
  const customers = useGet<any[]>("customers");
  const sites = useGet<any[]>(`customers/${id}/sites`);
  const orders = useGet<any[]>("orders");
  const enquiries = useGet<any[]>("enquiries");
  const cash = useGet<any[]>("cash-bills?tab=pending");
  const [edit, setEdit] = useState(false);
  const [site, setSite] = useState<any | null>(null);

  const c = customers.data?.find((x) => x.customer_id === id);
  if (customers.isLoading) return <div className="page"><Loading /></div>;
  if (customers.error || !c) return <div className="page"><PageHeader title={`Customer #${id}`} breadcrumb={[{ to: "/customers", label: "Customers" }]} /><ErrorBox error={customers.error ?? new Error("This customer doesn't exist.")} /></div>;

  const myOrders = (orders.data ?? []).filter((o) => o.customer_id === id);
  const myEnquiries = (enquiries.data ?? []).filter((e) => e.customer_id === id);
  const myCash = (cash.data ?? []).filter((o) => o.customer_id === id);
  const due = myCash.reduce((s, o) => s + Number(o.total_amount) - Number(o.total_collected), 0);
  const open = myEnquiries.filter((e) => e.enquiry_status === "0").length;
  const billing = [c.billing_line1, c.billing_line2, c.billing_city, c.billing_state, c.billing_pincode].filter(Boolean).join(", ");

  return (
    <div className="page">
      <PageHeader title={c.name} breadcrumb={[{ to: "/customers", label: "Customers" }]}
        status={<><Badge dot tone={c.is_active ? "success" : "neutral"}>{c.is_active ? "Active" : "Inactive"}</Badge>{c.tcs_status && <Badge tone="info">TCS</Badge>}</>}
        subtitle={[`Customer #${c.customer_id}`, c.customer_type, c.zb_customer_id ? "linked to Zoho Books" : "not in Zoho Books"].filter(Boolean).join(", ")}>
        <Button variant="primary" icon={<Pencil />} onClick={() => setEdit(true)}>Edit details</Button>
      </PageHeader>

      {!c.zb_customer_id && <Notice tone="warning">This customer isn't linked to Zoho Books, so their orders can't be invoiced. Import them from Zoho Books to link.</Notice>}

      <StatStrip items={[
        { label: "Orders", value: num(myOrders.filter((o) => o.order_status !== "5").length), hint: c.last_order ? `Last on ${fmtDate(c.last_order)}` : "None yet" },
        { label: "Billed to date", value: `₹${num(c.billed_value ?? 0)}` },
        { label: "Cash due", value: `₹${num(due)}`, tone: due > 0 ? "danger" : undefined, hint: myCash.length ? `${num(myCash.length)} cash bill${myCash.length === 1 ? "" : "s"} open` : "Nothing due" },
        { label: "Open enquiries", value: num(open), to: open ? `/enquiries?customer=${id}` : undefined },
      ]} />

      <Section title="Details">
        <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-4">
          <KV label="Phone" value={[c.phone, c.additional_phone_1, c.additional_phone_2].filter(Boolean).map((p: string, i: number) => <span key={p}>{i > 0 && ", "}<a href={`tel:${p}`} className={link}>{p}</a></span>)} />
          <KV label="Email" value={c.email && <a href={`mailto:${c.email}`} className={link}>{c.email}</a>} />
          <KV label="GSTIN" value={c.gstin} />
          <KV label="PAN" value={c.pan} />
          <KV label="TCS" value={c.tcs_status ? "Applies" : "Does not apply"} />
          <KV label="Zoho customer ID" value={c.zb_customer_id} />
          <KV className="sm:col-span-2" label="Billing address" value={billing} />
          {c.remarks && <KV className="sm:col-span-2 xl:col-span-4" label="Remarks" value={c.remarks} />}
        </div>
      </Section>

      <DataTable title="Sites" filename={`${c.name} sites`} rowKey="site_id" rows={sites.data ?? []} loading={sites.isLoading} search={false} pageSize={10}
        actions={<Button size="sm" icon={<Plus />} onClick={() => setSite({})}>Add site</Button>}
        empty={{ title: "No sites yet", hint: "Sites are the delivery addresses used on enquiries and orders." }}
        rowActions={(r) => [{ kind: "edit", label: `Edit ${r.site_name}`, icon: <Pencil />, onClick: () => setSite(r) }]}
        cols={[
          { key: "site_name", label: "Site" },
          { key: "site_person_name", label: "Site contact", sub: (r) => r.site_person_contact },
          { key: "line1", label: "Address", value: (r) => [r.line1, r.line2].filter(Boolean).join(", "), className: "max-w-[320px] truncate" },
          { key: "city", label: "City", sub: (r) => [r.state, r.pincode].filter(Boolean).join(" ") },
          { key: "maps_link", label: "Map", render: (r) => r.maps_link ? <a href={r.maps_link} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 font-medium text-ink underline decoration-line-strong underline-offset-2 hover:decoration-ink"><MapPin className="h-3.5 w-3.5" />Open</a> : null },
        ]} />

      <DataTable title="Orders" filename={`${c.name} orders`} rowKey="order_id" rows={myOrders} loading={orders.isLoading} pageSize={10}
        rowLink={(r) => `/orders/${r.order_id}`}
        empty={{ title: "No orders yet" }}
        rowActions={(r) => [{ kind: "open", label: `Open order #${r.order_id}`, icon: <ExternalLink />, href: `/orders/${r.order_id}` }]}
        cols={[
          { key: "order_id", label: "Order #", kind: "int", align: "left" },
          { key: "order_date", label: "Ordered", kind: "date" },
          { key: "site_name", label: "Site" },
          { key: "warehouse_name", label: "Warehouse" },
          { key: "payment_type", label: "Billing", value: (r) => (r.order_status === "1" ? "Not billed" : r.payment_type === "cash" ? "Cash bill" : "Invoice"), sub: (r) => r.zb_invoice_number },
          { key: "order_status", label: "Status", value: (r) => ORDER_STATUS_BADGE[r.order_status]?.label, render: (r) => { const s = ORDER_STATUS_BADGE[r.order_status]; return s ? <Badge dot tone={s.tone}>{s.label}</Badge> : null; } },
          { key: "total_amount", label: "Amount (₹)", kind: "money", total: true, value: (r) => r.total_amount ?? r.items_value },
        ]} />

      <DataTable title="Enquiries" filename={`${c.name} enquiries`} rowKey="enquiry_id" rows={myEnquiries} loading={enquiries.isLoading} pageSize={10}
        rowLink={(r) => `/enquiries/${r.enquiry_id}`}
        empty={{ title: "No enquiries yet" }}
        rowActions={(r) => [{ kind: "open", label: `Open enquiry EN-${r.enquiry_id}`, icon: <ExternalLink />, href: `/enquiries/${r.enquiry_id}` }]}
        cols={[
          { key: "enquiry_id", label: "Enquiry", kind: "int", align: "left", render: (r) => `EN-${r.enquiry_id}` },
          { key: "enquiry_date", label: "Received", kind: "date" },
          { key: "site_name", label: "Site" },
          { key: "item_count", label: "Items", kind: "int" },
          { key: "enquiry_status", label: "Status", value: (r) => ENQUIRY_STATUS_BADGE[r.enquiry_status]?.label, render: (r) => { const s = ENQUIRY_STATUS_BADGE[r.enquiry_status]; return s ? <Badge dot tone={s.tone}>{s.label}</Badge> : null; } },
          { key: "items_value", label: "Value (₹)", kind: "money", total: true },
        ]} />

      {edit && <EditCustomerModal customer={c} onClose={() => setEdit(false)} />}
      {site && <SiteModal customerId={id} site={site} onClose={() => setSite(null)} />}
    </div>
  );
}

export function EditCustomerModal({ customer, onClose }: { customer: any; onClose: () => void }) {
  const states = useGet<any[]>("state-codes");
  const [c, setC] = useState({
    name: customer.name ?? "", email: customer.email ?? "", phone: customer.phone ?? "", additional_phone_1: customer.additional_phone_1 ?? "", additional_phone_2: customer.additional_phone_2 ?? "",
    gstin: customer.gstin ?? "", pan: customer.pan ?? "", customer_type: customer.customer_type ?? "", remarks: customer.remarks ?? "", tcs_status: !!customer.tcs_status, is_active: !!customer.is_active,
  });
  const [b, setB] = useState({ line1: customer.billing_line1 ?? "", line2: customer.billing_line2 ?? "", city: customer.billing_city ?? "", state: customer.billing_state ?? "", pincode: customer.billing_pincode ?? "" });
  const save = useAction(() => patch(`customers/${customer.customer_id}`, { ...c, billing: b }), ["customers"], { onSuccess: onClose });
  const set = (p: Partial<typeof c>) => setC({ ...c, ...p });

  return (
    <Modal open onClose={onClose} title={`Edit ${customer.name}`} size="lg"
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" busy={save.isPending} disabled={!c.name.trim()} onClick={() => save.mutate(undefined)}>Save changes</Button></>}>
      <H>Customer</H>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" required className="sm:col-span-2"><Input id="c-name" value={c.name} onChange={(e) => set({ name: e.target.value })} /></Field>
        <Field label="Phone"><Input id="c-phone" value={c.phone} onChange={(e) => set({ phone: e.target.value })} /></Field>
        <Field label="Email"><Input id="c-email" type="email" value={c.email} onChange={(e) => set({ email: e.target.value })} /></Field>
        <Field label="Additional phone 1"><Input id="c-p1" value={c.additional_phone_1} onChange={(e) => set({ additional_phone_1: e.target.value })} /></Field>
        <Field label="Additional phone 2"><Input id="c-p2" value={c.additional_phone_2} onChange={(e) => set({ additional_phone_2: e.target.value })} /></Field>
        <Field label="GSTIN"><Input id="c-gst" value={c.gstin} onChange={(e) => set({ gstin: e.target.value.toUpperCase() })} /></Field>
        <Field label="PAN"><Input id="c-pan" value={c.pan} onChange={(e) => set({ pan: e.target.value.toUpperCase() })} /></Field>
        <Field label="Customer type"><Input id="c-type" value={c.customer_type} onChange={(e) => set({ customer_type: e.target.value })} /></Field>
        <div className="flex flex-col justify-end gap-2 pb-2">
          <Checkbox label="TCS applies" checked={c.tcs_status} onChange={(v) => set({ tcs_status: v })} />
          <Checkbox label="Active" checked={c.is_active} onChange={(v) => set({ is_active: v })} />
        </div>
        <Field label="Remarks" className="sm:col-span-2"><Textarea id="c-remarks" rows={2} value={c.remarks} onChange={(e) => set({ remarks: e.target.value })} /></Field>
      </div>
      <H>Billing address</H>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Address line 1" className="sm:col-span-2"><Input id="b-l1" value={b.line1} onChange={(e) => setB({ ...b, line1: e.target.value })} /></Field>
        <Field label="Address line 2" className="sm:col-span-2"><Input id="b-l2" value={b.line2} onChange={(e) => setB({ ...b, line2: e.target.value })} /></Field>
        <Field label="City"><Input id="b-city" value={b.city} onChange={(e) => setB({ ...b, city: e.target.value })} /></Field>
        <Field label="State"><Select id="b-state" value={b.state} onChange={(e) => setB({ ...b, state: e.target.value })} options={(states.data ?? []).map((s) => ({ value: s.state_name, label: s.state_name }))} placeholder="Select a state" /></Field>
        <Field label="Pincode"><Input id="b-pin" inputMode="numeric" value={b.pincode} onChange={(e) => setB({ ...b, pincode: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}

function SiteModal({ customerId, site, onClose }: { customerId: number; site: any; onClose: () => void }) {
  const isNew = !site.site_id;
  const states = useGet<any[]>("state-codes");
  const [f, setF] = useState({
    site_name: site.site_name ?? "", site_person_name: site.site_person_name ?? "", site_person_contact: site.site_person_contact ?? "+91",
    line1: site.line1 ?? "", line2: site.line2 ?? "", city: site.city ?? "", state: site.state ?? "Gujarat", pincode: site.pincode ?? "", maps_link: site.maps_link ?? "",
  });
  const keys = [`customers`];
  const save = useAction(() => (isNew ? post(`customers/${customerId}/sites`, f) : patch(`sites/${site.site_id}`, f)), keys, { onSuccess: onClose });
  const remove = useAction(() => del(`sites/${site.site_id}`), keys, { onSuccess: onClose });
  const set = (p: Partial<typeof f>) => setF({ ...f, ...p });
  return (
    <Modal open onClose={onClose} title={isNew ? "Add site" : `Edit ${site.site_name}`} size="lg" footer={
      <>
        {!isNew && <Button variant="danger" className="mr-auto" busy={remove.isPending} icon={<Trash2 />} onClick={async () => (await ask(`Delete site ${site.site_name}?`, "Delete site", { body: "Past enquiries and orders keep their address." })) && remove.mutate(undefined)}>Delete site</Button>}
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="primary" busy={save.isPending} disabled={!f.site_name.trim()} onClick={() => save.mutate(undefined)}>{isNew ? "Add site" : "Save changes"}</Button>
      </>
    }>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Site name" required className="sm:col-span-2"><Input id="s-name" value={f.site_name} onChange={(e) => set({ site_name: e.target.value })} /></Field>
        <Field label="Site contact name"><Input id="s-person" value={f.site_person_name} onChange={(e) => set({ site_person_name: e.target.value })} /></Field>
        <Field label="Site contact phone"><Input id="s-contact" value={f.site_person_contact} onChange={(e) => set({ site_person_contact: e.target.value })} /></Field>
        <Field label="Address line 1" className="sm:col-span-2"><Input id="s-l1" value={f.line1} onChange={(e) => set({ line1: e.target.value })} /></Field>
        <Field label="Address line 2" className="sm:col-span-2"><Input id="s-l2" value={f.line2} onChange={(e) => set({ line2: e.target.value })} /></Field>
        <Field label="City"><Input id="s-city" value={f.city} onChange={(e) => set({ city: e.target.value })} /></Field>
        <Field label="State"><Select id="s-state" value={f.state} onChange={(e) => set({ state: e.target.value })} options={(states.data ?? []).map((s) => ({ value: s.state_name, label: s.state_name }))} placeholder="Select a state" /></Field>
        <Field label="Pincode"><Input id="s-pin" inputMode="numeric" value={f.pincode} onChange={(e) => set({ pincode: e.target.value })} /></Field>
        <Field label="Google Maps link"><Input id="s-map" value={f.maps_link} onChange={(e) => set({ maps_link: e.target.value })} placeholder="https://maps.google.com/..." /></Field>
      </div>
    </Modal>
  );
}

export function ImportModal({ onClose }: { onClose: () => void }) {
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
    <Modal open onClose={onClose} title="Import a customer from Zoho Books" footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" busy={imp.isPending} disabled={!zbId.trim() || check?.valid === false} onClick={() => imp.mutate(undefined)}>Import</Button></>}>
      <Field label="Zoho Books customer ID" hint="Imports the contact with its billing and shipping addresses. Importing an existing customer again updates it.">
        <div className="flex gap-2">
          <Input id="imp-zb" value={zbId} onChange={(e) => { setZbId(e.target.value); setCheck(null); }} placeholder="e.g. 1234567000000123456" />
          <Button busy={checking} disabled={!zbId.trim()} onClick={validate}>Check</Button>
        </div>
      </Field>
      {check && <Notice className="mt-4" tone={check.valid ? "success" : "danger"} title={check.valid ? check.name ?? "Found in Zoho Books" : "Not found"}>{check.message}</Notice>}
    </Modal>
  );
}
