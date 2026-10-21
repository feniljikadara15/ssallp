import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Download, Trash2, RotateCcw, FileText, Receipt, Truck, CheckCircle2, Send, XCircle, PackagePlus, Plus, Eye, ExternalLink, Save } from "lucide-react";
import { api, patch, post, useAction, useGet, type Health } from "../api";
import { exportRows, fmtDate, includes, inRange, inr, stamp, today } from "../format";
import { ask, Badge, Button, Card, EmptyState, ErrorBox, Field, Input, KV, Loading, Menu, Modal, PageHeader, SearchInput, Select, Tabs, toast } from "../components/ui";
import ListItem, { revealDetail } from "../components/ListItem";
import { ItemsTable } from "../components/ItemsEditor";

type Tab = "1" | "2" | "3" | "5";
const TABS: { value: Tab; label: string }[] = [
  { value: "1", label: "Ongoing" }, { value: "2", label: "In-Transit" }, { value: "3", label: "Delivered" }, { value: "5", label: "Deleted" },
];
const EXPORT_NAME: Record<string, string> = { "1": "Ongoing Orders", "2": "In Transit Orders", "3": "Delivered Orders" };

export default function Orders() {
  const orders = useGet<any[]>("orders", { refetchInterval: 60_000 });
  const [tab, setTab] = useState<Tab>("1");
  const [party, setParty] = useState("");
  const [num, setNum] = useState("");
  const [ls, setLs] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sel, setSel] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);

  const list = useMemo(() => {
    // An order number or loading slip search finds the order regardless of the date filter.
    const direct = num.trim() !== "" || ls.trim() !== "";
    return (orders.data ?? []).filter((o) =>
      o.order_status === tab &&
      includes(o.customer_name, party) &&
      (!num.trim() || String(o.order_id).includes(num.trim()) || includes(o.order_number, num)) &&
      (!ls.trim() || (o.loading_slip_numbers ?? []).includes(ls.trim().replace(/^LS-?/i, "")) || includes(o.loading_slip_file_name, ls)) &&
      (direct || tab === "5" || inRange(o.order_date, from, to)));
  }, [orders.data, tab, party, num, ls, from, to]);

  const exportCsv = async () => {
    setExporting(true);
    try {
      const rows = await api(`orders-export?status=${tab}&start=${from}&end=${to}`);
      await exportRows(rows, `${EXPORT_NAME[tab]} ${stamp()}`, "csv");
    } catch (e) { toast((e as Error).message, "error"); }
    setExporting(false);
  };

  return (
    <div>
      <PageHeader title="Orders">
        {tab !== "5" && <Button variant="outline" busy={exporting} icon={<Download className="h-3.5 w-3.5" />} onClick={exportCsv} title={`Export ${EXPORT_NAME[tab]}`}>Export</Button>}
      </PageHeader>
      <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)] [&>*]:min-w-0">
        <Card className="p-3">
          <Tabs value={tab} onChange={(t) => { setTab(t); setSel(null); }} tabs={TABS.map((t) => ({ ...t, count: (orders.data ?? []).filter((o) => o.order_status === t.value).length }))} />
          <div className="mt-3 space-y-2">
            <SearchInput value={party} onChange={setParty} placeholder="Search by Party Name" />
            <div className="grid grid-cols-2 gap-2">
              <SearchInput value={num} onChange={setNum} placeholder="Order Number" />
              <SearchInput value={ls} onChange={setLs} placeholder="Loading Slip No." />
              {tab !== "5" && <Input type="date" aria-label="From date" value={from} onChange={(e) => setFrom(e.target.value)} />}
              {tab !== "5" && <Input type="date" aria-label="To date" value={to} onChange={(e) => setTo(e.target.value)} />}
            </div>
          </div>
          <div className="mt-3 max-h-[calc(100vh-340px)] space-y-2 overflow-y-auto pr-1">
            {orders.isLoading && <Loading />}
            {orders.error && <ErrorBox error={orders.error} />}
            {list.map((o) => (
              <ListItem key={o.order_id} active={sel === o.order_id} onClick={() => { setSel(o.order_id); revealDetail(); }}
                title={`OD - ${o.customer_name ?? ""} - ${o.order_id}`}
                subtitle={o.loading_slip_file_name ? <b className="text-secondary">{o.loading_slip_file_name}</b> : o.order_number}
                tag={o.payment_type && <Badge tone={o.payment_type === "cash" ? "yellow" : "blue"}>{o.payment_type}</Badge>}
                right={fmtDate(o.order_date)} />
            ))}
            {orders.data && !list.length && <div className="py-8 text-center text-xs text-gray-400">No orders</div>}
          </div>
        </Card>
        <div id="detail-panel" className="min-w-0 scroll-mt-4">{sel ? <OrderDetail id={sel} onMoved={(t) => setTab(t)} /> : <EmptyState text="Select an order to view details" />}</div>
      </div>
    </div>
  );
}

