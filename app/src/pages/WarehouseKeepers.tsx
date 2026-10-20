import { useState } from "react";
import { Download, Pencil, Plus, Trash2 } from "lucide-react";
import { useStore, nextId, downloadCsv } from "../data/store";
import { warehouseName } from "../data/lookups";
import type { WarehouseKeeper } from "../data/types";
import { Button, Card, DataTable, Field, Input, Modal, PageHeader, SearchInput, Select, ask } from "../components/ui";

export default function WarehouseKeepers() {
  const { db, update } = useStore();
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<WarehouseKeeper | null>(null);
  const rows = db.warehouseKeepers.filter((k) => k.is_active && (!q || [k.name, k.phone, warehouseName(db, k.warehouse_id)].join(" ").toLowerCase().includes(q.toLowerCase())));

  return (
    <div>
      <PageHeader title="Warehouse Keepers">
        <Button variant="outline" icon={<Download className="h-3.5 w-3.5" />} onClick={() => downloadCsv("warehouse-keepers.csv", rows.map((r) => ({ ...r, warehouse: warehouseName(db, r.warehouse_id) })))}>Download</Button>
        <Button icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setEdit({ warehouse_keeper_id: 0, name: "", phone: "", warehouse_id: db.warehouses[0]?.warehouse_id ?? 0, is_active: true })}>Add Warehouse Keeper</Button>
      </PageHeader>
      <Card>
        <div className="border-b p-3"><div className="w-72"><SearchInput value={q} onChange={setQ} placeholder="Search here" /></div></div>
        <DataTable rows={rows} rowKey={(r) => r.warehouse_keeper_id} pageSize={15} columns={[
          { key: "warehouse_keeper_id", label: "Warehouse keeper ID" },
          { key: "name", label: "Name", render: (r) => <b>{r.name}</b> },
          { key: "phone", label: "Phone" },
          { key: "warehouse_id", label: "Warehouse", render: (r) => warehouseName(db, r.warehouse_id) },
          { key: "actions", label: "Actions", render: (r) => (
            <div className="flex gap-1">
              <Button variant="ghost" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => setEdit(r)} />
              <Button variant="ghost" className="text-red-700" icon={<Trash2 className="h-3.5 w-3.5" />} onClick={async () => await ask(`Delete ${r.name}?`) && update((d) => { d.warehouseKeepers.find((k) => k.warehouse_keeper_id === r.warehouse_keeper_id)!.is_active = false; })} />
            </div>
          ) },
        ]} />
      </Card>
      {edit && (
        <Modal open onClose={() => setEdit(null)} title={edit.warehouse_keeper_id ? "Edit Warehouse Keeper" : "Add Warehouse Keeper"} size="sm" footer={<><Button variant="outline" onClick={() => setEdit(null)}>Cancel</Button><Button disabled={!edit.name || !edit.phone} onClick={() => {
          update((d) => { if (edit.warehouse_keeper_id) Object.assign(d.warehouseKeepers.find((k) => k.warehouse_keeper_id === edit.warehouse_keeper_id)!, edit); else d.warehouseKeepers.push({ ...edit, warehouse_keeper_id: nextId(d.warehouseKeepers, "warehouse_keeper_id") }); });
          setEdit(null);
        }}>Save</Button></>}>
          <div className="space-y-3">
            <Field label="Name"><Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
            <Field label="Phone"><Input value={edit.phone} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} /></Field>
            <Field label="Warehouse"><Select value={edit.warehouse_id} onChange={(e) => setEdit({ ...edit, warehouse_id: Number(e.target.value) })} options={db.warehouses.filter((w) => w.is_active).map((w) => ({ value: w.warehouse_id, label: w.name }))} /></Field>
          </div>
        </Modal>
      )}
    </div>
  );
}
