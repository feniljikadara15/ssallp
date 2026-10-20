import clsx from "clsx";
import { X, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState, type ReactNode, type InputHTMLAttributes, type SelectHTMLAttributes } from "react";

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={clsx("rounded-xl2 border border-black/10 bg-white", className)}>{children}</div>;
}

export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-bold text-secondary">{title}</h1>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

type BtnVariant = "primary" | "secondary" | "outline" | "danger" | "success" | "info" | "ghost";
export function Button({ variant = "primary", className, icon, children, ...p }: { variant?: BtnVariant; icon?: ReactNode } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...p}
      className={clsx(
        "inline-flex items-center justify-center gap-1.5 rounded-xl2 px-3.5 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
        {
          primary: "bg-primary text-white hover:bg-primary-600",
          secondary: "bg-secondary text-white hover:bg-secondary-600",
          outline: "border border-black/20 bg-white text-secondary hover:bg-black/5",
          danger: "bg-danger text-white hover:opacity-90",
          success: "bg-success text-white hover:opacity-90",
          info: "bg-info text-white hover:opacity-90",
          ghost: "text-secondary hover:bg-black/5",
        }[variant],
        className,
      )}
    >
      {icon}
      {children}
    </button>
  );
}

export function Badge({ tone = "gray", children }: { tone?: "gray" | "orange" | "green" | "blue" | "red" | "yellow" | "purple"; children: ReactNode }) {
  return (
    <span
      className={clsx("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium", {
        gray: "bg-gray-100 text-gray-700",
        orange: "bg-primary-100 text-primary-700",
        green: "bg-emerald-100 text-emerald-800",
        blue: "bg-blue-100 text-blue-800",
        red: "bg-red-100 text-red-800",
        yellow: "bg-amber-100 text-amber-800",
        purple: "bg-purple-100 text-purple-800",
      }[tone])}
    >
      {children}
    </span>
  );
}

export function Stat({ label, value, sub, icon }: { label: string; value: ReactNode; sub?: ReactNode; icon?: ReactNode }) {
  return (
    <Card className="flex items-center gap-4 p-4">
      {icon && <div className="grid h-11 w-11 place-items-center rounded-full bg-primary-50 text-primary">{icon}</div>}
      <div>
        <div className="text-xs text-gray-500">{label}</div>
        <div className="text-2xl font-bold text-secondary">{value}</div>
        {sub && <div className="text-xs">{sub}</div>}
      </div>
    </Card>
  );
}

export function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={clsx("block", className)}>
      <span className="mb-1 block text-xs font-medium text-gray-600">{label}</span>
      {children}
    </label>
  );
}

const inputCls = "w-full rounded-lg border border-black/20 bg-white px-2.5 py-1.5 text-xs outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";
export const Input = (p: InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={clsx(inputCls, p.className)} />;
export const Select = ({ options, placeholder, ...p }: SelectHTMLAttributes<HTMLSelectElement> & { options: { value: string | number; label: string }[]; placeholder?: string }) => (
  <select {...p} className={clsx(inputCls, p.className)}>
    {placeholder !== undefined && <option value="">{placeholder}</option>}
    {options.map((o) => (
      <option key={o.value} value={o.value}>{o.label}</option>
    ))}
  </select>
);
export const Textarea = (p: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...p} className={clsx(inputCls, p.className)} />;

export function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="pl-8" />
    </div>
  );
}

