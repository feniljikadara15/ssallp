import { useState } from "react";
import { Download, Pencil, Plus, Trash2 } from "lucide-react";
import { del, patch, post, useAction, useGet } from "../api";
import { exportRows } from "../format";
import { ask, Button, Card, DataTable, ErrorBox, Field, Input, Loading, Modal, PageHeader, SearchInput, Select, toast } from "../components/ui";

export default function WarehouseKeepers() {
  const keepers = useGet<any[]>("warehouse-keepers");
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<any | null>(null);
  const rows = (keepers.data ?? []).filter((k) => !q.trim() || [k.name, k.phone, k.warehouse_name].join(" ").toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <div>
      <PageHeader title="Warehouse Keepers" description="People who receive loading slips on WhatsApp">
        <Button variant="outline" icon={<Download />}
          onClick={() => exportRows(rows.map(({ warehouse_keeper_id, name, phone, warehouse_name }) => ({ warehouse_keeper_id, name, phone, warehouse: warehouse_name })), "Warehouse Keepers", "csv").catch((e) => toast(e.message, "error"))}>Export</Button>
        <Button icon={<Plus />} onClick={() => setEdit({})}>Add keeper</Button>
      </PageHeader>
      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b border-black/[0.05] p-3">
          <div className="w-full sm:w-80"><SearchInput value={q} onChange={setQ} placeholder="Search name, phone or warehouse" /></div>
          <span className="ml-auto text-2xs text-gray-500">{rows.length} shown</span>
        </div>
        {keepers.error && <div className="p-3"><ErrorBox error={keepers.error} /></div>}
        {keepers.isLoading ? <div className="p-4"><Loading variant="inline" /></div> : (
          <DataTable rows={rows} rowKey={(r: any) => r.warehouse_keeper_id} pageSize={15} onRowClick={(r: any) => setEdit(r)} empty="No warehouse keepers" columns={[
            { key: "name", label: "Name", render: (r: any) => (
              <div className="flex items-center gap-3">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-secondary/[0.06] text-2xs font-semibold text-secondary/70">{String(r.name ?? "?").split(/\s+/).map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()}</div>
                <span className="font-medium">{r.name}</span>
              </div>
            ) },
            { key: "phone", label: "Phone", className: "tabular" },
            { key: "warehouse_name", label: "Warehouse" },
            { key: "actions", label: "", align: "right", render: (r: any) => <Button variant="ghost" aria-label={`Edit ${r.name}`} icon={<Pencil />} onClick={(e) => { e.stopPropagation(); setEdit(r); }} /> },
          ]} />
        )}
      </Card>
      {edit && <KeeperModal row={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function KeeperModal({ row, onClose }: { row: any; onClose: () => void }) {
  const isNew = !row.warehouse_keeper_id;
  const warehouses = useGet<any[]>("warehouses");
  const [f, setF] = useState({ name: row.name ?? "", phone: row.phone ?? "+91", warehouse_id: row.warehouse_id ?? "" });
  const keys = ["warehouse-keepers", "warehouses"];
  const save = useAction(() => (isNew ? post("warehouse-keepers", f) : patch(`warehouse-keepers/${row.warehouse_keeper_id}`, f)), keys, { onSuccess: onClose });
  const remove = useAction(() => del(`warehouse-keepers/${row.warehouse_keeper_id}`), keys, { onSuccess: onClose });
  return (
    <Modal open onClose={onClose} title={isNew ? "Add Warehouse Keeper" : "Edit Warehouse Keeper"} size="sm" footer={
      <>
        {!isNew && <Button variant="danger" className="mr-auto" busy={remove.isPending} icon={<Trash2 className="h-3.5 w-3.5" />} onClick={async () => (await ask(`Delete ${row.name}?`, "Delete")) && remove.mutate(undefined)}>Delete</Button>}
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button busy={save.isPending} disabled={!f.name.trim() || f.phone.replace("+91", "").trim().length < 10 || !f.warehouse_id} onClick={() => save.mutate(undefined)}>{isNew ? "Save" : "Update"}</Button>
      </>
    }>
      <div className="space-y-3">
        <Field label="Name"><Input id="k-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Phone"><Input id="k-phone" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
        <Field label="Warehouse"><Select id="k-wh" value={f.warehouse_id} onChange={(e) => setF({ ...f, warehouse_id: e.target.value })} placeholder="Select a warehouse" options={(warehouses.data ?? []).map((w) => ({ value: w.warehouse_id, label: w.name }))} /></Field>
      </div>
    </Modal>
  );
}
