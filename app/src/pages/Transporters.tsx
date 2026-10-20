import { useEffect, useState } from "react";
import { Plus, Trash2, Save } from "lucide-react";
import { useStore, nextId } from "../data/store";
import { warehouseName } from "../data/lookups";
import { Button, Card, DataTable, EmptyState, Field, Input, Modal, PageHeader, SearchInput, Select, useToast, ask } from "../components/ui";
import ListItem from "../components/ListItem";

export default function Transporters() {
  const { db, update } = useStore();
  const toast = useToast();
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<number | null>(null);
  const [showNew, setShowNew] = useState(false);
  const t = db.transporters.find((x) => x.transporter_id === sel);
  const [form, setForm] = useState({ name: "", phone_number: "", additional_mobile_number: "" });
  const [veh, setVeh] = useState("");
  const [wh, setWh] = useState("");
  useEffect(() => { if (t) setForm({ name: t.name, phone_number: t.phone_number, additional_mobile_number: t.additional_mobile_number }); }, [sel]);

  const list = db.transporters.filter((x) => x.is_active && (!q || x.name.toLowerCase().includes(q.toLowerCase())));
  const vehicles = db.vehicles.filter((v) => v.transporter_id === sel);
  const twh = db.transporterWarehouses.filter((x) => x.transporter_id === sel);

  return (
    <div>
      <PageHeader title="Transporters">
        <Button icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setShowNew(true)}>New</Button>
      </PageHeader>
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Card className="p-3">
          <SearchInput value={q} onChange={setQ} placeholder="Search transporter" />
          <div className="mt-3 space-y-2">
            {list.map((x) => <ListItem key={x.transporter_id} active={sel === x.transporter_id} onClick={() => setSel(x.transporter_id)} title={x.name} subtitle={x.phone_number} />)}
          </div>
        </Card>
        {!t ? (
          <EmptyState text="Select a transporter to view details" />
        ) : (
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium text-secondary">{t.name}</h2>
              <Button variant="danger" icon={<Trash2 className="h-3.5 w-3.5" />} onClick={async () => { if (await ask("Delete transporter?")) { update((d) => { d.transporters.find((x) => x.transporter_id === t.transporter_id)!.is_active = false; }); setSel(null); } }}>Delete Transporter</Button>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <Field label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Enter transporter name" /></Field>
              <Field label="Phone Number"><Input value={form.phone_number} onChange={(e) => setForm({ ...form, phone_number: e.target.value })} /></Field>
              <Field label="Additional Phone Number"><Input value={form.additional_mobile_number} onChange={(e) => setForm({ ...form, additional_mobile_number: e.target.value })} /></Field>
            </div>
            <div className="mt-2 text-right">
              <Button icon={<Save className="h-3.5 w-3.5" />} onClick={() => { update((d) => Object.assign(d.transporters.find((x) => x.transporter_id === t.transporter_id)!, form)); toast("Transporter updated"); }}>Save</Button>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div>
                <h3 className="mb-2 text-sm font-medium text-secondary">Vehicles</h3>
                <div className="mb-2 flex gap-2">
                  <Input value={veh} onChange={(e) => setVeh(e.target.value)} placeholder="Enter vehicle number" />
                  <Button disabled={!veh} onClick={() => {
                    const num = veh.toUpperCase().replace(/\s/g, "");
                    if (db.vehicles.some((v) => v.vehicle_number === num)) return toast("Vehicle already exists");
                    update((d) => { d.vehicles.push({ vehicle_id: nextId(d.vehicles, "vehicle_id"), transporter_id: t.transporter_id, vehicle_number: num }); });
                    setVeh("");
                  }}>Add</Button>
                </div>
                <Card>
                  <DataTable rows={vehicles} rowKey={(r) => r.vehicle_id} empty="No vehicles" columns={[
                    { key: "vehicle_id", label: "Vehicle ID" },
                    { key: "vehicle_number", label: "Vehicles", render: (r) => <b>{r.vehicle_number}</b> },
                    { key: "x", label: "", render: (r) => <Button variant="ghost" className="text-red-700" icon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => update((d) => { d.vehicles = d.vehicles.filter((v) => v.vehicle_id !== r.vehicle_id); })} /> },
                  ]} />
                </Card>
              </div>
              <div>
                <h3 className="mb-2 text-sm font-medium text-secondary">Warehouses</h3>
                <div className="mb-2 flex gap-2">
                  <Select value={wh} onChange={(e) => setWh(e.target.value)} placeholder="Select an option" options={db.warehouses.filter((w) => w.is_active && !twh.some((x) => x.warehouse_id === w.warehouse_id)).map((w) => ({ value: w.warehouse_id, label: w.name }))} />
                  <Button disabled={!wh} onClick={() => { update((d) => { d.transporterWarehouses.push({ transporter_warehouse_id: nextId(d.transporterWarehouses, "transporter_warehouse_id"), transporter_id: t.transporter_id, warehouse_id: Number(wh) }); }); setWh(""); }}>Add</Button>
                </div>
                <Card>
                  <DataTable rows={twh} rowKey={(r) => r.transporter_warehouse_id} empty="No warehouses" columns={[
                    { key: "warehouse_id", label: "Warehouse ID" },
                    { key: "warehouse_name", label: "Warehouses", render: (r) => warehouseName(db, r.warehouse_id) },
                    { key: "x", label: "", render: (r) => <Button variant="ghost" className="text-red-700" icon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => update((d) => { d.transporterWarehouses = d.transporterWarehouses.filter((x) => x.transporter_warehouse_id !== r.transporter_warehouse_id); })} /> },
                  ]} />
                </Card>
              </div>
            </div>
          </Card>
        )}
      </div>
      {showNew && <NewTransporter onClose={() => setShowNew(false)} onSaved={setSel} />}
    </div>
  );
}

function NewTransporter({ onClose, onSaved }: { onClose: () => void; onSaved: (id: number) => void }) {
  const { db, update } = useStore();
  const [f, setF] = useState({ name: "", phone_number: "", additional_mobile_number: "" });
  return (
    <Modal open onClose={onClose} title="Add Transporter" size="sm" footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={!f.name || !f.phone_number} onClick={() => {
      const id = nextId(db.transporters, "transporter_id");
      update((d) => { d.transporters.push({ ...f, transporter_id: id, is_active: true }); });
      onSaved(id); onClose();
    }}>Save</Button></>}>
      <div className="space-y-3">
        <Field label="Name"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Phone Number"><Input value={f.phone_number} onChange={(e) => setF({ ...f, phone_number: e.target.value })} /></Field>
        <Field label="Additional Phone Number"><Input value={f.additional_mobile_number} onChange={(e) => setF({ ...f, additional_mobile_number: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}
