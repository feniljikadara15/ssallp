import { useEffect, useMemo, useState } from "react";
import { Save, Undo2 } from "lucide-react";
import { inr } from "../format";
import { Button } from "./ui";

export interface ItemRow {
  category?: string | null;
  brand?: string | null;
  grade?: string | null;
  unit?: string | null;
  quantity: number;
  unit_price: number;
  total_price?: number | null;
  [key: string]: unknown;
}

type Edit = { quantity: string; unit_price: string };

// Category / Brand / Grade / Quantity / Unit price / Total price, as in the
// Retool order, enquiry and cash bill item tables. With `onSave`, quantity and
// unit price are editable inline, like Retool's editable columns.
export function ItemsTable({ items, idKey, onSave, saving }: {
  items: ItemRow[];
  idKey?: string;
  onSave?: (changes: Record<string, unknown>[]) => void;
  saving?: boolean;
}) {
  const editable = !!onSave && !!idKey;
  const [edits, setEdits] = useState<Record<string, Edit>>({});
  useEffect(() => setEdits({}), [items]);

  const val = (it: ItemRow, f: keyof Edit) => Number(edits[String(it[idKey!])]?.[f] ?? it[f]);
  const changed = useMemo(() => items.filter((it) => {
    const e = edits[String(it[idKey ?? ""])];
    return e && (Number(e.quantity) !== Number(it.quantity) || Number(e.unit_price) !== Number(it.unit_price));
  }), [items, edits, idKey]);
  const invalid = changed.some((it) => !(val(it, "quantity") > 0) || !(val(it, "unit_price") >= 0));
  const total = items.reduce((a, x) => a + (editable ? val(x, "quantity") * val(x, "unit_price") : Number(x.total_price ?? x.quantity * x.unit_price)), 0);

  const set = (it: ItemRow, f: keyof Edit, v: string) => {
    const id = String(it[idKey!]);
    const current = edits[id] ?? { quantity: String(it.quantity), unit_price: String(it.unit_price) };
    setEdits({ ...edits, [id]: { ...current, [f]: v } });
  };
  const cell = "w-24 rounded-md border border-black/20 px-2 py-1 text-right text-xs outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

  return (
    <div>
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b bg-gray-50 text-left text-gray-500">
              <th className="px-3 py-2 font-medium">Category</th>
              <th className="px-3 py-2 font-medium">Brand</th>
              <th className="px-3 py-2 font-medium">Grade</th>
              <th className="px-3 py-2 text-right font-medium">Quantity</th>
              <th className="px-3 py-2 text-right font-medium">Unit price</th>
              <th className="px-3 py-2 text-right font-medium">Total price</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {items.map((it, i) => (
              <tr key={String(it[idKey ?? ""] ?? i)} className="border-b last:border-0">
                <td className="px-3 py-2">{it.category}</td>
                <td className="px-3 py-2">{it.brand}</td>
                <td className="px-3 py-2">{it.grade}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right">
                  {editable
                    ? <><input aria-label={`Quantity of ${it.brand} ${it.grade}`} type="number" min={0} className={cell} value={edits[String(it[idKey!])]?.quantity ?? String(it.quantity)} onChange={(e) => set(it, "quantity", e.target.value)} /> {it.unit}</>
                    : <>{Number(it.quantity)} {it.unit}</>}
                </td>
                <td className="px-3 py-2 text-right">
                  {editable
                    ? <input aria-label={`Unit price of ${it.brand} ${it.grade}`} type="number" min={0} className={cell} value={edits[String(it[idKey!])]?.unit_price ?? String(it.unit_price)} onChange={(e) => set(it, "unit_price", e.target.value)} />
                    : inr(it.unit_price)}
                </td>
                <td className="px-3 py-2 text-right font-medium">{inr(editable ? val(it, "quantity") * val(it, "unit_price") : it.total_price ?? it.quantity * it.unit_price)}</td>
              </tr>
            ))}
            {!items.length && <tr><td colSpan={6} className="px-3 py-6 text-center text-gray-400">No items</td></tr>}
            {items.length > 0 && (
              <tr className="bg-gray-50">
                <td colSpan={5} className="px-3 py-2 text-right font-medium">Grand total</td>
                <td className="px-3 py-2 text-right font-bold">{inr(total)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {editable && changed.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
          <span className="mr-auto text-[11px] text-warning">{changed.length} item{changed.length > 1 ? "s" : ""} changed{invalid ? " · quantity must be more than zero" : ""}</span>
          <Button variant="outline" icon={<Undo2 className="h-3.5 w-3.5" />} onClick={() => setEdits({})}>Discard</Button>
          <Button busy={saving} disabled={invalid} icon={<Save className="h-3.5 w-3.5" />}
            onClick={() => onSave!(changed.map((it) => ({ [idKey!]: it[idKey!], quantity: val(it, "quantity"), unit_price: val(it, "unit_price") })))}>
            Save items
          </Button>
        </div>
      )}
    </div>
  );
}
