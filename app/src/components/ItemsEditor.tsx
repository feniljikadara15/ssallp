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
  const cell = "w-24 rounded-md border border-black/15 bg-white px-2 py-1 text-right text-xs outline-none transition hover:border-black/30 focus:border-primary focus:ring-2 focus:ring-primary/20";

  const th = "px-4 py-2.5 font-medium";
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-black/[0.06] bg-gray-50/70 text-left text-2xs uppercase tracking-wide text-gray-500">
              <th className={th}>Product</th>
              <th className={`${th} text-right`}>Quantity</th>
              <th className={`${th} text-right`}>Unit price</th>
              <th className={`${th} text-right`}>Amount</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {items.map((it, i) => (
              <tr key={String(it[idKey ?? ""] ?? i)} className="border-b border-black/[0.04] last:border-0">
                <td className="px-4 py-2.5">
                  <div className="font-medium text-secondary">{[it.brand, it.grade].filter(Boolean).join(" ")}</div>
                  <div className="text-2xs text-gray-500">{it.category}</div>
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-right">
                  {editable
                    ? <span className="inline-flex items-center gap-1.5"><input aria-label={`Quantity of ${it.brand} ${it.grade}`} type="number" min={0} className={cell} value={edits[String(it[idKey!])]?.quantity ?? String(it.quantity)} onChange={(e) => set(it, "quantity", e.target.value)} /><span className="w-10 text-left text-gray-500">{it.unit}</span></span>
                    : <>{Number(it.quantity)} <span className="text-gray-500">{it.unit}</span></>}
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-right">
                  {editable
                    ? <input aria-label={`Unit price of ${it.brand} ${it.grade}`} type="number" min={0} className={cell} value={edits[String(it[idKey!])]?.unit_price ?? String(it.unit_price)} onChange={(e) => set(it, "unit_price", e.target.value)} />
                    : inr(it.unit_price)}
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-right font-medium text-secondary">{inr(editable ? val(it, "quantity") * val(it, "unit_price") : it.total_price ?? it.quantity * it.unit_price)}</td>
              </tr>
            ))}
            {!items.length && <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">No items</td></tr>}
          </tbody>
          {items.length > 0 && (
            <tfoot>
              <tr className="border-t border-black/[0.06] bg-gray-50/70">
                <td colSpan={3} className="px-4 py-3 text-right text-xs font-medium text-gray-600">Total</td>
                <td className="tabular whitespace-nowrap px-4 py-3 text-right text-sm font-semibold text-secondary">{inr(total)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {editable && changed.length > 0 && (
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-black/[0.06] bg-amber-50/60 px-4 py-2.5">
          <span className="mr-auto text-xs text-amber-800">{changed.length} item{changed.length > 1 ? "s" : ""} changed{invalid ? " · quantity must be more than zero" : ""}</span>
          <Button variant="outline" icon={<Undo2 />} onClick={() => setEdits({})}>Discard</Button>
          <Button busy={saving} disabled={invalid} icon={<Save />}
            onClick={() => onSave!(changed.map((it) => ({ [idKey!]: it[idKey!], quantity: val(it, "quantity"), unit_price: val(it, "unit_price") })))}>
            Save items
          </Button>
        </div>
      )}
    </div>
  );
}
