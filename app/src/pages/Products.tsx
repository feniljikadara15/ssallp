import { useMemo, useState } from "react";
import { Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { del, patch, post, useAction, useGet } from "../api";
import { num, stamp } from "../format";
import { useUrlState } from "../lib/urlState";
import { DataTable } from "../components/DataTable";
import { ask, Badge, Button, Checkbox, ErrorBox, Field, FilterBar, Input, Modal, PageHeader, Select, StatStrip, Tabs, Textarea, Toolbar } from "../components/ui";

// Option lists from the Retool Add Product form
const CATEGORIES = ["Aggregate", "Blocks", "Binding Wire", "Cement", "RMC", "Sand", "Steel", "Tilefix", "White Cement"];
const UNITS = ["Bags", "Bundles", "MTS", "M3", "Pieces", "MTS/Kgs", "Nos"];
const GST = ["5", "18", "28"];
const FILTERS = ["category", "brand", "gst", "zoho"] as const;

export default function Products() {
  const products = useGet<any[]>("products?all=1");
  const [f, set, clear] = useUrlState({ status: "true", category: "", brand: "", gst: "", zoho: "" });
  const [edit, setEdit] = useState<any | null>(null);
  const sync = useAction(() => post("products/sync-zoho"), ["products"]);
  const all = products.data ?? [];
  const distinct = (k: string) => [...new Set(all.map((p) => p[k]).filter(Boolean))].sort() as string[];

  const rows = useMemo(() => all.filter((p) =>
    (!f.status || String(!!p.is_active) === f.status) &&
    (!f.category || p.category === f.category) &&
    (!f.brand || p.brand === f.brand) &&
    (!f.gst || String(Number(p.gst_rate)) === f.gst) &&
    (!f.zoho || (f.zoho === "yes" ? !!p.zb_item_id : !p.zb_item_id))), [all, f]);
  const filtered = FILTERS.some((k) => f[k]);

  return (
    <div className="page">
      <PageHeader title="Products" subtitle="The catalogue used on enquiries and orders. Changes here are pushed to Zoho Books.">
        <Button busy={sync.isPending} icon={<RefreshCw />} onClick={() => sync.mutate(undefined)}>Sync with Zoho Books</Button>
        <Button variant="primary" icon={<Plus />} onClick={() => setEdit({})}>Add product</Button>
      </PageHeader>
      <Toolbar>
        <Tabs value={f.status} onChange={(v) => set({ status: v })} tabs={[
          { value: "true", label: "Active", count: all.filter((p) => p.is_active).length },
          { value: "false", label: "Inactive", count: all.filter((p) => !p.is_active).length },
          { value: "", label: "All", count: all.length },
        ]} />
      </Toolbar>
      <FilterBar active={filtered} onClear={() => clear(FILTERS)}>
        <Select className="w-full sm:w-48" value={f.category} onChange={(e) => set({ category: e.target.value })} placeholder="All categories" options={distinct("category").map((c) => ({ value: c, label: c }))} />
        <Select className="w-full sm:w-44" value={f.brand} onChange={(e) => set({ brand: e.target.value })} placeholder="All brands" options={distinct("brand").map((c) => ({ value: c, label: c }))} />
        <Select className="w-full sm:w-36" value={f.gst} onChange={(e) => set({ gst: e.target.value })} placeholder="Any GST" options={GST.map((g) => ({ value: g, label: `${g}% GST` }))} />
        <Select className="w-full sm:w-48" value={f.zoho} onChange={(e) => set({ zoho: e.target.value })} placeholder="Any Zoho link" options={[{ value: "yes", label: "Linked to Zoho" }, { value: "no", label: "Not in Zoho" }]} />
      </FilterBar>

      {products.error && <ErrorBox error={products.error} />}
      <StatStrip items={[
        { label: "Products", value: num(rows.length) },
        { label: "Categories", value: num(new Set(rows.map((p) => p.category).filter(Boolean)).size) },
        { label: "Brands", value: num(new Set(rows.map((p) => p.brand).filter(Boolean)).size) },
        { label: "Not in Zoho Books", value: num(rows.filter((p) => !p.zb_item_id).length), tone: rows.some((p) => !p.zb_item_id) ? "warning" : undefined, hint: "Can't be invoiced until synced" },
      ]} />

      <DataTable title="Products" filename={`Products ${stamp()}`} rowKey="product_id" rows={rows} loading={products.isLoading}
        filtersActive={filtered} onClearFilters={() => clear(FILTERS)} onRowClick={setEdit}
        empty={{ title: "No products", action: <Button size="sm" variant="primary" icon={<Plus />} onClick={() => setEdit({})}>Add product</Button> }}
        rowActions={(r) => [{ kind: "edit", label: `Edit ${r.product_name}`, icon: <Pencil />, onClick: () => setEdit(r) }]}
        cols={[
          { key: "product_name", label: "Product", className: "font-medium", sub: (r) => r.sku },
          { key: "category", label: "Category" },
          { key: "brand", label: "Brand" },
          { key: "grade", label: "Grade" },
          { key: "unit", label: "Unit" },
          { key: "hsn", label: "HSN", kind: "mono" },
          { key: "gst_rate", label: "GST", value: (r) => (r.gst_rate != null ? `${Number(r.gst_rate)}%` : null) },
          { key: "mrp", label: "MRP (₹)", kind: "money" },
          { key: "zb_item_id", label: "Zoho", value: (r) => (r.zb_item_id ? "Linked" : "Not linked"), render: (r) => r.zb_item_id ? <Badge tone="success">Linked</Badge> : <Badge tone="warning">Not linked</Badge> },
          { key: "is_active", label: "Status", value: (r) => (r.is_active ? "Active" : "Inactive"), render: (r) => <Badge dot tone={r.is_active ? "success" : "neutral"}>{r.is_active ? "Active" : "Inactive"}</Badge> },
        ]} />
      {edit && <ProductModal product={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function ProductModal({ product, onClose }: { product: any; onClose: () => void }) {
  const isNew = !product.product_id;
  const [p, setP] = useState({
    product_name: product.product_name ?? "", description: product.description ?? "", brand: product.brand ?? "", grade: product.grade ?? "",
    category: product.category ?? "", unit: product.unit ?? "", sku: product.sku ?? "", hsn: product.hsn ?? "",
    gst_rate: product.gst_rate != null ? String(Number(product.gst_rate)) : "18", mrp: product.mrp != null ? String(product.mrp) : "", is_active: product.is_active ?? true,
  });
  const set = (x: Partial<typeof p>) => setP({ ...p, ...x });
  const save = useAction(() => (isNew ? post("products", p) : patch(`products/${product.product_id}`, p)), ["products"], { onSuccess: onClose });
  const remove = useAction(() => del(`products/${product.product_id}`), ["products"], { onSuccess: onClose });
  const title = isNew ? "Add product" : `Edit ${product.product_name}`;
  return (
    <Modal open onClose={onClose} title={title} size="lg" footer={
      <>
        {!isNew && <Button variant="danger" className="mr-auto" busy={remove.isPending} icon={<Trash2 />} onClick={async () => (await ask(`Delete ${product.product_name}?`, "Delete product", { body: "It is also deleted in Zoho Books. Past orders keep their items." })) && remove.mutate(undefined)}>Delete</Button>}
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="primary" busy={save.isPending} disabled={!p.product_name.trim() || !p.brand.trim() || !p.category} onClick={() => save.mutate(undefined)}>{isNew ? "Add product" : "Save changes"}</Button>
      </>
    }>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field required label="Product name" className="sm:col-span-2"><Input id="p-name" value={p.product_name} onChange={(e) => set({ product_name: e.target.value })} /></Field>
        <Field label="Description" className="sm:col-span-2"><Textarea id="p-desc" rows={2} value={p.description} onChange={(e) => set({ description: e.target.value })} /></Field>
        <Field required label="Brand"><Input id="p-brand" value={p.brand} onChange={(e) => set({ brand: e.target.value })} /></Field>
        <Field label="Grade"><Input id="p-grade" value={p.grade} onChange={(e) => set({ grade: e.target.value })} /></Field>
        <Field required label="Category"><Select id="p-cat" value={p.category} onChange={(e) => set({ category: e.target.value })} placeholder="Select a category" options={[...new Set([...CATEGORIES, p.category].filter(Boolean))].map((x) => ({ value: x, label: x }))} /></Field>
        <Field label="Unit"><Select id="p-unit" value={p.unit} onChange={(e) => set({ unit: e.target.value })} placeholder="Select a unit" options={[...new Set([...UNITS, p.unit].filter(Boolean))].map((x) => ({ value: x, label: x }))} /></Field>
        <Field label="SKU"><Input id="p-sku" value={p.sku} onChange={(e) => set({ sku: e.target.value })} /></Field>
        <Field label="HSN/SAC"><Input id="p-hsn" value={p.hsn} onChange={(e) => set({ hsn: e.target.value })} /></Field>
        <Field label="GST rate"><Select id="p-gst" value={p.gst_rate} onChange={(e) => set({ gst_rate: e.target.value })} options={[...new Set([...GST, p.gst_rate])].map((x) => ({ value: x, label: `${x}%` }))} /></Field>
        <Field label="MRP"><Input id="p-mrp" type="number" value={p.mrp} onChange={(e) => set({ mrp: e.target.value })} /></Field>
        {!isNew && <Checkbox label="Active" checked={p.is_active} onChange={(v) => set({ is_active: v })} />}
      </div>
    </Modal>
  );
}
