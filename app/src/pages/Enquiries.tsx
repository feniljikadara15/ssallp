import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus, Trash2, RotateCcw, ArrowRightCircle, Send, X, MessagesSquare, UserRound, Truck, Boxes, MapPin, Phone, CheckCircle2 } from "lucide-react";
import { api, patch, post, useAction, useGet } from "../api";
import { fmtDate, includes, inRange, inr, today } from "../format";
import { ask, Badge, Button, Card, Checkbox, Combobox, EmptyState, ErrorBox, Field, Input, KV, Loading, Modal, PageHeader, SearchInput, Section, Select, Tabs, Textarea, toast, DateInput } from "../components/ui";
import ListItem, { revealDetail } from "../components/ListItem";
import { ItemsTable } from "../components/ItemsEditor";

type Tab = "0" | "1" | "5";
const TABS: { value: Tab; label: string }[] = [{ value: "0", label: "Ongoing" }, { value: "1", label: "Converted" }, { value: "5", label: "Deleted" }];

export default function Enquiries() {
  const enquiries = useGet<any[]>("enquiries", { refetchInterval: 60_000 });
  const [tab, setTab] = useState<Tab>("0");
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sel, setSel] = useState<number | null>(null);
  const [showNew, setShowNew] = useState(false);

  // ?id=<enquiry> opens it; ?new=1 opens the New Enquiry form.
  const [params, setParams] = useSearchParams();
  useEffect(() => {
    if (params.get("new")) { setShowNew(true); setParams({}, { replace: true }); return; }
    const id = Number(params.get("id"));
    if (!id || !enquiries.data) return;
    const e = enquiries.data.find((x) => x.enquiry_id === id);
    if (e) { setTab(e.enquiry_status); setQ(""); setFrom(""); setTo(""); setSel(id); revealDetail(); }
    setParams({}, { replace: true });
  }, [params, enquiries.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const list = useMemo(
    () => (enquiries.data ?? []).filter((e) => e.enquiry_status === tab && includes(e.customer_name, q) && (tab === "5" || inRange(e.enquiry_date, from, to))),
    [enquiries.data, tab, q, from, to],
  );

  return (
    <div>
      <PageHeader title="Enquiries" description="Customer requests waiting to become orders">
        <Button icon={<Plus />} onClick={() => setShowNew(true)}>New enquiry</Button>
      </PageHeader>
      <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)] items-start [&>*]:min-w-0">
        <Card className="flex flex-col p-3 lg:sticky lg:top-0 lg:max-h-[calc(100vh-120px)]">
          <Tabs value={tab} onChange={(t) => { setTab(t); setSel(null); }} tabs={TABS.map((t) => ({ ...t, count: (enquiries.data ?? []).filter((e) => e.enquiry_status === t.value).length }))} />
          <div className="mt-3 space-y-2">
            <SearchInput value={q} onChange={setQ} placeholder="Search customer" />
            {tab !== "5" && (
              <div className="grid grid-cols-2 gap-2">
                <DateInput aria-label="From date" placeholder="From" value={from} onChange={(e) => setFrom(e.target.value)} />
                <DateInput aria-label="To date" placeholder="To" value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
            )}
          </div>
          <div className="mt-3 flex items-center justify-between px-1 text-2xs text-gray-500">
            <span>{list.length} enquir{list.length === 1 ? "y" : "ies"}</span>
            {(q || from || to) && <button className="font-medium text-primary hover:underline" onClick={() => { setQ(""); setFrom(""); setTo(""); }}>Clear filters</button>}
          </div>
          <div className="-mx-1 mt-1 min-h-[200px] flex-1 space-y-0.5 overflow-y-auto px-1">
            {enquiries.isLoading && <Loading variant="inline" />}
            {enquiries.error && <ErrorBox error={enquiries.error} />}
            {list.map((e) => (
              <ListItem key={e.enquiry_id} active={sel === e.enquiry_id} onClick={() => { setSel(e.enquiry_id); revealDetail(); }}
                title={e.customer_name ?? "—"}
                subtitle={[`EN-${e.enquiry_id}`, e.site_name, `${e.item_count} item${e.item_count === 1 ? "" : "s"}`].filter(Boolean).join(" · ")}
                tag={e.type && <Badge tone={e.type === "External" ? "purple" : "gray"}>{e.type}</Badge>}
                right={fmtDate(e.enquiry_date)}
                rightSub={Number(e.items_value) > 0 ? inr(e.items_value) : undefined} />
            ))}
            {enquiries.data && !list.length && <div className="py-10 text-center text-xs text-gray-400">No enquiries match these filters</div>}
          </div>
        </Card>
        <div id="detail-panel" className="min-w-0 scroll-mt-4">{sel ? <EnquiryDetail id={sel} onMoved={(t) => { setTab(t); if (t === "5" || t === "1") setSel(null); }} /> : <EmptyState icon={<MessagesSquare className="h-5 w-5" />} text="Pick an enquiry on the left to review it and turn it into an order." />}</div>
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

  if (isLoading) return <Card className="p-5"><Loading variant="inline" /></Card>;
  if (error || !e) return <Card className="p-5"><ErrorBox error={error} /></Card>;
  const b = e.billing_address ?? {}, d = e.delivery_address ?? {};
  const total = e.items.reduce((a: number, x: any) => a + Number(x.total_price ?? Number(x.quantity) * Number(x.unit_price)), 0);

  const open = e.enquiry_status === "0";
  const ready = e.warehouse_id != null && e.transporter_id != null;
  const STATUS = { "0": { label: "Ongoing", tone: "orange" }, "1": { label: "Converted to order", tone: "green" }, "5": { label: "Deleted", tone: "red" } } as const;
  const st = STATUS[e.enquiry_status as "0" | "1" | "5"];

  return (
    <div className="min-w-0 space-y-4">
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-2xs font-medium text-gray-500">
              <span>EN-{e.enquiry_id}</span><span className="text-gray-300">/</span><span>{fmtDate(e.enquiry_date)}</span>
              {e.type && <><span className="text-gray-300">/</span><span>{e.type}</span></>}
            </div>
            <h2 className="mt-1 truncate text-xl font-semibold tracking-tight text-secondary">{e.customer_name}</h2>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {st && <Badge dot tone={st.tone}>{st.label}</Badge>}
              {e.tcs_status && <Badge tone="purple">TCS</Badge>}
              {e.delivery_date && <Badge>Deliver by {fmtDate(e.delivery_date)}</Badge>}
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xs font-medium text-gray-500">Enquiry value</div>
            <div className="tabular text-xl font-semibold tracking-tight text-secondary">{inr(total)}</div>
            <div className="text-2xs text-gray-500">{e.items.length} item{e.items.length === 1 ? "" : "s"}</div>
          </div>
        </div>
        {(open || e.enquiry_status === "5") && (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-black/[0.05] pt-4">
            {open && (
              <>
                <Button busy={createOrder.isPending} disabled={!ready} icon={<ArrowRightCircle />} onClick={() => createOrder.mutate(undefined)}>Create order</Button>
                {!ready && <span className="text-2xs text-gray-500">Pick the warehouse and transporter below first</span>}
                <div className="flex-1" />
                <Button variant="danger" busy={del.isPending} icon={<Trash2 />} onClick={async () => (await ask(`Delete enquiry EN-${id}? The customer gets a rejection message on WhatsApp.`, "Delete")) && del.mutate(undefined)}>Delete</Button>
              </>
            )}
            {e.enquiry_status === "5" && <Button variant="success" busy={restore.isPending} icon={<RotateCcw />} onClick={() => restore.mutate(undefined)}>Restore enquiry</Button>}
          </div>
        )}
        {e.enquiry_status === "1" && (
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800"><CheckCircle2 className="h-3.5 w-3.5" /> This enquiry has been converted to an order.</div>
        )}
      </Card>

      {open && (
        <Section title="Transport" icon={<Truck />} description="Choose where it ships from and who carries it">
          <div className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <Field label="Warehouse">
              <Select value={e.warehouse_id ?? ""} disabled={setTransport.isPending} onChange={(ev) => setTransport.mutate({ warehouse_id: ev.target.value || null })}
                placeholder="Select a warehouse" options={(warehouses.data ?? []).map((w) => ({ value: w.warehouse_id, label: w.name }))} />
            </Field>
            <Field label="Transporter">
              <Select value={e.transporter_id ?? ""} disabled={e.warehouse_id == null || setTransport.isPending} onChange={(ev) => setTransport.mutate({ transporter_id: ev.target.value || null })}
                placeholder={e.warehouse_id == null ? "Pick a warehouse first" : "Select a transporter"} options={(transporters.data ?? []).map((t) => ({ value: t.transporter_id, label: t.transporter_name }))} />
            </Field>
            <Button variant="outline" busy={notify.isPending} disabled={e.transporter_id == null} icon={<Send />} onClick={() => notify.mutate(undefined)}>Ask transporter</Button>
          </div>
        </Section>
      )}

      <Section title="Customer and delivery" icon={<UserRound />}>
        <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-4">
          <KV label="Customer" value={e.customer_name} />
          <KV label="Phone" value={[e.customer_phone, e.additional_phone_1, e.additional_phone_2].filter(Boolean).map((p: string) => (
            <a key={p} href={`tel:${p}`} className="mr-2 inline-flex items-center gap-1 hover:text-primary"><Phone className="h-3 w-3" />{p}</a>
          ))} />
          <KV label="GSTIN" value={e.gstin} />
          <KV label="PAN" value={e.pan} />
          <KV label="Site" value={e.site_name} />
          <KV label="Site contact" value={[e.site_person_name, e.site_person_contact].filter(Boolean).join(" · ")} />
          <KV label="Zoho customer ID" value={e.zb_customer_id} />
          <KV label="TCS" value={e.tcs_status ? "Applicable" : "Not applicable"} />
          <KV className="sm:col-span-2" label="Billing address" value={[b.line1, b.line2, b.city, b.state, b.pincode].filter(Boolean).join(", ")} />
          <KV className="sm:col-span-2" label="Delivery address" value={<>
            {[d.line1, d.line2, d.city, d.state, d.pincode].filter(Boolean).join(", ")}
            {d.maps_link && <a className="ml-2 inline-flex items-center gap-1 font-medium text-primary hover:underline" href={d.maps_link} target="_blank" rel="noreferrer"><MapPin className="h-3 w-3" />Map</a>}
          </>} />
          {e.remarks && <KV className="sm:col-span-2 xl:col-span-4" label="Remarks" value={e.remarks} />}
        </div>
      </Section>

      <Section title="Items" icon={<Boxes />} description={open ? "Quantities and prices can be edited until the order is created" : undefined} bodyClassName="p-0">
        <ItemsTable items={e.items} idKey="enquiry_item_id" onSave={open ? (items) => saveItems.mutate(items) : undefined} saving={saveItems.isPending} />
      </Section>
    </div>
  );
}

