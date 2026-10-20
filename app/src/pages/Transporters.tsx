import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { del, patch, post, useAction, useGet } from "../api";
import { ask, Button, Card, DataTable, EmptyState, ErrorBox, Field, Input, Loading, Modal, PageHeader, SearchInput, Select } from "../components/ui";
import ListItem from "../components/ListItem";

export default function Transporters() {
  const transporters = useGet<any[]>("transporters");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<number | null>(null);
  const [showNew, setShowNew] = useState(false);
  const list = (transporters.data ?? []).filter((x) => !q.trim() || x.name.toLowerCase().includes(q.trim().toLowerCase()));
  const t = (transporters.data ?? []).find((x) => x.transporter_id === sel);

  return (
    <div>
      <PageHeader title="Transporters">
        <Button icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setShowNew(true)}>New</Button>
      </PageHeader>
      <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <Card className="p-3">
          <SearchInput value={q} onChange={setQ} placeholder="Search transporter" />
          <div className="mt-3 space-y-2">
            {transporters.isLoading && <Loading />}
            {transporters.error && <ErrorBox error={transporters.error} />}
            {list.map((x) => <ListItem key={x.transporter_id} active={sel === x.transporter_id} onClick={() => setSel(x.transporter_id)} title={x.name} subtitle={x.phone_number} />)}
          </div>
        </Card>
        {t ? <TransporterDetail t={t} onDeleted={() => setSel(null)} /> : <EmptyState text="Select a transporter to view details" />}
      </div>
      {showNew && <NewTransporter onClose={() => setShowNew(false)} onSaved={setSel} />}
    </div>
  );
}

