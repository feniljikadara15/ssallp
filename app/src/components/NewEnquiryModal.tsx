import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { api, post, useAction, useGet } from "../api";
import { fmtDate, inr, today } from "../format";
import { Button, Checkbox, Combobox, DateInput, Field, Input, Modal, Select, Textarea, toast } from "./ui";

// New enquiry: the Retool "Create Enquiry" form. An existing customer fills in
// their details and sites; typing a new name creates the customer.
interface Item { product_id: number; category: string; brand: string; grade: string; unit: string; quantity: number; unit_price: number }
type Pick = { id: string | number | null; label: string };
const emptyAddr = { line1: "", line2: "", city: "", state: "Gujarat", pincode: "" };
const H = ({ children }: { children: string }) => (
  <h3 className="mb-3 mt-6 flex items-center gap-3 text-[12px] font-semibold uppercase tracking-wider text-faint first:mt-0">
    {children}<span className="h-px flex-1 bg-line" />
  </h3>
);

export function NewEnquiryModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: number) => void }) {
  const customers = useGet<any[]>("customer-names");
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
        {missing.length > 0 && <span className="mr-auto text-[12px] text-faint">Still needed: {missing.join(", ")}</span>}
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant="primary" busy={create.isPending} disabled={missing.length > 0} onClick={() => create.mutate(undefined)}>Create enquiry</Button>
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
            <Input id="enq-zb" value={zbId} onChange={(e) => { setZbId(e.target.value); setZbCheck(""); }} placeholder="Optional" />
            <Button disabled={!zbId} onClick={checkZb}>Check</Button>
          </div>
          {zbCheck && <div className="mt-1 text-[12px] text-faint">Zoho Books: {zbCheck}</div>}
        </Field>
        <Field label="Phone"><Input id="enq-phone" value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
        <Field label="Additional phone 1"><Input id="enq-phone1" value={phone1} onChange={(e) => setPhone1(e.target.value)} /></Field>
        <Field label="Additional phone 2"><Input id="enq-phone2" value={phone2} onChange={(e) => setPhone2(e.target.value)} /></Field>
        <Field label="GSTIN">
          <Input id="enq-gstin" value={gstNA ? "" : gstin} disabled={gstNA} onChange={(e) => setGstin(e.target.value.toUpperCase())} placeholder="15 characters" />
          <div className="mt-2"><Checkbox label="No GSTIN" checked={gstNA} onChange={setGstNA} /></div>
        </Field>
        <Field label="PAN">
          <Input id="enq-pan" value={panNA ? "" : pan} disabled={panNA} onChange={(e) => setPan(e.target.value.toUpperCase())} placeholder="10 characters" />
          <div className="mt-2"><Checkbox label="No PAN" checked={panNA} onChange={setPanNA} /></div>
        </Field>
        <Field label="TCS"><div className="flex h-9 items-center"><Checkbox label="TCS applies to this customer" checked={tcs} onChange={setTcs} /></div></Field>
      </div>

      <H>Billing address</H>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Address line 1"><Input id="bill-l1" value={billing.line1} onChange={(e) => setBilling({ ...billing, line1: e.target.value })} /></Field>
        <Field label="Address line 2"><Input id="bill-l2" value={billing.line2} onChange={(e) => setBilling({ ...billing, line2: e.target.value })} /></Field>
        <Field label="Pincode"><Input id="bill-pin" value={billing.pincode} onChange={(e) => setBilling({ ...billing, pincode: e.target.value })} /></Field>
        <Field label="City"><Input id="bill-city" value={billing.city} onChange={(e) => setBilling({ ...billing, city: e.target.value })} /></Field>
        <Field label="State"><Select id="bill-state" value={billing.state} onChange={(e) => setBilling({ ...billing, state: e.target.value })} options={stateOptions} placeholder="Select a state" /></Field>
      </div>

      <H>Delivery address</H>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Site">
          <Combobox id="enq-site" value={site} onChange={pickSite} placeholder="Select or create site" options={sites.map((s) => ({ id: s.site_id, label: s.site_name ?? `Site ${s.site_id}`, hint: s.city }))} />
        </Field>
        <Field label="Site person name"><Input id="site-person" value={delivery.sitePersonName} onChange={(e) => setDelivery({ ...delivery, sitePersonName: e.target.value })} /></Field>
        <Field label="Site person phone"><Input id="site-phone" value={delivery.sitePersonPhone} onChange={(e) => setDelivery({ ...delivery, sitePersonPhone: e.target.value })} /></Field>
        <Field label="Address line 1"><Input id="del-l1" value={delivery.line1} onChange={(e) => setDelivery({ ...delivery, line1: e.target.value })} /></Field>
        <Field label="Address line 2"><Input id="del-l2" value={delivery.line2} onChange={(e) => setDelivery({ ...delivery, line2: e.target.value })} /></Field>
        <Field label="Pincode"><Input id="del-pin" value={delivery.pincode} onChange={(e) => setDelivery({ ...delivery, pincode: e.target.value })} /></Field>
        <Field label="City"><Input id="del-city" value={delivery.city} onChange={(e) => setDelivery({ ...delivery, city: e.target.value })} /></Field>
        <Field label="State"><Select id="del-state" value={delivery.state} onChange={(e) => setDelivery({ ...delivery, state: e.target.value })} options={stateOptions} placeholder="Select a state" /></Field>
        <Field label="Google Maps link"><Input id="del-map" value={delivery.mapsLink} onChange={(e) => setDelivery({ ...delivery, mapsLink: e.target.value })} placeholder="Paste a Google Maps link" /></Field>
        <Field label="Delivery date"><DateInput id="del-date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} /></Field>
      </div>

      <H>Enquiry items</H>
      <div className="grid items-end gap-3 rounded-lg border border-line bg-surface-alt p-3 sm:grid-cols-6">
        <Field label="Category"><Select id="it-cat" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value, brand: "", grade: "" })} options={categories.map((c) => ({ value: c, label: c }))} placeholder="Category" /></Field>
        <Field label="Brand"><Select id="it-brand" value={draft.brand} disabled={!draft.category} onChange={(e) => setDraft({ ...draft, brand: e.target.value, grade: "" })} options={brands.map((c) => ({ value: c, label: c }))} placeholder="Brand" /></Field>
        <Field label="Grade"><Select id="it-grade" value={draft.grade} disabled={!draft.brand} onChange={(e) => setDraft({ ...draft, grade: e.target.value })} options={grades.map((c) => ({ value: c, label: c }))} placeholder="Grade" /></Field>
        <Field label={`Quantity${unit ? ` (${unit})` : ""}`}><Input id="it-qty" type="number" min={0} value={draft.quantity} onChange={(e) => setDraft({ ...draft, quantity: e.target.value })} /></Field>
        <Field label="Price with tax (₹)" hint={ltp.data?.unit_price ? `Last: ${inr(ltp.data.unit_price)} on ${fmtDate(ltp.data.order_date)}` : product ? "No earlier price" : undefined}>
          <Input id="it-price" type="number" min={0} value={draft.price} onChange={(e) => setDraft({ ...draft, price: e.target.value })} />
        </Field>
        <div className={ltp.data?.unit_price || product ? "pb-[22px]" : ""}><Button className="w-full" icon={<Plus />} onClick={addItem}>Add item</Button></div>
      </div>
      {items.length > 0 && (
        <div className="mt-3 overflow-x-auto rounded-lg border border-line">
          <table className="tbl w-full text-[13px]">
            <thead className="bg-surface-alt"><tr className="border-b border-line text-[12px] text-faint">
              <th className="c px-3 py-2 pl-4 text-left font-medium">Product</th><th className="c px-3 py-2 text-right font-medium">Quantity</th>
              <th className="c px-3 py-2 text-right font-medium">Price (₹)</th><th className="c px-3 py-2 text-right font-medium">Amount (₹)</th><th className="w-10" />
            </tr></thead>
            <tbody className="divide-y divide-line tabular-nums">
              {items.map((it, i) => (
                <tr key={i}>
                  <td className="c h-10 px-3 pl-4"><span className="font-medium text-ink">{it.brand} {it.grade}</span> <span className="text-faint">{it.category}</span></td>
                  <td className="c px-3 text-right">{it.quantity} <span className="text-faint">{it.unit}</span></td><td className="c px-3 text-right">{inr(it.unit_price)}</td>
                  <td className="c px-3 text-right font-medium">{inr(it.quantity * it.unit_price)}</td>
                  <td className="px-1"><button aria-label={`Remove ${it.brand} ${it.grade}`} title="Remove" className="btn-icon btn-icon-danger" onClick={() => setItems(items.filter((_, j) => j !== i))}><X className="h-4 w-4" /></button></td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-surface-alt"><tr className="border-t border-line-strong font-medium"><td className="c h-10 px-3 pl-4" colSpan={3}>Total</td><td className="c px-3 text-right tabular-nums">{inr(items.reduce((a, x) => a + x.quantity * x.unit_price, 0))}</td><td /></tr></tfoot>
          </table>
        </div>
      )}
      <Field label="Remarks" className="mt-4"><Textarea id="enq-remarks" rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} /></Field>
    </Modal>
  );
}