const STATUS_TONE: Record<string, "orange" | "blue" | "green" | "red"> = { "1": "orange", "2": "blue", "3": "green", "5": "red" };
const STATUS_LABEL: Record<string, string> = { "1": "Ongoing", "2": "In-Transit", "3": "Delivered", "5": "Deleted" };

function OrderDetail({ id, onMoved }: { id: number; onMoved: (t: Tab) => void }) {
  const navigate = useNavigate();
  const { data: o, error, isLoading } = useGet<any>(`orders/${id}`);
  const health = useGet<Health & { zohoOrgId?: string }>("health");
  const [cashMode, setCashMode] = useState(false);
  const [modal, setModal] = useState<null | "slips" | "deliver" | "cash" | "vehicle">(null);
  useEffect(() => setCashMode(false), [id]);

  const refresh = ["orders", "cash-bills", "loading-slips", "dashboard"];
  const del = useAction(() => post(`orders/${id}/delete`), refresh, { onSuccess: () => onMoved("5") });
  const restore = useAction(() => post(`orders/${id}/restore`), refresh, { onSuccess: () => onMoved("1") });
  const invoice = useAction(() => post(`orders/${id}/invoice`), refresh, { onSuccess: () => onMoved("2") });
  const cashBill = useAction(() => post(`orders/${id}/cash-bill`), refresh, { onSuccess: () => onMoved("2") });
  const sendInvoice = useAction((to: string) => post(`orders/${id}/send-invoice`, { to }), []);
  const sendOtp = useAction(() => post(`orders/${id}/send-otp`), []);
  const saveItems = useAction((items: Record<string, unknown>[]) => patch(`orders/${id}/items`, { items }), ["orders"]);

  if (isLoading) return <Card className="p-5"><Loading /></Card>;
  if (error || !o) return <Card className="p-5"><ErrorBox error={error} /></Card>;

  const status = o.order_status as string;
  const b = o.billing_address ?? {}, s = o.shipping_address ?? {};
  const total = o.items.reduce((a: number, x: any) => a + Number(x.unit_price) * Number(x.quantity), 0);
  const isCash = o.payment_type === "cash";
  const zohoApp = `https://books.zoho.in/app/${health.data?.zohoOrgId ?? "60031284196"}#`;
  const viewInvoice = async () => {
    if (o.zb_invoice_url) return window.open(o.zb_invoice_url, "_blank", "noopener");
    try { const r = await api(`orders/${id}/invoice-link`); window.open(r.url, "_blank", "noopener"); } catch (e) { toast((e as Error).message, "error"); }
  };

  return (
    <Card className="min-w-0 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium text-secondary">Order #{o.order_id}</h2>
          <div className="text-xs font-bold text-gray-600">{o.order_number}</div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status] ?? status}</Badge>
            {o.payment_type && <Badge tone={isCash ? "yellow" : "blue"}>{o.payment_type}</Badge>}
            {o.zb_invoice_number && <Badge>Invoice {o.zb_invoice_number}</Badge>}
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          {status === "5" && <Button variant="success" busy={restore.isPending} icon={<RotateCcw className="h-3.5 w-3.5" />} onClick={() => restore.mutate(undefined)}>Restore</Button>}
          {status === "1" && (
            <>
              <Button variant="danger" busy={del.isPending} icon={<Trash2 className="h-3.5 w-3.5" />} onClick={async () => (await ask(`Delete order #${id}?`, "Delete")) && del.mutate(undefined)}>Delete Order</Button>
              {cashMode ? (
                <Button variant="secondary" busy={cashBill.isPending} disabled={o.loading_slip_count !== 1} title={o.loading_slip_count !== 1 ? "Create the loading slips first" : undefined}
                  icon={<Receipt className="h-3.5 w-3.5" />} onClick={() => cashBill.mutate(undefined)}>Generate Cash Bill</Button>
              ) : (
                <Button variant="secondary" busy={invoice.isPending} disabled={o.loading_slip_count < 1 || !o.vehicle_id || !o.delivery_terms}
                  title={o.loading_slip_count < 1 ? "Create the loading slips first" : !o.vehicle_id || !o.delivery_terms ? "Save the vehicle and delivery terms first" : undefined}
                  icon={<FileText className="h-3.5 w-3.5" />} onClick={() => invoice.mutate(undefined)}>Generate Invoice</Button>
              )}
            </>
          )}
          {(status === "2" || status === "3") && isCash && (
            <Button variant="secondary" icon={<Receipt className="h-3.5 w-3.5" />} onClick={() => navigate(`/cash-bills?order=${id}`)}>View Cash Bill</Button>
          )}
          {status === "2" && isCash && (
            <Button variant="outline" busy={sendOtp.isPending} icon={<Send className="h-3.5 w-3.5" />} onClick={() => sendOtp.mutate(undefined)}>Send Delivery OTP</Button>
          )}
          {(status === "2" || status === "3") && o.zb_invoice_id && (
            <>
              <Button variant="info" icon={<ExternalLink className="h-3.5 w-3.5" />} onClick={() => window.open(`${zohoApp}/invoices/${o.zb_invoice_id}`, "_blank", "noopener")}>E-Invoice</Button>
              <Menu label="Send Invoice to..." icon={<Send className="h-3.5 w-3.5" />} disabled={sendInvoice.isPending} items={[
                { label: "Customer (with OTP)", onClick: () => sendInvoice.mutate("customer") },
                { label: "Customer (with OTP) & Transporter", onClick: () => sendInvoice.mutate("customer_transporter") },
              ]} />
              <Menu label="View" icon={<Eye className="h-3.5 w-3.5" />} items={[
                { label: "View Invoice", onClick: viewInvoice },
                ...(total >= 50000 ? [{ label: "View E-way Bill", onClick: () => window.open(`${zohoApp}/ewaybills/new?entity_id=${o.zb_invoice_id}&entity_type=invoice`, "_blank", "noopener") }] : []),
              ]} />
            </>
          )}
        </div>
      </div>

      <h3 className="mb-2 mt-5 text-sm font-medium text-secondary">Customer Information</h3>
      <div className="grid grid-cols-2 gap-4 rounded-xl bg-gray-50 p-4 md:grid-cols-4">
        <KV label="Name" value={o.customer_name} />
        <KV label="Phone" value={o.customer_phone} />
        <KV label="Site" value={[o.site_name, o.site_person_name, o.site_person_contact].filter(Boolean).join(" · ")} />
        <KV label="Order Date" value={fmtDate(o.order_date)} />
        <KV label="Billing Address" value={[b.line1, b.line2, b.city, b.state, b.pincode].filter(Boolean).join(", ")} />
        <KV label="Delivery Address" value={[s.line1, s.line2, s.city, s.state, s.pincode].filter(Boolean).join(", ")} />
        <KV label="Delivery Date" value={fmtDate(o.delivery_date)} />
        <KV label={status === "1" ? "Order Value" : "Total Amount"} value={inr(o.total_amount ?? total)} />
        {s.maps_link && <KV label="Map" value={<a className="text-info underline" href={s.maps_link} target="_blank" rel="noreferrer">Open map</a>} />}
      </div>

      <TransportPanel order={o} onAddVehicle={() => setModal("vehicle")} onSlips={() => setModal("slips")} onDeliver={() => setModal("deliver")} />

      <div className="mb-2 mt-5 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-medium text-secondary">Order Details</h3>
        {status === "1" && (
          cashMode
            ? <Button variant="outline" onClick={() => setCashMode(false)}>Back to invoice</Button>
            : <Button variant="outline" icon={<Receipt className="h-3.5 w-3.5" />} onClick={() => setModal("cash")}>CASH BILL</Button>
        )}
      </div>
      {cashMode && status === "1" && <div className="mb-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">Cash bill mode: this order will be billed as cash instead of a Zoho invoice.</div>}
      <ItemsTable items={o.items} idKey="order_item_id" onSave={status === "1" ? (items) => saveItems.mutate(items) : undefined} saving={saveItems.isPending} />
      {total >= 50000 && o.tcs_status && <p className="mt-2 text-[11px] text-gray-500">TCS applies to this customer.</p>}

      {modal === "slips" && <LoadingSlipsModal order={o} onClose={() => setModal(null)} />}
      {modal === "deliver" && <DeliverModal orderId={id} onClose={() => setModal(null)} onDone={() => { setModal(null); onMoved("3"); }} />}
      {modal === "vehicle" && <AddVehicleModal transporterId={o.transporter_id} onClose={() => setModal(null)} />}
      {modal === "cash" && (
        <Modal open onClose={() => setModal(null)} title="Convert to Cash Bill" size="sm" footer={<><Button variant="outline" onClick={() => setModal(null)}>Cancel</Button><Button onClick={() => { setCashMode(true); setModal(null); }}>Confirm</Button></>}>
          <p className="text-sm text-secondary">Are you sure you want to convert Order {id} to a Cash Bill?</p>
        </Modal>
      )}
    </Card>
  );
}

