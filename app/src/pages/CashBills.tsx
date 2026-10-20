import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Download, Wallet } from "lucide-react";
import { api, post, useAction, useGet } from "../api";
import { exportRows, fmtDate, includes, inRange, inr, stamp, today } from "../format";
import { Badge, Button, Card, DataTable, EmptyState, ErrorBox, Field, Input, KV, Loading, Modal, PageHeader, SearchInput, Tabs, toast } from "../components/ui";
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
      <PageHeader title="Cash Bills">
        <Button variant="outline" busy={exporting} icon={<Download className="h-3.5 w-3.5" />} onClick={exportXlsx}>Export</Button>
      </PageHeader>
      <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)] [&>*]:min-w-0">
        <Card className="p-3">
          <Tabs value={tab} onChange={(t) => { setTab(t); setSel(null); }} tabs={[
            { value: "pending", label: "Pending", count: pending.data?.length },
            { value: "collected", label: "Collected", count: collected.data?.length },
          ]} />
          <div className="mt-3 space-y-2">
            <SearchInput value={party} onChange={setParty} placeholder="Search by Party Name" />
            <div className="grid grid-cols-2 gap-2">
              <SearchInput value={num} onChange={setNum} placeholder="Order Number" />
              <SearchInput value={ls} onChange={setLs} placeholder="Loading Slip No." />
              <Input type="date" aria-label="From date" value={from} onChange={(e) => setFrom(e.target.value)} />
              <Input type="date" aria-label="To date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
          <div className="mt-3 max-h-[calc(100vh-340px)] space-y-2 overflow-y-auto pr-1">
            {source.isLoading && <Loading />}
            {source.error && <ErrorBox error={source.error} />}
            {list.map((o) => (
              <ListItem key={o.order_id} active={sel === o.order_id} onClick={() => { setSel(o.order_id); revealDetail(); }}
                title={`OD - ${o.customer_name ?? ""} - ${o.order_id}`}
                subtitle={`${o.loading_slip_file_name ?? o.order_number ?? ""} · ${inr(o.total_amount)}${tab === "pending" ? ` · due ${inr(o.total_amount - o.total_collected)}` : ""}`}
                right={fmtDate(o.order_date)} />
            ))}
            {source.data && !list.length && <div className="py-8 text-center text-xs text-gray-400">No cash bills</div>}
          </div>
        </Card>
        <div id="detail-panel" className="min-w-0 scroll-mt-4">{sel ? <CashBillDetail id={sel} /> : <EmptyState text="Select a cash bill to view details" />}</div>
      </div>
    </div>
  );
}

function CashBillDetail({ id }: { id: number }) {
  const { data: o, error, isLoading } = useGet<any>(`cash-bills/${id}`);
  const [collect, setCollect] = useState(false);
  if (isLoading) return <Card className="p-5"><Loading /></Card>;
  if (error || !o) return <Card className="p-5"><ErrorBox error={error} /></Card>;
  const itemsTotal = o.items.reduce((a: number, x: any) => a + Number(x.total_price ?? Number(x.quantity) * Number(x.unit_price)), 0);
  const paid = o.payments.reduce((a: number, x: any) => a + Number(x.amount), 0);
  const pendingAmt = itemsTotal - paid;
  return (
    <Card className="min-w-0 p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-medium text-secondary">Cash Bill: Order #{o.order_id}</h2>
          <div className="text-xs font-bold text-gray-600">{o.order_number}</div>
        </div>
        {pendingAmt > 0 && <Button icon={<Wallet className="h-3.5 w-3.5" />} onClick={() => setCollect(true)}>Collect Payment</Button>}
      </div>
      <h3 className="mb-2 mt-5 text-sm font-medium text-secondary">Order Information</h3>
      <div className="grid grid-cols-2 gap-4 rounded-xl bg-gray-50 p-4 md:grid-cols-4">
        <KV label="Name" value={o.customer_name} />
        <KV label="Order Date" value={fmtDate(o.order_date)} />
        <KV label="Loading Slip" value={o.loading_slip_file_name} />
        <KV label="Bill Total" value={inr(o.total_amount ?? itemsTotal)} />
      </div>
      <div className="mb-2 mt-5 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-medium text-secondary">Collected Payments</h3>
        <Badge tone={pendingAmt > 0 ? "red" : "green"}>Pending: {inr(pendingAmt)}</Badge>
      </div>
      <Card>
        <DataTable rows={o.payments} rowKey={(r: any) => r.cash_collected_id} empty="No payments collected yet" columns={[
          { key: "collection_date", label: "Collection date", render: (r: any) => fmtDate(r.collection_date) },
          { key: "receipt_number", label: "Receipt number" },
          { key: "payment_mode", label: "Mode" },
          { key: "amount", label: "Amount", align: "right", render: (r: any) => inr(r.amount) },
        ]} />
      </Card>
      <h3 className="mb-2 mt-5 text-sm font-medium text-secondary">Order Items</h3>
      <ItemsTable items={o.items} />
      {collect && <CollectModal orderId={o.order_id} pending={pendingAmt} onClose={() => setCollect(false)} />}
    </Card>
  );
}

function CollectModal({ orderId, pending, onClose }: { orderId: number; pending: number; onClose: () => void }) {
  const [amount, setAmount] = useState(String(pending));
  const [receipt, setReceipt] = useState("");
  const [date, setDate] = useState(today());
  const save = useAction(() => post(`cash-bills/${orderId}/payments`, { amount: Number(amount), receipt_number: receipt, collection_date: date }), ["cash-bills"], { onSuccess: onClose });
  const n = Number(amount);
  return (
    <Modal open onClose={onClose} title="Collect Payment" size="sm" footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button busy={save.isPending} disabled={!(n > 0) || n > pending || !receipt.trim()} onClick={() => save.mutate(undefined)}>Save</Button></>}>
      <div className="space-y-3">
        <Field label={`Amount Collected (pending ${inr(pending)})`}><Input id="cc-amount" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
        {n > pending && <p className="text-xs text-red-700">That's more than the pending amount.</p>}
        <Field label="Receipt Number"><Input id="cc-receipt" value={receipt} onChange={(e) => setReceipt(e.target.value)} placeholder="Enter receipt number" /></Field>
        <Field label="Collection Date"><Input id="cc-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      </div>
    </Modal>
  );
}
