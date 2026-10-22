import { Link, useNavigate } from "react-router-dom";
import { ArrowRightCircle, MapPin, RotateCcw, Send, Trash2 } from "lucide-react";
import { patch, post, useAction, useGet } from "../api";
import { fmtDate, num, plural } from "../format";
import { ItemsTable } from "../components/ItemsEditor";
import { ask, Badge, Button, ErrorBox, Field, KV, Loading, Notice, PageHeader, Section, Select, StatStrip, toast } from "../components/ui";
import { ENQUIRY_STATUS_BADGE } from "./Enquiries";

const link = "underline decoration-line-strong underline-offset-2 hover:decoration-ink";

// Shown on the right of the enquiries split view; the list on the left picks the id.
export default function EnquiryDetail({ id }: { id: number }) {
  const navigate = useNavigate();
  const { data: e, error, isLoading } = useGet<any>(`enquiries/${id}`);
  const warehouses = useGet<any[]>("warehouses");
  const transporters = useGet<any[]>(e?.warehouse_id ? `warehouses/${e.warehouse_id}/transporter-options` : null);
  const del = useAction(() => post(`enquiries/${id}/delete`), ["enquiries", "dashboard"]);
  const restore = useAction(() => post(`enquiries/${id}/restore`), ["enquiries", "dashboard"]);
  const createOrder = useAction(() => post(`enquiries/${id}/create-order`), ["enquiries", "orders", "dashboard"],
    { onSuccess: (r) => r?.order_id && navigate(`/orders/${r.order_id}`) });
  const setTransport = useAction((body: object) => patch(`enquiries/${id}/transport`, body), ["enquiries"], { quiet: true });
  const saveItems = useAction((items: Record<string, unknown>[]) => patch(`enquiries/${id}/items`, { items }), ["enquiries"]);
  const notify = useAction(() => post(`enquiries/${id}/notify-transporter`), [], { onSuccess: (r) => toast(r.note ?? "Enquiry sent to the transporter", r.sent === false ? "warn" : "ok") });

  if (isLoading) return <div className="page"><Loading /></div>;
  if (error || !e) return <div className="page"><PageHeader title={`EN-${id}`} /><ErrorBox error={error ?? new Error("This enquiry doesn't exist.")} /></div>;

  const status = e.enquiry_status as string;
  const st = ENQUIRY_STATUS_BADGE[status];
  const open = status === "0";
  const ready = e.warehouse_id != null && e.transporter_id != null;
  const b = e.billing_address ?? {}, d = e.delivery_address ?? {};
  const total = e.items.reduce((a: number, x: any) => a + Number(x.quantity) * Number(x.unit_price), 0);
  const brands = e.items.map((i: any) => i.brand).filter((x: string, i: number, a: string[]) => x && a.indexOf(x) === i).join(", ");

  return (
    <div className="page">
      <PageHeader title={`Enquiry EN-${e.enquiry_id}`}
        status={<>{st && <Badge dot tone={st.tone}>{st.label}</Badge>}{e.type === "External" && <Badge tone="info">Website</Badge>}</>}
        subtitle={<><span className="font-medium text-ink">{e.customer_name}</span>{e.site_name ? `, ${e.site_name}` : ""}, received {fmtDate(e.enquiry_date)}{e.order_id ? <>, became <Link className={link} to={`/orders/${e.order_id}`}>order #{e.order_id}</Link></> : null}</>}>
        {open && <Button busy={notify.isPending} disabled={e.transporter_id == null} icon={<Send />} onClick={() => notify.mutate(undefined)}
          title={e.transporter_id == null ? "Pick a transporter first" : "Ask the transporter on WhatsApp"}>Ask transporter</Button>}
        {open && <Button variant="primary" busy={createOrder.isPending} disabled={!ready} icon={<ArrowRightCircle />} onClick={() => createOrder.mutate(undefined)}>Create order</Button>}
        {e.order_id && <Link to={`/orders/${e.order_id}`} className="btn-primary">Open order #{e.order_id}</Link>}
        {status === "5" && <Button variant="primary" busy={restore.isPending} icon={<RotateCcw />} onClick={() => restore.mutate(undefined)}>Restore enquiry</Button>}
      </PageHeader>

      {status === "5" && <Notice tone="neutral" title="This enquiry is deleted">The customer was told it was rejected. Restore it to work on it again.</Notice>}
      {open && !ready && <Notice tone="warning">{e.warehouse_id == null ? "Pick the warehouse it ships from, then the transporter, to create the order." : "Pick the transporter to create the order."}</Notice>}

      <StatStrip items={[
        { label: "Enquiry value", value: `₹${num(total)}` },
        { label: "Items", value: num(e.items.length), hint: brands || undefined },
        { label: "Deliver by", value: e.delivery_date ? fmtDate(e.delivery_date) : "-", hint: e.delivery_date ? undefined : "No date given" },
        { label: "Transport", value: e.warehouse_name ?? "Not picked", hint: e.transporter_name ?? (e.warehouse_id != null ? "No transporter yet" : undefined), tone: open && !ready ? "warning" : undefined },
      ]} />

      <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2 [&>*]:flex [&>*]:min-w-0 [&>*>*]:flex-1">
        <div>
          <Section title="Customer and delivery">
            <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
              <KV label="Customer" value={e.customer_name} />
              <KV label="Phone" value={[e.customer_phone, e.additional_phone_1, e.additional_phone_2].filter(Boolean).map((p: string, i: number) => (
                <span key={p}>{i > 0 && ", "}<a href={`tel:${p}`} className={link}>{p}</a></span>
              ))} />
              <KV label="GSTIN" value={e.gstin} />
              <KV label="PAN" value={e.pan} />
              <KV label="Site" value={e.site_name} />
              <KV label="Site contact" value={[e.site_person_name, e.site_person_contact].filter(Boolean).join(", ")} />
              <KV label="TCS" value={e.tcs_status ? "Applies" : "Does not apply"} />
              <KV label="Zoho customer ID" value={e.zb_customer_id} />
              <KV className="sm:col-span-2" label="Billing address" value={[b.line1, b.line2, b.city, b.state, b.pincode].filter(Boolean).join(", ")} />
              <KV className="sm:col-span-2" label="Delivery address" value={<>
                {[d.line1, d.line2, d.city, d.state, d.pincode].filter(Boolean).join(", ")}
                {d.maps_link && <a className="ml-2 inline-flex items-center gap-1 font-medium text-ink underline decoration-line-strong underline-offset-2 hover:decoration-ink" href={d.maps_link} target="_blank" rel="noreferrer"><MapPin className="h-3.5 w-3.5" />Map</a>}
              </>} />
              {e.remarks && <KV className="sm:col-span-2" label="Remarks" value={e.remarks} />}
            </div>
          </Section>
        </div>
        <div>
          <Section title="Transport" description={open ? "Where it ships from and who carries it. Saved as you pick." : undefined}>
            {open ? (
              <div className="grid gap-4">
                <Field label="Warehouse" required>
                  <Select value={e.warehouse_id ?? ""} disabled={setTransport.isPending} onChange={(ev) => setTransport.mutate({ warehouse_id: ev.target.value || null })}
                    placeholder="Select a warehouse" options={(warehouses.data ?? []).map((w) => ({ value: w.warehouse_id, label: w.name }))} />
                </Field>
                <Field label="Transporter" required hint={e.warehouse_id != null && transporters.data && !transporters.data.length ? "No transporters serve this warehouse yet. Add one under Transporters." : undefined}>
                  <Select value={e.transporter_id ?? ""} disabled={e.warehouse_id == null || setTransport.isPending} onChange={(ev) => setTransport.mutate({ transporter_id: ev.target.value || null })}
                    placeholder={e.warehouse_id == null ? "Pick a warehouse first" : "Select a transporter"} options={(transporters.data ?? []).map((t) => ({ value: t.transporter_id, label: t.transporter_name }))} />
                </Field>
              </div>
            ) : (
              <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
                <KV label="Warehouse" value={e.warehouse_name} />
                <KV label="Transporter" value={e.transporter_name} />
                <KV label="Delivery date" value={fmtDate(e.delivery_date)} />
                <KV label="Source" value={e.type ?? "Internal"} />
              </div>
            )}
          </Section>
        </div>
      </div>

      <Section title="Items" meta={plural(e.items.length, "item")} description={open ? "Quantity and price can change until the order is created." : undefined} bodyClassName="p-0">
        <ItemsTable items={e.items} idKey="enquiry_item_id" onSave={open ? (items) => saveItems.mutate(items) : undefined} saving={saveItems.isPending} />
      </Section>

      {open && (
        <div className="no-print flex justify-end">
          <Button variant="danger" busy={del.isPending} icon={<Trash2 />} onClick={async () => (await ask(`Delete enquiry EN-${id}?`, "Delete enquiry", { body: "The customer gets a rejection message on WhatsApp. It can be restored from the Deleted tab." })) && del.mutate(undefined)}>Delete enquiry</Button>
        </div>
      )}
    </div>
  );
}
