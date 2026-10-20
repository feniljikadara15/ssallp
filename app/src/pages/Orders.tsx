import { useMemo, useState } from "react";
import { Download, Trash2, RotateCcw, FileText, Receipt, Truck, CheckCircle2, Pencil, Send, XCircle, PackagePlus } from "lucide-react";
import { useStore, fmtDate, inr, nextId, downloadCsv } from "../data/store";
import { customerName, siteOf, addressOf, warehouseName, transporterName, vehicleNumber, slipsFor, collectedFor } from "../data/lookups";
import type { Order, OrderStatus } from "../data/types";
import { Badge, Button, Card, EmptyState, Field, Input, KV, Modal, PageHeader, SearchInput, Select, Tabs, useToast, ask } from "../components/ui";
import ListItem from "../components/ListItem";
import { ItemsTable } from "../components/ItemsEditor";

type Tab = OrderStatus | "deleted";
const TABS: { value: Tab; label: string }[] = [
  { value: "ongoing", label: "Ongoing" },
  { value: "in_transit", label: "In-Transit" },
  { value: "delivered", label: "Delivered" },
  { value: "deleted", label: "Deleted" },
];
const STATUS_TONE = { ongoing: "orange", in_transit: "blue", delivered: "green" } as const;

export default function Orders() {
  const { db } = useStore();
  const [tab, setTab] = useState<Tab>("ongoing");
  const [party, setParty] = useState("");
  const [num, setNum] = useState("");
  const [ls, setLs] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sel, setSel] = useState<number | null>(null);

  const inTab = (o: Order, t: Tab) => (t === "deleted" ? !o.is_active : o.is_active && o.order_status === t);
  const list = useMemo(
    () =>
      db.orders
        .filter((o) => inTab(o, tab))
        .filter((o) => !party || customerName(db, o.customer_id).toLowerCase().includes(party.toLowerCase()))
        .filter((o) => !num || o.order_number.toLowerCase().includes(num.toLowerCase()) || String(o.order_id).includes(num))
        .filter((o) => !ls || slipsFor(db, o.order_id).some((s) => s.loading_slip_file_name.toLowerCase().includes(ls.toLowerCase())))
        .filter((o) => (!from || o.order_date >= from) && (!to || o.order_date.slice(0, 10) <= to))
        .sort((a, b) => b.order_date.localeCompare(a.order_date)),
    [db, tab, party, num, ls, from, to],
  );
  const order = db.orders.find((o) => o.order_id === sel);

  const exportCsv = () =>
    downloadCsv(`${tab}-orders.csv`, list.flatMap((o) => o.items.map((it) => ({
      order_id: o.order_id, order_number: o.order_number, order_date: fmtDate(o.order_date), customer: customerName(db, o.customer_id),
      payment_type: o.payment_type, status: o.order_status, warehouse: warehouseName(db, o.warehouse_id), transporter: transporterName(db, o.transporter_id),
      vehicle: vehicleNumber(db, o.vehicle_id), category: it.category, brand: it.brand, grade: it.grade, quantity: it.quantity, unit: it.unit,
      unit_price: it.unit_price, line_total: it.quantity * it.unit_price,
    }))));

  return (
    <div>
      <PageHeader title="Orders">
        <Button variant="outline" icon={<Download className="h-3.5 w-3.5" />} onClick={exportCsv} title={`Export ${tab} orders`}>Export</Button>
      </PageHeader>
      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <Card className="p-3">
          <Tabs value={tab} onChange={(t) => { setTab(t); setSel(null); }} tabs={TABS.map((t) => ({ ...t, count: db.orders.filter((o) => inTab(o, t.value)).length }))} />
          <div className="mt-3 space-y-2">
            <SearchInput value={party} onChange={setParty} placeholder="Search by Party Name" />
            <div className="grid grid-cols-2 gap-2">
              <SearchInput value={num} onChange={setNum} placeholder="Order Number" />
              <SearchInput value={ls} onChange={setLs} placeholder="Loading Slip No." />
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
          <div className="mt-3 max-h-[calc(100vh-340px)] space-y-2 overflow-y-auto pr-1">
            {list.map((o) => (
              <ListItem
                key={o.order_id}
                active={sel === o.order_id}
                onClick={() => setSel(o.order_id)}
                title={`OD - ${customerName(db, o.customer_id)} - ${o.order_id}`}
                subtitle={slipsFor(db, o.order_id)[0]?.loading_slip_file_name ?? o.order_number}
                tag={<Badge tone={o.payment_type === "cash" ? "yellow" : "blue"}>{o.payment_type}</Badge>}
                right={fmtDate(o.order_date)}
              />
            ))}
            {!list.length && <div className="py-8 text-center text-xs text-gray-400">No orders</div>}
          </div>
        </Card>
        {order ? <OrderDetail order={order} /> : <EmptyState text="Select an order to view details" />}
      </div>
    </div>
  );
}

