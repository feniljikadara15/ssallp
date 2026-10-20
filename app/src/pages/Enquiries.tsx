import { useMemo, useState } from "react";
import { Plus, Trash2, RotateCcw, ArrowRightCircle } from "lucide-react";
import { useStore, fmtDate, inr, nextId } from "../data/store";
import { customerName, siteOf, addressOf, warehouseName, transporterName, lineTotal } from "../data/lookups";
import type { Enquiry, LineItem, PaymentType } from "../data/types";
import { Badge, Button, Card, EmptyState, Field, Input, KV, Modal, PageHeader, SearchInput, Select, Tabs, Textarea, useToast, ask } from "../components/ui";
import ListItem from "../components/ListItem";
import ItemsEditor, { ItemsTable } from "../components/ItemsEditor";

type Tab = "ongoing" | "past" | "deleted";

export default function Enquiries() {
  const { db, update } = useStore();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("ongoing");
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sel, setSel] = useState<number | null>(null);
  const [showNew, setShowNew] = useState(false);

  const inTab = (e: Enquiry, t: Tab) => (t === "deleted" ? !e.is_active : e.is_active && (t === "ongoing" ? e.enquiry_status === "ongoing" : e.enquiry_status !== "ongoing"));
  const list = useMemo(
    () =>
      db.enquiries
        .filter((e) => inTab(e, tab))
        .filter((e) => !q || customerName(db, e.customer_id).toLowerCase().includes(q.toLowerCase()))
        .filter((e) => (!from || e.enquiry_date >= from) && (!to || e.enquiry_date.slice(0, 10) <= to))
        .sort((a, b) => b.enquiry_date.localeCompare(a.enquiry_date)),
    [db, tab, q, from, to],
  );
  const enq = db.enquiries.find((e) => e.enquiry_id === sel);

  const setActive = (active: boolean) => {
    update((d) => { d.enquiries.find((e) => e.enquiry_id === sel)!.is_active = active; });
    toast(active ? "Enquiry restored" : "Enquiry deleted");
  };

  const createOrder = () => {
    if (!enq) return;
    update((d) => {
      const e = d.enquiries.find((x) => x.enquiry_id === enq.enquiry_id)!;
      e.enquiry_status = "converted";
      const id = nextId(d.orders, "order_id");
      const yy = new Date().getFullYear() % 100;
      d.orders.push({
        order_id: id, order_number: `SO/${yy}-${yy + 1}/${String(d.orders.length + 101).padStart(4, "0")}`,
        enquiry_id: e.enquiry_id, order_date: new Date().toISOString(), payment_type: e.type, order_status: "ongoing",
        total_amount: lineTotal(e.items), billing_address_id: e.billing_address_id, site_id: e.site_id,
        otp: String(1000 + Math.floor(Math.random() * 9000)), invoice_id: null, transporter_id: e.transporter_id,
        vehicle_id: null, customer_id: e.customer_id, warehouse_id: e.warehouse_id, po_number: "", sub_dealer: "",
        delivery_terms: "Delivered at Site", is_active: true, items: e.items.map((x) => ({ ...x })),
      });
    });
    toast("Order created from enquiry");
  };

  return (
    <div>
      <PageHeader title="Enquiries">
        <Button icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setShowNew(true)}>New</Button>
      </PageHeader>
      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <Card className="p-3">
          <Tabs
            value={tab}
            onChange={(t) => { setTab(t); setSel(null); }}
            tabs={(["ongoing", "past", "deleted"] as Tab[]).map((t) => ({ value: t, label: t[0].toUpperCase() + t.slice(1), count: db.enquiries.filter((e) => inTab(e, t)).length }))}
          />
          <div className="mt-3 space-y-2">
            <SearchInput value={q} onChange={setQ} placeholder="Search by Customer" />
            <div className="grid grid-cols-2 gap-2">
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} title="From" />
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} title="To" />
            </div>
          </div>
          <div className="mt-3 max-h-[calc(100vh-300px)] space-y-2 overflow-y-auto pr-1">
            {list.map((e) => (
              <ListItem
                key={e.enquiry_id}
                active={sel === e.enquiry_id}
                onClick={() => setSel(e.enquiry_id)}
                title={`EN - ${e.enquiry_id} - ${customerName(db, e.customer_id)}`}
                tag={<Badge tone={e.type === "cash" ? "yellow" : "blue"}>{e.type}</Badge>}
                right={fmtDate(e.enquiry_date)}
              />
            ))}
            {!list.length && <div className="py-8 text-center text-xs text-gray-400">No enquiries</div>}
          </div>
        </Card>

        {!enq ? (
          <EmptyState text="Select an enquiry to view details" />
        ) : (
          <Card className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-medium text-secondary">Enquiry #{enq.enquiry_id}</h2>
                <div className="text-xs text-gray-500">{customerName(db, enq.customer_id)} · {fmtDate(enq.enquiry_date)}</div>
              </div>
              <div className="flex gap-2">
                {enq.is_active ? (
                  <>
                    <Button variant="danger" icon={<Trash2 className="h-3.5 w-3.5" />} onClick={async () => await ask("Delete this enquiry?") && setActive(false)}>Delete Enquiry</Button>
                    {enq.enquiry_status === "ongoing" && <Button icon={<ArrowRightCircle className="h-3.5 w-3.5" />} onClick={createOrder}>Create Order</Button>}
                  </>
                ) : (
                  <Button variant="success" icon={<RotateCcw className="h-3.5 w-3.5" />} onClick={() => setActive(true)}>Restore</Button>
                )}
              </div>
            </div>
            <EnquirySummary enq={enq} />
            <h3 className="mb-2 mt-5 text-sm font-medium text-secondary">Enquiry Items</h3>
            <div className="overflow-x-auto rounded-xl border"><ItemsTable items={enq.items} /></div>
          </Card>
        )}
      </div>
      {showNew && <NewEnquiryModal onClose={() => setShowNew(false)} onCreated={(id) => { setTab("ongoing"); setSel(id); }} />}
    </div>
  );
}

