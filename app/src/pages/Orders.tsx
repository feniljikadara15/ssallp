import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import clsx from "clsx";
import { Download, Trash2, RotateCcw, FileText, Receipt, Truck, CheckCircle2, Send, XCircle, PackagePlus, Plus, Eye, Save, Check, UserRound, MapPin, Boxes, ClipboardList, Phone } from "lucide-react";
import { api, patch, post, useAction, useGet, type Health } from "../api";
import { exportRows, fmtDate, includes, inRange, inr, stamp, today } from "../format";
import { ask, Badge, Button, Card, EmptyState, ErrorBox, Field, Input, KV, Loading, Menu, Modal, PageHeader, SearchInput, Section, Select, Tabs, toast, DateInput } from "../components/ui";
import ListItem, { revealDetail } from "../components/ListItem";
import { ItemsTable } from "../components/ItemsEditor";

type Tab = "1" | "2" | "3" | "5";
const TABS: { value: Tab; label: string }[] = [
  { value: "1", label: "Ongoing" }, { value: "2", label: "In transit" }, { value: "3", label: "Delivered" }, { value: "5", label: "Deleted" },
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

  // Links from search and the dashboard: ?id=<order> opens it, ?tab=<status> picks a tab.
  const [params, setParams] = useSearchParams();
  useEffect(() => {
    const t = params.get("tab") as Tab | null;
    if (t && TABS.some((x) => x.value === t)) setTab(t);
    const id = Number(params.get("id"));
    if (!id || !orders.data) return;
    const o = orders.data.find((x) => x.order_id === id);
    if (o) { setTab(o.order_status); setParty(""); setNum(""); setLs(""); setFrom(""); setTo(""); setSel(id); revealDetail(); }
    setParams({}, { replace: true });
  }, [params, orders.data]); // eslint-disable-line react-hooks/exhaustive-deps

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
      <PageHeader title="Orders" description="Dispatch, bill and deliver confirmed orders">
        {tab !== "5" && <Button variant="outline" busy={exporting} icon={<Download className="h-3.5 w-3.5" />} onClick={exportCsv} title={`Export ${EXPORT_NAME[tab]}`}>Export</Button>}
      </PageHeader>
      <div className="grid items-start gap-5 lg:grid-cols-[380px_minmax(0,1fr)] [&>*]:min-w-0">
        <Card className="flex flex-col p-3 lg:sticky lg:top-0 lg:max-h-[calc(100vh-120px)]">
          <Tabs value={tab} onChange={(t) => { setTab(t); setSel(null); }} tabs={TABS.map((t) => ({ ...t, count: (orders.data ?? []).filter((o) => o.order_status === t.value).length }))} />
          <div className="mt-3 shrink-0 space-y-2">
            <SearchInput value={party} onChange={setParty} placeholder="Search customer" />
            <div className="grid grid-cols-2 gap-2">
              <SearchInput value={num} onChange={setNum} placeholder="Order no." />
              <SearchInput value={ls} onChange={setLs} placeholder="Loading slip no." />
              {tab !== "5" && <DateInput aria-label="From date" placeholder="From" value={from} onChange={(e) => setFrom(e.target.value)} />}
              {tab !== "5" && <DateInput aria-label="To date" placeholder="To" value={to} onChange={(e) => setTo(e.target.value)} />}
            </div>
          </div>
          <div className="mt-3 flex shrink-0 items-center justify-between px-1 text-2xs text-gray-500">
            <span>{list.length} order{list.length === 1 ? "" : "s"}</span>
            {(party || num || ls || from || to) && <button className="font-medium text-primary hover:underline" onClick={() => { setParty(""); setNum(""); setLs(""); setFrom(""); setTo(""); }}>Clear filters</button>}
          </div>
          <div className="-mx-1 mt-1 min-h-[200px] flex-1 space-y-0.5 overflow-y-auto px-1">
            {orders.isLoading && <Loading variant="inline" />}
            {orders.error && <ErrorBox error={orders.error} />}
            {list.map((o) => (
              <ListItem key={o.order_id} active={sel === o.order_id} onClick={() => { setSel(o.order_id); revealDetail(); }}
                title={o.customer_name ?? "—"}
                subtitle={[`#${o.order_id}`, o.site_name].filter(Boolean).join(" · ")}
                tag={(o.payment_type || o.loading_slip_file_name) && <>
                  {o.loading_slip_file_name && <Badge tone="gray">{o.loading_slip_file_name}</Badge>}
                  {o.payment_type && <Badge tone={o.payment_type === "cash" ? "yellow" : "blue"}>{o.payment_type === "cash" ? "Cash" : "Invoice"}</Badge>}
                </>}
                right={fmtDate(o.order_date)}
                rightSub={inr(o.total_amount ?? o.items_value)} />
            ))}
            {orders.data && !list.length && <div className="py-10 text-center text-xs text-gray-400">No orders match these filters</div>}
          </div>
        </Card>
        <div id="detail-panel" className="min-w-0 scroll-mt-4">{sel ? <OrderDetail id={sel} onMoved={(t) => setTab(t)} /> : <EmptyState icon={<ClipboardList className="h-5 w-5" />} text="Pick an order on the left to see its items, transport and billing." />}</div>
      </div>
    </div>
  );
}