function OrderDetail({ order }: { order: Order }) {
  const { db, update } = useStore();
  const toast = useToast();
  const [modal, setModal] = useState<null | "transport" | "deliver" | "terms" | "cashbill">(null);
  const c = db.customers.find((x) => x.customer_id === order.customer_id);
  const site = siteOf(db, order.site_id);
  const addr = addressOf(db, order.billing_address_id);
  const slips = slipsFor(db, order.order_id);
  const mut = (fn: (o: Order) => void) => update((d) => fn(d.orders.find((x) => x.order_id === order.order_id)!));

  const generateSlips = () => {
    if (!order.warehouse_id) return toast("Set a warehouse first");
    update((d) => {
      const lsId = nextId(d.loadingSlipItems, "loading_slip_id");
      [...new Set(order.items.map((i) => i.brand))].forEach((brand) => {
        const id = nextId(d.loadingSlipItems, "loading_slip_item_id");
        const n = 3000 + id;
        d.loadingSlipItems.push({ loading_slip_item_id: id, loading_slip_id: lsId, order_id: order.order_id, loading_slip_number: `LS${n}`, loading_slip_file_name: `LS-${n}-${brand.split(" ")[0].toUpperCase()}`, brand, warehouse_id: order.warehouse_id!, transporter_id: order.transporter_id, status: "Sent", is_active: true });
      });
    });
    toast("Loading slips generated & sent to warehouse keepers");
  };

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium text-secondary">Order #{order.order_id}</h2>
          <div className="text-xs font-bold text-gray-600">{order.order_number}</div>
          <div className="mt-1 flex gap-1.5">
            <Badge tone={STATUS_TONE[order.order_status]}>{order.order_status.replace("_", " ")}</Badge>
            <Badge tone={order.payment_type === "cash" ? "yellow" : "blue"}>{order.payment_type}</Badge>
            {!order.is_active && <Badge tone="red">deleted</Badge>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {!order.is_active ? (
            <Button variant="success" icon={<RotateCcw className="h-3.5 w-3.5" />} onClick={() => { mut((o) => (o.is_active = true)); toast("Order restored"); }}>Restore</Button>
          ) : (
            <>
              {order.payment_type === "credit" ? (
                order.invoice_id ? (
                  <Button variant="info" icon={<FileText className="h-3.5 w-3.5" />} onClick={() => toast(`Opening invoice ${order.invoice_id}`)}>View Invoice</Button>
                ) : (
                  <Button variant="secondary" icon={<FileText className="h-3.5 w-3.5" />} onClick={() => { mut((o) => (o.invoice_id = `INV-${2200 + o.order_id}`)); toast("Invoice generated in Zoho Books"); }}>Generate Invoice</Button>
                )
              ) : (
                <Button variant="secondary" icon={<Receipt className="h-3.5 w-3.5" />} onClick={() => setModal("cashbill")}>{order.invoice_id ? "View Cash Bill" : "Generate Cash Bill"}</Button>
              )}
              {order.invoice_id && <Button variant="outline" icon={<Send className="h-3.5 w-3.5" />} onClick={() => toast("Invoice sent to customer (with OTP) & transporter")}>Send Invoice</Button>}
              <Button variant="danger" icon={<Trash2 className="h-3.5 w-3.5" />} onClick={async () => await ask("Delete this order?") && mut((o) => (o.is_active = false))}>Delete Order</Button>
            </>
          )}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 rounded-xl bg-gray-50 p-4 md:grid-cols-4">
        <KV label="Customer" value={c?.name} />
        <KV label="Phone" value={c?.phone} />
        <KV label="Order Date" value={fmtDate(order.order_date)} />
        <KV label="Enquiry" value={`EN - ${order.enquiry_id}`} />
        <KV label="Billing Address" value={addr && `${addr.line1}, ${addr.city}`} />
        <KV label="Site" value={site?.site_name} />
        <KV label="Site Person" value={site && `${site.site_person_name} (${site.site_person_contact})`} />
        <KV label="OTP" value={order.otp} />
        <KV label="PO Number" value={order.po_number} />
        <KV label="Delivery Terms" value={order.delivery_terms} />
        <KV label="Invoice" value={order.invoice_id} />
        <KV label="Total Amount" value={inr(order.total_amount)} />
      </div>

      <div className="mt-4 rounded-xl border p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-medium text-secondary">Transport & Dispatch</h3>
          {order.is_active && (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => setModal("terms")}>PO / Terms</Button>
              <Button variant="outline" icon={<Truck className="h-3.5 w-3.5" />} onClick={() => setModal("transport")}>Edit Transport</Button>
              {order.order_status === "ongoing" && <Button icon={<PackagePlus className="h-3.5 w-3.5" />} onClick={() => { if (!slips.length) generateSlips(); mut((o) => (o.order_status = "in_transit")); }}>Dispatch</Button>}
              {order.order_status === "in_transit" && <Button variant="success" icon={<CheckCircle2 className="h-3.5 w-3.5" />} onClick={() => setModal("deliver")}>Mark Delivered</Button>}
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <KV label="Warehouse" value={warehouseName(db, order.warehouse_id)} />
          <KV label="Transporter" value={transporterName(db, order.transporter_id)} />
          <KV label="Vehicle" value={vehicleNumber(db, order.vehicle_id)} />
        </div>
        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-xs font-medium text-gray-600">Loading Slips</span>
            {order.is_active && !slips.length && <Button variant="ghost" onClick={generateSlips}>Generate</Button>}
          </div>
          {slips.length ? (
            <div className="flex flex-wrap gap-2">
              {slips.map((s) => (
                <span key={s.loading_slip_item_id} className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px]">
                  <b>{s.loading_slip_file_name}</b> · {s.brand}
                  {order.is_active && order.order_status !== "delivered" && (
                    <button title="Cancel loading slip" className="text-red-700" onClick={async () => await ask(`Cancel ${s.loading_slip_file_name}?`) && update((d) => { const x = d.loadingSlipItems.find((y) => y.loading_slip_item_id === s.loading_slip_item_id)!; x.is_active = false; x.status = "Cancelled"; })}>
                      <XCircle className="h-3.5 w-3.5" />
                    </button>
                  )}
                </span>
              ))}
            </div>
          ) : (
            <div className="text-xs text-gray-400">No loading slips yet</div>
          )}
        </div>
      </div>

      <h3 className="mb-2 mt-5 text-sm font-medium text-secondary">Order Details</h3>
      <div className="overflow-x-auto rounded-xl border"><ItemsTable items={order.items} /></div>

      {modal === "transport" && <TransportModal order={order} onClose={() => setModal(null)} />}
      {modal === "terms" && <TermsModal order={order} onClose={() => setModal(null)} />}
      {modal === "deliver" && (
        <DeliverModal order={order} onClose={() => setModal(null)} onDone={() => { mut((o) => (o.order_status = "delivered")); toast("Order marked as delivered"); setModal(null); }} />
      )}
      {modal === "cashbill" && <CashBillModal order={order} onClose={() => setModal(null)} />}
    </Card>
  );
}

