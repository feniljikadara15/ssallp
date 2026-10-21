import { useMemo, useState } from "react";
import { Plus, Trash2, Pencil, Building2, MapPin, Tags, Truck, Warehouse as WarehouseIcon } from "lucide-react";
import { del, patch, post, useAction, useGet } from "../api";
import { ask, Badge, Button, Card, DataTable, EmptyState, ErrorBox, Field, Input, Loading, Modal, PageHeader, SearchInput, Section, Select, Textarea } from "../components/ui";
import ListItem, { revealDetail } from "../components/ListItem";

export default function Warehouses() {
  const warehouses = useGet<any[]>("warehouses");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<number | null>(null);
  const [edit, setEdit] = useState<any | null>(null);
  const list = (warehouses.data ?? []).filter((w) => !q.trim() || w.name.toLowerCase().includes(q.trim().toLowerCase()));
  const w = (warehouses.data ?? []).find((x) => x.warehouse_id === sel);

  return (
    <div>
      <PageHeader title="Warehouses" description="Where stock ships from, which brands each holds, and who loads them">
        <Button icon={<Plus />} onClick={() => setEdit({})}>New warehouse</Button>
      </PageHeader>
      <div className="grid items-start gap-5 lg:grid-cols-[320px_minmax(0,1fr)] [&>*]:min-w-0">
        <Card className="p-3">
          <SearchInput value={q} onChange={setQ} placeholder="Search warehouse" />
          <div className="mt-3 space-y-0.5">
            {warehouses.isLoading && <Loading variant="inline" />}
            {warehouses.error && <ErrorBox error={warehouses.error} />}
            {list.map((x) => (
              <ListItem key={x.warehouse_id} active={sel === x.warehouse_id} onClick={() => { setSel(x.warehouse_id); revealDetail(); }} title={x.name} subtitle={x.location} />
            ))}
          </div>
        </Card>
        <div id="detail-panel" className="min-w-0 scroll-mt-4">{w ? <WarehouseDetail w={w} onEdit={() => setEdit(w)} onDeleted={() => setSel(null)} /> : <EmptyState icon={<WarehouseIcon className="h-5 w-5" />} text="Pick a warehouse to manage its brands, keepers and transporters." />}</div>
      </div>
      {edit && <WarehouseModal w={edit} onClose={() => setEdit(null)} onSaved={(id) => setSel(id)} />}
    </div>
  );
}