const STATUS_TONE: Record<string, "orange" | "blue" | "green" | "red"> = { "1": "orange", "2": "blue", "3": "green", "5": "red" };
const STATUS_LABEL: Record<string, string> = { "1": "Ongoing", "2": "In transit", "3": "Delivered", "5": "Deleted" };

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

  if (isLoading) return <Card className="p-5"><Loading variant="inline" /></Card>;
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
    <div className="min-w-0 space-y-4">
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-2xs font-medium text-gray-500">
              <span>Order #{o.order_id}</span>{o.order_number && <><span className="text-gray-300">/</span><span>{o.order_number}</span></>}
              {o.enquiry_id && <><span className="text-gray-300">/</span><span>From EN-{o.enquiry_id}</span></>}
            </div>
            <h2 className="mt-1 truncate text-xl font-semibold tracking-tight text-secondary">{o.customer_name}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <Badge dot tone={STATUS_TONE[status]}>{STATUS_LABEL[status] ?? status}</Badge>
              {o.payment_type && <Badge tone={isCash ? "yellow" : "blue"}>{isCash ? "Cash bill" : "Invoice"}</Badge>}
              {o.zb_invoice_number && <Badge>Invoice {o.zb_invoice_number}</Badge>}
              {o.tcs_status && <Badge tone="purple">TCS</Badge>}
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xs font-medium text-gray-500">{status === "1" ? "Order value" : "Total amount"}</div>
            <div className="tabular text-xl font-semibold tracking-tight text-secondary">{inr(o.total_amount ?? total)}</div>
            <div className="text-2xs text-gray-500">{o.items.length} item{o.items.length === 1 ? "" : "s"} · {fmtDate(o.order_date)}</div>
          </div>
        </div>
        {status === "5" ? (
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800"><Trash2 className="h-3.5 w-3.5" /> This order is deleted. Restore it to work on it again.</div>
        ) : <Stepper order={o} />}
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-black/[0.05] pt-4">
          {status === "5" && <Button variant="success" busy={restore.isPending} icon={<RotateCcw />} onClick={() => restore.mutate(undefined)}>Restore order</Button>}
          {status === "1" && (
            <>
              {cashMode ? (
                <Button busy={cashBill.isPending} disabled={o.loading_slip_count !== 1} title={o.loading_slip_count !== 1 ? "Create the loading slips first" : undefined}
                  icon={<Receipt />} onClick={() => cashBill.mutate(undefined)}>Generate cash bill</Button>
              ) : (
                <Button busy={invoice.isPending} disabled={o.loading_slip_count < 1 || !o.vehicle_id || !o.delivery_terms}
                  title={o.loading_slip_count < 1 ? "Create the loading slips first" : !o.vehicle_id || !o.delivery_terms ? "Save the vehicle and delivery terms first" : undefined}
                  icon={<FileText />} onClick={() => invoice.mutate(undefined)}>Generate invoice</Button>
              )}
              {(cashMode ? o.loading_slip_count !== 1 : o.loading_slip_count < 1 || !o.vehicle_id || !o.delivery_terms) && (
                <span className="text-2xs text-gray-500">{o.loading_slip_count < 1 ? "Create loading slips to bill" : cashMode ? "Needs exactly one loading slip" : "Save the vehicle and delivery terms to bill"}</span>
              )}
              {cashMode
                ? <Button variant="outline" onClick={() => setCashMode(false)}>Bill by invoice instead</Button>
                : <Button variant="outline" icon={<Receipt />} onClick={() => setModal("cash")}>Bill as cash</Button>}
              <div className="flex-1" />
              <Button variant="danger" busy={del.isPending} icon={<Trash2 />} onClick={async () => (await ask(`Delete order #${id}? You can restore it later from the Deleted tab.`, "Delete")) && del.mutate(undefined)}>Delete</Button>
            </>
          )}
          {status === "2" && <Button variant="success" icon={<CheckCircle2 />} onClick={() => setModal("deliver")}>Confirm delivery</Button>}
          {(status === "2" || status === "3") && o.zb_invoice_id && (
            <>
              <Menu label="Send invoice" variant={status === "2" ? "outline" : "primary"} icon={<Send />} disabled={sendInvoice.isPending} items={[
                { label: "To customer (with delivery OTP)", onClick: () => sendInvoice.mutate("customer") },
                { label: "To customer (with OTP) and transporter", onClick: () => sendInvoice.mutate("customer_transporter") },
              ]} />
              <Menu label="View" icon={<Eye />} items={[
                { label: "Invoice PDF", onClick: viewInvoice },
                { label: "E-invoice in Zoho Books", onClick: () => window.open(`${zohoApp}/invoices/${o.zb_invoice_id}`, "_blank", "noopener") },
                ...(total >= 50000 ? [{ label: "E-way bill", onClick: () => window.open(`${zohoApp}/ewaybills/new?entity_id=${o.zb_invoice_id}&entity_type=invoice`, "_blank", "noopener") }] : []),
              ]} />
            </>
          )}
          {(status === "2" || status === "3") && isCash && (
            <Button variant="outline" icon={<Receipt />} onClick={() => navigate(`/cash-bills?order=${id}`)}>View cash bill</Button>
          )}
          {status === "2" && isCash && (
            <Button variant="outline" busy={sendOtp.isPending} icon={<Send />} onClick={() => sendOtp.mutate(undefined)}>Send delivery OTP</Button>
          )}
        </div>
        {cashMode && status === "1" && <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">Cash bill mode: this order will be billed as cash instead of a Zoho invoice.</div>}
      </Card>

      <Section title="Customer and delivery" icon={<UserRound />}>
        <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-4">
          <KV label="Customer" value={o.customer_name} />
          <KV label="Phone" value={o.customer_phone && <a href={`tel:${o.customer_phone}`} className="inline-flex items-center gap-1 hover:text-primary"><Phone className="h-3 w-3" />{o.customer_phone}</a>} />
          <KV label="Site" value={o.site_name} />
          <KV label="Site contact" value={[o.site_person_name, o.site_person_contact].filter(Boolean).join(" · ")} />
          <KV className="sm:col-span-2" label="Billing address" value={[b.line1, b.line2, b.city, b.state, b.pincode].filter(Boolean).join(", ")} />
          <KV className="sm:col-span-2" label="Delivery address" value={<>
            {[s.line1, s.line2, s.city, s.state, s.pincode].filter(Boolean).join(", ")}
            {s.maps_link && <a className="ml-2 inline-flex items-center gap-1 font-medium text-primary hover:underline" href={s.maps_link} target="_blank" rel="noreferrer"><MapPin className="h-3 w-3" />Map</a>}
          </>} />
          <KV label="Order date" value={fmtDate(o.order_date)} />
          <KV label="Delivery date" value={fmtDate(o.delivery_date)} />
        </div>
      </Section>

      <TransportPanel order={o} onAddVehicle={() => setModal("vehicle")} onSlips={() => setModal("slips")} />

      <Section title="Items" icon={<Boxes />} description={status === "1" ? "Quantities and prices can be edited until the order is billed" : undefined} bodyClassName="p-0">
        <ItemsTable items={o.items} idKey="order_item_id" onSave={status === "1" ? (items) => saveItems.mutate(items) : undefined} saving={saveItems.isPending} />
      </Section>

      {modal === "slips" && <LoadingSlipsModal order={o} onClose={() => setModal(null)} />}
      {modal === "deliver" && <DeliverModal orderId={id} onClose={() => setModal(null)} onDone={() => { setModal(null); onMoved("3"); }} />}
      {modal === "vehicle" && <AddVehicleModal transporterId={o.transporter_id} onClose={() => setModal(null)} />}
      {modal === "cash" && (
        <Modal open onClose={() => setModal(null)} title="Convert to cash bill" size="sm" footer={<><Button variant="outline" onClick={() => setModal(null)}>Cancel</Button><Button onClick={() => { setCashMode(true); setModal(null); }}>Confirm</Button></>}>
          <p className="text-sm text-secondary">Bill order #{id} as cash instead of a Zoho invoice?</p>
        </Modal>
      )}
    </div>
  );
}

