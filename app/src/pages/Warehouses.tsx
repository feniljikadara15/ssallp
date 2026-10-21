import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ExternalLink, Pencil, Plus, Trash2 } from "lucide-react";
import { del, patch, post, useAction, useGet } from "../api";
import { num, stamp } from "../format";
import { DataTable } from "../components/DataTable";
import { ask, Badge, Button, ErrorBox, Field, Input, Loading, Modal, Notice, PageHeader, Select, StatStrip } from "../components/ui";
import { KeeperModal } from "./WarehouseKeepers";

// Warehouses: where stock ships from, which brands each holds, who loads
// them (the keeper gets the loading slip) and which transporters serve it.
export default function Warehouses() {
  const warehouses = useGet<any[]>("warehouses");
  const [edit, setEdit] = useState<any | null>(null);
  const navigate = useNavigate();
  const rows = warehouses.data ?? [];
  const gaps = rows.reduce((s, w) => s + Number(w.brands_without_keeper ?? 0), 0);

  return (
    <div className="page">
      <PageHeader title="Warehouses" subtitle="Where stock ships from, the brands each holds, who loads them and which transporters serve it.">
        <Button variant="primary" icon={<Plus />} onClick={() => setEdit({})}>New warehouse</Button>
      </PageHeader>
      {warehouses.error && <ErrorBox error={warehouses.error} />}
      <StatStrip items={[
        { label: "Warehouses", value: num(rows.length) },
        { label: "Brands stocked", value: num(rows.reduce((s, w) => s + Number(w.brand_count ?? 0), 0)) },
        { label: "Brands without a keeper", value: num(gaps), tone: gaps ? "warning" : undefined, hint: gaps ? "Their loading slips can't be sent" : "Every brand has a keeper" },
        { label: "Ongoing orders", value: num(rows.reduce((s, w) => s + Number(w.open_orders ?? 0), 0)), to: "/orders" },
      ]} />
      <DataTable title="Warehouses" filename={`Warehouses ${stamp()}`} rowKey="warehouse_id" rows={rows} loading={warehouses.isLoading}
        rowLink={(r) => `/warehouses/${r.warehouse_id}`}
        empty={{ title: "No warehouses yet", action: <Button size="sm" variant="primary" icon={<Plus />} onClick={() => setEdit({})}>New warehouse</Button> }}
        rowActions={(r) => [
          { kind: "open", label: `Open ${r.name}`, icon: <ExternalLink />, href: `/warehouses/${r.warehouse_id}` },
          { kind: "edit", label: `Edit ${r.name}`, icon: <Pencil />, onClick: () => setEdit(r) },
        ]}
        cols={[
          { key: "name", label: "Warehouse", sub: (r) => r.location },
          { key: "brand_count", label: "Brands", kind: "int", total: true },
          { key: "brands_without_keeper", label: "Without keeper", kind: "int", total: true, render: (r) => r.brands_without_keeper ? <Badge tone="warning">{r.brands_without_keeper}</Badge> : <span className="text-faint">0</span> },
          { key: "keeper_count", label: "Keepers", kind: "int", total: true },
          { key: "transporter_count", label: "Transporters", kind: "int", total: true },
          { key: "open_orders", label: "Ongoing orders", kind: "int", total: true },
        ]} />
      {edit && <WarehouseModal w={edit} onClose={() => setEdit(null)} onSaved={(id) => !edit.warehouse_id && navigate(`/warehouses/${id}`)} />}
    </div>
  );
}