function EnquirySummary({ enq }: { enq: Enquiry }) {
  const { db } = useStore();
  const c = db.customers.find((x) => x.customer_id === enq.customer_id);
  const site = siteOf(db, enq.site_id);
  const addr = addressOf(db, enq.billing_address_id);
  return (
    <div className="mt-4 grid grid-cols-2 gap-4 rounded-xl bg-gray-50 p-4 md:grid-cols-4">
      <KV label="Customer" value={c?.name} />
      <KV label="Phone" value={c?.phone} />
      <KV label="GSTIN" value={c?.gstin} />
      <KV label="Payment" value={<Badge tone={enq.type === "cash" ? "yellow" : "blue"}>{enq.type}</Badge>} />
      <KV label="Billing Address" value={addr && `${addr.line1}, ${addr.city}`} />
      <KV label="Site" value={site?.site_name} />
      <KV label="Site Person" value={site && `${site.site_person_name} (${site.site_person_contact})`} />
      <KV label="Delivery Date" value={fmtDate(enq.delivery_date)} />
      <KV label="Warehouse" value={warehouseName(db, enq.warehouse_id)} />
      <KV label="Transporter" value={transporterName(db, enq.transporter_id)} />
      <KV label="Total" value={inr(lineTotal(enq.items))} />
      <KV label="Remarks" value={enq.remarks} />
    </div>
  );
}

function NewEnquiryModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: number) => void }) {
  const { db, update } = useStore();
  const toast = useToast();
  const [customerId, setCustomerId] = useState<number | "">("");
  const [type, setType] = useState<PaymentType>("credit");
  const [siteId, setSiteId] = useState<number | "">("");
  const [warehouseId, setWarehouseId] = useState<number | "">("");
  const [transporterId, setTransporterId] = useState<number | "">("");
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().slice(0, 10));
  const [remarks, setRemarks] = useState("");
  const [items, setItems] = useState<LineItem[]>([{ item_id: 1, product_id: 0, category: "", brand: "", grade: "", quantity: 0, unit: "", unit_price: 0 }]);

  const c = db.customers.find((x) => x.customer_id === customerId);
  const addr = c && addressOf(db, c.customer_id);
  const sites = db.sites.filter((s) => s.customer_id === customerId);
  const site = sites.find((s) => s.site_id === siteId);
  const valid = c && siteId && items.length && items.every((i) => i.product_id && i.quantity > 0 && i.unit_price > 0);

  const save = () => {
    const id = nextId(db.enquiries, "enquiry_id");
    update((d) => {
      d.enquiries.push({
        enquiry_id: id, customer_id: Number(customerId), enquiry_date: new Date().toISOString(), enquiry_status: "ongoing", type,
        billing_address_id: Number(customerId), site_id: Number(siteId), remarks, warehouse_id: warehouseId ? Number(warehouseId) : null,
        transporter_id: transporterId ? Number(transporterId) : null, delivery_date: new Date(deliveryDate).toISOString(), is_active: true,
        items: items.map((x, i) => ({ ...x, item_id: Date.now() + i })),
      });
    });
    toast(`Enquiry #${id} created`);
    onCreated(id);
    onClose();
  };

  return (
    <Modal open onClose={onClose} title="New Enquiry" size="lg" footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={!valid} onClick={save}>Submit Enquiry</Button></>}>
      <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">Customer Information</h4>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Customer Name" className="sm:col-span-2">
          <Select value={customerId} onChange={(e) => { setCustomerId(e.target.value ? Number(e.target.value) : ""); setSiteId(""); }} placeholder="Select customer" options={db.customers.filter((x) => x.is_active).map((x) => ({ value: x.customer_id, label: x.name }))} />
        </Field>
        <Field label="Zoho Books Customer ID"><Input readOnly value={c?.zb_customer_id ?? ""} placeholder="ZB Customer ID" /></Field>
        <Field label="Phone"><Input readOnly value={c?.phone ?? ""} /></Field>
        <Field label="GSTIN"><Input readOnly value={c?.gstin ?? ""} /></Field>
        <Field label="PAN"><Input readOnly value={c?.pan ?? ""} /></Field>
        <Field label="Payment Type">
          <Select value={type} onChange={(e) => setType(e.target.value as PaymentType)} options={[{ value: "credit", label: "Credit" }, { value: "cash", label: "Cash" }]} />
        </Field>
        <Field label="TCS Applicable?"><Input readOnly value={c ? (c.tcs_status ? "Yes" : "No") : ""} /></Field>
      </div>
      <h4 className="mb-2 mt-5 text-xs font-bold uppercase tracking-wide text-gray-500">Billing Address</h4>
      <div className="rounded-xl bg-gray-50 p-3 text-xs text-gray-600">{addr ? `${addr.line1}, ${addr.line2 ? addr.line2 + ", " : ""}${addr.city}, ${addr.state} - ${addr.pincode}` : "Select a customer"}</div>
      <h4 className="mb-2 mt-5 text-xs font-bold uppercase tracking-wide text-gray-500">Delivery Address</h4>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Site"><Select value={siteId} onChange={(e) => setSiteId(e.target.value ? Number(e.target.value) : "")} placeholder="Select site" options={sites.map((s) => ({ value: s.site_id, label: s.site_name }))} /></Field>
        <Field label="Site Person Name"><Input readOnly value={site?.site_person_name ?? ""} /></Field>
        <Field label="Site Person Phone"><Input readOnly value={site?.site_person_contact ?? ""} /></Field>
        <Field label="Delivery Date"><Input type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} /></Field>
        <Field label="Warehouse"><Select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value ? Number(e.target.value) : "")} placeholder="Select warehouse" options={db.warehouses.map((w) => ({ value: w.warehouse_id, label: w.name }))} /></Field>
        <Field label="Transporter">
          <Select value={transporterId} onChange={(e) => setTransporterId(e.target.value ? Number(e.target.value) : "")} placeholder="Select transporter"
            options={db.transporters.filter((t) => !warehouseId || db.transporterWarehouses.some((tw) => tw.transporter_id === t.transporter_id && tw.warehouse_id === warehouseId)).map((t) => ({ value: t.transporter_id, label: t.name }))} />
        </Field>
      </div>
      <h4 className="mb-2 mt-5 text-xs font-bold uppercase tracking-wide text-gray-500">Enquiry Items</h4>
      <ItemsEditor items={items} onChange={setItems} />
      <div className="mt-2 text-right text-xs">Total: <b>{inr(lineTotal(items))}</b></div>
      <Field label="Remarks" className="mt-3"><Textarea rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} /></Field>
    </Modal>
  );
}
