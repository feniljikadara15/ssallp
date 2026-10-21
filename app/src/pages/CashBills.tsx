import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Banknote, Boxes, Download, ReceiptText, Wallet } from "lucide-react";
import { api, post, useAction, useGet } from "../api";
import { exportRows, fmtDate, includes, inRange, inr, stamp, today } from "../format";
import { Badge, Button, Card, DataTable, EmptyState, ErrorBox, Field, Input, KV, Loading, Modal, PageHeader, SearchInput, Section, Tabs, toast, DateInput } from "../components/ui";
import ListItem, { revealDetail } from "../components/ListItem";
import { ItemsTable } from "../components/ItemsEditor";

type Tab = "pending" | "collected";
const last4 = (v: unknown) => String(v ?? "").replace(/.*(\d{4})$/, "$1");

export default function CashBills() {
  const [params] = useSearchParams();
  const [tab, setTab] = useState<Tab>("pending");
  const pending = useGet<any[]>("cash-bills?tab=pending");
  const collected = useGet<any[]>("cash-bills?tab=collected");
  const [party, setParty] = useState("");
  const [num, setNum] = useState("");
  const [ls, setLs] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sel, setSel] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);

  // Arriving from an order's "View Cash Bill" button
  useEffect(() => {
    const id = Number(params.get("order"));
    if (!id || !pending.data || !collected.data) return;
    setSel(id);
    setTab(collected.data.some((o) => o.order_id === id) ? "collected" : "pending");
  }, [params, pending.data, collected.data]);

  const source = tab === "pending" ? pending : collected;
  const list = useMemo(() => (source.data ?? []).filter((o) =>
    includes(o.customer_name, party) &&
    (!num.trim() || String(o.order_id).includes(num.trim()) || last4(o.order_number).includes(num.trim())) &&
    (!ls.trim() || includes(o.loading_slip_file_name, ls) || last4(o.loading_slip_number).includes(ls.trim())) &&
    inRange(o.order_date, from, to)), [source.data, party, num, ls, from, to]);

  const exportXlsx = async () => {
    setExporting(true);
    try {
      const rows = await api(`cash-bills-export?tab=${tab}&start=${from}&end=${to}`);
      const name = tab === "pending" ? "Cash Bills Pending" : "Cash Bills Collected";
      await exportRows(rows, `${name} - ${stamp()}`, "xlsx", name);
    } catch (e) { toast((e as Error).message, "error"); }
    setExporting(false);
  };

  return (
    <div>
      <PageHeader title="Cash Bills" description="Orders billed as cash and the payments collected against them">
        <Button variant="outline" busy={exporting} icon={<Download />} onClick={exportXlsx}>Export</Button>
      </PageHeader>
      <div className="grid items-start gap-5 lg:grid-cols-[380px_minmax(0,1fr)] [&>*]:min-w-0">
        <Card className="flex flex-col p-3 lg:sticky lg:top-0 lg:max-h-[calc(100vh-120px)]">
          <Tabs value={tab} onChange={(t) => { setTab(t); setSel(null); }} tabs={[
            { value: "pending", label: "Pending", count: pending.data?.length },
            { value: "collected", label: "Collected", count: collected.data?.length },
          ]} />
          <div className="mt-3 shrink-0 space-y-2">
            <SearchInput value={party} onChange={setParty} placeholder="Search customer" />
            <div className="grid grid-cols-2 gap-2">
              <SearchInput value={num} onChange={setNum} placeholder="Order no." />
              <SearchInput value={ls} onChange={setLs} placeholder="Loading slip no." />
              <DateInput aria-label="From date" placeholder="From" value={from} onChange={(e) => setFrom(e.target.value)} />
              <DateInput aria-label="To date" placeholder="To" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
          <div className="mt-3 flex shrink-0 items-center justify-between px-1 text-2xs text-gray-500">
            <span>{list.length} bill{list.length === 1 ? "" : "s"}{tab === "pending" && list.length > 0 && <> · {inr(list.reduce((a, o) => a + Number(o.total_amount) - Number(o.total_collected), 0))} due</>}</span>
            {(party || num || ls || from || to) && <button className="font-medium text-primary hover:underline" onClick={() => { setParty(""); setNum(""); setLs(""); setFrom(""); setTo(""); }}>Clear filters</button>}
          </div>
          <div className="-mx-1 mt-1 min-h-[200px] flex-1 space-y-0.5 overflow-y-auto px-1">
            {source.isLoading && <Loading variant="inline" />}
            {source.error && <ErrorBox error={source.error} />}
            {list.map((o) => (
              <ListItem key={o.order_id} active={sel === o.order_id} onClick={() => { setSel(o.order_id); revealDetail(); }}
                title={o.customer_name ?? "—"}
                subtitle={[`#${o.order_id}`, o.loading_slip_file_name].filter(Boolean).join(" · ")}
                tag={tab === "pending" ? <Badge tone="red">Due {inr(o.total_amount - o.total_collected)}</Badge> : <Badge tone="green">Collected</Badge>}
                right={fmtDate(o.order_date)}
                rightSub={inr(o.total_amount)} />
            ))}
            {source.data && !list.length && <div className="py-10 text-center text-xs text-gray-400">{tab === "pending" ? "No cash pending" : "No collected bills"}</div>}
          </div>
        </Card>
        <div id="detail-panel" className="min-w-0 scroll-mt-4">{sel ? <CashBillDetail id={sel} /> : <EmptyState icon={<Banknote className="h-5 w-5" />} text="Pick a cash bill to see what's been collected and record a payment." />}</div>
      </div>
    </div>
  );
}