// Transport Details + Dispatch Details panels (container17 / container38)
function TransportPanel({ order: o, onAddVehicle, onSlips, onDeliver }: { order: any; onAddVehicle: () => void; onSlips: () => void; onDeliver: () => void }) {
  const editable = o.order_status === "1";
  const initial = () => ({
    warehouse_id: o.warehouse_id ?? "", transporter_id: o.transporter_id ?? "", vehicle_id: o.vehicle_id ?? "",
    delivery_terms: o.delivery_terms ?? "", po_number: o.po_number ?? "", sub_dealer: o.sub_dealer ?? "",
  });
  const [f, setF] = useState(initial);
  useEffect(() => setF(initial()), [o.order_id, o.warehouse_id, o.transporter_id, o.vehicle_id, o.delivery_terms, o.po_number, o.sub_dealer]);
  const warehouses = useGet<any[]>("warehouses");
  const transporters = useGet<any[]>(f.warehouse_id ? `warehouses/${f.warehouse_id}/transporter-options` : null);
  const vehicles = useGet<any[]>(f.transporter_id ? `transporters/${f.transporter_id}/vehicles` : null);
  const save = useAction(() => patch(`orders/${o.order_id}`, f), ["orders"]);
  const notify = useAction(() => post(`orders/${o.order_id}/notify-transporter`), [], { onSuccess: (r) => toast(r.sent === false ? r.note : "Order details sent to transporter", r.sent === false ? "warn" : "ok") });
  const dirty = JSON.stringify(f) !== JSON.stringify(initial());
  const set = (patch: Partial<ReturnType<typeof initial>>) => setF({ ...f, ...patch });

  return (
    <div className="mt-4 grid gap-4 xl:grid-cols-2">
      <div className="rounded-xl border p-4">
        <h3 className="text-sm font-medium text-secondary">Transport Details</h3>
        <p className="mb-3 text-xs text-gray-500">Assign a transporter and set delivery details</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Warehouse"><Select id="ord-wh" value={f.warehouse_id} disabled={!editable} onChange={(e) => set({ warehouse_id: e.target.value, transporter_id: "", vehicle_id: "" })} placeholder="Select a warehouse" options={(warehouses.data ?? []).map((w) => ({ value: w.warehouse_id, label: w.name }))} /></Field>
          <Field label="Transporter"><Select id="ord-tr" value={f.transporter_id} disabled={!editable || !f.warehouse_id} onChange={(e) => set({ transporter_id: e.target.value, vehicle_id: "" })} placeholder="Select an option" options={(transporters.data ?? []).map((t) => ({ value: t.transporter_id, label: t.transporter_name }))} /></Field>
          <Field label="Delivery Terms"><Select id="ord-terms" value={f.delivery_terms} disabled={!editable} onChange={(e) => set({ delivery_terms: e.target.value })} placeholder="Select an option" options={["Delivery", "Ex warehouse"].map((x) => ({ value: x, label: x }))} /></Field>
          <Field label="Vehicle Number">
            <Select id="ord-veh" value={f.vehicle_id} disabled={!editable || !f.transporter_id} onChange={(e) => set({ vehicle_id: e.target.value })} placeholder="Select a vehicle" options={(vehicles.data ?? []).map((v) => ({ value: v.vehicle_id, label: v.vehicle_number }))} />
          </Field>
        </div>
        {editable && (
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="outline" disabled={!o.transporter_id || dirty} title={dirty ? "Save details first" : !o.transporter_id ? "Select a transporter first" : "If the vehicle number isn't listed, add it"} icon={<Plus className="h-3.5 w-3.5" />} onClick={onAddVehicle}>Add New Vehicle Number</Button>
            <Button variant="secondary" busy={notify.isPending} disabled={!o.warehouse_id || !o.transporter_id || !o.vehicle_id || dirty} title={dirty ? "Save details first" : undefined} icon={<Truck className="h-3.5 w-3.5" />} onClick={() => notify.mutate(undefined)}>Notify Transporter</Button>
          </div>
        )}
      </div>
      <div className="rounded-xl border p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-medium text-secondary">Dispatch Details</h3>
          {o.order_status === "2" && <Button variant="success" icon={<CheckCircle2 className="h-3.5 w-3.5" />} onClick={onDeliver}>Confirm Delivery</Button>}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Sub Dealer"><Input id="ord-sub" value={f.sub_dealer} disabled={!editable} onChange={(e) => set({ sub_dealer: e.target.value })} placeholder="Enter sub dealer name" /></Field>
          <Field label="PO Number"><Input id="ord-po" value={f.po_number} disabled={!editable} onChange={(e) => set({ po_number: e.target.value })} placeholder="Enter PO number" /></Field>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {editable && <Button busy={save.isPending} disabled={!dirty} icon={<Save className="h-3.5 w-3.5" />} onClick={() => save.mutate(undefined)}>Save Details</Button>}
          {editable && <Button variant="secondary" icon={<PackagePlus className="h-3.5 w-3.5" />} onClick={onSlips}>Manage Loading Slips{o.loading_slip_items.length ? ` (${o.loading_slip_items.length})` : ""}</Button>}
          {!editable && o.loading_slip_items.length > 0 && <Button variant="outline" icon={<Eye className="h-3.5 w-3.5" />} onClick={onSlips}>View Loading Slips</Button>}
        </div>
        {editable && dirty && <p className="mt-2 text-[11px] text-warning">Unsaved changes</p>}
      </div>
    </div>
  );
}

