import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, RotateCcw, ArrowRightCircle, Send, X } from "lucide-react";
import { api, patch, post, useAction, useGet } from "../api";
import { fmtDate, includes, inRange, inr, today } from "../format";
import { ask, Badge, Button, Card, Checkbox, Combobox, EmptyState, ErrorBox, Field, Input, KV, Loading, Modal, PageHeader, SearchInput, Select, Tabs, Textarea, toast, DateInput } from "../components/ui";
import ListItem, { revealDetail } from "../components/ListItem";
import { ItemsTable } from "../components/ItemsEditor";

type Tab = "0" | "1" | "5";
const TABS: { value: Tab; label: string }[] = [{ value: "0", label: "Ongoing" }, { value: "1", label: "Past" }, { value: "5", label: "Deleted" }];

export default function Enquiries() {
  const enquiries = useGet<any[]>("enquiries", { refetchInterval: 60_000 });
  const [tab, setTab] = useState<Tab>("0");
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sel, setSel] = useState<number | null>(null);
  const [showNew, setShowNew] = useState(false);

  const list = useMemo(
    () => (enquiries.data ?? []).filter((e) => e.enquiry_status === tab && includes(e.customer_name, q) && (tab === "5" || inRange(e.enquiry_date, from, to))),
    [enquiries.data, tab, q, from, to],
  );

  return (
    <div>
      <PageHeader title="Enquiries">
        <Button icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setShowNew(true)}>New</Button>
      </PageHeader>
      <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)] [&>*]:min-w-0">
        <Card className="p-3">
          <Tabs value={tab} onChange={(t) => { setTab(t); setSel(null); }} tabs={TABS.map((t) => ({ ...t, count: (enquiries.data ?? []).filter((e) => e.enquiry_status === t.value).length }))} />
          <div className="mt-3 space-y-2">
            <SearchInput value={q} onChange={setQ} placeholder="Search by Customer" />
            {tab !== "5" && (
              <div className="grid grid-cols-2 gap-2">
                <DateInput aria-label="From date" value={from} onChange={(e) => setFrom(e.target.value)} />
                <DateInput aria-label="To date" value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
            )}
          </div>
          <div className="mt-3 max-h-[calc(100vh-300px)] space-y-2 overflow-y-auto pr-1">
            {enquiries.isLoading && <Loading />}
            {enquiries.error && <ErrorBox error={enquiries.error} />}
            {list.map((e) => (
              <ListItem key={e.enquiry_id} active={sel === e.enquiry_id} onClick={() => { setSel(e.enquiry_id); revealDetail(); }}
                title={`EN - ${e.enquiry_id} - ${e.customer_name ?? ""}`}
                tag={e.type && <Badge tone={e.type === "External" ? "purple" : "blue"}>{e.type}</Badge>}
                right={fmtDate(e.enquiry_date)} />
            ))}
            {enquiries.data && !list.length && <div className="py-8 text-center text-xs text-gray-400">No enquiries</div>}
          </div>
        </Card>
        <div id="detail-panel" className="min-w-0 scroll-mt-4">{sel ? <EnquiryDetail id={sel} onMoved={(t) => { setTab(t); if (t === "5" || t === "1") setSel(null); }} /> : <EmptyState text="Select an enquiry to view details" />}</div>
      </div>
      {showNew && <NewEnquiryModal onClose={() => setShowNew(false)} onCreated={(id) => { setTab("0"); setSel(id); }} />}
    </div>
  );
}

