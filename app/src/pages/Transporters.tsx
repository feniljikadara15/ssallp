import { useEffect, useState } from "react";
import { Plus, Trash2, CarFront, Check, Truck, Warehouse as WarehouseIcon, X } from "lucide-react";
import { del, patch, post, useAction, useGet } from "../api";
import { ask, Button, Card, EmptyState, ErrorBox, Field, Input, Loading, Modal, PageHeader, SearchInput, Section, Select } from "../components/ui";
import ListItem, { revealDetail } from "../components/ListItem";

export default function Transporters() {
  const transporters = useGet<any[]>("transporters");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<number | null>(null);
  const [showNew, setShowNew] = useState(false);
  const list = (transporters.data ?? []).filter((x) => !q.trim() || x.name.toLowerCase().includes(q.trim().toLowerCase()));
  const t = (transporters.data ?? []).find((x) => x.transporter_id === sel);

  return (
    <div>
      <PageHeader title="Transporters" description="Carriers, their vehicles and the warehouses they serve">
        <Button icon={<Plus />} onClick={() => setShowNew(true)}>New transporter</Button>
      </PageHeader>
      <div className="grid items-start gap-5 lg:grid-cols-[320px_minmax(0,1fr)] [&>*]:min-w-0">
        <Card className="p-3">
          <SearchInput value={q} onChange={setQ} placeholder="Search transporter" />
          <div className="mt-3 space-y-0.5">
            {transporters.isLoading && <Loading variant="inline" />}
            {transporters.error && <ErrorBox error={transporters.error} />}
            {list.map((x) => <ListItem key={x.transporter_id} active={sel === x.transporter_id} onClick={() => { setSel(x.transporter_id); revealDetail(); }} title={x.name} subtitle={x.phone_number} />)}
          </div>
        </Card>
        <div id="detail-panel" className="min-w-0 scroll-mt-4">{t ? <TransporterDetail t={t} onDeleted={() => setSel(null)} /> : <EmptyState icon={<Truck className="h-5 w-5" />} text="Pick a transporter to edit their details, vehicles and warehouses." />}</div>
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
    <div className="min-w-0 space-y-4">
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-secondary/[0.06] text-secondary/70"><Truck className="h-5 w-5" /></div>
            <div className="min-w-0">
              <h2 className="truncate text-xl font-semibold tracking-tight text-secondary">{t.name}</h2>
              <div className="mt-0.5 text-xs text-gray-500">{vehicles.data?.length ?? "…"} vehicles · {linked.data?.length ?? "…"} warehouses</div>
            </div>
          </div>
          <Button variant="danger" busy={remove.isPending} icon={<Trash2 />} onClick={async () => (await ask(`Delete ${t.name}? Its vehicles and warehouse links are removed too.`, "Delete")) && remove.mutate(undefined)}>Delete</Button>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <Field label="Name"><Input id="t-name" value={form.name} onBlur={blur} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Transporter name" /></Field>
          <Field label="Phone"><Input id="t-phone" value={form.phone_number} onBlur={blur} onChange={(e) => setForm({ ...form, phone_number: e.target.value })} /></Field>
          <Field label="Alternate phone"><Input id="t-phone2" value={form.additional_mobile_number} onBlur={blur} onChange={(e) => setForm({ ...form, additional_mobile_number: e.target.value })} /></Field>
        </div>
        <p className="mt-2 flex h-4 items-center gap-1 text-2xs text-gray-400">
          {update.isPending ? "Saving…" : update.isSuccess ? <><Check className="h-3 w-3 text-emerald-600" /><span className="text-emerald-700">Saved</span></> : "Changes save automatically when you leave a field."}
        </p>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Section title="Vehicles" icon={<CarFront />}>
          <div className="flex gap-2">
            <Input id="t-veh" value={veh} onChange={(e) => setVeh(e.target.value.toUpperCase())} placeholder="Vehicle number, e.g. GJ01AB1234" onKeyDown={(e) => e.key === "Enter" && veh.trim() && addVehicle.mutate(undefined)} />
            <Button busy={addVehicle.isPending} disabled={!veh.trim()} icon={<Plus />} onClick={() => addVehicle.mutate(undefined)}>Add</Button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {(vehicles.data ?? []).map((r: any) => (
              <span key={r.vehicle_id} className="group inline-flex items-center gap-1.5 rounded-lg border border-black/[0.08] bg-gray-50 py-1 pl-2.5 pr-1 text-xs font-medium text-secondary">
                {r.vehicle_number}
                <button aria-label={`Delete ${r.vehicle_number}`} onClick={async () => (await ask(`Delete vehicle ${r.vehicle_number}?`, "Delete")) && removeVehicle.mutate(r.vehicle_id)}
                  className="rounded p-0.5 text-gray-400 transition hover:bg-red-50 hover:text-red-600"><X className="h-3 w-3" /></button>
              </span>
            ))}
            {vehicles.data && !vehicles.data.length && <span className="text-xs text-gray-400">No vehicles yet</span>}
          </div>
        </Section>
        <Section title="Warehouses" icon={<WarehouseIcon />} description="Shown as an option for orders from these warehouses">
          <div className="flex gap-2">
            <div className="min-w-0 flex-1"><Select id="t-wh" value={wh} onChange={(e) => setWh(e.target.value)} placeholder={unlinked.length ? "Link a warehouse" : "All warehouses linked"} disabled={!unlinked.length} options={unlinked.map((w) => ({ value: w.warehouse_id, label: w.name }))} /></div>
            <Button busy={link.isPending} disabled={!wh} icon={<Plus />} onClick={() => link.mutate(undefined)}>Link</Button>
          </div>
          <ul className="mt-3 space-y-1.5">
            {(linked.data ?? []).map((r: any) => (
              <li key={r.transporter_warehouse_id} className="flex items-center gap-2 rounded-lg border border-black/[0.06] px-3 py-2 text-xs">
                <WarehouseIcon className="h-3.5 w-3.5 text-gray-400" />
                <span className="flex-1 font-medium text-secondary">{r.warehouse_name}</span>
                <button aria-label={`Unlink ${r.warehouse_name}`} onClick={async () => (await ask(`Unlink ${r.warehouse_name}?`, "Unlink")) && unlink.mutate(r.transporter_warehouse_id)}
                  className="rounded p-1 text-gray-400 transition hover:bg-red-50 hover:text-red-600"><X className="h-3.5 w-3.5" /></button>
              </li>
            ))}
            {linked.data && !linked.data.length && <li className="text-xs text-gray-400">Not linked to any warehouse</li>}
          </ul>
        </Section>
      </div>
    </div>
  );
}

function NewTransporter({ onClose, onSaved }: { onClose: () => void; onSaved: (id: number) => void }) {
  const [f, setF] = useState({ name: "", phone_number: "+91", additional_mobile_number: "" });
  const save = useAction(() => post("transporters", f), ["transporters"], { onSuccess: (r) => { onSaved(r.transporter_id); onClose(); } });
  return (
    <Modal open onClose={onClose} title="New transporter" size="sm" footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button busy={save.isPending} disabled={!f.name.trim() || f.phone_number.replace("+91", "").trim().length < 10} onClick={() => save.mutate(undefined)}>Save</Button></>}>
      <div className="space-y-3">
        <Field label="Name"><Input id="nt-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Phone"><Input id="nt-phone" value={f.phone_number} onChange={(e) => setF({ ...f, phone_number: e.target.value })} /></Field>
        <Field label="Alternate phone"><Input id="nt-phone2" value={f.additional_mobile_number} onChange={(e) => setF({ ...f, additional_mobile_number: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}