function LoadingSlipsModal({ order: o, onClose }: { order: any; onClose: () => void }) {
  const [date, setDate] = useState(today());
  const editable = o.order_status === "1";
  const create = useAction(() => post(`orders/${o.order_id}/loading-slips`, { date }), ["orders", "loading-slips"]);
  const send = useAction((sid: number) => post(`loading-slip-items/${sid}/send`), ["orders", "loading-slips"]);
  const cancel = useAction((sid: number) => post(`loading-slip-items/${sid}/cancel`), ["orders", "loading-slips"]);
  const rows: any[] = o.loading_slip_items;
  return (
    <Modal open onClose={onClose} title="Manage Loading Slips" size="lg">
      {editable && (
        <div className="mb-4 flex flex-wrap items-end gap-2 rounded-xl bg-gray-50 p-3">
          <Field label="Loading slip date"><Input id="ls-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Button busy={create.isPending} disabled={!o.warehouse_id} title={!o.warehouse_id ? "Save a warehouse on the order first" : undefined} icon={<PackagePlus className="h-3.5 w-3.5" />}
            onClick={async () => (!rows.length || (await ask("Create a new set of loading slips? The current ones will be replaced.", "Create"))) && create.mutate(undefined)}>
            Create Loading Slips
          </Button>
          <span className="text-[11px] text-gray-500">One slip per brand, for the order's warehouse.</span>
        </div>
      )}
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-xs">
          <thead><tr className="border-b bg-gray-50 text-left text-gray-500">
            <th className="px-3 py-2 font-medium">Loading Slip No</th><th className="px-3 py-2 font-medium">Brand</th><th className="px-3 py-2 font-medium">Warehouse Keeper</th>
            <th className="px-3 py-2 font-medium">Keeper Phone</th><th className="px-3 py-2 font-medium">Status</th><th className="px-3 py-2" />
          </tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.loading_slip_item_id} className="border-b last:border-0">
                <td className="px-3 py-2"><a href={r.url} target="_blank" rel="noreferrer" className="font-bold text-info underline">{r.loading_slip_file_name}</a></td>
                <td className="px-3 py-2">{r.brand}</td>
                <td className="px-3 py-2">{r.warehouse_keeper_name || <span className="text-warning">Not assigned</span>}</td>
                <td className="px-3 py-2">{r.warehouse_keeper_phone}</td>
                <td className="px-3 py-2"><Badge tone={r.status === "Sent" ? "green" : r.status === "Cancelled" ? "red" : "gray"}>{r.status ?? "—"}</Badge></td>
                <td className="whitespace-nowrap px-3 py-2 text-right">
                  <Button variant="ghost" icon={<Eye className="h-3.5 w-3.5" />} onClick={() => window.open(r.url, "_blank", "noopener")}>View</Button>
                  {r.status !== "Cancelled" && editable && <Button variant="ghost" busy={send.isPending && send.variables === r.loading_slip_item_id} icon={<Send className="h-3.5 w-3.5" />} onClick={() => send.mutate(r.loading_slip_item_id)}>Send</Button>}
                  {r.status !== "Cancelled" && editable && (
                    <Button variant="ghost" className="text-red-700" icon={<XCircle className="h-3.5 w-3.5" />}
                      onClick={async () => (await ask(`Cancel loading slip ${r.loading_slip_file_name}? The warehouse keeper gets a cancellation message.`, "Cancel slip")) && cancel.mutate(r.loading_slip_item_id)}>Cancel</Button>
                  )}
                </td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={6} className="px-3 py-8 text-center text-gray-400">No loading slips yet</td></tr>}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}

