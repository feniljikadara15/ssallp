import { useMemo, useState } from "react";
import { Plus, Trash2, Pencil, Building2 } from "lucide-react";
import { del, patch, post, useAction, useGet } from "../api";
import { ask, Button, Card, DataTable, EmptyState, ErrorBox, Field, Input, Loading, Modal, PageHeader, SearchInput, Select, Textarea } from "../components/ui";
import ListItem from "../components/ListItem";

export default function Warehouses() {
  const warehouses = useGet<any[]>("warehouses");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<number | null>(null);
  const [edit, setEdit] = useState<any | null>(null);
  const list = (warehouses.data ?? []).filter((w) => !q.trim() || w.name.toLowerCase().includes(q.trim().toLowerCase()));
  const w = (warehouses.data ?? []).find((x) => x.warehouse_id === sel);

  return (
    <div>
      <PageHeader title="Warehouses">
        <Button icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setEdit({})}>New</Button>
      </PageHeader>
      <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <Card className="p-3">
          <SearchInput value={q} onChange={setQ} placeholder="Search warehouse" />
          <div className="mt-3 space-y-2">
            {warehouses.isLoading && <Loading />}
            {warehouses.error && <ErrorBox error={warehouses.error} />}
            {list.map((x) => (
              <div key={x.warehouse_id} className="flex items-stretch gap-1">
                <div className="min-w-0 flex-1"><ListItem active={sel === x.warehouse_id} onClick={() => setSel(x.warehouse_id)} title={x.name} subtitle={x.location} /></div>
                <button aria-label={`Edit ${x.name}`} title="Edit warehouse and companies" onClick={() => setEdit(x)} className="rounded-xl border px-2 text-gray-500 hover:border-primary/40 hover:text-primary"><Pencil className="h-3.5 w-3.5" /></button>
              </div>
            ))}
          </div>
        </Card>
        {w ? <WarehouseDetail w={w} onDeleted={() => setSel(null)} /> : <EmptyState text="Select a warehouse to view details" />}
      </div>
      {edit && <WarehouseModal w={edit} onClose={() => setEdit(null)} onSaved={(id) => setSel(id)} />}
    </div>
  );
}

function WarehouseDetail({ w, onDeleted }: { w: any; onDeleted: () => void }) {
  const id = w.warehouse_id;
  const brands = useGet<any[]>(`warehouses/${id}/brands`);
  const transporters = useGet<any[]>(`warehouses/${id}/transporters`);
  const [brand, setBrand] = useState<any | null>(null);
  const remove = useAction(() => del(`warehouses/${id}`), ["warehouses", "warehouse-keepers"], { onSuccess: onDeleted });
  const removeBrand = useAction((bid: number) => del(`warehouse-brands/${bid}`), [`warehouses`]);

  return (
    <Card className="min-w-0 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-medium text-secondary">{w.name}</h2>
          <div className="text-xs text-gray-500">{w.location}</div>
        </div>
        <Button variant="danger" busy={remove.isPending} icon={<Trash2 className="h-3.5 w-3.5" />} onClick={async () => (await ask(`Delete ${w.name}? Its brand assignments and warehouse keepers are removed too.`, "Delete")) && remove.mutate(undefined)}>Delete Warehouse</Button>
      </div>

      <div className="mb-2 mt-5 flex items-center justify-between">
        <h3 className="text-sm font-medium text-secondary">Brands & Warehouse Keepers</h3>
        <Button variant="outline" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setBrand({})}>Add Brand</Button>
      </div>
      <Card>
        {brands.isLoading ? <Loading /> : (
          <DataTable rows={brands.data ?? []} rowKey={(r: any) => r.warehouse_brands_id} empty="No brands assigned" columns={[
            { key: "warehouse_brands_id", label: "ID" },
            { key: "brand", label: "Brand", render: (r: any) => <b>{r.brand}</b> },
            { key: "warehouse_keeper_name", label: "Warehouse Keeper", render: (r: any) => r.warehouse_keeper_name ? `${r.warehouse_keeper_name} (${r.warehouse_keeper_phone ?? ""})` : <span className="text-warning">Not assigned</span> },
            { key: "actions", label: "Actions", render: (r: any) => (
              <div className="flex gap-1">
                <Button variant="ghost" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => setBrand(r)}>Edit</Button>
                <Button variant="ghost" className="text-red-700" icon={<Trash2 className="h-3.5 w-3.5" />} onClick={async () => (await ask(`Remove ${r.brand} from ${w.name}?`, "Remove")) && removeBrand.mutate(r.warehouse_brands_id)}>Remove</Button>
              </div>
            ) },
          ]} />
        )}
      </Card>

      <h3 className="mb-2 mt-5 text-sm font-medium text-secondary">Transporters</h3>
      <Card>
        {transporters.isLoading ? <Loading /> : (
          <DataTable rows={transporters.data ?? []} rowKey={(r: any) => r.transporter_warehouse_id} empty="No transporters linked. Link them from the Transporters page." columns={[
            { key: "transporter_id", label: "Transporter ID" },
            { key: "transporter_name", label: "Transporter name" },
            { key: "phone_number", label: "Phone number" },
            { key: "additional_mobile_number", label: "Additional mobile number" },
            { key: "vehicle_number", label: "Vehicles", className: "whitespace-normal" },
          ]} />
        )}
      </Card>
      {brand && <BrandModal warehouseId={id} row={brand} taken={(brands.data ?? []).map((b) => b.brand.toLowerCase())} onClose={() => setBrand(null)} />}
    </Card>
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
    <Modal open onClose={onClose} title={isNew ? "Add Brand" : "Edit Brand"} size="sm" footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button busy={save.isPending} disabled={!brand} onClick={() => save.mutate(undefined)}>Save</Button></>}>
      <div className="space-y-3">
        <Field label="Brand"><Select id="wb-brand" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Select brand" options={options.map((b) => ({ value: b, label: b }))} /></Field>
        <Field label="Warehouse Keeper"><Select id="wb-keeper" value={keeper} onChange={(e) => setKeeper(e.target.value)} placeholder="Select keeper" options={(keepers.data ?? []).filter((k) => k.warehouse_id === warehouseId).map((k) => ({ value: k.warehouse_keeper_id, label: `${k.name} (${k.phone})` }))} /></Field>
        <p className="text-[11px] text-gray-500">Loading slips for this brand go to this keeper on WhatsApp.</p>
      </div>
    </Modal>
  );
}

