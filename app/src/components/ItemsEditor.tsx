import { Plus, Trash2 } from "lucide-react";
import { useStore, inr } from "../data/store";
import type { LineItem } from "../data/types";
import { Button, Input, Select } from "./ui";

// Category → Brand → Grade cascade used by the enquiry and order forms.
export default function ItemsEditor({ items, onChange }: { items: LineItem[]; onChange: (i: LineItem[]) => void }) {
  const { db } = useStore();
  const products = db.products.filter((p) => p.is_active);
  const categories = [...new Set(products.map((p) => p.category))];
  const set = (idx: number, patch: Partial<LineItem>) => onChange(items.map((it, i) => (i === idx ? { ...it, ...patch } : it)));

  const choose = (idx: number, cat: string, brand: string, grade: string) => {
    const p = products.find((x) => x.category === cat && x.brand === brand && x.grade === grade);
    set(idx, { category: cat, brand, grade, product_id: p?.product_id ?? 0, unit: p?.unit ?? "", unit_price: p ? p.mrp : items[idx].unit_price });
  };

  // Last price this product was sold at, like the "Last Price" field in the old form.
  const lastPrice = (pid: number) => {
    for (const o of [...db.orders].sort((a, b) => b.order_date.localeCompare(a.order_date))) {
      const it = o.items.find((x) => x.product_id === pid);
      if (it) return it.unit_price;
    }
    return null;
  };

  return (
    <div className="space-y-2">
      {items.map((it, idx) => {
        const brands = [...new Set(products.filter((p) => p.category === it.category).map((p) => p.brand))];
        const grades = products.filter((p) => p.category === it.category && p.brand === it.brand).map((p) => p.grade);
        const lp = it.product_id ? lastPrice(it.product_id) : null;
        return (
          <div key={idx} className="grid grid-cols-2 items-end gap-2 rounded-xl border p-2 sm:grid-cols-[1fr_1fr_1fr_90px_110px_auto]">
            <Select value={it.category} onChange={(e) => choose(idx, e.target.value, "", "")} options={categories.map((c) => ({ value: c, label: c }))} placeholder="Category" />
            <Select value={it.brand} onChange={(e) => choose(idx, it.category, e.target.value, "")} options={brands.map((c) => ({ value: c, label: c }))} placeholder="Brand" />
            <Select value={it.grade} onChange={(e) => choose(idx, it.category, it.brand, e.target.value)} options={grades.map((c) => ({ value: c, label: c }))} placeholder="Grade" />
            <Input type="number" min={0} value={it.quantity || ""} placeholder={`Qty ${it.unit}`} onChange={(e) => set(idx, { quantity: Number(e.target.value) })} />
            <div>
              <Input type="number" min={0} value={it.unit_price || ""} placeholder="Price (with tax)" onChange={(e) => set(idx, { unit_price: Number(e.target.value) })} />
              {lp !== null && <div className="mt-0.5 text-[10px] text-gray-400">Last: {inr(lp)}</div>}
            </div>
            <button onClick={() => onChange(items.filter((_, i) => i !== idx))} className="justify-self-end rounded p-1.5 text-red-700 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
          </div>
        );
      })}
      <Button variant="outline" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => onChange([...items, { item_id: Date.now(), product_id: 0, category: "", brand: "", grade: "", quantity: 0, unit: "", unit_price: 0 }])}>
        Add item
      </Button>
    </div>
  );
}

export function ItemsTable({ items }: { items: LineItem[] }) {
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b bg-gray-50 text-left text-gray-500">
          <th className="px-3 py-2 font-medium">#</th>
          <th className="px-3 py-2 font-medium">Category</th>
          <th className="px-3 py-2 font-medium">Brand</th>
          <th className="px-3 py-2 font-medium">Grade</th>
          <th className="px-3 py-2 text-right font-medium">Quantity</th>
          <th className="px-3 py-2 text-right font-medium">Unit price</th>
          <th className="px-3 py-2 text-right font-medium">Total price</th>
        </tr>
      </thead>
      <tbody>
        {items.map((it, i) => (
          <tr key={it.item_id} className="border-b last:border-0">
            <td className="px-3 py-2 text-gray-400">{i + 1}</td>
            <td className="px-3 py-2">{it.category}</td>
            <td className="px-3 py-2">{it.brand}</td>
            <td className="px-3 py-2">{it.grade}</td>
            <td className="px-3 py-2 text-right">{it.quantity} {it.unit}</td>
            <td className="px-3 py-2 text-right">{inr(it.unit_price)}</td>
            <td className="px-3 py-2 text-right font-medium">{inr(it.quantity * it.unit_price)}</td>
          </tr>
        ))}
        <tr className="bg-gray-50">
          <td colSpan={6} className="px-3 py-2 text-right font-medium">Grand total</td>
          <td className="px-3 py-2 text-right font-bold">{inr(items.reduce((a, x) => a + x.quantity * x.unit_price, 0))}</td>
        </tr>
      </tbody>
    </table>
  );
}
