import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ExternalLink, Link2, Pencil, Plus, Trash2, Unlink } from "lucide-react";
import { del, patch, post, useAction, useGet } from "../api";
import { num, stamp } from "../format";
import { useUrlState } from "../lib/urlState";
import { DataTable } from "../components/DataTable";
import { ask, Badge, Button, ErrorBox, Field, FilterBar, Input, Loading, Modal, Notice, PageHeader, Select, StatStrip } from "../components/ui";
import { ORDER_STATUS_BADGE } from "./OrderDetail";

// Carriers. Each serves some warehouses (and so shows up as an option on
// enquiries from them) and has vehicles picked when an order is billed.
export default function Transporters() {
  const transporters = useGet<any[]>("transporters");
  const warehouses = useGet<any[]>("warehouses");
  const navigate = useNavigate();
  const [f, set, clear] = useUrlState({ warehouse: "", vehicles: "" });
  const [adding, setAdding] = useState(false);
  const all = transporters.data ?? [];
  const rows = useMemo(() => all.filter((t) =>
    (!f.warehouse || (t.warehouse_ids ?? []).map(String).includes(f.warehouse)) &&
    (!f.vehicles || (f.vehicles === "yes" ? t.vehicle_count > 0 : !t.vehicle_count))), [all, f]);
  const filtered = !!(f.warehouse || f.vehicles);

  return (
    <div className="page">
      <PageHeader title="Transporters" subtitle="Carriers, the warehouses they serve and their vehicles.">
        <Button variant="primary" icon={<Plus />} onClick={() => setAdding(true)}>New transporter</Button>
      </PageHeader>
      <FilterBar active={filtered} onClear={() => clear(["warehouse", "vehicles"])}>
        <Select className="w-full sm:w-56" value={f.warehouse} onChange={(e) => set({ warehouse: e.target.value })} placeholder="Serving any warehouse"
          options={(warehouses.data ?? []).map((w) => ({ value: String(w.warehouse_id), label: w.name }))} />
        <Select className="w-full sm:w-48" value={f.vehicles} onChange={(e) => set({ vehicles: e.target.value })} placeholder="Any vehicles"
          options={[{ value: "yes", label: "Has vehicles" }, { value: "no", label: "No vehicles yet" }]} />
      </FilterBar>
      {transporters.error && <ErrorBox error={transporters.error} />}
      <StatStrip items={[
        { label: "Transporters", value: num(rows.length) },
        { label: "Vehicles", value: num(rows.reduce((s, t) => s + Number(t.vehicle_count ?? 0), 0)), to: "/transporter-vehicles" },
        { label: "Not serving a warehouse", value: num(rows.filter((t) => !t.warehouse_names).length), hint: "Can't be picked on enquiries" },
        { label: "Orders on the road", value: num(rows.reduce((s, t) => s + Number(t.active_orders ?? 0), 0)), hint: "Ongoing and in transit" },
      ]} />
      <DataTable title="Transporters" filename={`Transporters ${stamp()}`} rowKey="transporter_id" rows={rows} loading={transporters.isLoading}
        filtersActive={filtered} onClearFilters={() => clear(["warehouse", "vehicles"])}
        rowLink={(r) => `/transporters/${r.transporter_id}`}
        empty={{ title: "No transporters yet", action: <Button size="sm" variant="primary" icon={<Plus />} onClick={() => setAdding(true)}>New transporter</Button> }}
        rowActions={(r) => [{ kind: "open", label: `Open ${r.name}`, icon: <ExternalLink />, href: `/transporters/${r.transporter_id}` }]}
        cols={[
          { key: "name", label: "Transporter" },
          { key: "phone_number", label: "Phone", kind: "mono", sub: (r) => r.additional_mobile_number },
          { key: "warehouse_names", label: "Warehouses", className: "max-w-[360px] truncate", render: (r) => r.warehouse_names ?? <Badge tone="warning">None</Badge> },
          { key: "vehicle_count", label: "Vehicles", kind: "int", total: true },
          { key: "active_orders", label: "Active orders", kind: "int", total: true },
        ]} />
      {adding && <TransporterModal t={{}} onClose={() => setAdding(false)} onSaved={(id) => navigate(`/transporters/${id}`)} />}
    </div>
  );
}

