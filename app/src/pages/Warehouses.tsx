import { useState } from "react";
import { Plus, Trash2, Pencil } from "lucide-react";
import { useStore, nextId } from "../data/store";
import { keeperName, transporterName } from "../data/lookups";
import type { Warehouse } from "../data/types";
import { Button, Card, DataTable, EmptyState, Field, Input, Modal, PageHeader, SearchInput, Select, useToast, ask } from "../components/ui";
import ListItem from "../components/ListItem";

export default function Warehouses() {
  const { db, update } = useStore();
  const toast = useToast();
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<number | null>(null);
  const [edit, setEdit] = useState<Warehouse | null>(null);
  const [brandModal, setBrandModal] = useState<{ id?: number; brand: string; keeper: string } | null>(null);
  const [addTr, setAddTr] = useState("");

  const list = db.warehouses.filter((w) => w.is_active && (!q || w.name.toLowerCase().includes(q.toLowerCase())));
  const w = db.warehouses.find((x) => x.warehouse_id === sel);
  const brands = db.warehouseBrands.filter((b) => b.warehouse_id === sel);
  const trs = db.transporterWarehouses.filter((t) => t.warehouse_id === sel);
  const keepers = db.warehouseKeepers.filter((k) => k.warehouse_id === sel && k.is_active);

  return (
    <div>
      <PageHeader title="Warehouses">
        <Button icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setEdit({ warehouse_id: 0, name: "", address: "", city: "", is_active: true })}>New</Button>
      </PageHeader>
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Card className="p-3">
          <SearchInput value={q} onChange={setQ} placeholder="Search warehouse" />
          <div className="mt-3 space-y-2">
            {list.map((x) => <ListItem key={x.warehouse_id} active={sel === x.warehouse_id} onClick={() => setSel(x.warehouse_id)} title={x.name} subtitle={x.address} />)}
          </div>
        </Card>
        {!w ? (
          <EmptyState text="Select a warehouse to view details" />
        ) : (
          <Card className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-medium text-secondary">{w.name}</h2>
                <div className="text-xs text-gray-500">{w.address}, {w.city}</div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => setEdit(w)}>Edit</Button>
                <Button variant="danger" icon={<Trash2 className="h-3.5 w-3.5" />} onClick={async () => { if (await ask("Delete warehouse?")) { update((d) => { d.warehouses.find((x) => x.warehouse_id === w.warehouse_id)!.is_active = false; }); setSel(null); toast("Warehouse deleted"); } }}>Delete Warehouse</Button>
              </div>
            </div>

            <div className="mb-2 mt-5 flex items-center justify-between">
              <h3 className="text-sm font-medium text-secondary">Brands</h3>
              <Button variant="outline" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setBrandModal({ brand: "", keeper: "" })}>Add Brand</Button>
            </div>
            <Card>
              <DataTable rows={brands} rowKey={(r) => r.warehouse_brands_id} empty="No brands" columns={[
                { key: "warehouse_brands_id", label: "ID" },
                { key: "brand", label: "Brand", render: (r) => <b>{r.brand}</b> },
                { key: "warehouse_keeper_id", label: "Warehouse Keeper", render: (r) => keeperName(db, r.warehouse_keeper_id) },
                { key: "actions", label: "Actions", render: (r) => (
                  <div className="flex gap-1">
                    <Button variant="ghost" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => setBrandModal({ id: r.warehouse_brands_id, brand: r.brand, keeper: String(r.warehouse_keeper_id ?? "") })} />
                    <Button variant="ghost" className="text-red-700" icon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => update((d) => { d.warehouseBrands = d.warehouseBrands.filter((b) => b.warehouse_brands_id !== r.warehouse_brands_id); })} />
                  </div>
                ) },
              ]} />
            </Card>

            <div className="mb-2 mt-5 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-medium text-secondary">Transporters</h3>
              <div className="flex gap-2">
                <Select className="w-56" value={addTr} onChange={(e) => setAddTr(e.target.value)} placeholder="Add transporter…" options={db.transporters.filter((t) => !trs.some((x) => x.transporter_id === t.transporter_id)).map((t) => ({ value: t.transporter_id, label: t.name }))} />
                <Button variant="outline" disabled={!addTr} onClick={() => { update((d) => { d.transporterWarehouses.push({ transporter_warehouse_id: nextId(d.transporterWarehouses, "transporter_warehouse_id"), transporter_id: Number(addTr), warehouse_id: w.warehouse_id }); }); setAddTr(""); }}>Add</Button>
              </div>
            </div>
            <Card>
              <DataTable rows={trs} rowKey={(r) => r.transporter_warehouse_id} empty="No transporters" columns={[
                { key: "transporter_id", label: "Transporter ID" },
                { key: "name", label: "Transporter name", render: (r) => transporterName(db, r.transporter_id) },
                { key: "phone", label: "Phone number", render: (r) => db.transporters.find((t) => t.transporter_id === r.transporter_id)?.phone_number },
                { key: "alt", label: "Additional mobile number", render: (r) => db.transporters.find((t) => t.transporter_id === r.transporter_id)?.additional_mobile_number || "—" },
                { key: "x", label: "", render: (r) => <Button variant="ghost" className="text-red-700" icon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => update((d) => { d.transporterWarehouses = d.transporterWarehouses.filter((x) => x.transporter_warehouse_id !== r.transporter_warehouse_id); })} /> },
              ]} />
            </Card>
          </Card>
        )}
      </div>

      {edit && (
        <WarehouseModal w={edit} onClose={() => setEdit(null)} onSaved={(id) => setSel(id)} />
      )}
      {brandModal && w && (
        <Modal open onClose={() => setBrandModal(null)} title={brandModal.id ? "Edit Brand" : "Add Brand"} size="sm" footer={<><Button variant="outline" onClick={() => setBrandModal(null)}>Cancel</Button><Button disabled={!brandModal.brand} onClick={() => {
          update((d) => {
            const keeper = brandModal.keeper ? Number(brandModal.keeper) : null;
            if (brandModal.id) Object.assign(d.warehouseBrands.find((b) => b.warehouse_brands_id === brandModal.id)!, { brand: brandModal.brand, warehouse_keeper_id: keeper });
            else d.warehouseBrands.push({ warehouse_brands_id: nextId(d.warehouseBrands, "warehouse_brands_id"), warehouse_id: w.warehouse_id, brand: brandModal.brand, warehouse_keeper_id: keeper });
          });
          setBrandModal(null);
        }}>Save</Button></>}>
          <div className="space-y-3">
            <Field label="Brand"><Select value={brandModal.brand} onChange={(e) => setBrandModal({ ...brandModal, brand: e.target.value })} placeholder="Select brand" options={[...new Set(db.products.map((p) => p.brand))].map((b) => ({ value: b, label: b }))} /></Field>
            <Field label="Warehouse Keeper"><Select value={brandModal.keeper} onChange={(e) => setBrandModal({ ...brandModal, keeper: e.target.value })} placeholder="Select keeper" options={keepers.map((k) => ({ value: k.warehouse_keeper_id, label: k.name }))} /></Field>
          </div>
        </Modal>
      )}
    </div>
  );
}

function WarehouseModal({ w, onClose, onSaved }: { w: Warehouse; onClose: () => void; onSaved: (id: number) => void }) {
  const { db, update } = useStore();
  const [f, setF] = useState(w);
  return (
    <Modal open onClose={onClose} title={w.warehouse_id ? "Edit Warehouse" : "New Warehouse"} size="sm" footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={!f.name} onClick={() => {
      const id = f.warehouse_id || nextId(db.warehouses, "warehouse_id");
      update((d) => { if (f.warehouse_id) Object.assign(d.warehouses.find((x) => x.warehouse_id === id)!, f); else d.warehouses.push({ ...f, warehouse_id: id }); });
      onSaved(id); onClose();
    }}>Save</Button></>}>
      <div className="space-y-3">
        <Field label="Name"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Address"><Input value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></Field>
        <Field label="City"><Input value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}
