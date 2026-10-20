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
      <PageHeader title="Warehouse Keepers">
        <Button icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setEdit({})}>Add Warehouse Keeper</Button>
      </PageHeader>
      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b p-3">
          <div className="w-full sm:w-72"><SearchInput value={q} onChange={setQ} placeholder="Search here" /></div>
          <Button variant="ghost" className="ml-auto" icon={<Download className="h-3.5 w-3.5" />}
            onClick={() => exportRows(rows.map(({ warehouse_keeper_id, name, phone, warehouse_name }) => ({ warehouse_keeper_id, name, phone, warehouse: warehouse_name })), "Warehouse Keepers", "csv").catch((e) => toast(e.message, "error"))}>Download</Button>
        </div>
        {keepers.error && <div className="p-3"><ErrorBox error={keepers.error} /></div>}
        {keepers.isLoading ? <Loading /> : (
          <DataTable rows={rows} rowKey={(r: any) => r.warehouse_keeper_id} pageSize={15} columns={[
            { key: "warehouse_keeper_id", label: "Warehouse keeper ID" },
            { key: "name", label: "Name", render: (r: any) => <b>{r.name}</b> },
            { key: "phone", label: "Phone" },
            { key: "warehouse_name", label: "Warehouse" },
            { key: "actions", label: "Actions", render: (r: any) => <Button variant="ghost" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => setEdit(r)}>Edit</Button> },
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
