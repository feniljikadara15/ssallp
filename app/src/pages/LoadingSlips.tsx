import { useMemo, useState } from "react";
import { Package } from "lucide-react";
import { useStore, fmtDate, inr } from "../data/store";
import { customerName, warehouseName, keeperName } from "../data/lookups";
import { Badge, Card, DataTable, Input, PageHeader, SearchInput, Select, Stat } from "../components/ui";

export default function LoadingSlips() {
  const { db } = useStore();
  const [q, setQ] = useState("");
  const [brand, setBrand] = useState("");
  const [wh, setWh] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const rows = useMemo(
    () =>
      db.loadingSlipItems
        .filter((l) => l.is_active)
        .map((l) => {
          const o = db.orders.find((x) => x.order_id === l.order_id)!;
          const wb = db.warehouseBrands.find((b) => b.warehouse_id === l.warehouse_id && b.brand.toLowerCase() === l.brand.toLowerCase());
          const keeper = db.warehouseKeepers.find((k) => k.warehouse_keeper_id === wb?.warehouse_keeper_id);
          return { ...l, o, keeper };
        })
        .filter((r) => !q || r.loading_slip_file_name.toLowerCase().includes(q.toLowerCase()))
        .filter((r) => !brand || r.brand === brand)
        .filter((r) => !wh || r.warehouse_id === Number(wh))
        .filter((r) => (!from || r.o.order_date >= from) && (!to || r.o.order_date.slice(0, 10) <= to))
        .sort((a, b) => b.o.order_date.localeCompare(a.o.order_date)),
    [db, q, brand, wh, from, to],
  );

  return (
    <div>
      <PageHeader title="Loading Slips" />
      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <Stat label="Total Loading Slips" value={rows.length} icon={<Package className="h-5 w-5" />} />
      </div>
      <Card>
        <div className="grid gap-2 border-b p-3 sm:grid-cols-5">
          <SearchInput value={q} onChange={setQ} placeholder="Search by Loading Slip Number" />
          <Select value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Select a Brand" options={[...new Set(db.products.map((p) => p.brand))].map((b) => ({ value: b, label: b }))} />
          <Select value={wh} onChange={(e) => setWh(e.target.value)} placeholder="Select a warehouse" options={db.warehouses.map((w) => ({ value: w.warehouse_id, label: w.name }))} />
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <DataTable rows={rows} rowKey={(r) => r.loading_slip_item_id} pageSize={15} columns={[
          { key: "loading_slip_file_name", label: "Loading slip Number", render: (r) => <b>{r.loading_slip_file_name}</b> },
          { key: "order_date", label: "Order Date", render: (r) => fmtDate(r.o.order_date) },
          { key: "order_id", label: "Order ID" },
          { key: "customer", label: "Customer", render: (r) => customerName(db, r.o.customer_id) },
          { key: "brand", label: "Brand" },
          { key: "warehouse", label: "Warehouse", render: (r) => warehouseName(db, r.warehouse_id) },
          { key: "keeper", label: "Warehouse Keeper", render: (r) => (r.keeper ? `${keeperName(db, r.keeper.warehouse_keeper_id)} (${r.keeper.phone})` : "—") },
          { key: "payment_type", label: "Payment type", render: (r) => <Badge tone={r.o.payment_type === "cash" ? "yellow" : "blue"}>{r.o.payment_type}</Badge> },
          { key: "order_status", label: "Order status", render: (r) => <Badge tone={r.o.order_status === "delivered" ? "green" : r.o.order_status === "in_transit" ? "blue" : "orange"}>{r.o.order_status.replace("_", " ")}</Badge> },
          { key: "total_amount", label: "Total amount", align: "right", render: (r) => inr(r.o.total_amount) },
        ]} />
      </Card>
    </div>
  );
}