function EnquiryDetail({ id, onMoved }: { id: number; onMoved: (t: Tab) => void }) {
  const { data: e, error, isLoading } = useGet<any>(`enquiries/${id}`);
  const warehouses = useGet<any[]>("warehouses");
  const transporters = useGet<any[]>(e?.warehouse_id ? `warehouses/${e.warehouse_id}/transporter-options` : null);
  const del = useAction(() => post(`enquiries/${id}/delete`), ["enquiries"], { onSuccess: () => onMoved("5") });
  const restore = useAction(() => post(`enquiries/${id}/restore`), ["enquiries"], { onSuccess: () => onMoved("0") });
  const createOrder = useAction(() => post(`enquiries/${id}/create-order`), ["enquiries", "orders", "dashboard"], { onSuccess: () => onMoved("1") });
  const setTransport = useAction((body: object) => patch(`enquiries/${id}/transport`, body), ["enquiries"], { quiet: true });
  const saveItems = useAction((items: Record<string, unknown>[]) => patch(`enquiries/${id}/items`, { items }), ["enquiries"]);
  const notify = useAction(() => post(`enquiries/${id}/notify-transporter`), [], { onSuccess: (r) => toast(r.note ?? "Enquiry sent to transporter", r.sent === false ? "warn" : "ok") });

  if (isLoading) return <Card className="p-5"><Loading /></Card>;
  if (error || !e) return <Card className="p-5"><ErrorBox error={error} /></Card>;
  const b = e.billing_address ?? {}, d = e.delivery_address ?? {};
  const total = e.items.reduce((a: number, x: any) => a + Number(x.total_price ?? Number(x.quantity) * Number(x.unit_price)), 0);

  return (
    <Card className="min-w-0 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-medium text-secondary">Enquiry #{e.enquiry_id}</h2>
          <div className="text-xs text-gray-500">{fmtDate(e.enquiry_date)}{e.type && ` · ${e.type}`}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          {e.enquiry_status === "0" && (
            <>
              <Button variant="danger" busy={del.isPending} icon={<Trash2 className="h-3.5 w-3.5" />} onClick={async () => (await ask(`Delete enquiry #${id}? The customer gets a rejection message on WhatsApp.`, "Delete")) && del.mutate(undefined)}>Delete Enquiry</Button>
              <Button busy={createOrder.isPending} disabled={e.warehouse_id == null || e.transporter_id == null} title={e.warehouse_id == null || e.transporter_id == null ? "Set the warehouse and transporter first" : undefined}
                icon={<ArrowRightCircle className="h-3.5 w-3.5" />} onClick={() => createOrder.mutate(undefined)}>Create Order</Button>
            </>
          )}
          {e.enquiry_status === "5" && <Button variant="success" busy={restore.isPending} icon={<RotateCcw className="h-3.5 w-3.5" />} onClick={() => restore.mutate(undefined)}>Restore</Button>}
        </div>
      </div>

      <h3 className="mb-2 mt-5 text-sm font-medium text-secondary">Customer Information</h3>
      <div className="grid grid-cols-2 gap-4 rounded-xl bg-gray-50 p-4 md:grid-cols-4">
        <KV label="Customer" value={e.customer_name} />
        <KV label="Phone" value={[e.customer_phone, e.additional_phone_1, e.additional_phone_2].filter(Boolean).join(", ")} />
        <KV label="GSTIN" value={e.gstin} />
        <KV label="PAN" value={e.pan} />
        <KV label="ZB Customer ID" value={e.zb_customer_id} />
        <KV label="TCS" value={e.tcs_status ? "Applicable" : "No"} />
        <KV label="Billing Address" value={[b.line1, b.line2, b.city, b.state, b.pincode].filter(Boolean).join(", ")} />
        <KV label="Delivery Date" value={fmtDate(e.delivery_date)} />
        <KV label="Site" value={e.site_name} />
        <KV label="Site Person" value={[e.site_person_name, e.site_person_contact].filter(Boolean).join(" · ")} />
        <KV label="Delivery Address" value={[d.line1, d.line2, d.city, d.state, d.pincode].filter(Boolean).join(", ")} />
        <KV label="Map" value={d.maps_link ? <a className="text-info underline" href={d.maps_link} target="_blank" rel="noreferrer">Open map</a> : null} />
        {e.remarks && <KV label="Remarks" value={e.remarks} />}
      </div>

      <div className="mt-4 rounded-xl border p-4">
        <h3 className="text-sm font-medium text-secondary">Transport Details</h3>
        <p className="mb-3 text-xs text-gray-500">Assign a transporter and set delivery details</p>
        <div className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <Field label="Warehouse">
            <Select value={e.warehouse_id ?? ""} disabled={e.enquiry_status !== "0" || setTransport.isPending} onChange={(ev) => setTransport.mutate({ warehouse_id: ev.target.value || null })}
              placeholder="Select a warehouse" options={(warehouses.data ?? []).map((w) => ({ value: w.warehouse_id, label: w.name }))} />
          </Field>
          <Field label="Transporter">
            <Select value={e.transporter_id ?? ""} disabled={e.enquiry_status !== "0" || e.warehouse_id == null || setTransport.isPending} onChange={(ev) => setTransport.mutate({ transporter_id: ev.target.value || null })}
              placeholder="Select an option" options={(transporters.data ?? []).map((t) => ({ value: t.transporter_id, label: t.transporter_name }))} />
          </Field>
          <Button variant="secondary" busy={notify.isPending} disabled={e.transporter_id == null} icon={<Send className="h-3.5 w-3.5" />} onClick={() => notify.mutate(undefined)}>Notify Transporter</Button>
        </div>
      </div>

      <div className="mb-2 mt-5 flex items-center justify-between">
        <h3 className="text-sm font-medium text-secondary">Enquiry Items</h3>
        <span className="text-xs text-gray-500">Total {inr(total)}</span>
      </div>
      <ItemsTable items={e.items} idKey="enquiry_item_id" onSave={e.enquiry_status === "0" ? (items) => saveItems.mutate(items) : undefined} saving={saveItems.isPending} />
    </Card>
  );
}