function DeliverModal({ orderId, onClose, onDone }: { orderId: number; onClose: () => void; onDone: () => void }) {
  const [otp, setOtp] = useState("");
  const verify = useAction(() => post(`orders/${orderId}/deliver`, { otp }), ["orders", "cash-bills", "dashboard"], { onSuccess: onDone });
  return (
    <Modal open onClose={onClose} title="Mark as delivered" size="sm" footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button variant="success" busy={verify.isPending} disabled={!otp.trim()} onClick={() => verify.mutate(undefined)}>Verify OTP</Button></>}>
      <Field label="Delivery OTP"><Input id="otp" inputMode="numeric" autoFocus value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="Enter delivery OTP" onKeyDown={(e) => e.key === "Enter" && otp && verify.mutate(undefined)} /></Field>
      <p className="mt-2 text-[11px] text-gray-500">The customer gets this OTP on WhatsApp when the invoice is sent (or from Send Delivery OTP for cash bills).</p>
    </Modal>
  );
}

function AddVehicleModal({ transporterId, onClose }: { transporterId: number; onClose: () => void }) {
  const [num, setNum] = useState("");
  const vehicles = useGet<any[]>(`transporters/${transporterId}/vehicles`);
  const norm = (v: string) => v.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const exists = !!num && (vehicles.data ?? []).some((v) => norm(v.vehicle_number) === norm(num));
  const add = useAction(() => post(`transporters/${transporterId}/vehicles`, { vehicle_number: num }), ["transporters", "vehicle-details"], { onSuccess: onClose });
  return (
    <Modal open onClose={onClose} title="Add New Vehicle Number" size="sm" footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button busy={add.isPending} disabled={!norm(num) || exists} onClick={() => add.mutate(undefined)}>Save</Button></>}>
      <Field label="Vehicle Number"><Input id="new-veh" autoFocus value={num} onChange={(e) => setNum(e.target.value)} placeholder="GJ01AB1234" /></Field>
      {exists && <p className="mt-2 text-xs text-red-700">This vehicle is already added for this transporter.</p>}
      <p className="mt-2 text-[11px] text-gray-500">After saving, pick it in Vehicle Number and Save Details.</p>
    </Modal>
  );
}
