import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import clsx from "clsx";
import { Check, CheckCircle2, ExternalLink, FileText, MapPin, PackagePlus, Plus, Receipt, RotateCcw, Save, Send, Trash2, Truck, XCircle } from "lucide-react";
import { api, patch, post, useAction, useGet, type Health } from "../api";
import { fmtDate, num, plural, today } from "../format";
import { DataTable } from "../components/DataTable";
import { ItemsTable } from "../components/ItemsEditor";
import { ask, Badge, Button, DateInput, ErrorBox, Field, Input, KV, Loading, Menu, Modal, Notice, PageHeader, Section, Select, StatStrip, toast, type Tone } from "../components/ui";

export const ORDER_STATUS_BADGE: Record<string, { label: string; tone: Tone }> = {
  "1": { label: "Ongoing", tone: "warning" }, "2": { label: "In transit", tone: "info" }, "3": { label: "Delivered", tone: "success" }, "5": { label: "Deleted", tone: "neutral" },
};

export default function OrderDetail() {
  const id = Number(useParams().id);
  const navigate = useNavigate();
  const { data: o, error, isLoading } = useGet<any>(`orders/${id}`);
  const health = useGet<Health & { zohoOrgId?: string }>("health");
  const [cashMode, setCashMode] = useState(false);
  const [modal, setModal] = useState<null | "slips" | "deliver" | "vehicle">(null);
  useEffect(() => setCashMode(false), [id]);

  const refresh = ["orders", "cash-bills", "loading-slips", "dashboard"];
  const del = useAction(() => post(`orders/${id}/delete`), refresh);
  const restore = useAction(() => post(`orders/${id}/restore`), refresh);
  const invoice = useAction(() => post(`orders/${id}/invoice`), refresh);
  const cashBill = useAction(() => post(`orders/${id}/cash-bill`), refresh, { onSuccess: () => setCashMode(false) });
  const sendInvoice = useAction((to: string) => post(`orders/${id}/send-invoice`, { to }), []);
  const sendOtp = useAction(() => post(`orders/${id}/send-otp`), []);
  const saveItems = useAction((items: Record<string, unknown>[]) => patch(`orders/${id}/items`, { items }), ["orders"]);
  const sendSlip = useAction((sid: number) => post(`loading-slip-items/${sid}/send`), ["orders", "loading-slips"]);
  const cancelSlip = useAction((sid: number) => post(`loading-slip-items/${sid}/cancel`), ["orders", "loading-slips"]);

  if (isLoading) return <div className="page"><Loading /></div>;
  if (error || !o) return <div className="page"><PageHeader title={`Order #${id}`} breadcrumb={[{ to: "/orders", label: "Orders" }]} /><ErrorBox error={error ?? new Error("This order doesn't exist.")} /></div>;

  const status = o.order_status as string;
  const st = ORDER_STATUS_BADGE[status];
  const b = o.billing_address ?? {}, s = o.shipping_address ?? {};
  const total = o.items.reduce((a: number, x: any) => a + Number(x.unit_price) * Number(x.quantity), 0);
  const isCash = o.payment_type === "cash";
  const slips: any[] = o.loading_slip_items;
  const sent = slips.filter((x) => x.status === "Sent").length;
  const zohoApp = `https://books.zoho.in/app/${health.data?.zohoOrgId ?? "60031284196"}#`;
  const viewInvoice = async () => {
    if (o.zb_invoice_url) return void window.open(o.zb_invoice_url, "_blank", "noopener");
    try { const r = await api(`orders/${id}/invoice-link`); window.open(r.url, "_blank", "noopener"); } catch (e) { toast("Invoice not available", "error", (e as Error).message); }
  };
  // Why billing can't run yet, in the reader's words (null when it can).
  const blocker = status !== "1" ? null
    : o.loading_slip_count < 1 ? "Create the loading slips first, so the warehouse knows what to load."
    : cashMode ? (o.loading_slip_count !== 1 ? "A cash bill needs exactly one loading slip." : null)
    : !o.vehicle_id || !o.delivery_terms ? "Save the vehicle and delivery terms in Transport, then generate the invoice." : null;

  return (
    <div className="page">
      <PageHeader title={`Order #${o.order_id}`} breadcrumb={[{ to: "/orders", label: "Orders" }]}
        status={st && <Badge dot tone={st.tone}>{st.label}</Badge>}
        subtitle={<><span className="font-medium text-ink">{o.customer_name}</span>{o.site_name ? `, ${o.site_name}` : ""}, ordered {fmtDate(o.order_date)}{o.order_number ? ` (${o.order_number})` : ""}{o.enquiry_id ? <> from <Link className="underline decoration-line-strong underline-offset-2 hover:text-ink" to={`/enquiries/${o.enquiry_id}`}>EN-{o.enquiry_id}</Link></> : null}</>}>
        {status === "1" && (cashMode
          ? <><Button onClick={() => setCashMode(false)}>Bill by invoice instead</Button><Button variant="primary" busy={cashBill.isPending} disabled={!!blocker} icon={<Receipt />} onClick={() => cashBill.mutate(undefined)}>Generate cash bill</Button></>
          : <><Button icon={<Receipt />} onClick={async () => (await ask(`Bill order #${id} as cash?`, "Bill as cash", { body: "It is billed as a cash bill instead of a Zoho Books invoice. Nothing changes until you generate the bill." })) && setCashMode(true)}>Bill as cash</Button>
              <Button variant="primary" busy={invoice.isPending} disabled={!!blocker} icon={<FileText />} onClick={() => invoice.mutate(undefined)}>Generate invoice</Button></>)}
        {(status === "2" || status === "3") && o.zb_invoice_id && <>
          <Menu label="View" items={[
            { label: "Invoice PDF", hint: "From Zoho Books", onClick: viewInvoice },
            { label: "E-invoice in Zoho Books", onClick: () => window.open(`${zohoApp}/invoices/${o.zb_invoice_id}`, "_blank", "noopener") },
            ...(total >= 50000 ? [{ label: "E-way bill", hint: "Needed above ₹50,000", onClick: () => window.open(`${zohoApp}/ewaybills/new?entity_id=${o.zb_invoice_id}&entity_type=invoice`, "_blank", "noopener") }] : []),
          ]} />
          <Menu label="Send invoice" icon={<Send />} disabled={sendInvoice.isPending} items={[
            { label: "To the customer", hint: "With the delivery OTP", onClick: () => sendInvoice.mutate("customer") },
            { label: "To the customer and transporter", hint: "Customer gets the OTP", onClick: () => sendInvoice.mutate("customer_transporter") },
          ]} />
        </>}
        {(status === "2" || status === "3") && isCash && <Button icon={<Receipt />} onClick={() => navigate(`/cash-bills/${id}`)}>Cash bill</Button>}
        {status === "2" && isCash && <Button busy={sendOtp.isPending} icon={<Send />} onClick={() => sendOtp.mutate(undefined)}>Send delivery OTP</Button>}
        {status === "2" && <Button variant="primary" icon={<CheckCircle2 />} onClick={() => setModal("deliver")}>Confirm delivery</Button>}
        {status === "5" && <Button variant="primary" busy={restore.isPending} icon={<RotateCcw />} onClick={() => restore.mutate(undefined)}>Restore order</Button>}
      </PageHeader>

      {status === "5" ? <Notice tone="neutral" title="This order is deleted">It no longer appears in the order lists. Restore it to work on it again.</Notice> : <Stepper order={o} />}
      {cashMode && status === "1" && <Notice tone="info" title="Billing as cash">Generate cash bill creates the bill and moves the order to in transit. No Zoho Books invoice is made.</Notice>}
      {blocker && <Notice tone="warning">{blocker}</Notice>}

      <StatStrip items={[
        { label: status === "1" ? "Order value" : "Billed amount", value: `₹${num(o.total_amount ?? total)}` },
        { label: "Items", value: num(o.items.length), hint: o.items.map((i: any) => i.brand).filter((x: string, i: number, a: string[]) => x && a.indexOf(x) === i).join(", ") || undefined },
        { label: "Loading slips", value: num(slips.length), hint: slips.length ? `${num(sent)} sent to warehouse` : "Not created", tone: slips.length ? undefined : "warning" },
        { label: "Billing", value: o.zb_invoice_number ?? (isCash ? "Cash bill" : status === "1" ? "Not billed" : "Invoice"), hint: isCash && o.total_amount ? `₹${num(o.total_collected ?? 0)} collected` : o.delivery_terms ?? undefined },
      ]} />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 [&>*]:flex [&>*]:min-w-0 [&>*>*]:flex-1">
        <div>
          <Section title="Customer and delivery">
            <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
              <KV label="Customer" value={o.customer_name} />
              <KV label="Phone" value={o.customer_phone && <a href={`tel:${o.customer_phone}`} className="underline decoration-line-strong underline-offset-2 hover:decoration-ink">{o.customer_phone}</a>} />
              <KV label="GSTIN" value={o.gstin} />
              <KV label="TCS" value={o.tcs_status ? "Applies" : "Does not apply"} />
              <KV label="Site" value={o.site_name} />
              <KV label="Site contact" value={[o.site_person_name, o.site_person_contact].filter(Boolean).join(", ")} />
              <KV className="sm:col-span-2" label="Billing address" value={[b.line1, b.line2, b.city, b.state, b.pincode].filter(Boolean).join(", ")} />
              <KV className="sm:col-span-2" label="Delivery address" value={<>
                {[s.line1, s.line2, s.city, s.state, s.pincode].filter(Boolean).join(", ")}
                {s.maps_link && <a className="ml-2 inline-flex items-center gap-1 font-medium text-brand underline-offset-2 hover:underline" href={s.maps_link} target="_blank" rel="noreferrer"><MapPin className="h-3.5 w-3.5" />Map</a>}
              </>} />
              <KV label="Delivery date" value={fmtDate(o.delivery_date)} />
            </div>
          </Section>
        </div>
        <div><TransportPanel order={o} onAddVehicle={() => setModal("vehicle")} /></div>
      </div>

      <DataTable title="Loading slips" filename={`Order ${o.order_id} loading slips`} rowKey="loading_slip_item_id" rows={slips} search={false} exportable={slips.length > 0}
        empty={{ title: "No loading slips yet", hint: status === "1" ? (o.warehouse_id ? "Create them to send one slip per brand to the warehouse keepers." : "Save a warehouse in Transport first.") : undefined,
          action: status === "1" && o.warehouse_id ? <Button size="sm" variant="primary" icon={<PackagePlus />} onClick={() => setModal("slips")}>Create loading slips</Button> : undefined }}
        actions={status === "1" && slips.length > 0 && <Button size="sm" icon={<PackagePlus />} onClick={() => setModal("slips")}>Recreate</Button>}
        rowActions={(r) => [
          { kind: "open", label: `Open ${r.loading_slip_file_name}`, icon: <ExternalLink />, href: r.url },
          ...(status === "1" && r.status !== "Cancelled" ? [
            { kind: "send" as const, label: `Send ${r.loading_slip_file_name} to the warehouse keeper`, icon: <Send />, onClick: () => sendSlip.mutate(r.loading_slip_item_id), disabled: sendSlip.isPending },
            { kind: "delete" as const, label: `Cancel ${r.loading_slip_file_name}`, icon: <XCircle />, onClick: async () => (await ask(`Cancel loading slip ${r.loading_slip_file_name}?`, "Cancel slip", { body: "The warehouse keeper gets a cancellation message on WhatsApp." })) && cancelSlip.mutate(r.loading_slip_item_id) },
          ] : []),
        ]}
        cols={[
          { key: "loading_slip_file_name", label: "Slip", render: (r) => <a href={r.url} target="_blank" rel="noreferrer" className="font-medium text-ink underline decoration-line-strong underline-offset-2 hover:decoration-ink">{r.loading_slip_file_name}</a> },
          { key: "brand", label: "Brand" },
          { key: "warehouse_keeper_name", label: "Warehouse keeper", render: (r) => r.warehouse_keeper_name || <Badge tone="warning">Not assigned</Badge>, sub: (r) => r.warehouse_keeper_phone },
          { key: "status", label: "Status", value: (r) => (r.status === "Created" || r.status === "Active" || !r.status ? "Not sent" : r.status),
            render: (r) => <Badge dot tone={r.status === "Sent" ? "success" : r.status === "Cancelled" ? "danger" : "neutral"}>{r.status === "Created" || r.status === "Active" || !r.status ? "Not sent" : r.status}</Badge> },
        ]} />

      <Section title="Items" meta={plural(o.items.length, "item")} description={status === "1" ? "Quantity and price can change until the order is billed." : undefined} bodyClassName="p-0">
        <ItemsTable items={o.items} idKey="order_item_id" onSave={status === "1" ? (items) => saveItems.mutate(items) : undefined} saving={saveItems.isPending} />
      </Section>

      {/* Deleting ends the order's life: kept apart from the everyday actions in the header. */}
      {status === "1" && (
        <div className="no-print flex justify-end">
          <Button variant="danger" busy={del.isPending} icon={<Trash2 />} onClick={async () => (await ask(`Delete order #${id}?`, "Delete order", { body: "It moves to the Deleted tab and can be restored from there or from the Audit log." })) && del.mutate(undefined)}>Delete order</Button>
        </div>
      )}

      {modal === "slips" && <CreateSlipsModal order={o} onClose={() => setModal(null)} />}
      {modal === "deliver" && <DeliverModal orderId={id} onClose={() => setModal(null)} />}
      {modal === "vehicle" && <AddVehicleModal transporterId={o.transporter_id} onClose={() => setModal(null)} />}
    </div>
  );
}