export function Modal({ open, onClose, title, children, footer, size = "md" }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; size?: "sm" | "md" | "lg" | "xl" }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-8" onMouseDown={onClose}>
      <div
        className={clsx("w-full rounded-xl2 bg-white shadow-xl", { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-3xl", xl: "max-w-5xl" }[size])}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-5 py-3">
          <h3 className="text-base font-medium text-secondary">{title}</h3>
          <button onClick={onClose} className="rounded-full p-1 hover:bg-black/5"><X className="h-4 w-4" /></button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { value: T; label: string; count?: number }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex gap-1 overflow-x-auto border-b">
      {tabs.map((t) => (
        <button
          key={t.value}
          onClick={() => onChange(t.value)}
          className={clsx("-mb-px shrink-0 whitespace-nowrap border-b-2 px-2.5 py-2 text-xs font-medium", value === t.value ? "border-primary text-primary" : "border-transparent text-gray-500 hover:text-secondary")}
        >
          {t.label}
          {t.count !== undefined && <span className="ml-1.5 rounded-full bg-gray-100 px-1.5 text-[10px] text-gray-600">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export interface Column<T> {
  key: string;
  label: string;
  render?: (row: T, i: number) => ReactNode;
  align?: "right";
  className?: string;
}

export function DataTable<T>({ rows, columns, rowKey, pageSize = 12, onRowClick, selectedKey, empty = "No rows" }: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (r: T) => string | number;
  pageSize?: number;
  onRowClick?: (r: T) => void;
  selectedKey?: string | number | null;
  empty?: string;
}) {
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const cur = Math.min(page, pages - 1);
  const slice = useMemo(() => rows.slice(cur * pageSize, cur * pageSize + pageSize), [rows, cur, pageSize]);
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b bg-gray-50 text-left text-gray-500">
              {columns.map((c) => (
                <th key={c.key} className={clsx("whitespace-nowrap px-3 py-2 font-medium", c.align === "right" && "text-right")}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slice.map((r, i) => (
              <tr
                key={rowKey(r)}
                onClick={() => onRowClick?.(r)}
                className={clsx("border-b last:border-0", onRowClick && "cursor-pointer hover:bg-primary-50/50", selectedKey === rowKey(r) && "bg-primary-50")}
              >
                {columns.map((c) => (
                  <td key={c.key} className={clsx("whitespace-nowrap px-3 py-2", c.align === "right" && "text-right", c.className)}>
                    {c.render ? c.render(r, cur * pageSize + i) : String((r as Record<string, unknown>)[c.key] ?? "")}
                  </td>
                ))}
              </tr>
            ))}
            {!slice.length && (
              <tr><td colSpan={columns.length} className="px-3 py-8 text-center text-gray-400">{empty}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {rows.length > pageSize && (
        <div className="flex items-center justify-end gap-2 border-t px-3 py-2 text-xs text-gray-500">
          <span>{cur * pageSize + 1}–{Math.min(rows.length, (cur + 1) * pageSize)} of {rows.length}</span>
          <button disabled={cur === 0} onClick={() => setPage(cur - 1)} className="rounded p-1 hover:bg-black/5 disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
          <button disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)} className="rounded p-1 hover:bg-black/5 disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
        </div>
      )}
    </div>
  );
}

export function EmptyState({ text }: { text: string }) {
  return <Card className="grid min-h-[300px] place-items-center p-8 text-sm font-medium text-gray-400">{text}</Card>;
}

export function KV({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-gray-400">{label}</div>
      <div className="text-xs font-medium text-secondary">{value || "—"}</div>
    </div>
  );
}

export function useToast() {
  return (msg: string) => {
    const el = document.createElement("div");
    el.textContent = msg;
    el.className = "fixed bottom-5 right-5 z-[60] rounded-xl2 bg-secondary px-4 py-2 text-xs text-white shadow-lg";
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2200);
  };
}

// In-page confirmation dialog; resolves true when the user confirms.
export function ask(message: string, confirmLabel = "Confirm"): Promise<boolean> {
  return new Promise((resolve) => {
    const root = document.createElement("div");
    root.className = "fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4";
    root.innerHTML = `
      <div class="w-full max-w-sm rounded-xl2 bg-white p-5 shadow-xl">
        <p class="text-sm text-secondary"></p>
        <div class="mt-5 flex justify-end gap-2">
          <button data-v="0" class="rounded-xl2 border border-black/20 px-3.5 py-1.5 text-xs font-medium text-secondary hover:bg-black/5">Cancel</button>
          <button data-v="1" class="rounded-xl2 bg-danger px-3.5 py-1.5 text-xs font-medium text-white hover:opacity-90"></button>
        </div>
      </div>`;
    root.querySelector("p")!.textContent = message;
    root.querySelector('[data-v="1"]')!.textContent = confirmLabel;
    const done = (v: boolean) => { root.remove(); resolve(v); };
    root.addEventListener("mousedown", (e) => { if (e.target === root) done(false); });
    root.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => done(b.dataset.v === "1")));
    document.body.appendChild(root);
    (root.querySelector('[data-v="1"]') as HTMLButtonElement).focus();
  });
}
