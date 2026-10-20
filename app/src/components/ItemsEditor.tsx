import { inr } from "../format";

export interface ItemRow {
  category?: string | null;
  brand?: string | null;
  grade?: string | null;
  unit?: string | null;
  quantity: number;
  unit_price: number;
  total_price?: number | null;
}

// Category / Brand / Grade / Quantity / Unit price / Total price, as in the
// Retool order, enquiry and cash bill item tables.
export function ItemsTable({ items }: { items: ItemRow[] }) {
  const total = items.reduce((a, x) => a + Number(x.total_price ?? x.quantity * x.unit_price), 0);
  return (
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
            <tr key={i} className="border-b last:border-0">
              <td className="px-3 py-2">{it.category}</td>
              <td className="px-3 py-2">{it.brand}</td>
              <td className="px-3 py-2">{it.grade}</td>
              <td className="px-3 py-2 text-right">{Number(it.quantity)} {it.unit}</td>
              <td className="px-3 py-2 text-right">{inr(it.unit_price)}</td>
              <td className="px-3 py-2 text-right font-medium">{inr(it.total_price ?? it.quantity * it.unit_price)}</td>
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
  );
}