function TransportModal({ order, onClose }: { order: Order; onClose: () => void }) {
  const { db, update } = useStore();
  const [wh, setWh] = useState(order.warehouse_id ?? "");
  const [tr, setTr] = useState(order.transporter_id ?? "");
  const [veh, setVeh] = useState(order.vehicle_id ?? "");
  const [newVeh, setNewVeh] = useState("");
  const transporters = db.transporters.filter((t) => !wh || db.transporterWarehouses.some((x) => x.transporter_id === t.transporter_id && x.warehouse_id === Number(wh)));
  const save = () => {
    update((d) => {
      const o = d.orders.find((x) => x.order_id === order.order_id)!;
      let vid = veh ? Number(veh) : null;
      if (newVeh && tr) {
        vid = nextId(d.vehicles, "vehicle_id");
        d.vehicles.push({ vehicle_id: vid, transporter_id: Number(tr), vehicle_number: newVeh.toUpperCase().replace(/\s/g, "") });
      }
      o.warehouse_id = wh ? Number(wh) : null;
      o.transporter_id = tr ? Number(tr) : null;
      o.vehicle_id = vid;
    });
    onClose();
  };
  return (
    <Modal open onClose={onClose} title="Edit Transport Details" footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save}>Save</Button></>}>
      <div className="space-y-3">
        <Field label="Warehouse"><Select value={wh} onChange={(e) => { setWh(e.target.value); setTr(""); setVeh(""); }} placeholder="Select warehouse" options={db.warehouses.map((w) => ({ value: w.warehouse_id, label: w.name }))} /></Field>
        <Field label="Transporter"><Select value={tr} onChange={(e) => { setTr(e.target.value); setVeh(""); }} placeholder="Select transporter" options={transporters.map((t) => ({ value: t.transporter_id, label: t.name }))} /></Field>
        <Field label="Vehicle"><Select value={veh} onChange={(e) => setVeh(e.target.value)} placeholder="Select vehicle" options={db.vehicles.filter((v) => v.transporter_id === Number(tr)).map((v) => ({ value: v.vehicle_id, label: v.vehicle_number }))} /></Field>
        <Field label="…or add a new vehicle number"><Input value={newVeh} onChange={(e) => setNewVeh(e.target.value)} placeholder="GJ01AB1234" disabled={!tr} /></Field>
      </div>
    </Modal>
  );
}