function CashBillDetail({ id }: { id: number }) {
  const { data: o, error, isLoading } = useGet<any>(`cash-bills/${id}`);
  const [collect, setCollect] = useState(false);
  if (isLoading) return <Card className="p-5"><Loading variant="inline" /></Card>;
  if (error || !o) return <Card className="p-5"><ErrorBox error={error} /></Card>;
  const itemsTotal = o.items.reduce((a: number, x: any) => a + Number(x.total_price ?? Number(x.quantity) * Number(x.unit_price)), 0);
  const paid = o.payments.reduce((a: number, x: any) => a + Number(x.amount), 0);
  const pendingAmt = itemsTotal - paid;
  const total = Number(o.total_amount ?? itemsTotal);
  const pct = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;
  return (
    <div className="min-w-0 space-y-4">
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-2xs font-medium text-gray-500">
              <span>Order #{o.order_id}</span>{o.order_number && <><span className="text-gray-300">/</span><span>{o.order_number}</span></>}
              {o.loading_slip_file_name && <><span className="text-gray-300">/</span><span>{o.loading_slip_file_name}</span></>}
            </div>
            <h2 className="mt-1 truncate text-xl font-semibold tracking-tight text-secondary">{o.customer_name}</h2>
            <div className="mt-2"><Badge dot tone={pendingAmt > 0 ? "red" : "green"}>{pendingAmt > 0 ? "Payment due" : "Fully collected"}</Badge></div>
          </div>
          {pendingAmt > 0 && <Button icon={<Wallet />} onClick={() => setCollect(true)}>Record payment</Button>}
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <KV label="Bill total" value={<span className="tabular text-base font-semibold">{inr(total)}</span>} />
          <KV label="Collected" value={<span className="tabular text-base font-semibold text-emerald-700">{inr(paid)}</span>} />
          <KV label="Due" value={<span className={`tabular text-base font-semibold ${pendingAmt > 0 ? "text-red-700" : "text-secondary"}`}>{inr(pendingAmt)}</span>} />
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Collected">
          <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-1 text-2xs text-gray-500">{pct}% collected · billed {fmtDate(o.order_date)}</div>
      </Card>
      <Section title="Payments" icon={<ReceiptText />} description={o.payments.length ? `${o.payments.length} payment${o.payments.length === 1 ? "" : "s"} recorded` : undefined} bodyClassName="p-0">
        <DataTable rows={o.payments} rowKey={(r: any) => r.cash_collected_id} empty="No payments collected yet" columns={[
          { key: "collection_date", label: "Date", render: (r: any) => fmtDate(r.collection_date) },
          { key: "receipt_number", label: "Receipt no." },
          { key: "payment_mode", label: "Mode", render: (r: any) => r.payment_mode ?? "Cash" },
          { key: "amount", label: "Amount", align: "right", render: (r: any) => <span className="font-medium">{inr(r.amount)}</span> },
        ]} />
      </Section>
      <Section title="Items" icon={<Boxes />} bodyClassName="p-0">
        <ItemsTable items={o.items} />
      </Section>
      {collect && <CollectModal orderId={o.order_id} pending={pendingAmt} onClose={() => setCollect(false)} />}
    </div>
  );
}

function CollectModal({ orderId, pending, onClose }: { orderId: number; pending: number; onClose: () => void }) {
  const [amount, setAmount] = useState(String(pending));
  const [receipt, setReceipt] = useState("");
  const [date, setDate] = useState(today());
  const save = useAction(() => post(`cash-bills/${orderId}/payments`, { amount: Number(amount), receipt_number: receipt, collection_date: date }), ["cash-bills"], { onSuccess: onClose });
  const n = Number(amount);
  return (
    <Modal open onClose={onClose} title="Record payment" size="sm" footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button busy={save.isPending} disabled={!(n > 0) || n > pending || !receipt.trim()} onClick={() => save.mutate(undefined)}>Save</Button></>}>
      <div className="space-y-3">
        <Field label={`Amount collected (due ${inr(pending)})`}><Input id="cc-amount" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
        {n > pending && <p className="text-xs text-red-700">That's more than the pending amount.</p>}
        <Field label="Receipt number"><Input id="cc-receipt" value={receipt} onChange={(e) => setReceipt(e.target.value)} placeholder="Enter receipt number" /></Field>
        <Field label="Collection date"><DateInput id="cc-date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      </div>
    </Modal>
  );
}