// ------------------------------------------------------------ New Enquiry

interface Item { product_id: number; category: string; brand: string; grade: string; unit: string; quantity: number; unit_price: number }
type Pick = { id: string | number | null; label: string };
const emptyAddr = { line1: "", line2: "", city: "", state: "Gujarat", pincode: "" };
const H = ({ children }: { children: string }) => <h4 className="mb-2 mt-5 text-xs font-bold uppercase tracking-wide text-gray-500 first:mt-0">{children}</h4>;

function NewEnquiryModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: number) => void }) {
  const customers = useGet<any[]>("customers");
  const products = useGet<any[]>("products");
  const states = useGet<any[]>("state-codes");

  const [customer, setCustomer] = useState<Pick>({ id: null, label: "" });
  const [zbId, setZbId] = useState("");
  const [zbCheck, setZbCheck] = useState<string>("");
  const [phone, setPhone] = useState("+91");
  const [phone1, setPhone1] = useState("+91");
  const [phone2, setPhone2] = useState("+91");
  const [gstin, setGstin] = useState("");
  const [gstNA, setGstNA] = useState(false);
  const [pan, setPan] = useState("");
  const [panNA, setPanNA] = useState(false);
  const [tcs, setTcs] = useState(false);
  const [billing, setBilling] = useState(emptyAddr);
  const [site, setSite] = useState<Pick>({ id: null, label: "" });
  const [delivery, setDelivery] = useState({ ...emptyAddr, sitePersonName: "", sitePersonPhone: "+91", mapsLink: "" });
  const [deliveryDate, setDeliveryDate] = useState(today());
  const [remarks, setRemarks] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [draft, setDraft] = useState({ category: "", brand: "", grade: "", quantity: "", price: "" });

  const defaults = useGet<any>(typeof customer.id === "number" ? `customers/${customer.id}/enquiry-defaults` : null);
  const sites: any[] = defaults.data?.sites ?? [];

  // Fill in the customer's details when an existing customer is picked
  useEffect(() => {
    const d = defaults.data;
    if (!d?.customer) return;
    const c = d.customer;
    setPhone(c.phone ?? "+91"); setPhone1(c.additional_phone_1 ?? "+91"); setPhone2(c.additional_phone_2 ?? "+91");
    setGstin(c.gstin ?? ""); setGstNA(!c.gstin); setPan(c.pan ?? ""); setPanNA(!c.pan); setTcs(!!c.tcs_status); setZbId(c.zb_customer_id ?? "");
    if (d.billing) setBilling({ line1: d.billing.line1 ?? "", line2: d.billing.line2 ?? "", city: d.billing.city ?? "", state: d.billing.state ?? "Gujarat", pincode: d.billing.pincode ?? "" });
    setSite({ id: null, label: "" });
  }, [defaults.data]);

  const pickSite = (v: Pick) => {
    setSite(v);
    const s = sites.find((x) => x.site_id === v.id);
    if (s) setDelivery({ line1: s.line1 ?? "", line2: s.line2 ?? "", city: s.city ?? "", state: s.state ?? "Gujarat", pincode: s.pincode ?? "", sitePersonName: s.site_person_name ?? "", sitePersonPhone: s.site_person_contact ?? "+91", mapsLink: s.maps_link ?? "" });
  };

  const active = (products.data ?? []).filter((p) => p.is_active);
  const categories = [...new Set(active.map((p) => p.category).filter(Boolean))].sort();
  const brands = [...new Set(active.filter((p) => p.category === draft.category).map((p) => p.brand))].sort();
  const grades = [...new Set(active.filter((p) => p.category === draft.category && p.brand === draft.brand).map((p) => p.grade))].sort();
  const product = active.find((p) => p.category === draft.category && p.brand === draft.brand && p.grade === draft.grade);
  const unit = [...new Set(active.filter((p) => p.category === draft.category).map((p) => p.unit))][0] ?? "";
  const ltp = useGet<any>(product ? `last-price?product_id=${product.product_id}&customer_id=${typeof customer.id === "number" ? customer.id : ""}&phone=${encodeURIComponent(phone)}` : null);

  const addItem = () => {
    if (!product) return toast("Pick category, brand and grade", "warn");
    if (!(Number(draft.quantity) > 0) || !(Number(draft.price) > 0)) return toast("Enter quantity and price", "warn");
    setItems([...items, { product_id: product.product_id, category: product.category, brand: product.brand, grade: product.grade, unit: product.unit, quantity: Number(draft.quantity), unit_price: Number(draft.price) }]);
    setDraft({ category: "", brand: "", grade: "", quantity: "", price: "" });
  };

  const checkZb = async () => {
    try { const r = await api(`zoho/contacts/${encodeURIComponent(zbId)}`); setZbCheck(r.valid ? `${r.name} · ${r.message}` : `Invalid: ${r.message}`); }
    catch (e) { setZbCheck((e as Error).message); }
  };

  const create = useAction(
    () => post("enquiries", {
      customerID: customer.id ?? customer.label, customerName: customer.label, zb_customer_id: zbId || null,
      customerPhone: phone, additionalPhone1: phone1, additionalPhone2: phone2,
      gstin: gstNA ? null : gstin, pan: panNA ? null : pan, tcsStatus: tcs,
      billingAddress: billing,
      deliveryAddress: { siteId: site.id, siteName: site.label, ...delivery },
      items: items.map(({ product_id, quantity, unit_price }) => ({ product_id, quantity, unit_price })),
      deliveryDate, remarks, source: "Internal",
    }),
    ["enquiries", "customers", "dashboard"],
    { onSuccess: (r) => { toast("Enquiry created"); onCreated(r.enquiry_id); onClose(); } },
  );

  const missing = [!customer.label.trim() && "customer", phone.replace("+91", "").trim().length < 10 && "phone", !site.label.trim() && "site", !items.length && "items"].filter(Boolean);
  const stateOptions = (states.data ?? []).map((s) => ({ value: s.state_name, label: s.state_name }));

  return (
    <Modal open onClose={onClose} title="New Enquiry" size="xl" footer={
      <>
        {missing.length > 0 && <span className="mr-auto self-center text-xs text-gray-500">Still needed: {missing.join(", ")}</span>}
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button busy={create.isPending} disabled={missing.length > 0} onClick={() => create.mutate(undefined)}>Create Enquiry</Button>
      </>
    }>
      <H>Customer Information</H>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Customer Name" className="sm:col-span-2">
          <Combobox id="enq-customer" value={customer} onChange={(v) => { setCustomer(v); if (v.id === null) setZbId(""); }} placeholder="Select or enter name"
            options={(customers.data ?? []).filter((c) => c.is_active).map((c) => ({ id: c.customer_id, label: c.name, hint: c.phone }))} />
        </Field>
        <Field label="Zoho Books Customer ID">
          <div className="flex gap-1.5">
            <Input id="enq-zb" value={zbId} onChange={(e) => { setZbId(e.target.value); setZbCheck(""); }} placeholder="ZB Customer ID" />
            <Button variant="outline" disabled={!zbId} onClick={checkZb}>Check</Button>
          </div>
          {zbCheck && <div className="mt-1 text-[11px] text-gray-500">ZB ID match: {zbCheck}</div>}
        </Field>
        <Field label="Phone"><Input id="enq-phone" value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
        <Field label="Additional Phone 1"><Input id="enq-phone1" value={phone1} onChange={(e) => setPhone1(e.target.value)} /></Field>
        <Field label="Additional Phone 2"><Input id="enq-phone2" value={phone2} onChange={(e) => setPhone2(e.target.value)} /></Field>
        <Field label="GSTIN">
          <Input id="enq-gstin" value={gstNA ? "" : gstin} disabled={gstNA} onChange={(e) => setGstin(e.target.value.toUpperCase())} placeholder="Enter GSTIN" />
          <div className="mt-1"><Checkbox label="GST Not Applicable" checked={gstNA} onChange={setGstNA} /></div>
        </Field>
        <Field label="PAN">
          <Input id="enq-pan" value={panNA ? "" : pan} disabled={panNA} onChange={(e) => setPan(e.target.value.toUpperCase())} placeholder="Enter PAN" />
          <div className="mt-1"><Checkbox label="PAN Not Applicable" checked={panNA} onChange={setPanNA} /></div>
        </Field>
        <Field label="TCS"><div className="pt-1.5"><Checkbox label="TCS Applicable?" checked={tcs} onChange={setTcs} /></div></Field>
      </div>

      <H>Billing Address</H>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Address Line 1"><Input id="bill-l1" value={billing.line1} onChange={(e) => setBilling({ ...billing, line1: e.target.value })} placeholder="Enter address line 1" /></Field>
        <Field label="Address Line 2"><Input id="bill-l2" value={billing.line2} onChange={(e) => setBilling({ ...billing, line2: e.target.value })} placeholder="Enter address line 2" /></Field>
        <Field label="Pincode"><Input id="bill-pin" value={billing.pincode} onChange={(e) => setBilling({ ...billing, pincode: e.target.value })} placeholder="Enter pincode" /></Field>
        <Field label="City"><Input id="bill-city" value={billing.city} onChange={(e) => setBilling({ ...billing, city: e.target.value })} placeholder="Enter city" /></Field>
        <Field label="State"><Select id="bill-state" value={billing.state} onChange={(e) => setBilling({ ...billing, state: e.target.value })} options={stateOptions} placeholder="Select an option" /></Field>
      </div>

      <H>Delivery Address</H>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Site">
          <Combobox id="enq-site" value={site} onChange={pickSite} placeholder="Select or create site" options={sites.map((s) => ({ id: s.site_id, label: s.site_name ?? `Site ${s.site_id}`, hint: s.city }))} />
        </Field>
        <Field label="Site Person Name"><Input id="site-person" value={delivery.sitePersonName} onChange={(e) => setDelivery({ ...delivery, sitePersonName: e.target.value })} placeholder="Enter site person name" /></Field>
        <Field label="Site Person Phone"><Input id="site-phone" value={delivery.sitePersonPhone} onChange={(e) => setDelivery({ ...delivery, sitePersonPhone: e.target.value })} /></Field>
        <Field label="Address Line 1"><Input id="del-l1" value={delivery.line1} onChange={(e) => setDelivery({ ...delivery, line1: e.target.value })} /></Field>
        <Field label="Address Line 2"><Input id="del-l2" value={delivery.line2} onChange={(e) => setDelivery({ ...delivery, line2: e.target.value })} /></Field>
        <Field label="Pincode"><Input id="del-pin" value={delivery.pincode} onChange={(e) => setDelivery({ ...delivery, pincode: e.target.value })} /></Field>
        <Field label="City"><Input id="del-city" value={delivery.city} onChange={(e) => setDelivery({ ...delivery, city: e.target.value })} /></Field>
        <Field label="State"><Select id="del-state" value={delivery.state} onChange={(e) => setDelivery({ ...delivery, state: e.target.value })} options={stateOptions} placeholder="Select an option" /></Field>
        <Field label="Google Maps Link"><Input id="del-map" value={delivery.mapsLink} onChange={(e) => setDelivery({ ...delivery, mapsLink: e.target.value })} placeholder="Paste maps link here" /></Field>
        <Field label="Delivery Date"><DateInput id="del-date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} /></Field>
      </div>

      <H>Enquiry Items</H>
      <div className="grid items-end gap-2 rounded-xl border p-3 sm:grid-cols-6">
        <Field label="Category"><Select id="it-cat" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value, brand: "", grade: "" })} options={categories.map((c) => ({ value: c, label: c }))} placeholder="Select a category" /></Field>
        <Field label="Brand"><Select id="it-brand" value={draft.brand} disabled={!draft.category} onChange={(e) => setDraft({ ...draft, brand: e.target.value, grade: "" })} options={brands.map((c) => ({ value: c, label: c }))} placeholder="Brand" /></Field>
        <Field label="Grade"><Select id="it-grade" value={draft.grade} disabled={!draft.brand} onChange={(e) => setDraft({ ...draft, grade: e.target.value })} options={grades.map((c) => ({ value: c, label: c }))} placeholder="Grade" /></Field>
        <Field label={`Quantity${unit ? ` (${unit})` : ""}`}><Input id="it-qty" type="number" min={0} value={draft.quantity} onChange={(e) => setDraft({ ...draft, quantity: e.target.value })} /></Field>
        <Field label="Price (with Tax)">
          <Input id="it-price" type="number" min={0} value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} />
        </Field>
        <div>
          <div className="mb-1 text-[11px] text-gray-500">Last Price: {ltp.data?.unit_price ? `${inr(ltp.data.unit_price)} (${fmtDate(ltp.data.order_date)})` : "—"}</div>
          <Button className="w-full" variant="secondary" icon={<Plus className="h-3.5 w-3.5" />} onClick={addItem}>Add item</Button>
        </div>
      </div>
      {items.length > 0 && (
        <div className="mt-2 overflow-x-auto rounded-xl border">
          <table className="w-full text-xs">
            <tbody className="tabular-nums">
              {items.map((it, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="px-3 py-2">{it.category}</td><td className="px-3 py-2">{it.brand}</td><td className="px-3 py-2">{it.grade}</td>
                  <td className="px-3 py-2 text-right">{it.quantity} {it.unit}</td><td className="px-3 py-2 text-right">{inr(it.unit_price)}</td>
                  <td className="px-3 py-2 text-right font-medium">{inr(it.quantity * it.unit_price)}</td>
                  <td className="w-8 px-2"><button aria-label="Remove item" className="rounded p-1 text-red-700 hover:bg-red-50" onClick={() => setItems(items.filter((_, j) => j !== i))}><X className="h-3.5 w-3.5" /></button></td>
                </tr>
              ))}
              <tr className="bg-gray-50"><td colSpan={5} className="px-3 py-2 text-right font-medium">Total</td><td className="px-3 py-2 text-right font-bold">{inr(items.reduce((a, x) => a + x.quantity * x.unit_price, 0))}</td><td /></tr>
            </tbody>
          </table>
        </div>
      )}
      <Field label="Remarks" className="mt-3"><Textarea id="enq-remarks" rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} /></Field>
    </Modal>
  );
}
