import clsx from "clsx";
import { X, Search, ChevronLeft, ChevronRight, ChevronDown, Loader2, XCircle, Check, Inbox } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type ReactNode, type InputHTMLAttributes } from "react";
import { usePopover } from "./pickers";
export { Select, DateInput } from "./pickers";

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={clsx("rounded-xl2 border border-black/[0.06] bg-white shadow-card", className)}>{children}</div>;
}

// A card with a titled header row: icon, title, optional description and actions.
export function Section({ title, description, icon, actions, children, className, bodyClassName }: {
  title: ReactNode; description?: ReactNode; icon?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; bodyClassName?: string;
}) {
  return (
    <Card className={className}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/[0.05] px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          {icon && <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-secondary/[0.06] text-secondary/70 [&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</div>}
          <div className="min-w-0">
            <h3 className="truncate text-[13px] font-semibold text-secondary">{title}</h3>
            {description && <p className="truncate text-2xs text-gray-500">{description}</p>}
          </div>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      <div className={bodyClassName ?? "p-4"}>{children}</div>
    </Card>
  );
}

export function PageHeader({ title, description, children }: { title: string; description?: ReactNode; children?: ReactNode }) {
  useEffect(() => { document.title = `${title} · Sambhavnath OMS`; }, [title]);
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-[22px] font-semibold tracking-tight text-secondary">{title}</h1>
        {description && <p className="mt-0.5 text-xs text-gray-500">{description}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

type BtnVariant = "primary" | "secondary" | "outline" | "danger" | "success" | "info" | "ghost";
export function Button({ variant = "primary", className, icon, busy, children, ...p }: { variant?: BtnVariant; icon?: ReactNode; busy?: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...p}
      disabled={p.disabled || busy}
      className={clsx(
        "inline-flex h-8 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-xs font-medium transition active:translate-y-px disabled:pointer-events-none disabled:opacity-45 [&>svg]:h-3.5 [&>svg]:w-3.5",
        {
          primary: "bg-primary text-white shadow-sm shadow-primary/25 hover:bg-primary-600",
          secondary: "bg-secondary text-white shadow-sm hover:bg-secondary-600",
          outline: "border border-black/[0.12] bg-white text-secondary shadow-sm hover:border-black/20 hover:bg-gray-50",
          danger: "border border-red-200 bg-white text-red-700 hover:border-red-300 hover:bg-red-50",
          success: "bg-emerald-600 text-white shadow-sm hover:bg-emerald-700",
          info: "bg-info text-white shadow-sm hover:opacity-90",
          ghost: "text-secondary hover:bg-black/5",
        }[variant],
        className,
      )}
    >
      {busy ? <Loader2 className="animate-spin" /> : icon}
      {children}
    </button>
  );
}

type Tone = "gray" | "orange" | "green" | "blue" | "red" | "yellow" | "purple";
const TONES: Record<Tone, { chip: string; dot: string }> = {
  gray: { chip: "bg-gray-100 text-gray-700 ring-gray-200", dot: "bg-gray-400" },
  orange: { chip: "bg-primary-50 text-primary-700 ring-primary-100", dot: "bg-primary" },
  green: { chip: "bg-emerald-50 text-emerald-700 ring-emerald-100", dot: "bg-emerald-500" },
  blue: { chip: "bg-sky-50 text-sky-700 ring-sky-100", dot: "bg-sky-500" },
  red: { chip: "bg-red-50 text-red-700 ring-red-100", dot: "bg-red-500" },
  yellow: { chip: "bg-amber-50 text-amber-800 ring-amber-100", dot: "bg-amber-500" },
  purple: { chip: "bg-violet-50 text-violet-700 ring-violet-100", dot: "bg-violet-500" },
};
export function Badge({ tone = "gray", dot, children }: { tone?: Tone; dot?: boolean; children: ReactNode }) {
  return (
    <span className={clsx("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-2xs font-medium ring-1 ring-inset", TONES[tone].chip)}>
      {dot && <span className={clsx("h-1.5 w-1.5 rounded-full", TONES[tone].dot)} />}
      {children}
    </span>
  );
}

export function Stat({ label, value, sub, icon, tone = "orange" }: { label: string; value: ReactNode; sub?: ReactNode; icon?: ReactNode; tone?: "orange" | "blue" | "green" | "navy" | "amber" }) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="text-xs font-medium text-gray-500">{label}</div>
        {icon && (
          <div className={clsx("grid h-8 w-8 shrink-0 place-items-center rounded-lg [&>svg]:h-4 [&>svg]:w-4", {
            orange: "bg-primary-50 text-primary", blue: "bg-sky-50 text-sky-600", green: "bg-emerald-50 text-emerald-600", navy: "bg-secondary/[0.07] text-secondary", amber: "bg-amber-50 text-amber-600",
          }[tone])}>{icon}</div>
        )}
      </div>
      <div className="tabular mt-1 text-2xl font-semibold tracking-tight text-secondary">{value}</div>
      {sub && <div className="mt-1 text-2xs text-gray-500">{sub}</div>}
    </Card>
  );
}