function TransporterDetail({ t, onDeleted }: { t: any; onDeleted: () => void }) {
  const id = t.transporter_id;
  const [form, setForm] = useState({ name: t.name ?? "", phone_number: t.phone_number ?? "", additional_mobile_number: t.additional_mobile_number ?? "" });
  useEffect(() => setForm({ name: t.name ?? "", phone_number: t.phone_number ?? "", additional_mobile_number: t.additional_mobile_number ?? "" }), [id, t.name, t.phone_number, t.additional_mobile_number]);
  const vehicles = useGet<any[]>(`transporters/${id}/vehicles`);
  const linked = useGet<any[]>(`transporters/${id}/warehouses`);
  const warehouses = useGet<any[]>("warehouses");
  const [veh, setVeh] = useState("");
  const [wh, setWh] = useState("");
  const keys = ["transporters", "warehouses", "vehicle-details"];
  // updateTransporterDetails runs when a field loses focus, as in Retool
  const update = useAction(() => patch(`transporters/${id}`, form), keys, { quiet: true });
  const remove = useAction(() => del(`transporters/${id}`), keys, { onSuccess: onDeleted });
  const addVehicle = useAction(() => post(`transporters/${id}/vehicles`, { vehicle_number: veh }), keys, { onSuccess: () => setVeh("") });
  const removeVehicle = useAction((vid: number) => del(`vehicles/${vid}`), keys);
  const link = useAction(() => post(`transporters/${id}/warehouses`, { warehouse_id: wh }), keys, { onSuccess: () => setWh("") });
  const unlink = useAction((twid: number) => del(`transporter-warehouses/${twid}`), keys);
  const blur = () => {
    if (form.name.trim() && (form.name !== t.name || form.phone_number !== (t.phone_number ?? "") || form.additional_mobile_number !== (t.additional_mobile_number ?? ""))) update.mutate(undefined);
  };
  const unlinked = (warehouses.data ?? []).filter((w) => !(linked.data ?? []).some((x) => x.warehouse_id === w.warehouse_id));

  return (
    <Card className="min-w-0 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-medium text-secondary">{t.name}</h2>
        <Button variant="danger" busy={remove.isPending} icon={<Trash2 className="h-3.5 w-3.5" />} onClick={async () => (await ask(`Delete ${t.name}? Its vehicles and warehouse links are removed too.`, "Delete")) && remove.mutate(undefined)}>Delete Transporter</Button>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Field label="Name"><Input id="t-name" value={form.name} onBlur={blur} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Enter transporter name" /></Field>
        <Field label="Phone Number"><Input id="t-phone" value={form.phone_number} onBlur={blur} onChange={(e) => setForm({ ...form, phone_number: e.target.value })} /></Field>
        <Field label="Additional Phone Number"><Input id="t-phone2" value={form.additional_mobile_number} onBlur={blur} onChange={(e) => setForm({ ...form, additional_mobile_number: e.target.value })} /></Field>
      </div>
      <p className="mt-1 h-4 text-[11px] text-gray-400">{update.isPending ? "Saving…" : update.isSuccess ? "Saved" : "Changes save when you leave a field."}</p>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <div className="min-w-0">
          <h3 className="mb-2 text-sm font-medium text-secondary">Vehicles</h3>
          <div className="mb-2 flex gap-2">
            <Input id="t-veh" value={veh} onChange={(e) => setVeh(e.target.value)} placeholder="Enter vehicle number" onKeyDown={(e) => e.key === "Enter" && veh.trim() && addVehicle.mutate(undefined)} />
            <Button busy={addVehicle.isPending} disabled={!veh.trim()} onClick={() => addVehicle.mutate(undefined)}>Add</Button>
          </div>
          <Card>
            <DataTable rows={vehicles.data ?? []} rowKey={(r: any) => r.vehicle_id} empty="No vehicles" columns={[
              { key: "vehicle_id", label: "Vehicle ID" },
              { key: "vehicle_number", label: "Vehicles", render: (r: any) => <b>{r.vehicle_number}</b> },
              { key: "x", label: "", render: (r: any) => <Button variant="ghost" className="text-red-700" icon={<Trash2 className="h-3.5 w-3.5" />} onClick={async () => (await ask(`Delete vehicle ${r.vehicle_number}?`, "Delete")) && removeVehicle.mutate(r.vehicle_id)}>Delete</Button> },
            ]} />
          </Card>
        </div>
        <div className="min-w-0">
          <h3 className="mb-2 text-sm font-medium text-secondary">Warehouses</h3>
          <div className="mb-2 flex gap-2">
            <Select id="t-wh" value={wh} onChange={(e) => setWh(e.target.value)} placeholder="Select an option" options={unlinked.map((w) => ({ value: w.warehouse_id, label: w.name }))} />
            <Button busy={link.isPending} disabled={!wh} onClick={() => link.mutate(undefined)}>Add</Button>
          </div>
          <Card>
            <DataTable rows={linked.data ?? []} rowKey={(r: any) => r.transporter_warehouse_id} empty="No warehouses" columns={[
              { key: "warehouse_id", label: "Warehouse ID" },
              { key: "warehouse_name", label: "Warehouses" },
              { key: "x", label: "", render: (r: any) => <Button variant="ghost" className="text-red-700" icon={<Trash2 className="h-3.5 w-3.5" />} onClick={async () => (await ask(`Unlink ${r.warehouse_name}?`, "Unlink")) && unlink.mutate(r.transporter_warehouse_id)}>Delete</Button> },
            ]} />
          </Card>
        </div>
      </div>
    </Card>
  );
}

function NewTransporter({ onClose, onSaved }: { onClose: () => void; onSaved: (id: number) => void }) {
  const [f, setF] = useState({ name: "", phone_number: "+91", additional_mobile_number: "" });
  const save = useAction(() => post("transporters", f), ["transporters"], { onSuccess: (r) => { onSaved(r.transporter_id); onClose(); } });
  return (
    <Modal open onClose={onClose} title="Add Transporter" size="sm" footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button busy={save.isPending} disabled={!f.name.trim() || f.phone_number.replace("+91", "").trim().length < 10} onClick={() => save.mutate(undefined)}>Save</Button></>}>
      <div className="space-y-3">
        <Field label="Name"><Input id="nt-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Phone Number"><Input id="nt-phone" value={f.phone_number} onChange={(e) => setF({ ...f, phone_number: e.target.value })} /></Field>
        <Field label="Additional Phone Number"><Input id="nt-phone2" value={f.additional_mobile_number} onChange={(e) => setF({ ...f, additional_mobile_number: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}
