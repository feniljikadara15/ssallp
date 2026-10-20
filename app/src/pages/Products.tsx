import { useMemo, useState } from "react";
import { Pencil, Plus, RefreshCw, Tag, Trash2 } from "lucide-react";
import { del, patch, post, useAction, useGet } from "../api";
import { inr } from "../format";
import { ask, Badge, Button, Card, Checkbox, DataTable, ErrorBox, Field, Input, Loading, Modal, PageHeader, SearchInput, Select, Stat, Textarea } from "../components/ui";

// Option lists from the Retool Add Product form
const CATEGORIES = ["Aggregate", "Blocks", "Binding Wire", "Cement", "RMC", "Sand", "Steel", "Tilefix", "White Cement"];
const UNITS = ["Bags", "Bundles", "MTS", "M3", "Pieces", "MTS/Kgs", "Nos"];
const GST = ["5", "18", "28"];

export default function Products() {
  const products = useGet<any[]>("products?all=1");
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [edit, setEdit] = useState<any | null>(null);
  const sync = useAction(() => post("products/sync-zoho"), ["products"]);

  const rows = useMemo(() => (products.data ?? [])
    .filter((p) => showInactive || p.is_active)
    .filter((p) => !cat || p.category === cat)
    .filter((p) => !q.trim() || [p.product_name, p.brand, p.grade, p.sku, p.zb_item_id].join(" ").toLowerCase().includes(q.trim().toLowerCase())), [products.data, q, cat, showInactive]);

  return (
    <div>
      <PageHeader title="Products">
        <Button variant="outline" busy={sync.isPending} icon={<RefreshCw className="h-3.5 w-3.5" />} onClick={() => sync.mutate(undefined)}>Sync with Zoho Books</Button>
        <Button icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setEdit({})}>Add Product</Button>
      </PageHeader>
      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <Stat label="Product Count" value={rows.length} icon={<Tag className="h-5 w-5" />} />
      </div>
      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b p-3">
          <div className="w-full sm:w-72"><SearchInput value={q} onChange={setQ} placeholder="Search Products..." /></div>
          <div className="w-full sm:w-48"><Select value={cat} onChange={(e) => setCat(e.target.value)} placeholder="All categories" options={[...new Set((products.data ?? []).map((p) => p.category).filter(Boolean))].sort().map((c) => ({ value: c, label: c }))} /></div>
          <Checkbox label="Show inactive" checked={showInactive} onChange={setShowInactive} />
        </div>
        {products.error && <div className="p-3"><ErrorBox error={products.error} /></div>}
        {products.isLoading ? <Loading /> : (
          <DataTable rows={rows} rowKey={(r: any) => r.product_id} pageSize={15} columns={[
            { key: "product_id", label: "Product ID" },
            { key: "product_name", label: "Product Name", render: (r: any) => <span className="font-medium">{r.product_name}</span> },
            { key: "category", label: "Category" },
            { key: "brand", label: "Brand" },
            { key: "grade", label: "Grade" },
            { key: "unit", label: "Unit" },
            { key: "sku", label: "SKU" },
            { key: "hsn", label: "HSN/SAC" },
            { key: "gst_rate", label: "GST Rate", render: (r: any) => (r.gst_rate != null ? `${Number(r.gst_rate)}%` : "") },
            { key: "mrp", label: "MRP", align: "right", render: (r: any) => (r.mrp != null ? inr(r.mrp) : "") },
            { key: "is_active", label: "Is active", render: (r: any) => <Badge tone={r.is_active ? "green" : "red"}>{r.is_active ? "Active" : "Inactive"}</Badge> },
            { key: "action", label: "Action", render: (r: any) => <Button variant="ghost" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => setEdit(r)}>Edit</Button> },
          ]} />
        )}
      </Card>
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
  const title = isNew ? "Add New Product" : `Edit Product : ${product.product_name}${product.zb_item_id ? `  [${product.zb_item_id}]` : ""}`;
  return (
    <Modal open onClose={onClose} title={title} size="lg" footer={
      <>
        {!isNew && <Button variant="danger" className="mr-auto" busy={remove.isPending} icon={<Trash2 className="h-3.5 w-3.5" />} onClick={async () => (await ask(`Delete ${product.product_name}? It is also deleted in Zoho Books.`, "Delete")) && remove.mutate(undefined)}>Delete</Button>}
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button busy={save.isPending} disabled={!p.product_name.trim() || !p.brand.trim() || !p.category} onClick={() => save.mutate(undefined)}>Save</Button>
      </>
    }>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Product Name" className="sm:col-span-2"><Input id="p-name" value={p.product_name} onChange={(e) => set({ product_name: e.target.value })} /></Field>
        <Field label="Description" className="sm:col-span-2"><Textarea id="p-desc" rows={2} value={p.description} onChange={(e) => set({ description: e.target.value })} /></Field>
        <Field label="Brand"><Input id="p-brand" value={p.brand} onChange={(e) => set({ brand: e.target.value })} /></Field>
        <Field label="Grade"><Input id="p-grade" value={p.grade} onChange={(e) => set({ grade: e.target.value })} /></Field>
        <Field label="Category"><Select id="p-cat" value={p.category} onChange={(e) => set({ category: e.target.value })} placeholder="Select a category" options={[...new Set([...CATEGORIES, p.category].filter(Boolean))].map((x) => ({ value: x, label: x }))} /></Field>
        <Field label="Unit"><Select id="p-unit" value={p.unit} onChange={(e) => set({ unit: e.target.value })} placeholder="Select a unit" options={[...new Set([...UNITS, p.unit].filter(Boolean))].map((x) => ({ value: x, label: x }))} /></Field>
        <Field label="SKU"><Input id="p-sku" value={p.sku} onChange={(e) => set({ sku: e.target.value })} /></Field>
        <Field label="HSN/SAC"><Input id="p-hsn" value={p.hsn} onChange={(e) => set({ hsn: e.target.value })} /></Field>
        <Field label="GST Rate"><Select id="p-gst" value={p.gst_rate} onChange={(e) => set({ gst_rate: e.target.value })} options={[...new Set([...GST, p.gst_rate])].map((x) => ({ value: x, label: `${x}%` }))} /></Field>
        <Field label="MRP"><Input id="p-mrp" type="number" value={p.mrp} onChange={(e) => set({ mrp: e.target.value })} /></Field>
        {!isNew && <Checkbox label="Product Active" checked={p.is_active} onChange={(v) => set({ is_active: v })} />}
      </div>
    </Modal>
  );
}
