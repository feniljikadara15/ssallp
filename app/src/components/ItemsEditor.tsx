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
  const cell = "input input-sm w-28 text-right tabular-nums";
  const th = "c whitespace-nowrap px-3 py-2.5 text-[12px] font-medium text-faint first:pl-4";

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="tbl w-full text-[13px]">
          <thead className="bg-surface-alt">
            <tr className="border-b border-line">
              <th className={`${th} text-left`}>Product</th>
              <th className={`${th} text-left`}>Category</th>
              <th className={`${th} text-right`}>Quantity</th>
              <th className={`${th} text-right`}>Unit price (₹)</th>
              <th className={`${th} text-right`}>Amount (₹)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line tabular-nums">
            {items.map((it, i) => (
              <tr key={String(it[idKey ?? ""] ?? i)} className="transition-colors hover:bg-surface-alt">
                <td className="c h-10 px-3 py-1.5 pl-4 font-medium text-ink">{[it.brand, it.grade].filter(Boolean).join(" ")}</td>
                <td className="c px-3 text-muted">{it.category}</td>
                <td className="c whitespace-nowrap px-3 text-right">
                  {editable
                    ? <span className="inline-flex items-center gap-2"><input aria-label={`Quantity of ${it.brand} ${it.grade}`} type="number" min={0} className={cell} value={edits[String(it[idKey!])]?.quantity ?? String(it.quantity)} onChange={(e) => set(it, "quantity", e.target.value)} /><span className="w-12 text-left text-faint">{it.unit}</span></span>
                    : <>{Number(it.quantity).toLocaleString("en-IN")} <span className="text-faint">{it.unit}</span></>}
                </td>
                <td className="c whitespace-nowrap px-3 text-right">
                  {editable
                    ? <input aria-label={`Unit price of ${it.brand} ${it.grade}`} type="number" min={0} className={cell} value={edits[String(it[idKey!])]?.unit_price ?? String(it.unit_price)} onChange={(e) => set(it, "unit_price", e.target.value)} />
                    : inr(it.unit_price)}
                </td>
                <td className="c whitespace-nowrap px-3 pr-4 text-right font-medium text-ink">{inr(editable ? val(it, "quantity") * val(it, "unit_price") : it.total_price ?? it.quantity * it.unit_price)}</td>
              </tr>
            ))}
            {!items.length && <tr><td colSpan={5} className="px-4 py-10 text-center text-[13px] text-faint">No items</td></tr>}
          </tbody>
          {items.length > 0 && (
            <tfoot className="bg-surface-alt">
              <tr className="border-t border-line-strong font-medium">
                <td className="c h-10 px-3 pl-4">Total</td><td className="c" /><td className="c" /><td className="c" />
                <td className="c whitespace-nowrap px-3 pr-4 text-right tabular-nums">{inr(total)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {editable && changed.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-t border-warning-line bg-warning-soft px-4 py-2.5">
          <span className="min-w-0 flex-1 text-[13px] text-warning">{changed.length} item{changed.length > 1 ? "s" : ""} changed, not saved yet{invalid ? ". A quantity must be more than zero." : "."}</span>
          <Button size="sm" variant="ghost" icon={<Undo2 />} onClick={() => setEdits({})}>Discard</Button>
          <Button size="sm" variant="primary" busy={saving} disabled={invalid} icon={<Save />}
            onClick={() => onSave!(changed.map((it) => ({ [idKey!]: it[idKey!], quantity: val(it, "quantity"), unit_price: val(it, "unit_price") })))}>
            Save items
          </Button>
        </div>
      )}
    </div>
  );
}