export function WarehouseDetail() {
  const id = Number(useParams().id);
  const navigate = useNavigate();
  const warehouses = useGet<any[]>("warehouses");
  const brands = useGet<any[]>(`warehouses/${id}/brands`);
  const transporters = useGet<any[]>(`warehouses/${id}/transporters`);
  const companies = useGet<any[]>(`warehouses/${id}/companies`);
  const keepers = useGet<any[]>("warehouse-keepers");
  const [modal, setModal] = useState<null | { kind: "edit" } | { kind: "brand"; row: any } | { kind: "company"; row: any } | { kind: "keeper"; row: any }>(null);
  const remove = useAction(() => del(`warehouses/${id}`), ["warehouses", "warehouse-keepers"], { onSuccess: () => navigate("/warehouses") });
  const removeBrand = useAction((bid: number) => del(`warehouse-brands/${bid}`), ["warehouses"]);
  const w = warehouses.data?.find((x) => x.warehouse_id === id);

  if (warehouses.isLoading) return <div className="page"><Loading /></div>;
  if (!w) return <div className="page"><PageHeader title={`Warehouse #${id}`} breadcrumb={[{ to: "/warehouses", label: "Warehouses" }]} /><ErrorBox error={warehouses.error ?? new Error("This warehouse doesn't exist.")} /></div>;
  const myKeepers = (keepers.data ?? []).filter((k) => k.warehouse_id === id);
  const unassigned = (brands.data ?? []).filter((b) => !b.warehouse_keeper_name);

  return (
    <div className="page">
      <PageHeader title={w.name} breadcrumb={[{ to: "/warehouses", label: "Warehouses" }]} subtitle={w.location}>
        <Button variant="primary" icon={<Pencil />} onClick={() => setModal({ kind: "edit" })}>Edit warehouse</Button>
      </PageHeader>
      {unassigned.length > 0 && <Notice tone="warning" title={`${unassigned.length} brand${unassigned.length === 1 ? " has" : "s have"} no warehouse keeper`}>Loading slips for {unassigned.map((b) => b.brand).join(", ")} can't be sent until a keeper is assigned.</Notice>}
      <StatStrip items={[
        { label: "Brands", value: num(brands.data?.length ?? 0) },
        { label: "Warehouse keepers", value: num(myKeepers.length) },
        { label: "Transporters", value: num(transporters.data?.length ?? 0) },
        { label: "Ongoing orders", value: num(w.open_orders ?? 0), to: `/orders?warehouse=${id}` },
      ]} />

      <DataTable title="Brands and keepers" note="Each brand's loading slip goes to its keeper" filename={`${w.name} brands`} rowKey="warehouse_brands_id" rows={brands.data ?? []} loading={brands.isLoading} search={false} pageSize={50}
        actions={<Button size="sm" icon={<Plus />} onClick={() => setModal({ kind: "brand", row: {} })}>Add brand</Button>}
        empty={{ title: "No brands yet", hint: "Brands not listed here get no loading slip." }}
        rowActions={(r) => [
          { kind: "edit", label: `Edit ${r.brand}`, icon: <Pencil />, onClick: () => setModal({ kind: "brand", row: r }) },
          { kind: "delete", label: `Remove ${r.brand}`, icon: <Trash2 />, onClick: async () => (await ask(`Remove ${r.brand} from ${w.name}?`, "Remove brand")) && removeBrand.mutate(r.warehouse_brands_id) },
        ]}
        cols={[
          { key: "brand", label: "Brand", className: "font-medium" },
          { key: "warehouse_keeper_name", label: "Warehouse keeper", render: (r) => r.warehouse_keeper_name ?? <Badge dot tone="warning">Not assigned</Badge> },
          { key: "warehouse_keeper_phone", label: "Keeper phone", kind: "mono" },
        ]} />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 [&>*]:flex [&>*]:min-w-0 [&>*>*]:flex-1">
        <div>
          <DataTable title="Warehouse keepers" filename={`${w.name} keepers`} rowKey="warehouse_keeper_id" rows={myKeepers} loading={keepers.isLoading} search={false} pageSize={10}
            actions={<Button size="sm" icon={<Plus />} onClick={() => setModal({ kind: "keeper", row: { warehouse_id: id } })}>Add keeper</Button>}
            empty={{ title: "No keepers yet" }}
            rowActions={(r) => [{ kind: "edit", label: `Edit ${r.name}`, icon: <Pencil />, onClick: () => setModal({ kind: "keeper", row: r }) }]}
            cols={[
              { key: "name", label: "Name", sub: (r) => (r.brands ? `${r.brands.split(", ").length} brand${r.brands.includes(",") ? "s" : ""}` : "No brands") },
              { key: "phone", label: "Phone", kind: "mono" },
            ]} />
        </div>
        <div>
          <DataTable title="Transporters" note="Link them from a transporter's page" filename={`${w.name} transporters`} rowKey="transporter_warehouse_id" rows={transporters.data ?? []} loading={transporters.isLoading} search={false} pageSize={10}
            rowLink={(r) => `/transporters/${r.transporter_id}`}
            empty={{ title: "No transporters linked" }}
            cols={[
              { key: "transporter_name", label: "Transporter", sub: (r) => r.vehicle_number },
              { key: "phone_number", label: "Phone", kind: "mono" },
            ]} />
        </div>
      </div>

      <DataTable title="Billing companies" note="Shown as the dispatching company on documents" filename={`${w.name} companies`} rowKey="warehouse_company_id" rows={companies.data ?? []} loading={companies.isLoading} search={false} pageSize={10}
        actions={<Button size="sm" icon={<Plus />} onClick={() => setModal({ kind: "company", row: {} })}>Add company</Button>}
        empty={{ title: "No companies yet" }}
        rowActions={(r) => [{ kind: "edit", label: `Edit ${r.company_name}`, icon: <Pencil />, onClick: () => setModal({ kind: "company", row: r }) }]}
        cols={[
          { key: "company_name", label: "Company", className: "font-medium" },
          { key: "address_line1", label: "Address", value: (r) => [r.address_line1, r.address_line2].filter(Boolean).join(", ") },
          { key: "city", label: "City" },
          { key: "state", label: "State" },
          { key: "pincode", label: "Pincode", kind: "mono" },
        ]} />

      <div className="no-print flex justify-end">
        <Button variant="danger" busy={remove.isPending} icon={<Trash2 />} onClick={async () => (await ask(`Delete ${w.name}?`, "Delete warehouse", { body: "Its brand assignments and warehouse keepers are removed too. Past orders keep their warehouse." })) && remove.mutate(undefined)}>Delete warehouse</Button>
      </div>

      {modal?.kind === "edit" && <WarehouseModal w={w} onClose={() => setModal(null)} onSaved={() => null} />}
      {modal?.kind === "brand" && <BrandModal warehouseId={id} row={modal.row} taken={(brands.data ?? []).map((b) => b.brand.toLowerCase())} onClose={() => setModal(null)} />}
      {modal?.kind === "company" && <CompanyModal warehouseId={id} row={modal.row} onClose={() => setModal(null)} />}
      {modal?.kind === "keeper" && <KeeperModal row={modal.row} onClose={() => setModal(null)} />}
    </div>
  );
}

function WarehouseModal({ w, onClose, onSaved }: { w: any; onClose: () => void; onSaved: (id: number) => void }) {
  const isNew = !w.warehouse_id;
  const [name, setName] = useState(w.name ?? "");
  const [location, setLocation] = useState(w.location ?? "");
  const save = useAction(() => (isNew ? post("warehouses", { name, location }) : patch(`warehouses/${w.warehouse_id}`, { name, location })), ["warehouses"], {
    onSuccess: (r) => { onClose(); onSaved(r.warehouse_id ?? w.warehouse_id); },
  });
  return (
    <Modal open onClose={onClose} title={isNew ? "New warehouse" : `Edit ${w.name}`} size="sm"
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" busy={save.isPending} disabled={!name.trim()} onClick={() => save.mutate(undefined)}>{isNew ? "Add warehouse" : "Save changes"}</Button></>}>
      <div className="grid gap-4">
        <Field label="Warehouse name" required><Input id="w-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="City - Area" /></Field>
        <Field label="Location"><Input id="w-loc" value={location} onChange={(e) => setLocation(e.target.value)} /></Field>
      </div>
    </Modal>
  );
}

function BrandModal({ warehouseId, row, taken, onClose }: { warehouseId: number; row: any; taken: string[]; onClose: () => void }) {
  const isNew = !row.warehouse_brands_id;
  const products = useGet<any[]>("products");
  const keepers = useGet<any[]>("warehouse-keepers");
  const [brand, setBrand] = useState(row.brand ?? "");
  const [keeper, setKeeper] = useState(row.warehouse_keeper_id ?? "");
  // getBrandsDistinct: brands not yet assigned to this warehouse
  const options = useMemo(() => [...new Set((products.data ?? []).map((p) => p.brand).filter(Boolean))].filter((b) => !isNew || !taken.includes(b.toLowerCase()) || b === row.brand).sort(), [products.data, taken, isNew, row.brand]);
  const body = { brand, warehouse_keeper_id: keeper || null };
  const save = useAction(() => (isNew ? post(`warehouses/${warehouseId}/brands`, body) : patch(`warehouse-brands/${row.warehouse_brands_id}`, body)), ["warehouses"], { onSuccess: onClose });
  return (
    <Modal open onClose={onClose} title={isNew ? "Add brand" : `Edit ${row.brand}`} size="sm" footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" busy={save.isPending} disabled={!brand} onClick={() => save.mutate(undefined)}>{isNew ? "Add brand" : "Save changes"}</Button></>}>
      <div className="grid gap-4">
        <Field label="Brand" required><Select id="wb-brand" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Select a brand" options={options.map((b) => ({ value: b, label: b }))} /></Field>
        <Field label="Warehouse keeper" hint="Loading slips for this brand go to this keeper on WhatsApp."><Select id="wb-keeper" value={keeper} onChange={(e) => setKeeper(e.target.value)} placeholder="Select a keeper" options={(keepers.data ?? []).filter((k) => k.warehouse_id === warehouseId).map((k) => ({ value: k.warehouse_keeper_id, label: `${k.name} (${k.phone})` }))} /></Field>
      </div>
    </Modal>
  );
}

function CompanyModal({ warehouseId, row, onClose }: { warehouseId: number; row: any; onClose: () => void }) {
  const isNew = !row.warehouse_company_id;
  const [f, setF] = useState({ company_name: row.company_name ?? "", country: row.country ?? "India", state: row.state ?? "", city: row.city ?? "", address_line1: row.address_line1 ?? "", address_line2: row.address_line2 ?? "", pincode: row.pincode ?? "" });
  const keys = [`warehouses`];
  const save = useAction(() => (isNew ? post(`warehouses/${warehouseId}/companies`, f) : patch(`warehouse-companies/${row.warehouse_company_id}`, f)), keys, { onSuccess: onClose });
  const remove = useAction(() => del(`warehouse-companies/${row.warehouse_company_id}`), keys, { onSuccess: onClose });
  const set = (p: Partial<typeof f>) => setF({ ...f, ...p });
  return (
    <Modal open onClose={onClose} title={isNew ? "Add company" : `Edit ${row.company_name}`} footer={
      <>
        {!isNew && <Button variant="danger" className="mr-auto" busy={remove.isPending} icon={<Trash2 />} onClick={async () => (await ask(`Delete ${row.company_name}?`, "Delete company")) && remove.mutate(undefined)}>Delete</Button>}
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="primary" busy={save.isPending} disabled={!f.company_name.trim()} onClick={() => save.mutate(undefined)}>{isNew ? "Add company" : "Save changes"}</Button>
      </>
    }>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field required label="Company name" className="sm:col-span-2"><Input id="co-name" value={f.company_name} onChange={(e) => set({ company_name: e.target.value })} /></Field>
        <Field label="Address line 1" className="sm:col-span-2"><Input id="co-l1" value={f.address_line1} onChange={(e) => set({ address_line1: e.target.value })} /></Field>
        <Field label="Address line 2" className="sm:col-span-2"><Input id="co-l2" value={f.address_line2} onChange={(e) => set({ address_line2: e.target.value })} /></Field>
        <Field label="City"><Input id="co-city" value={f.city} onChange={(e) => set({ city: e.target.value })} /></Field>
        <Field label="State"><Input id="co-state" value={f.state} onChange={(e) => set({ state: e.target.value })} /></Field>
        <Field label="Pincode"><Input id="co-pin" value={f.pincode} onChange={(e) => set({ pincode: e.target.value })} /></Field>
        <Field label="Country"><Input id="co-country" value={f.country} onChange={(e) => set({ country: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}
