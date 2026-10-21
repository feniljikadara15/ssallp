import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Wallet } from "lucide-react";
import { post, useAction, useGet } from "../api";
import { fmtDate, num, plural, today } from "../format";
import { DataTable } from "../components/DataTable";
import { ItemsTable } from "../components/ItemsEditor";
import { Badge, Button, DateInput, ErrorBox, Field, Input, Loading, Modal, Notice, PageHeader, Section, StatStrip } from "../components/ui";

export default function CashBillDetail() {
  const id = Number(useParams().id);
  const [params, setParams] = useSearchParams();
  const { data: o, error, isLoading } = useGet<any>(`cash-bills/${id}`);
  const [collect, setCollect] = useState(params.get("collect") === "1");
  const close = () => { setCollect(false); if (params.get("collect")) setParams({}, { replace: true }); };

  if (isLoading) return <div className="page"><Loading /></div>;
  if (error || !o) return <div className="page"><PageHeader title={`Cash bill #${id}`} breadcrumb={[{ to: "/cash-bills", label: "Cash bills" }]} /><ErrorBox error={error ?? new Error("This cash bill doesn't exist.")} /></div>;

  const itemsTotal = o.items.reduce((a: number, x: any) => a + Number(x.quantity) * Number(x.unit_price), 0);
  const total = Number(o.total_amount ?? itemsTotal);
  const paid = o.payments.reduce((a: number, x: any) => a + Number(x.amount), 0);
  const due = total - paid;
  const pct = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;

  return (
    <div className="page">
      <PageHeader title={`Cash bill #${o.order_id}`} breadcrumb={[{ to: "/cash-bills", label: "Cash bills" }]}
        status={<Badge dot tone={due > 0 ? "danger" : "success"}>{due > 0 ? "Payment due" : "Fully collected"}</Badge>}
        subtitle={<><span className="font-medium text-ink">{o.customer_name}</span>{o.site_name ? `, ${o.site_name}` : ""}, billed {fmtDate(o.order_date)}{o.loading_slip_file_name ? `, ${o.loading_slip_file_name}` : ""}</>}>
        <Link to={`/orders/${o.order_id}`} className="btn">Open order</Link>
        {due > 0 && <Button variant="primary" icon={<Wallet />} onClick={() => setCollect(true)}>Record payment</Button>}
      </PageHeader>

      <StatStrip items={[
        { label: "Bill total", value: `₹${num(total)}` },
        { label: "Collected", value: `₹${num(paid)}`, hint: `${pct}% of the bill` },
        { label: "Due", value: `₹${num(due)}`, tone: due > 0 ? "danger" : "success", hint: due > 0 ? undefined : "Nothing left to collect" },
        { label: "Payments", value: num(o.payments.length), hint: o.payments.length ? `Last on ${fmtDate(o.payments[o.payments.length - 1].collection_date)}` : "None yet" },
      ]} />
      {total !== itemsTotal && <Notice tone="info">The bill total ₹{num(total)} differs from the item total ₹{num(itemsTotal)} because items changed after billing.</Notice>}

      <DataTable title="Payments" filename={`Cash bill ${o.order_id} payments`} rowKey="cash_collected_id" rows={o.payments} search={false} exportable={o.payments.length > 0}
        empty={{ title: "No payments recorded yet", action: due > 0 ? <Button size="sm" variant="primary" icon={<Wallet />} onClick={() => setCollect(true)}>Record payment</Button> : undefined }}
        cols={[
          { key: "collection_date", label: "Date", kind: "date" },
          { key: "receipt_number", label: "Receipt no.", kind: "mono" },
          { key: "payment_mode", label: "Mode", value: (r) => r.payment_mode ?? "Cash" },
          { key: "amount", label: "Amount (₹)", kind: "money", total: true },
        ]} />

      <Section title="Items" meta={plural(o.items.length, "item")} bodyClassName="p-0">
        <ItemsTable items={o.items} />
      </Section>

      {collect && due > 0 && <CollectModal orderId={o.order_id} due={due} onClose={close} />}
    </div>
  );
}

function CollectModal({ orderId, due, onClose }: { orderId: number; due: number; onClose: () => void }) {
  const [amount, setAmount] = useState(String(due));
  const [receipt, setReceipt] = useState("");
  const [date, setDate] = useState(today());
  const save = useAction(() => post(`cash-bills/${orderId}/payments`, { amount: Number(amount), receipt_number: receipt.trim(), collection_date: date }), ["cash-bills", "dashboard"], { onSuccess: onClose });
  const n = Number(amount);
  const over = n > due;
  return (
    <Modal open onClose={onClose} title="Record payment" size="sm"
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" busy={save.isPending} disabled={!(n > 0) || over || !receipt.trim() || !date} onClick={() => save.mutate(undefined)}>Save payment</Button></>}>
      <div className="grid gap-4">
        <Field label="Amount collected (₹)" required hint={over ? <span className="text-danger">More than the ₹{num(due)} due.</span> : `₹${num(due)} due`}>
          <Input id="cc-amount" type="number" inputMode="decimal" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <Field label="Receipt number" required><Input id="cc-receipt" value={receipt} onChange={(e) => setReceipt(e.target.value)} placeholder="As written on the receipt" /></Field>
        <Field label="Collected on" required><DateInput id="cc-date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      </div>
    </Modal>
  );
}
