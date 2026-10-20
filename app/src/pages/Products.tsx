import { useMemo, useState } from "react";
import { Pencil, Plus, Tag, Trash2 } from "lucide-react";
import { useStore, nextId, inr } from "../data/store";
import type { Product } from "../data/types";
import { Badge, Button, Card, DataTable, Field, Input, Modal, PageHeader, SearchInput, Select, Stat, useToast, ask } from "../components/ui";

const blank = (): Product => ({ product_id: 0, product_name: "", category: "Steel", brand: "", grade: "", unit: "MT", sku: "", hsn: "", gst_rate: 18, mrp: 0, zb_item_id: "", is_active: true });

export default function Products() {
  const { db, update } = useStore();
  const toast = useToast();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [edit, setEdit] = useState<Product | null>(null);

  const rows = useMemo(
    () => db.products.filter((p) => p.is_active).filter((p) => !cat || p.category === cat).filter((p) => !q || [p.product_name, p.brand, p.grade, p.sku].join(" ").toLowerCase().includes(q.toLowerCase())),
    [db.products, q, cat],
  );

  return (
    <div>
      <PageHeader title="Products">
        <Button icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setEdit(blank())}>Add Product</Button>
      </PageHeader>
      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <Stat label="Product Count" value={rows.length} icon={<Tag className="h-5 w-5" />} />
      </div>
      <Card>
        <div className="flex flex-wrap gap-2 border-b p-3">
          <div className="w-72"><SearchInput value={q} onChange={setQ} placeholder="Search Products..." /></div>
          <div className="w-48"><Select value={cat} onChange={(e) => setCat(e.target.value)} placeholder="All categories" options={[...new Set(db.products.map((p) => p.category))].map((c) => ({ value: c, label: c }))} /></div>
        </div>
        <DataTable rows={rows} rowKey={(r) => r.product_id} pageSize={15} columns={[
          { key: "product_id", label: "Product ID" },
          { key: "product_name", label: "Product Name", render: (r) => <span className="font-medium">{r.product_name}</span> },
          { key: "category", label: "Category", render: (r) => <Badge tone={r.category === "Steel" ? "blue" : r.category === "Cement" ? "gray" : "yellow"}>{r.category}</Badge> },
          { key: "brand", label: "Brand" },
          { key: "grade", label: "Grade" },
          { key: "unit", label: "Unit" },
          { key: "sku", label: "SKU" },
          { key: "hsn", label: "HSN/SAC" },
          { key: "gst_rate", label: "GST Rate", render: (r) => `${r.gst_rate}%` },
          { key: "mrp", label: "MRP", align: "right", render: (r) => inr(r.mrp) },
          { key: "action", label: "Action", render: (r) => (
            <div className="flex gap-1">
              <Button variant="ghost" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => setEdit(r)} />
              <Button variant="ghost" className="text-red-700" icon={<Trash2 className="h-3.5 w-3.5" />} onClick={async () => { if (await ask(`Delete ${r.product_name}?`)) { update((d) => { d.products.find((p) => p.product_id === r.product_id)!.is_active = false; }); toast("Product deleted"); } }} />
            </div>
          ) },
        ]} />
      </Card>
      {edit && <ProductModal product={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function ProductModal({ product, onClose }: { product: Product; onClose: () => void }) {
  const { update } = useStore();
  const [p, setP] = useState(product);
  const set = (x: Partial<Product>) => setP({ ...p, ...x });
  const isNew = !product.product_id;
  return (
    <Modal open onClose={onClose} title={isNew ? "Add Product" : "Edit Product"} footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={!p.brand || !p.grade} onClick={() => {
      update((d) => {
        const row = { ...p, product_name: p.product_name || `${p.brand} ${p.grade}` };
        if (isNew) d.products.push({ ...row, product_id: nextId(d.products, "product_id") });
        else Object.assign(d.products.find((x) => x.product_id === p.product_id)!, row);
      });
      onClose();
    }}>Save</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Category"><Select value={p.category} onChange={(e) => set({ category: e.target.value })} options={["Steel", "Cement", "Binding Wire"].map((x) => ({ value: x, label: x }))} /></Field>
        <Field label="Brand"><Input value={p.brand} onChange={(e) => set({ brand: e.target.value })} /></Field>
        <Field label="Grade"><Input value={p.grade} onChange={(e) => set({ grade: e.target.value })} /></Field>
        <Field label="Unit"><Select value={p.unit} onChange={(e) => set({ unit: e.target.value })} options={["MT", "Bag", "Kg", "Nos"].map((x) => ({ value: x, label: x }))} /></Field>
        <Field label="Product Name" className="sm:col-span-2"><Input value={p.product_name} placeholder="Defaults to Brand + Grade" onChange={(e) => set({ product_name: e.target.value })} /></Field>
        <Field label="SKU"><Input value={p.sku} onChange={(e) => set({ sku: e.target.value })} /></Field>
        <Field label="HSN/SAC"><Input value={p.hsn} onChange={(e) => set({ hsn: e.target.value })} /></Field>
        <Field label="GST Rate (%)"><Input type="number" value={p.gst_rate} onChange={(e) => set({ gst_rate: Number(e.target.value) })} /></Field>
        <Field label="MRP"><Input type="number" value={p.mrp} onChange={(e) => set({ mrp: Number(e.target.value) })} /></Field>
        <Field label="Zoho Books Item ID" className="sm:col-span-2"><Input value={p.zb_item_id} onChange={(e) => set({ zb_item_id: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}