// ------------------------------------------------------------ New Enquiry

interface Item { product_id: number; category: string; brand: string; grade: string; unit: string; quantity: number; unit_price: number }
type Pick = { id: string | number | null; label: string };
const emptyAddr = { line1: "", line2: "", city: "", state: "Gujarat", pincode: "" };
const H = ({ children }: { children: string }) => (
  <h4 className="mb-3 mt-6 flex items-center gap-3 text-[13px] font-semibold text-secondary first:mt-0">
    {children}<span className="h-px flex-1 bg-black/[0.06]" />
  </h4>
);

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
    <Modal open onClose={onClose} title="New enquiry" size="xl" footer={
      <>
        {missing.length > 0 && <span className="mr-auto self-center text-xs text-gray-500">Still needed: {missing.join(", ")}</span>}
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button busy={create.isPending} disabled={missing.length > 0} onClick={() => create.mutate(undefined)}>Create Enquiry</Button>
      </>
    }>
      <H>Customer information</H>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Customer name" className="sm:col-span-2">
          <Combobox id="enq-customer" value={customer} onChange={(v) => { setCustomer(v); if (v.id === null) setZbId(""); }} placeholder="Select or enter name"
            options={(customers.data ?? []).filter((c) => c.is_active).map((c) => ({ id: c.customer_id, label: c.name, hint: c.phone }))} />
        </Field>
        <Field label="Zoho Books customer ID">
          <div className="flex gap-1.5">
            <Input id="enq-zb" value={zbId} onChange={(e) => { setZbId(e.target.value); setZbCheck(""); }} placeholder="ZB Customer ID" />
            <Button variant="outline" disabled={!zbId} onClick={checkZb}>Check</Button>
          </div>
          {zbCheck && <div className="mt-1 text-[11px] text-gray-500">ZB ID match: {zbCheck}</div>}
        </Field>
        <Field label="Phone"><Input id="enq-phone" value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
        <Field label="Additional phone 1"><Input id="enq-phone1" value={phone1} onChange={(e) => setPhone1(e.target.value)} /></Field>
        <Field label="Additional phone 2"><Input id="enq-phone2" value={phone2} onChange={(e) => setPhone2(e.target.value)} /></Field>
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

      <H>Billing address</H>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Address line 1"><Input id="bill-l1" value={billing.line1} onChange={(e) => setBilling({ ...billing, line1: e.target.value })} placeholder="Enter address line 1" /></Field>
        <Field label="Address line 2"><Input id="bill-l2" value={billing.line2} onChange={(e) => setBilling({ ...billing, line2: e.target.value })} placeholder="Enter address line 2" /></Field>
        <Field label="Pincode"><Input id="bill-pin" value={billing.pincode} onChange={(e) => setBilling({ ...billing, pincode: e.target.value })} placeholder="Enter pincode" /></Field>
        <Field label="City"><Input id="bill-city" value={billing.city} onChange={(e) => setBilling({ ...billing, city: e.target.value })} placeholder="Enter city" /></Field>
        <Field label="State"><Select id="bill-state" value={billing.state} onChange={(e) => setBilling({ ...billing, state: e.target.value })} options={stateOptions} placeholder="Select an option" /></Field>
      </div>

      <H>Delivery address</H>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Site">
          <Combobox id="enq-site" value={site} onChange={pickSite} placeholder="Select or create site" options={sites.map((s) => ({ id: s.site_id, label: s.site_name ?? `Site ${s.site_id}`, hint: s.city }))} />
        </Field>
        <Field label="Site person name"><Input id="site-person" value={delivery.sitePersonName} onChange={(e) => setDelivery({ ...delivery, sitePersonName: e.target.value })} placeholder="Enter site person name" /></Field>
        <Field label="Site person phone"><Input id="site-phone" value={delivery.sitePersonPhone} onChange={(e) => setDelivery({ ...delivery, sitePersonPhone: e.target.value })} /></Field>
        <Field label="Address line 1"><Input id="del-l1" value={delivery.line1} onChange={(e) => setDelivery({ ...delivery, line1: e.target.value })} /></Field>
        <Field label="Address line 2"><Input id="del-l2" value={delivery.line2} onChange={(e) => setDelivery({ ...delivery, line2: e.target.value })} /></Field>
        <Field label="Pincode"><Input id="del-pin" value={delivery.pincode} onChange={(e) => setDelivery({ ...delivery, pincode: e.target.value })} /></Field>
        <Field label="City"><Input id="del-city" value={delivery.city} onChange={(e) => setDelivery({ ...delivery, city: e.target.value })} /></Field>
        <Field label="State"><Select id="del-state" value={delivery.state} onChange={(e) => setDelivery({ ...delivery, state: e.target.value })} options={stateOptions} placeholder="Select an option" /></Field>
        <Field label="Google Maps link"><Input id="del-map" value={delivery.mapsLink} onChange={(e) => setDelivery({ ...delivery, mapsLink: e.target.value })} placeholder="Paste maps link here" /></Field>
        <Field label="Delivery date"><DateInput id="del-date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} /></Field>
      </div>

      <H>Enquiry items</H>
      <div className="grid items-end gap-2 rounded-xl border p-3 sm:grid-cols-6">
        <Field label="Category"><Select id="it-cat" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value, brand: "", grade: "" })} options={categories.map((c) => ({ value: c, label: c }))} placeholder="Select a category" /></Field>
        <Field label="Brand"><Select id="it-brand" value={draft.brand} disabled={!draft.category} onChange={(e) => setDraft({ ...draft, brand: e.target.value, grade: "" })} options={brands.map((c) => ({ value: c, label: c }))} placeholder="Brand" /></Field>
        <Field label="Grade"><Select id="it-grade" value={draft.grade} disabled={!draft.brand} onChange={(e) => setDraft({ ...draft, grade: e.target.value })} options={grades.map((c) => ({ value: c, label: c }))} placeholder="Grade" /></Field>
        <Field label={`Quantity${unit ? ` (${unit})` : ""}`}><Input id="it-qty" type="number" min={0} value={draft.quantity} onChange={(e) => setDraft({ ...draft, quantity: e.target.value })} /></Field>
        <Field label="Price (with tax)">
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