// Where the order is in its life: placed, transport, slips, billed, delivered.
function Stepper({ order: o }: { order: any }) {
  const billed = o.order_status === "2" || o.order_status === "3";
  const steps = [
    { label: "Order placed", done: true, note: fmtDate(o.order_date) },
    { label: "Transport", done: !!(o.warehouse_id && o.transporter_id && o.vehicle_id), note: o.vehicle_number ?? (o.transporter_name || "Not assigned") },
    { label: "Loading slips", done: o.loading_slip_items.length > 0, note: o.loading_slip_items.length ? plural(o.loading_slip_items.length, "slip") : "Not created" },
    { label: o.payment_type === "cash" ? "Cash bill" : "Invoice", done: billed, note: billed ? (o.zb_invoice_number ?? (o.payment_type === "cash" ? "Generated" : "Done")) : "Pending" },
    { label: "Delivered", done: o.order_status === "3", note: o.order_status === "3" ? "OTP verified" : o.order_status === "2" ? "In transit" : "-" },
  ];
  const current = steps.findIndex((x) => !x.done);
  return (
    <div className="card px-4 py-5">
      <ol className="grid grid-cols-5" aria-label="Order progress">
        {steps.map((st, i) => {
          const active = i === current;
          return (
            <li key={st.label} className="relative flex min-w-0 flex-col items-center text-center" aria-current={active ? "step" : undefined}>
              {i < steps.length - 1 && (
                <span aria-hidden className={clsx("absolute top-[13px] h-0.5 rounded-full", st.done && steps[i + 1].done ? "bg-brand-fill" : st.done ? "bg-brand-fill/40" : "bg-line")}
                  style={{ left: "calc(50% + 18px)", right: "calc(-50% + 18px)" }} />
              )}
              <span className={clsx("relative z-10 grid h-7 w-7 place-items-center rounded-full text-[12px] font-semibold",
                st.done ? "bg-brand-fill text-white" : active ? "border-2 border-brand bg-surface text-brand" : "border border-line-strong bg-surface text-faint")}>
                {st.done ? <Check className="h-4 w-4" strokeWidth={3} /> : i + 1}
              </span>
              <span className={clsx("mt-2 max-w-full truncate px-1 text-[12px] font-medium", st.done || active ? "text-ink" : "text-faint")}>{st.label}</span>
              <span className="hidden max-w-full truncate px-1 text-[12px] text-faint sm:block">{st.note}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function TransportPanel({ order: o, onAddVehicle }: { order: any; onAddVehicle: () => void }) {
  const editable = o.order_status === "1";
  const initial = () => ({
    warehouse_id: o.warehouse_id ?? "", transporter_id: o.transporter_id ?? "", vehicle_id: o.vehicle_id ?? "",
    delivery_terms: o.delivery_terms ?? "", po_number: o.po_number ?? "", sub_dealer: o.sub_dealer ?? "",
  });
  const [f, setF] = useState(initial);
  useEffect(() => setF(initial()), [o.order_id, o.warehouse_id, o.transporter_id, o.vehicle_id, o.delivery_terms, o.po_number, o.sub_dealer]); // eslint-disable-line react-hooks/exhaustive-deps
  const warehouses = useGet<any[]>("warehouses");
  const transporters = useGet<any[]>(f.warehouse_id ? `warehouses/${f.warehouse_id}/transporter-options` : null);
  const vehicles = useGet<any[]>(f.transporter_id ? `transporters/${f.transporter_id}/vehicles` : null);
  const save = useAction(() => patch(`orders/${o.order_id}`, f), ["orders"]);
  const notify = useAction(() => post(`orders/${o.order_id}/notify-transporter`), [], { quiet: true, onSuccess: (r) => (r.sent === false ? toast("Transporter not notified", "warn", r.note) : toast("Order details sent to the transporter")) });
  const dirty = JSON.stringify(f) !== JSON.stringify(initial());
  const set = (p: Partial<ReturnType<typeof initial>>) => setF({ ...f, ...p });

  return (
    <Section title="Transport" description={editable ? "Warehouse, transporter and vehicle for this order" : undefined}
      actions={editable && dirty ? <Badge tone="warning" dot>Unsaved changes</Badge> : undefined}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Warehouse"><Select id="ord-wh" value={f.warehouse_id} disabled={!editable} onChange={(e) => set({ warehouse_id: e.target.value, transporter_id: "", vehicle_id: "" })} placeholder="Select a warehouse" options={(warehouses.data ?? []).map((w) => ({ value: w.warehouse_id, label: w.name }))} /></Field>
        <Field label="Transporter"><Select id="ord-tr" value={f.transporter_id} disabled={!editable || !f.warehouse_id} onChange={(e) => set({ transporter_id: e.target.value, vehicle_id: "" })} placeholder={f.warehouse_id ? "Select a transporter" : "Pick a warehouse first"} options={(transporters.data ?? []).map((t) => ({ value: t.transporter_id, label: t.transporter_name }))} /></Field>
        <Field label="Vehicle number"><Select id="ord-veh" value={f.vehicle_id} disabled={!editable || !f.transporter_id} onChange={(e) => set({ vehicle_id: e.target.value })} placeholder={f.transporter_id ? "Select a vehicle" : "Pick a transporter first"} options={(vehicles.data ?? []).map((v) => ({ value: v.vehicle_id, label: v.vehicle_number }))} /></Field>
        <Field label="Delivery terms"><Select id="ord-terms" value={f.delivery_terms} disabled={!editable} onChange={(e) => set({ delivery_terms: e.target.value })} placeholder="Select terms" options={["Delivery", "Ex warehouse"].map((x) => ({ value: x, label: x }))} /></Field>
        <Field label="Sub dealer"><Input id="ord-sub" value={f.sub_dealer} disabled={!editable} onChange={(e) => set({ sub_dealer: e.target.value })} placeholder="Optional" /></Field>
        <Field label="PO number"><Input id="ord-po" value={f.po_number} disabled={!editable} onChange={(e) => set({ po_number: e.target.value })} placeholder="Optional" /></Field>
      </div>
      {editable && (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
          <Button variant="primary" busy={save.isPending} disabled={!dirty} icon={<Save />} onClick={() => save.mutate(undefined)}>Save transport</Button>
          <Button busy={notify.isPending} disabled={!o.warehouse_id || !o.transporter_id || !o.vehicle_id || dirty} title={dirty ? "Save first" : undefined} icon={<Truck />} onClick={() => notify.mutate(undefined)}>Notify transporter</Button>
          <Button variant="ghost" disabled={!o.transporter_id || dirty} title={dirty ? "Save first" : !o.transporter_id ? "Pick a transporter first" : "Add a vehicle that isn't listed"} icon={<Plus />} onClick={onAddVehicle}>Add vehicle</Button>
        </div>
      )}
    </Section>
  );
}

function CreateSlipsModal({ order: o, onClose }: { order: any; onClose: () => void }) {
  const [date, setDate] = useState(today());
  const create = useAction(() => post(`orders/${o.order_id}/loading-slips`, { date }), ["orders", "loading-slips"], { onSuccess: onClose });
  const existing = o.loading_slip_items.length;
  return (
    <Modal open onClose={onClose} title={existing ? "Recreate loading slips" : "Create loading slips"} size="sm"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" busy={create.isPending} disabled={!date} icon={<PackagePlus />} onClick={() => create.mutate(undefined)}>{existing ? "Replace slips" : "Create slips"}</Button></>}>
      <div className="space-y-3">
        <Field label="Loading slip date" required><DateInput id="ls-date" value={date} onChange={(e) => setDate(e.target.value)} clearable={false} /></Field>
        <p className="text-[13px] text-muted">One slip per brand in this order that the warehouse stocks. {existing ? `The ${plural(existing, "current slip")} will be replaced.` : ""}</p>
      </div>
    </Modal>
  );
}

function DeliverModal({ orderId, onClose }: { orderId: number; onClose: () => void }) {
  const [otp, setOtp] = useState("");
  const verify = useAction(() => post(`orders/${orderId}/deliver`, { otp }), ["orders", "cash-bills", "dashboard"], { onSuccess: onClose });
  return (
    <Modal open onClose={onClose} title="Confirm delivery" size="sm"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" busy={verify.isPending} disabled={!otp.trim()} onClick={() => verify.mutate(undefined)}>Verify OTP</Button></>}>
      <Field label="Delivery OTP" hint="The customer gets it on WhatsApp with the invoice, or from Send delivery OTP for cash bills.">
        <Input id="otp" inputMode="numeric" value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="6-digit code" onKeyDown={(e) => e.key === "Enter" && otp && verify.mutate(undefined)} />
      </Field>
    </Modal>
  );
}

function AddVehicleModal({ transporterId, onClose }: { transporterId: number; onClose: () => void }) {
  const [v, setV] = useState("");
  const vehicles = useGet<any[]>(`transporters/${transporterId}/vehicles`);
  const norm = (x: string) => x.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const exists = !!v && (vehicles.data ?? []).some((x) => norm(x.vehicle_number) === norm(v));
  const add = useAction(() => post(`transporters/${transporterId}/vehicles`, { vehicle_number: v }), ["transporters", "vehicle-details"], { onSuccess: onClose });
  return (
    <Modal open onClose={onClose} title="Add a vehicle" size="sm"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" busy={add.isPending} disabled={!norm(v) || exists} onClick={() => add.mutate(undefined)}>Add vehicle</Button></>}>
      <Field label="Vehicle number" required hint={exists ? <span className="text-danger">This transporter already has this vehicle.</span> : "Then pick it under Vehicle number and save."}>
        <Input id="new-veh" value={v} onChange={(e) => setV(e.target.value.toUpperCase())} placeholder="GJ01AB1234" />
      </Field>
    </Modal>
  );
}