export function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={clsx("block min-w-0", className)}>
      <span className="mb-1.5 block text-xs font-medium text-gray-700">{label}</span>
      {children}
    </label>
  );
}

export const inputCls =
  "w-full min-w-0 rounded-lg border border-black/15 bg-white px-2.5 py-1.5 text-xs outline-none transition placeholder:text-gray-400 hover:border-black/30 focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400";
export const Input = (p: InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={clsx(inputCls, p.className)} />;
export const Textarea = (p: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...p} className={clsx(inputCls, p.className)} />;

export function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative min-w-0">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={clsx("pl-8", value && "pr-7")} />
      {value && (
        <button type="button" aria-label="Clear search" onClick={() => onChange("")} className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-gray-400 hover:bg-black/5 hover:text-secondary">
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

export function Modal({ open, onClose, title, children, footer, size = "md" }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; size?: "sm" | "md" | "lg" | "xl" }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fade-in fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-secondary/40 p-4 backdrop-blur-[2px] sm:p-8" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={clsx("pop-in w-full rounded-xl2 bg-white shadow-2xl shadow-black/20", { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-3xl", xl: "max-w-5xl" }[size])}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-black/5 px-5 py-3.5">
          <h3 className="text-sm font-semibold text-secondary">{title}</h3>
          <button aria-label="Close" onClick={onClose} className="rounded-lg p-1.5 text-gray-400 transition hover:bg-black/5 hover:text-secondary"><X className="h-4 w-4" /></button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 rounded-b-xl2 border-t border-black/5 bg-gray-50/60 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { value: T; label: string; count?: number }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div role="tablist" className="flex gap-0.5 overflow-x-auto rounded-lg bg-gray-100/80 p-0.5">
      {tabs.map((t) => (
        <button
          key={t.value}
          role="tab"
          aria-selected={value === t.value}
          onClick={() => onChange(t.value)}
          className={clsx(
            "flex flex-1 shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-md px-2 py-1.5 text-xs font-medium transition",
            value === t.value ? "bg-white text-secondary shadow-sm" : "text-gray-500 hover:text-secondary",
          )}
        >
          {t.label}
          {t.count !== undefined && <span className={clsx("tabular rounded-full px-1.5 text-2xs", value === t.value ? "bg-primary-50 text-primary-700" : "bg-black/5 text-gray-500")}>{t.count}</span>}
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
            <tr className="border-b border-black/[0.06] bg-gray-50/70 text-left text-2xs uppercase tracking-wide text-gray-500">
              {columns.map((c) => (
                <th key={c.key} className={clsx("whitespace-nowrap px-4 py-2.5 font-medium", c.align === "right" && "text-right")}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slice.map((r, i) => (
              <tr
                key={rowKey(r)}
                onClick={() => onRowClick?.(r)}
                className={clsx("border-b border-black/[0.04] transition-colors last:border-0 hover:bg-gray-50/80", onRowClick && "cursor-pointer", selectedKey === rowKey(r) && "bg-primary-50/60")}
              >
                {columns.map((c) => (
                  <td key={c.key} className={clsx("whitespace-nowrap px-4 py-2.5 text-secondary", c.align === "right" && "tabular text-right", c.className)}>
                    {c.render ? c.render(r, cur * pageSize + i) : String((r as Record<string, unknown>)[c.key] ?? "")}
                  </td>
                ))}
              </tr>
            ))}
            {!slice.length && (
              <tr><td colSpan={columns.length} className="px-3 py-12 text-center text-gray-400"><Inbox className="mx-auto mb-2 h-5 w-5 text-gray-300" />{empty}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {rows.length > pageSize && (
        <div className="flex items-center justify-end gap-2 border-t border-black/[0.05] px-4 py-2 text-xs text-gray-500">
          <span>{cur * pageSize + 1}–{Math.min(rows.length, (cur + 1) * pageSize)} of {rows.length}</span>
          <button disabled={cur === 0} onClick={() => setPage(cur - 1)} className="rounded p-1 hover:bg-black/5 disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
          <button disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)} className="rounded p-1 hover:bg-black/5 disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
        </div>
      )}
    </div>
  );
}

export function EmptyState({ text, icon }: { text: string; icon?: ReactNode }) {
  return (
    <Card className="flex min-h-[300px] flex-col items-center justify-center gap-3 p-8 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-full bg-gray-100 text-gray-400">{icon ?? <Inbox className="h-5 w-5" />}</div>
      <div className="max-w-xs text-sm text-gray-500">{text}</div>
    </Card>
  );
}

export function KV({ label, value, className }: { label: string; value: ReactNode; className?: string }) {
  return (
    <div className={clsx("min-w-0", className)}>
      <div className="text-2xs font-medium text-gray-500">{label}</div>
      <div className="mt-0.5 break-words text-xs font-medium text-secondary">{value || <span className="font-normal text-gray-300">—</span>}</div>
    </div>
  );
}

let toastStack: HTMLDivElement | null = null;
const TOAST_ICON = {
  ok: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>',
  warn: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>',
  error: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>',
};
export function toast(msg: string, tone: "ok" | "warn" | "error" = "ok") {
  if (!toastStack || !document.body.contains(toastStack)) {
    toastStack = document.createElement("div");
    toastStack.className = "pointer-events-none fixed bottom-5 left-4 right-4 z-[80] flex flex-col items-end gap-2 sm:left-auto sm:right-5 sm:w-96";
    document.body.appendChild(toastStack);
  }
  const el = document.createElement("div");
  el.setAttribute("role", tone === "error" ? "alert" : "status");
  el.className = "toast-in pointer-events-auto flex w-full items-start gap-2.5 rounded-xl border border-black/5 bg-white px-3.5 py-3 text-xs text-secondary shadow-lg shadow-black/10";
  const icon = document.createElement("span");
  icon.className = clsx("mt-px shrink-0", { ok: "text-emerald-600", warn: "text-warning", error: "text-red-600" }[tone]);
  icon.innerHTML = TOAST_ICON[tone];
  const text = document.createElement("span");
  text.className = "min-w-0 flex-1 break-words leading-relaxed";
  text.textContent = msg;
  const close = document.createElement("button");
  close.setAttribute("aria-label", "Dismiss");
  close.className = "shrink-0 rounded p-0.5 text-gray-400 hover:bg-black/5 hover:text-secondary";
  close.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';
  el.append(icon, text, close);
  const remove = () => { el.classList.add("toast-out"); setTimeout(() => el.remove(), 180); };
  close.addEventListener("click", remove);
  toastStack.appendChild(el);
  setTimeout(remove, tone === "ok" ? 3000 : 7000);
}

export const useToast = () => toast;

export function Loading({ text = "Loading…", variant = "list" }: { text?: string; variant?: "list" | "inline" }) {
  if (variant === "inline")
    return <div className="flex items-center justify-center gap-2 py-10 text-xs text-gray-400"><Loader2 className="h-4 w-4 animate-spin" /> {text}</div>;
  return (
    <div role="status" aria-label={text} className="space-y-3 py-2">
      <span className="sr-only">{text}</span>
      <div className="skeleton h-7 w-48 rounded-lg" />
      <div className="grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => <div key={i} className="skeleton h-20 rounded-xl2" />)}
      </div>
      <div className="space-y-2 rounded-xl2 border border-black/5 bg-white p-4">
        {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="skeleton h-8 rounded-md" style={{ opacity: 1 - i * 0.12 }} />)}
      </div>
    </div>
  );
}

export function ErrorBox({ error }: { error: unknown }) {
  return (
    <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-800">
      <XCircle className="mt-px h-4 w-4 shrink-0" />
      <span className="min-w-0 break-words">{(error as Error)?.message ?? "Something went wrong"}</span>
    </div>
  );
}

export function Checkbox({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className={clsx("group inline-flex cursor-pointer select-none items-center gap-2 text-xs text-secondary", disabled && "cursor-not-allowed opacity-50")}>
      <input type="checkbox" className="peer sr-only" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className={clsx(
        "grid h-4 w-4 shrink-0 place-items-center rounded border transition peer-focus-visible:ring-2 peer-focus-visible:ring-primary/30",
        checked ? "border-primary bg-primary text-white" : "border-black/25 bg-white group-hover:border-primary/60",
      )}>
        {checked && <Check className="h-3 w-3" strokeWidth={3} />}
      </span>
      {label}
    </label>
  );
}

// Text input with suggestions: pick an existing option or type a new value.
export function Combobox({ value, onChange, options, placeholder, id }: {
  value: { id: string | number | null; label: string };
  onChange: (v: { id: string | number | null; label: string }) => void;
  options: { id: string | number; label: string; hint?: string }[];
  placeholder?: string;
  id?: string;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const close = useCallback(() => setOpen(false), []);
  const { anchor, render } = usePopover<HTMLInputElement>(open, close);
  const shown = useMemo(() => {
    const t = value.label.trim().toLowerCase();
    return options.filter((o) => !t || value.id !== null || o.label.toLowerCase().includes(t) || o.hint?.toLowerCase().includes(t)).slice(0, 50);
  }, [options, value]);
  const choose = (o: { id: string | number; label: string }) => { onChange({ id: o.id, label: o.label }); setOpen(false); };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape" && open) { e.preventDefault(); e.stopPropagation(); setOpen(false); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive((a) => Math.min(shown.length - 1, a + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === "Enter" && open && shown[active]) { e.preventDefault(); choose(shown[active]); }
  };
  return (
    <div className="relative">
      <input
        ref={anchor}
        id={id}
        role="combobox"
        aria-expanded={open}
        autoComplete="off"
        value={value.label}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onKeyDown={onKey}
        onChange={(e) => { onChange({ id: null, label: e.target.value }); setOpen(true); setActive(0); }}
        className={clsx(inputCls, "pr-12")}
      />
      {value.id === null && value.label.trim()
        ? <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-primary-100 px-1.5 py-px text-[10px] font-medium text-primary-700">New</span>
        : <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />}
      {shown.length > 0 && render(
        <div role="listbox" className="overflow-y-auto p-1">
          {shown.map((o, i) => (
            <div key={o.id} role="option" aria-selected={value.id === o.id}
              onMouseEnter={() => setActive(i)} onMouseDown={(e) => e.preventDefault()} onClick={() => choose(o)}
              className={clsx("flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-secondary", i === active && "bg-primary-50", value.id === o.id && "font-medium text-primary-700")}>
              <span className="min-w-0 flex-1 truncate">{o.label}{o.hint && <span className="ml-2 font-normal text-gray-400">{o.hint}</span>}</span>
              {value.id === o.id && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
            </div>
          ))}
        </div>,
      )}
    </div>
  );
}

export function Menu({ label, items, variant = "outline", icon, disabled }: { label: string; items: { label: string; onClick: () => void; disabled?: boolean }[]; variant?: BtnVariant; icon?: ReactNode; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative" onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setOpen(false)}>
      <Button variant={variant} icon={icon} disabled={disabled} onClick={() => setOpen(!open)}>
        {label} <ChevronDown className="h-3.5 w-3.5" />
      </Button>
      {open && (
        <div className="pop-in absolute right-0 z-30 mt-1 min-w-[220px] rounded-xl border border-black/10 bg-white p-1 shadow-xl shadow-black/10" onKeyDown={(e) => e.key === "Escape" && setOpen(false)}>
          {items.map((it) => (
            <button key={it.label} disabled={it.disabled} onClick={() => { setOpen(false); it.onClick(); }} className="block w-full rounded-md px-2.5 py-2 text-left text-xs text-secondary hover:bg-primary-50 disabled:pointer-events-none disabled:opacity-40">
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// In-page confirmation dialog; resolves true when the user confirms.
export function ask(message: string, confirmLabel = "Confirm"): Promise<boolean> {
  return new Promise((resolve) => {
    const root = document.createElement("div");
    root.className = "fade-in fixed inset-0 z-[70] flex items-center justify-center bg-secondary/40 p-4 backdrop-blur-[2px]";
    root.setAttribute("role", "alertdialog");
    root.innerHTML = `
      <div class="pop-in w-full max-w-sm rounded-xl2 bg-white p-5 shadow-2xl shadow-black/20">
        <p class="text-sm leading-relaxed text-secondary"></p>
        <div class="mt-5 flex justify-end gap-2">
          <button data-v="0" class="rounded-lg border border-black/15 bg-white px-3.5 py-1.5 text-xs font-medium text-secondary hover:bg-black/5">Cancel</button>
          <button data-v="1" class="rounded-lg bg-danger px-3.5 py-1.5 text-xs font-medium text-white hover:opacity-90"></button>
        </div>
      </div>`;
    root.querySelector("p")!.textContent = message;
    root.querySelector('[data-v="1"]')!.textContent = confirmLabel;
    const done = (v: boolean) => { root.remove(); resolve(v); };
    root.addEventListener("mousedown", (e) => { if (e.target === root) done(false); });
    root.addEventListener("keydown", (e) => { if (e.key === "Escape") done(false); });
    root.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => done(b.dataset.v === "1")));
    document.body.appendChild(root);
    (root.querySelector('[data-v="1"]') as HTMLButtonElement).focus();
  });
}