export function TransporterDetail() {
  const id = Number(useParams().id);
  const navigate = useNavigate();
  const transporters = useGet<any[]>("transporters");
  const vehicles = useGet<any[]>(`transporters/${id}/vehicles`);
  const linked = useGet<any[]>(`transporters/${id}/warehouses`);
  const orders = useGet<any[]>("orders");
  const [modal, setModal] = useState<null | "edit" | "vehicle" | "link">(null);
  const keys = ["transporters", "warehouses", "vehicle-details"];
  const remove = useAction(() => del(`transporters/${id}`), keys, { onSuccess: () => navigate("/transporters") });
  const removeVehicle = useAction((vid: number) => del(`vehicles/${vid}`), keys);
  const unlink = useAction((twid: number) => del(`transporter-warehouses/${twid}`), keys);
  const t = transporters.data?.find((x) => x.transporter_id === id);

  if (transporters.isLoading) return <div className="page"><Loading /></div>;
  if (!t) return <div className="page"><PageHeader title={`Transporter #${id}`} breadcrumb={[{ to: "/transporters", label: "Transporters" }]} /><ErrorBox error={transporters.error ?? new Error("This transporter doesn't exist.")} /></div>;
  const myOrders = (orders.data ?? []).filter((o) => o.transporter_id === id);

  return (
    <div className="page">
      <PageHeader title={t.name} breadcrumb={[{ to: "/transporters", label: "Transporters" }]} subtitle={[t.phone_number, t.additional_mobile_number].filter(Boolean).join(", ")}>
        <Button variant="primary" icon={<Pencil />} onClick={() => setModal("edit")}>Edit details</Button>
      </PageHeader>
      {linked.data && !linked.data.length && <Notice tone="warning">Not linked to any warehouse, so it can't be picked on enquiries. Link the warehouses it serves below.</Notice>}
      <StatStrip items={[
        { label: "Vehicles", value: num(vehicles.data?.length ?? 0) },
        { label: "Warehouses served", value: num(linked.data?.length ?? 0) },
        { label: "Ongoing orders", value: num(myOrders.filter((o) => o.order_status === "1").length) },
        { label: "In transit", value: num(myOrders.filter((o) => o.order_status === "2").length) },
      ]} />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 [&>*]:flex [&>*]:min-w-0 [&>*>*]:flex-1">
        <div>
          <DataTable title="Vehicles" filename={`${t.name} vehicles`} rowKey="vehicle_id" rows={vehicles.data ?? []} loading={vehicles.isLoading} search={false} pageSize={10}
            actions={<Button size="sm" icon={<Plus />} onClick={() => setModal("vehicle")}>Add vehicle</Button>}
            empty={{ title: "No vehicles yet", hint: "A vehicle is picked when an order is invoiced." }}
            rowActions={(r) => [{ kind: "delete", label: `Delete ${r.vehicle_number}`, icon: <Trash2 />, onClick: async () => (await ask(`Delete vehicle ${r.vehicle_number}?`, "Delete vehicle")) && removeVehicle.mutate(r.vehicle_id) }]}
            cols={[
              { key: "vehicle_number", label: "Vehicle number", kind: "mono", className: "font-medium" },
              { key: "vehicle_type", label: "Type" },
              { key: "capacity", label: "Capacity" },
            ]} />
        </div>
        <div>
          <DataTable title="Warehouses served" filename={`${t.name} warehouses`} rowKey="transporter_warehouse_id" rows={linked.data ?? []} loading={linked.isLoading} search={false} pageSize={10}
            actions={<Button size="sm" icon={<Link2 />} onClick={() => setModal("link")}>Link warehouse</Button>}
            empty={{ title: "Not linked to any warehouse" }}
            rowLink={(r) => `/warehouses/${r.warehouse_id}`}
            rowActions={(r) => [{ kind: "delete", label: `Unlink ${r.warehouse_name}`, icon: <Unlink />, onClick: async () => (await ask(`Unlink ${r.warehouse_name}?`, "Unlink", { body: "This transporter stops showing up on enquiries from that warehouse." })) && unlink.mutate(r.transporter_warehouse_id) }]}
            cols={[
              { key: "warehouse_name", label: "Warehouse" },
              { key: "warehouse_location", label: "Location" },
            ]} />
        </div>
      </div>

      <DataTable title="Orders" filename={`${t.name} orders`} rowKey="order_id" rows={myOrders} loading={orders.isLoading} pageSize={10}
        rowLink={(r) => `/orders/${r.order_id}`}
        empty={{ title: "No orders yet" }}
        cols={[
          { key: "order_id", label: "Order #", kind: "int", align: "left" },
          { key: "customer_name", label: "Customer", sub: (r) => r.site_name },
          { key: "order_date", label: "Ordered", kind: "date" },
          { key: "warehouse_name", label: "Warehouse" },
          { key: "vehicle_number", label: "Vehicle", kind: "mono" },
          { key: "order_status", label: "Status", value: (r) => ORDER_STATUS_BADGE[r.order_status]?.label, render: (r) => { const s = ORDER_STATUS_BADGE[r.order_status]; return s ? <Badge dot tone={s.tone}>{s.label}</Badge> : null; } },
          { key: "total_amount", label: "Amount (₹)", kind: "money", total: true, value: (r) => r.total_amount ?? r.items_value },
        ]} />

      <div className="no-print flex justify-end">
        <Button variant="danger" busy={remove.isPending} icon={<Trash2 />} onClick={async () => (await ask(`Delete ${t.name}?`, "Delete transporter", { body: "Its vehicles and warehouse links are removed too. Past orders keep their transporter." })) && remove.mutate(undefined)}>Delete transporter</Button>
      </div>

      {modal === "edit" && <TransporterModal t={t} onClose={() => setModal(null)} />}
      {modal === "vehicle" && <VehicleModal transporterId={id} onClose={() => setModal(null)} />}
      {modal === "link" && <LinkModal transporterId={id} linked={(linked.data ?? []).map((x) => x.warehouse_id)} onClose={() => setModal(null)} />}
    </div>
  );
}

function TransporterModal({ t, onClose, onSaved }: { t: any; onClose: () => void; onSaved?: (id: number) => void }) {
  const isNew = !t.transporter_id;
  const [f, setF] = useState({ name: t.name ?? "", phone_number: t.phone_number ?? "+91", additional_mobile_number: t.additional_mobile_number ?? "" });
  const save = useAction(() => (isNew ? post("transporters", f) : patch(`transporters/${t.transporter_id}`, f)), ["transporters", "vehicle-details"], {
    onSuccess: (r) => { onClose(); onSaved?.(r.transporter_id ?? t.transporter_id); },
  });
  const phoneOk = f.phone_number.replace(/\D/g, "").replace(/^91/, "").length >= 10;
  return (
    <Modal open onClose={onClose} title={isNew ? "New transporter" : `Edit ${t.name}`} size="sm"
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" busy={save.isPending} disabled={!f.name.trim() || !phoneOk} onClick={() => save.mutate(undefined)}>{isNew ? "Add transporter" : "Save changes"}</Button></>}>
      <div className="grid gap-4">
        <Field label="Name" required><Input id="t-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="WhatsApp number" required hint="Enquiries and delivery requests are sent here."><Input id="t-phone" inputMode="tel" value={f.phone_number} onChange={(e) => setF({ ...f, phone_number: e.target.value })} /></Field>
        <Field label="Alternate phone"><Input id="t-phone2" inputMode="tel" value={f.additional_mobile_number} onChange={(e) => setF({ ...f, additional_mobile_number: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}

function VehicleModal({ transporterId, onClose }: { transporterId: number; onClose: () => void }) {
  const [v, setV] = useState("");
  const save = useAction(() => post(`transporters/${transporterId}/vehicles`, { vehicle_number: v }), ["transporters", "vehicle-details"], { onSuccess: onClose });
  return (
    <Modal open onClose={onClose} title="Add vehicle" size="sm"
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" busy={save.isPending} disabled={!v.trim()} onClick={() => save.mutate(undefined)}>Add vehicle</Button></>}>
      <Field label="Vehicle number" required hint="Spaces and dashes are removed, e.g. GJ01AB1234.">
        <Input id="v-num" value={v} onChange={(e) => setV(e.target.value.toUpperCase())} onKeyDown={(e) => e.key === "Enter" && v.trim() && save.mutate(undefined)} placeholder="GJ01AB1234" />
      </Field>
    </Modal>
  );
}

function LinkModal({ transporterId, linked, onClose }: { transporterId: number; linked: number[]; onClose: () => void }) {
  const warehouses = useGet<any[]>("warehouses");
  const [wh, setWh] = useState("");
  const options = (warehouses.data ?? []).filter((w) => !linked.includes(w.warehouse_id));
  const save = useAction(() => post(`transporters/${transporterId}/warehouses`, { warehouse_id: wh }), ["transporters", "warehouses"], { onSuccess: onClose });
  return (
    <Modal open onClose={onClose} title="Link a warehouse" size="sm"
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" busy={save.isPending} disabled={!wh} onClick={() => save.mutate(undefined)}>Link warehouse</Button></>}>
      <Field label="Warehouse" required hint="The transporter shows up on enquiries from this warehouse.">
        <Select id="tw-wh" value={wh} onChange={(e) => setWh(e.target.value)} disabled={!options.length} placeholder={options.length ? "Select a warehouse" : "Already serves every warehouse"} options={options.map((w) => ({ value: w.warehouse_id, label: w.name }))} />
      </Field>
    </Modal>
  );
}