function TermsModal({ order, onClose }: { order: Order; onClose: () => void }) {
  const { update } = useStore();
  const [po, setPo] = useState(order.po_number);
  const [terms, setTerms] = useState(order.delivery_terms);
  const [sub, setSub] = useState(order.sub_dealer);
  return (
    <Modal open onClose={onClose} title="Order Details & Terms" footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={() => { update((d) => { const o = d.orders.find((x) => x.order_id === order.order_id)!; o.po_number = po; o.delivery_terms = terms; o.sub_dealer = sub; }); onClose(); }}>Save</Button></>}>
      <div className="space-y-3">
        <Field label="PO Number"><Input value={po} onChange={(e) => setPo(e.target.value)} /></Field>
        <Field label="Delivery Terms"><Select value={terms} onChange={(e) => setTerms(e.target.value)} options={["Ex-Warehouse", "Delivered at Site", "Freight Extra"].map((x) => ({ value: x, label: x }))} /></Field>
        <Field label="Sub Dealer"><Input value={sub} onChange={(e) => setSub(e.target.value)} /></Field>
      </div>
    </Modal>
  );
}

function DeliverModal({ order, onClose, onDone }: { order: Order; onClose: () => void; onDone: () => void }) {
  const [otp, setOtp] = useState("");
  return (
    <Modal open onClose={onClose} title="Confirm Delivery" size="sm" footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button variant="success" disabled={otp !== order.otp} onClick={onDone}>Mark as Delivered</Button></>}>
      <p className="mb-3 text-xs text-gray-600">Enter the delivery OTP shared with the customer.</p>
      <Field label="OTP"><Input value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="4-digit OTP" maxLength={4} /></Field>
      <p className="mt-2 text-[11px] text-gray-400">Preview hint: OTP is {order.otp}</p>
    </Modal>
  );
}

function CashBillModal({ order, onClose }: { order: Order; onClose: () => void }) {
  const { db, update } = useStore();
  const toast = useToast();
  const c = db.customers.find((x) => x.customer_id === order.customer_id);
  const collected = collectedFor(db, order.order_id);
  return (
    <Modal open onClose={onClose} title="CASH BILL" size="lg" footer={
      <>
        {!order.invoice_id && <Button onClick={() => { update((d) => { d.orders.find((x) => x.order_id === order.order_id)!.invoice_id = `CB-${order.order_id}`; }); toast("Cash bill generated"); onClose(); }}>Generate Cash Bill</Button>}
      </>
    }>
      <div className="flex justify-between text-xs">
        <div>
          <div className="text-sm font-bold">Sambhavnath Agencies LLP</div>
          <div className="text-gray-500">Cash Memo</div>
        </div>
        <div className="text-right">
          <div>Bill No: <b>{order.invoice_id ?? "(draft)"}</b></div>
          <div>Date: {fmtDate(order.order_date)}</div>
          <div>Order: {order.order_number}</div>
        </div>
      </div>
      <div className="my-3 rounded-xl bg-gray-50 p-3 text-xs">To: <b>{c?.name}</b> · {c?.phone}</div>
      <div className="overflow-x-auto rounded-xl border"><ItemsTable items={order.items} /></div>
      <div className="mt-3 text-right text-xs">Collected: <b>{inr(collected)}</b> · Balance: <b>{inr(order.total_amount - collected)}</b></div>
    </Modal>
  );
}
