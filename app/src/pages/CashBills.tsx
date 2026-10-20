import { useMemo, useState } from "react";
import { Download, Wallet } from "lucide-react";
import { useStore, fmtDate, inr, nextId, downloadCsv } from "../data/store";
import { customerName, collectedFor, slipsFor } from "../data/lookups";
import { Badge, Button, Card, DataTable, EmptyState, Field, Input, KV, Modal, PageHeader, SearchInput, Tabs, useToast } from "../components/ui";
import ListItem from "../components/ListItem";
import { ItemsTable } from "../components/ItemsEditor";

type Tab = "pending" | "collected";

export default function CashBills() {
  const { db } = useStore();
  const [tab, setTab] = useState<Tab>("pending");
  const [party, setParty] = useState("");
  const [num, setNum] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sel, setSel] = useState<number | null>(null);
  const [collect, setCollect] = useState(false);

  const cashOrders = db.orders.filter((o) => o.payment_type === "cash" && o.is_active);
  const isCollected = (id: number, total: number) => collectedFor(db, id) >= total;
  const list = useMemo(
    () =>
      cashOrders
        .filter((o) => (tab === "collected") === isCollected(o.order_id, o.total_amount))
        .filter((o) => !party || customerName(db, o.customer_id).toLowerCase().includes(party.toLowerCase()))
        .filter((o) => !num || o.order_number.toLowerCase().includes(num.toLowerCase()) || String(o.order_id).includes(num))
        .filter((o) => (!from || o.order_date >= from) && (!to || o.order_date.slice(0, 10) <= to))
        .sort((a, b) => b.order_date.localeCompare(a.order_date)),
    [db, tab, party, num, from, to],
  );
  const order = db.orders.find((o) => o.order_id === sel);
  const payments = db.cashCollected.filter((c) => c.order_id === sel && c.is_active);
  const collected = order ? collectedFor(db, order.order_id) : 0;

  const exportCsv = () =>
    downloadCsv(`cash-bills-${tab}.csv`, list.map((o) => ({
      order_id: o.order_id, order_number: o.order_number, date: fmtDate(o.order_date), customer: customerName(db, o.customer_id),
      loading_slip: slipsFor(db, o.order_id)[0]?.loading_slip_file_name ?? "", total: o.total_amount, collected: collectedFor(db, o.order_id),
      balance: o.total_amount - collectedFor(db, o.order_id),
    })));

  return (
    <div>
      <PageHeader title="Cash Bills">
        <Button variant="outline" icon={<Download className="h-3.5 w-3.5" />} onClick={exportCsv}>Export</Button>
      </PageHeader>
      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <Card className="p-3">
          <Tabs value={tab} onChange={(t) => { setTab(t); setSel(null); }} tabs={[
            { value: "pending", label: "Pending", count: cashOrders.filter((o) => !isCollected(o.order_id, o.total_amount)).length },
            { value: "collected", label: "Collected", count: cashOrders.filter((o) => isCollected(o.order_id, o.total_amount)).length },
          ]} />
          <div className="mt-3 space-y-2">
            <SearchInput value={party} onChange={setParty} placeholder="Search by Party Name" />
            <SearchInput value={num} onChange={setNum} placeholder="Search by Order Number" />
            <div className="grid grid-cols-2 gap-2">
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
          <div className="mt-3 max-h-[calc(100vh-340px)] space-y-2 overflow-y-auto pr-1">
            {list.map((o) => (
              <ListItem key={o.order_id} active={sel === o.order_id} onClick={() => setSel(o.order_id)}
                title={`OD - ${customerName(db, o.customer_id)} - ${o.order_id}`}
                subtitle={`${inr(o.total_amount)} · balance ${inr(o.total_amount - collectedFor(db, o.order_id))}`}
                right={fmtDate(o.order_date)} />
            ))}
            {!list.length && <div className="py-8 text-center text-xs text-gray-400">No cash bills</div>}
          </div>
        </Card>

        {!order ? (
          <EmptyState text="Select a cash bill to view details" />
        ) : (
          <Card className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-lg font-medium text-secondary">Cash Bill: Order #{order.order_id}</h2>
                <div className="text-xs font-bold text-gray-600">{order.order_number}</div>
              </div>
              {collected < order.total_amount && <Button icon={<Wallet className="h-3.5 w-3.5" />} onClick={() => setCollect(true)}>Collect Payment</Button>}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4 rounded-xl bg-gray-50 p-4 md:grid-cols-4">
              <KV label="Customer" value={customerName(db, order.customer_id)} />
              <KV label="Total" value={inr(order.total_amount)} />
              <KV label="Collected" value={inr(collected)} />
              <KV label="Balance" value={<Badge tone={collected >= order.total_amount ? "green" : "red"}>{inr(order.total_amount - collected)}</Badge>} />
            </div>
            <h3 className="mb-2 mt-5 text-sm font-medium text-secondary">Collected Payments</h3>
            <Card>
              <DataTable rows={payments} rowKey={(r) => r.cash_collected_id} empty="No payments collected yet" columns={[
                { key: "cash_collected_id", label: "ID" },
                { key: "collection_date", label: "Collection date", render: (r) => fmtDate(r.collection_date) },
                { key: "receipt_number", label: "Receipt number" },
                { key: "amount", label: "Amount", align: "right", render: (r) => inr(r.amount) },
              ]} />
            </Card>
            <h3 className="mb-2 mt-5 text-sm font-medium text-secondary">Order Items</h3>
            <div className="overflow-x-auto rounded-xl border"><ItemsTable items={order.items} /></div>
            {collect && <CollectModal orderId={order.order_id} balance={order.total_amount - collected} onClose={() => setCollect(false)} />}
          </Card>
        )}
      </div>
    </div>
  );
}

function CollectModal({ orderId, balance, onClose }: { orderId: number; balance: number; onClose: () => void }) {
  const { update } = useStore();
  const toast = useToast();
  const [amount, setAmount] = useState(balance);
  const [receipt, setReceipt] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  return (
    <Modal open onClose={onClose} title="Collect Payment" size="sm" footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={!amount || amount > balance || !receipt} onClick={() => {
      update((d) => d.cashCollected.push({ cash_collected_id: nextId(d.cashCollected, "cash_collected_id"), order_id: orderId, collection_date: new Date(date).toISOString(), receipt_number: receipt, amount, is_active: true }));
      toast("Payment recorded"); onClose();
    }}>Save</Button></>}>
      <div className="space-y-3">
        <Field label={`Amount (balance ${inr(balance)})`}><Input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} /></Field>
        <Field label="Receipt number"><Input value={receipt} onChange={(e) => setReceipt(e.target.value)} placeholder="RC-00000" /></Field>
        <Field label="Collection date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
      </div>
    </Modal>
  );
}
