import { useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { del, patch, post, useAction, useGet } from "../api";
import { num, stamp } from "../format";
import { useUrlState } from "../lib/urlState";
import { DataTable } from "../components/DataTable";
import { ask, Badge, Button, ErrorBox, Field, FilterBar, Input, Modal, PageHeader, Select, StatStrip } from "../components/ui";

// People who receive loading slips on WhatsApp, one or more per warehouse.
// Which brands each one loads is set on the warehouse's page.
export default function WarehouseKeepers() {
  const keepers = useGet<any[]>("warehouse-keepers");
  const warehouses = useGet<any[]>("warehouses");
  const [f, set, clear] = useUrlState({ warehouse: "", brands: "" });
  const [edit, setEdit] = useState<any | null>(null);
  const all = keepers.data ?? [];
  const rows = useMemo(() => all.filter((k) =>
    (!f.warehouse || String(k.warehouse_id) === f.warehouse) &&
    (!f.brands || (f.brands === "yes" ? !!k.brands : !k.brands))), [all, f]);
  const filtered = !!(f.warehouse || f.brands);

  return (
    <div className="page">
      <PageHeader title="Warehouse keepers" subtitle="People who receive loading slips on WhatsApp. Assign the brands they load on each warehouse's page.">
        <Button variant="primary" icon={<Plus />} onClick={() => setEdit({})}>Add keeper</Button>
      </PageHeader>
      <FilterBar active={filtered} onClear={() => clear(["warehouse", "brands"])}>
        <Select className="w-full sm:w-56" value={f.warehouse} onChange={(e) => set({ warehouse: e.target.value })} placeholder="All warehouses"
          options={(warehouses.data ?? []).map((w) => ({ value: String(w.warehouse_id), label: w.name }))} />
        <Select className="w-full sm:w-52" value={f.brands} onChange={(e) => set({ brands: e.target.value })} placeholder="Any brands"
          options={[{ value: "yes", label: "Loads at least one brand" }, { value: "no", label: "No brands assigned" }]} />
      </FilterBar>
      {keepers.error && <ErrorBox error={keepers.error} />}
      <StatStrip items={[
        { label: "Keepers", value: num(rows.length) },
        { label: "Warehouses covered", value: num(new Set(rows.map((k) => k.warehouse_id)).size) },
        { label: "Without brands", value: num(rows.filter((k) => !k.brands).length), hint: "Get no loading slips" },
      ]} />
      <DataTable title="Warehouse keepers" filename={`Warehouse keepers ${stamp()}`} rowKey="warehouse_keeper_id" rows={rows} loading={keepers.isLoading}
        filtersActive={filtered} onClearFilters={() => clear(["warehouse", "brands"])} onRowClick={setEdit}
        empty={{ title: "No warehouse keepers", action: <Button size="sm" variant="primary" icon={<Plus />} onClick={() => setEdit({})}>Add keeper</Button> }}
        rowActions={(r) => [{ kind: "edit", label: `Edit ${r.name}`, icon: <Pencil />, onClick: () => setEdit(r) }]}
        cols={[
          { key: "name", label: "Name", className: "font-medium" },
          { key: "phone", label: "Phone", kind: "mono" },
          { key: "warehouse_name", label: "Warehouse" },
          { key: "brands", label: "Brands", render: (r) => r.brands ?? <Badge tone="neutral">None</Badge> },
        ]} />
      {edit && <KeeperModal row={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

export function KeeperModal({ row, onClose }: { row: any; onClose: () => void }) {
  const isNew = !row.warehouse_keeper_id;
  const warehouses = useGet<any[]>("warehouses");
  const [f, setF] = useState({ name: row.name ?? "", phone: row.phone ?? "+91", warehouse_id: row.warehouse_id ?? "" });
  const keys = ["warehouse-keepers", "warehouses"];
  const save = useAction(() => (isNew ? post("warehouse-keepers", f) : patch(`warehouse-keepers/${row.warehouse_keeper_id}`, f)), keys, { onSuccess: onClose });
  const remove = useAction(() => del(`warehouse-keepers/${row.warehouse_keeper_id}`), keys, { onSuccess: onClose });
  const phoneOk = f.phone.replace(/\D/g, "").replace(/^91/, "").length >= 10;
  return (
    <Modal open onClose={onClose} title={isNew ? "Add warehouse keeper" : `Edit ${row.name}`} size="sm" footer={
      <>
        {!isNew && <Button variant="danger" className="mr-auto" busy={remove.isPending} icon={<Trash2 />} onClick={async () => (await ask(`Delete ${row.name}?`, "Delete keeper", { body: "Brands they loaded are left without a keeper until you assign another." })) && remove.mutate(undefined)}>Delete</Button>}
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="primary" busy={save.isPending} disabled={!f.name.trim() || !phoneOk || !f.warehouse_id} onClick={() => save.mutate(undefined)}>{isNew ? "Add keeper" : "Save changes"}</Button>
      </>
    }>
      <div className="grid gap-4">
        <Field label="Name" required><Input id="k-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="WhatsApp number" required hint="Loading slips are sent here."><Input id="k-phone" inputMode="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
        <Field label="Warehouse" required><Select id="k-wh" value={f.warehouse_id} onChange={(e) => setF({ ...f, warehouse_id: e.target.value })} placeholder="Select a warehouse" options={(warehouses.data ?? []).map((w) => ({ value: w.warehouse_id, label: w.name }))} /></Field>
      </div>
    </Modal>
  );
}