// Where the order is in its life: placed, transport, slips, billed, delivered.
function Stepper({ order: o }: { order: any }) {
  const billed = o.order_status === "2" || o.order_status === "3";
  const steps = [
    { label: "Order placed", done: true, note: fmtDate(o.order_date) },
    { label: "Transport", done: !!(o.warehouse_id && o.transporter_id && o.vehicle_id), note: o.vehicle_number ?? (o.transporter_name || "Not assigned") },
    { label: "Loading slips", done: o.loading_slip_items.length > 0, note: o.loading_slip_items.length ? `${o.loading_slip_items.length} slip${o.loading_slip_items.length === 1 ? "" : "s"}` : "Not created" },
    { label: o.payment_type === "cash" ? "Cash bill" : "Invoice", done: billed, note: billed ? (o.zb_invoice_number ?? (o.payment_type === "cash" ? "Generated" : "Done")) : "Pending" },
    { label: "Delivered", done: o.order_status === "3", note: o.order_status === "3" ? "OTP verified" : o.order_status === "2" ? "In transit" : "—" },
  ];
  const current = steps.findIndex((x) => !x.done);
  return (
    <ol className="mt-5 grid grid-cols-5">
      {steps.map((st, i) => {
        const active = i === current;
        return (
          <li key={st.label} className="relative flex min-w-0 flex-col items-center text-center">
            {/* connector to the next step, drawn between the two circles */}
            {i < steps.length - 1 && (
              <span aria-hidden className={clsx("absolute top-[13px] h-0.5 rounded-full", st.done && steps[i + 1].done ? "bg-primary" : st.done ? "bg-primary/40" : "bg-gray-200")}
                style={{ left: "calc(50% + 18px)", right: "calc(-50% + 18px)" }} />
            )}
            <span className={clsx("relative z-10 grid h-7 w-7 place-items-center rounded-full text-xs font-semibold",
              st.done ? "bg-primary text-white" : active ? "border-2 border-primary bg-white text-primary" : "border border-gray-300 bg-white text-gray-500")}>
              {st.done ? <Check className="h-4 w-4" strokeWidth={3} /> : i + 1}
            </span>
            <span className={clsx("mt-2 max-w-full truncate px-1 text-2xs font-medium", st.done || active ? "text-secondary" : "text-gray-500")}>{st.label}</span>
            <span className="hidden max-w-full truncate px-1 text-2xs text-gray-400 sm:block">{st.note}</span>
          </li>
        );
      })}
    </ol>
  );
}