function WarehouseDetail({ w, onEdit, onDeleted }: { w: any; onEdit: () => void; onDeleted: () => void }) {
  const id = w.warehouse_id;
  const brands = useGet<any[]>(`warehouses/${id}/brands`);
  const transporters = useGet<any[]>(`warehouses/${id}/transporters`);
  const [brand, setBrand] = useState<any | null>(null);
  const remove = useAction(() => del(`warehouses/${id}`), ["warehouses", "warehouse-keepers"], { onSuccess: onDeleted });
  const removeBrand = useAction((bid: number) => del(`warehouse-brands/${bid}`), [`warehouses`]);
  const unassigned = (brands.data ?? []).filter((b) => !b.warehouse_keeper_name).length;

  return (
    <div className="min-w-0 space-y-4">
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-secondary/[0.06] text-secondary/70"><WarehouseIcon className="h-5 w-5" /></div>
            <div className="min-w-0">
              <h2 className="truncate text-xl font-semibold tracking-tight text-secondary">{w.name}</h2>
              {w.location && <div className="mt-0.5 flex items-center gap-1 text-xs text-gray-500"><MapPin className="h-3 w-3" />{w.location}</div>}
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" icon={<Pencil />} onClick={onEdit}>Edit</Button>
            <Button variant="danger" busy={remove.isPending} icon={<Trash2 />} onClick={async () => (await ask(`Delete ${w.name}? Its brand assignments and warehouse keepers are removed too.`, "Delete")) && remove.mutate(undefined)}>Delete</Button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge>{brands.data?.length ?? "…"} brands</Badge>
          <Badge>{transporters.data?.length ?? "…"} transporters</Badge>
          {unassigned > 0 && <Badge tone="yellow" dot>{unassigned} brand{unassigned === 1 ? "" : "s"} without a keeper</Badge>}
        </div>
      </Card>

      <Section title="Brands and warehouse keepers" icon={<Tags />} description="Loading slips go to the keeper of each brand" bodyClassName="p-0"
        actions={<Button variant="outline" icon={<Plus />} onClick={() => setBrand({})}>Add brand</Button>}>
        {brands.isLoading ? <div className="p-4"><Loading variant="inline" /></div> : (
          <DataTable rows={brands.data ?? []} rowKey={(r: any) => r.warehouse_brands_id} empty="No brands yet. Brands not listed here get no loading slip." columns={[
            { key: "brand", label: "Brand", render: (r: any) => <span className="font-medium">{r.brand}</span> },
            { key: "warehouse_keeper_name", label: "Warehouse keeper", render: (r: any) => r.warehouse_keeper_name
              ? <div><div className="text-secondary">{r.warehouse_keeper_name}</div><div className="tabular text-2xs text-gray-500">{r.warehouse_keeper_phone}</div></div>
              : <Badge tone="yellow" dot>Not assigned</Badge> },
            { key: "actions", label: "", align: "right", render: (r: any) => (
              <div className="flex justify-end gap-1">
                <Button variant="ghost" icon={<Pencil />} onClick={() => setBrand(r)}>Edit</Button>
                <Button variant="ghost" className="text-red-700 hover:bg-red-50" aria-label={`Remove ${r.brand}`} icon={<Trash2 />} onClick={async () => (await ask(`Remove ${r.brand} from ${w.name}?`, "Remove")) && removeBrand.mutate(r.warehouse_brands_id)} />
              </div>
            ) },
          ]} />
        )}
      </Section>

      <Section title="Transporters" icon={<Truck />} description="Link transporters from the Transporters page" bodyClassName="p-0">
        {transporters.isLoading ? <div className="p-4"><Loading variant="inline" /></div> : (
          <DataTable rows={transporters.data ?? []} rowKey={(r: any) => r.transporter_warehouse_id} empty="No transporters linked yet" columns={[
            { key: "transporter_name", label: "Transporter", render: (r: any) => <span className="font-medium">{r.transporter_name}</span> },
            { key: "phone_number", label: "Phone", render: (r: any) => <span className="tabular">{[r.phone_number, r.additional_mobile_number].filter(Boolean).join(", ")}</span> },
            { key: "vehicle_number", label: "Vehicles", className: "whitespace-normal", render: (r: any) => (
              <div className="flex flex-wrap gap-1">{String(r.vehicle_number ?? "").split(/,\s*/).filter(Boolean).map((v) => <Badge key={v}>{v}</Badge>)}</div>
            ) },
          ]} />
        )}
      </Section>
      {brand && <BrandModal warehouseId={id} row={brand} taken={(brands.data ?? []).map((b) => b.brand.toLowerCase())} onClose={() => setBrand(null)} />}
    </div>
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
        <Field label="Warehouse keeper"><Select id="wb-keeper" value={keeper} onChange={(e) => setKeeper(e.target.value)} placeholder="Select keeper" options={(keepers.data ?? []).filter((k) => k.warehouse_id === warehouseId).map((k) => ({ value: k.warehouse_keeper_id, label: `${k.name} (${k.phone})` }))} /></Field>
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
        <Field label="Warehouse name"><Input id="w-name" value={name} onChange={(e) => setName(e.target.value)} /></Field>
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
        <Field label="Company name" className="sm:col-span-2"><Input id="co-name" value={f.company_name} onChange={(e) => set({ company_name: e.target.value })} /></Field>
        <Field label="Address line 1"><Textarea id="co-l1" rows={2} value={f.address_line1} onChange={(e) => set({ address_line1: e.target.value })} /></Field>
        <Field label="Address line 2"><Textarea id="co-l2" rows={2} value={f.address_line2} onChange={(e) => set({ address_line2: e.target.value })} /></Field>
        <Field label="City"><Input id="co-city" value={f.city} onChange={(e) => set({ city: e.target.value })} /></Field>
        <Field label="State"><Input id="co-state" value={f.state} onChange={(e) => set({ state: e.target.value })} /></Field>
        <Field label="Pincode"><Input id="co-pin" value={f.pincode} onChange={(e) => set({ pincode: e.target.value })} /></Field>
        <Field label="Country"><Input id="co-country" value={f.country} onChange={(e) => set({ country: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}