function WarehouseModal({ w, onClose, onSaved }: { w: any; onClose: () => void; onSaved: (id: number) => void }) {
  const isNew = !w.warehouse_id;
  const [name, setName] = useState(w.name ?? "");
  const [location, setLocation] = useState(w.location ?? "");
  const [company, setCompany] = useState<any | null>(null);
  const companies = useGet<any[]>(isNew ? null : `warehouses/${w.warehouse_id}/companies`);
  const save = useAction(() => (isNew ? post("warehouses", { name, location }) : patch(`warehouses/${w.warehouse_id}`, { name, location })), ["warehouses"], {
    onSuccess: (r) => { onSaved(r.warehouse_id ?? w.warehouse_id); onClose(); },
  });
  return (
    <Modal open onClose={onClose} title={isNew ? "New Warehouse" : "Edit Warehouse"} size={isNew ? "sm" : "lg"} footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button busy={save.isPending} disabled={!name.trim()} onClick={() => save.mutate(undefined)}>{isNew ? "Save" : "Update"}</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Warehouse Name"><Input id="w-name" value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Location"><Input id="w-loc" value={location} onChange={(e) => setLocation(e.target.value)} /></Field>
      </div>
      {!isNew && (
        <>
          <div className="mb-2 mt-5 flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wide text-gray-500">Companies</h4>
            <Button variant="outline" icon={<Building2 className="h-3.5 w-3.5" />} onClick={() => setCompany({})}>Add Company</Button>
          </div>
          <Card>
            {companies.isLoading ? <Loading /> : (
              <DataTable rows={companies.data ?? []} rowKey={(r: any) => r.warehouse_company_id} empty="No companies" columns={[
                { key: "company_name", label: "Company name" },
                { key: "address_line1", label: "Address line 1" },
                { key: "city", label: "City" },
                { key: "state", label: "State" },
                { key: "pincode", label: "Pincode" },
                { key: "action", label: "Action", render: (r: any) => <Button variant="ghost" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => setCompany(r)}>Edit</Button> },
              ]} />
            )}
          </Card>
        </>
      )}
      {company && <CompanyModal warehouseId={w.warehouse_id} row={company} onClose={() => setCompany(null)} />}
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
    <Modal open onClose={onClose} title={isNew ? "Add Company" : "Edit Company Warehouse"} footer={
      <>
        {!isNew && <Button variant="danger" className="mr-auto" busy={remove.isPending} onClick={async () => (await ask(`Delete ${row.company_name}?`, "Delete")) && remove.mutate(undefined)}>Delete</Button>}
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button busy={save.isPending} disabled={!f.company_name.trim()} onClick={() => save.mutate(undefined)}>{isNew ? "Save" : "Update"}</Button>
      </>
    }>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Company Name" className="sm:col-span-2"><Input id="co-name" value={f.company_name} onChange={(e) => set({ company_name: e.target.value })} /></Field>
        <Field label="Address Line 1"><Textarea id="co-l1" rows={2} value={f.address_line1} onChange={(e) => set({ address_line1: e.target.value })} /></Field>
        <Field label="Address Line 2"><Textarea id="co-l2" rows={2} value={f.address_line2} onChange={(e) => set({ address_line2: e.target.value })} /></Field>
        <Field label="City"><Input id="co-city" value={f.city} onChange={(e) => set({ city: e.target.value })} /></Field>
        <Field label="State"><Input id="co-state" value={f.state} onChange={(e) => set({ state: e.target.value })} /></Field>
        <Field label="Pincode"><Input id="co-pin" value={f.pincode} onChange={(e) => set({ pincode: e.target.value })} /></Field>
        <Field label="Country"><Input id="co-country" value={f.country} onChange={(e) => set({ country: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}