// Transport Details + Dispatch Details panels (container17 / container38)
function TransportPanel({ order: o, onAddVehicle, onSlips }: { order: any; onAddVehicle: () => void; onSlips: () => void }) {
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
  const slips: any[] = o.loading_slip_items;

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <Section title="Transport and dispatch" icon={<Truck />} description={editable ? "Assign the warehouse, transporter and vehicle" : undefined}
        actions={editable && dirty ? <Badge tone="yellow" dot>Unsaved changes</Badge> : undefined}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Warehouse"><Select id="ord-wh" value={f.warehouse_id} disabled={!editable} onChange={(e) => set({ warehouse_id: e.target.value, transporter_id: "", vehicle_id: "" })} placeholder="Select a warehouse" options={(warehouses.data ?? []).map((w) => ({ value: w.warehouse_id, label: w.name }))} /></Field>
          <Field label="Transporter"><Select id="ord-tr" value={f.transporter_id} disabled={!editable || !f.warehouse_id} onChange={(e) => set({ transporter_id: e.target.value, vehicle_id: "" })} placeholder={f.warehouse_id ? "Select a transporter" : "Pick a warehouse first"} options={(transporters.data ?? []).map((t) => ({ value: t.transporter_id, label: t.transporter_name }))} /></Field>
          <Field label="Vehicle number">
            <Select id="ord-veh" value={f.vehicle_id} disabled={!editable || !f.transporter_id} onChange={(e) => set({ vehicle_id: e.target.value })} placeholder={f.transporter_id ? "Select a vehicle" : "Pick a transporter first"} options={(vehicles.data ?? []).map((v) => ({ value: v.vehicle_id, label: v.vehicle_number }))} />
          </Field>
          <Field label="Delivery terms"><Select id="ord-terms" value={f.delivery_terms} disabled={!editable} onChange={(e) => set({ delivery_terms: e.target.value })} placeholder="Select terms" options={["Delivery", "Ex warehouse"].map((x) => ({ value: x, label: x }))} /></Field>
          <Field label="Sub dealer"><Input id="ord-sub" value={f.sub_dealer} disabled={!editable} onChange={(e) => set({ sub_dealer: e.target.value })} placeholder="Optional" /></Field>
          <Field label="PO number"><Input id="ord-po" value={f.po_number} disabled={!editable} onChange={(e) => set({ po_number: e.target.value })} placeholder="Optional" /></Field>
        </div>
        {editable && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button busy={save.isPending} disabled={!dirty} icon={<Save />} onClick={() => save.mutate(undefined)}>Save details</Button>
            <Button variant="outline" busy={notify.isPending} disabled={!o.warehouse_id || !o.transporter_id || !o.vehicle_id || dirty} title={dirty ? "Save details first" : undefined} icon={<Truck />} onClick={() => notify.mutate(undefined)}>Notify transporter</Button>
            <Button variant="ghost" disabled={!o.transporter_id || dirty} title={dirty ? "Save details first" : !o.transporter_id ? "Select a transporter first" : "Add a vehicle that isn't listed"} icon={<Plus />} onClick={onAddVehicle}>Add vehicle</Button>
          </div>
        )}
      </Section>

      <Section title="Loading slips" icon={<PackagePlus />} description={slips.length ? `${slips.length} slip${slips.length === 1 ? "" : "s"}, one per brand` : "One slip per brand for the warehouse"}
        actions={slips.length > 0 ? <Button variant="outline" icon={editable ? <PackagePlus /> : <Eye />} onClick={onSlips}>{editable ? "Manage" : "View"}</Button> : undefined}>
        {slips.length ? (
          <ul className="space-y-1.5">
            {slips.map((r) => (
              <li key={r.loading_slip_item_id} className="flex items-center gap-3 rounded-lg border border-black/[0.06] px-3 py-2">
                <FileText className="h-4 w-4 shrink-0 text-gray-400" />
                <div className="min-w-0 flex-1">
                  <a href={r.url} target="_blank" rel="noreferrer" className="text-xs font-medium text-secondary hover:text-primary">{r.loading_slip_file_name}</a>
                  <div className="truncate text-2xs text-gray-500">{r.brand}{r.warehouse_keeper_name ? ` · ${r.warehouse_keeper_name}` : ""}</div>
                </div>
                <Badge dot tone={r.status === "Sent" ? "green" : r.status === "Cancelled" ? "red" : "gray"}>{r.status === "Active" || !r.status ? "Not sent" : r.status}</Badge>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <div className="text-xs text-gray-500">{editable ? (o.warehouse_id ? "No slips yet." : "Save a warehouse first, then create the slips.") : "No loading slips."}</div>
            {editable && o.warehouse_id && <Button icon={<PackagePlus />} onClick={onSlips}>Create loading slips</Button>}
          </div>
        )}
      </Section>
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
    <Modal open onClose={onClose} title="Manage loading slips" size="lg">
      {editable && (
        <div className="mb-4 flex flex-wrap items-end gap-2 rounded-xl bg-gray-50 p-3">
          <Field label="Loading slip date"><DateInput id="ls-date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
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
    <Modal open onClose={onClose} title="Add new vehicle number" size="sm" footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button busy={add.isPending} disabled={!norm(num) || exists} onClick={() => add.mutate(undefined)}>Save</Button></>}>
      <Field label="Vehicle number"><Input id="new-veh" autoFocus value={num} onChange={(e) => setNum(e.target.value)} placeholder="GJ01AB1234" /></Field>
      {exists && <p className="mt-2 text-xs text-red-700">This vehicle is already added for this transporter.</p>}
      <p className="mt-2 text-[11px] text-gray-500">After saving, pick it in Vehicle Number and Save Details.</p>
    </Modal>
  );
}
