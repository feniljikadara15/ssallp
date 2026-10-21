import clsx from "clsx";
import { X, Search, ChevronLeft, ChevronRight, ChevronDown, Loader2, ArrowLeft } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type InputHTMLAttributes } from "react";
import { Link } from "react-router-dom";
import { usePopover } from "./pickers";
export { Select, DateInput, DateRange } from "./pickers";

// Shared building blocks. Every screen composes these; styles live in index.css
// (.card, .btn, .input, .seg, .badge, .notice) so a value is defined once.

// ------------------------------------------------------------------ surfaces

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={clsx("card", className)}>{children}</div>;
}

/** A card with a header row: title (+ count/meta), optional description, actions on the right. */
export function Section({ title, description, meta, actions, children, className, bodyClassName }: {
  title: ReactNode; description?: ReactNode; meta?: ReactNode; icon?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; bodyClassName?: string;
}) {
  return (
    <div className={clsx("card flex flex-col", className)}>
      <div className="card-head">
        <div className="min-w-[12rem] flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <h2 className="card-title break-words">{title}</h2>
            {meta && <span className="count">{meta}</span>}
          </div>
          {description && <p className="meta mt-0.5">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      <div className={clsx("flex-1", bodyClassName ?? "card-body")}>{children}</div>
    </div>
  );
}

/** Title row: breadcrumb above, title + status and subtitle on the left, actions on the right.
 *  Action order: secondary actions first, at most one primary action last. */
export function PageHeader({ title, description, subtitle, breadcrumb, status, children }: {
  title: string; description?: ReactNode; subtitle?: ReactNode; breadcrumb?: { to: string; label: string }[]; status?: ReactNode; children?: ReactNode;
}) {
  useEffect(() => { document.title = `${title} · Sambhavnath OMS`; }, [title]);
  const sub = subtitle ?? description;
  return (
    <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
      <div className="min-w-0 flex-1 basis-72">
        {breadcrumb && breadcrumb.length > 0 && (
          <nav aria-label="Breadcrumb" className="no-print mb-1.5 flex flex-wrap items-center gap-1 text-[12px] text-faint">
            {breadcrumb.map((b, i) => (
              <span key={b.to} className="inline-flex items-center gap-1">
                {i > 0 && <span aria-hidden>/</span>}
                <Link to={b.to} className="inline-flex items-center gap-1 hover:text-ink hover:underline">{i === 0 && <ArrowLeft className="h-3 w-3" />}{b.label}</Link>
              </span>
            ))}
          </nav>
        )}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className="page-title break-words">{title}</h1>
          {status}
        </div>
        {sub && <p className="mt-1 text-[13px] text-faint">{sub}</p>}
      </div>
      {children && <div className="no-print flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

/** Tabs row and filter row live together under the header. */
export function Toolbar({ children }: { children: ReactNode }) {
  return <div className="no-print flex flex-wrap items-center gap-x-3 gap-y-2">{children}</div>;
}

/** One filter row pattern for every page: 36px controls, Clear appears only when something is set. */
export function FilterBar({ children, active, onClear, className }: { children: ReactNode; active?: boolean; onClear?: () => void; className?: string }) {
  return (
    <div className={clsx("no-print flex flex-wrap items-center gap-2", className)}>
      {children}
      {active && onClear && <button type="button" className="btn-ghost" onClick={onClear}>Clear filters</button>}
    </div>
  );
}

/** Numbers side by side in one card with hairline dividers. Cells on a short last row stretch to fill it. */
export function StatStrip({ items }: { items: { label: string; value: ReactNode; unit?: string; hint?: ReactNode; to?: string; tone?: "danger" | "success" | "warning" }[] }) {
  if (!items.length) return null;
  return (
    <div className="card flex flex-wrap overflow-hidden">
      {items.map((s) => {
        const body = (
          <>
            <div className="text-[12px] leading-snug text-faint">{s.label}</div>
            <div className={clsx("mt-1.5 break-words text-[clamp(1.125rem,1.2vw+0.6rem,1.375rem)] font-medium leading-tight tracking-tight tabular-nums",
              s.tone === "danger" ? "text-danger" : s.tone === "success" ? "text-success" : s.tone === "warning" ? "text-warning" : "text-ink")}>
              {s.value}{s.unit && <span className="ml-1 text-[13px] font-normal text-faint">{s.unit}</span>}
            </div>
            {s.hint && <div className="mt-1 text-[12px] leading-snug text-faint">{s.hint}</div>}
          </>
        );
        const cls = clsx("-ml-px -mt-px min-w-0 grow border-l border-t border-line px-4 py-3.5", items.length > 4 ? "basis-[10.5rem] sm:basis-[11rem]" : "basis-[10.5rem] sm:basis-[13rem]");
        return s.to
          ? <Link key={s.label} to={s.to} className={clsx(cls, "transition-colors hover:bg-surface-alt")}>{body}</Link>
          : <div key={s.label} className={cls}>{body}</div>;
      })}
    </div>
  );
}

/** A message that belongs to the page (not a toast): one look per tone, everywhere. */
export function Notice({ tone = "neutral", title, children, className, action }: { tone?: "success" | "warning" | "danger" | "info" | "neutral"; title?: string; children?: ReactNode; className?: string; action?: ReactNode }) {
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={clsx("notice", `notice-${tone}`, action && "flex flex-wrap items-center gap-3", className)}>
      <div className="min-w-0 flex-1">
        {title && <div className="font-semibold">{title}</div>}
        {children && <div className={title ? "mt-0.5" : ""}>{children}</div>}
      </div>
      {action}
    </div>
  );
}

/** One empty state. Says whether nothing exists yet or filters hide rows, and offers the next step. */
export function EmptyState({ title, text, hint, action, compact, className }: { title?: string; text?: string; hint?: ReactNode; action?: ReactNode; compact?: boolean; icon?: ReactNode; className?: string }) {
  return (
    <div className={clsx("flex flex-col items-center justify-center gap-1 px-4 text-center", compact ? "py-6" : "py-12", className)}>
      <div className="text-[13.5px] font-medium text-ink">{title ?? text}</div>
      {hint && <div className="max-w-md text-[13px] text-faint">{hint}</div>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function KV({ label, value, className }: { label: string; value: ReactNode; className?: string }) {
  return (
    <div className={clsx("min-w-0", className)}>
      <div className="text-[12px] text-faint">{label}</div>
      <div className="mt-0.5 break-words text-[13.5px] text-ink">{value === null || value === undefined || value === "" ? <span className="text-faint">-</span> : value}</div>
    </div>
  );
}

// ------------------------------------------------------------------ controls

type BtnVariant = "primary" | "secondary" | "outline" | "danger" | "dangerSolid" | "success" | "info" | "ghost";
const BTN: Record<BtnVariant, string> = {
  primary: "btn-primary", secondary: "btn", outline: "btn", info: "btn", danger: "btn-danger", dangerSolid: "btn-danger-solid", success: "btn-success", ghost: "btn-ghost",
};
export function Button({ variant = "secondary", size, className, icon, busy, children, ...p }: { variant?: BtnVariant; size?: "sm"; icon?: ReactNode; busy?: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" {...p} disabled={p.disabled || busy} className={clsx(BTN[variant], size === "sm" && "btn-sm", "[&>svg]:h-4 [&>svg]:w-4", className)}>
      {busy ? <Loader2 className="animate-spin" /> : icon}
      {children}
    </button>
  );
}

export function IconButton({ label, icon, onClick, danger, disabled, href }: { label: string; icon: ReactNode; onClick?: () => void; danger?: boolean; disabled?: boolean; href?: string }) {
  const cls = clsx("btn-icon [&>svg]:h-4 [&>svg]:w-4", danger && "btn-icon-danger");
  return href
    ? <a href={href} target="_blank" rel="noreferrer" className={cls} aria-label={label} title={label}>{icon}</a>
    : <button type="button" className={cls} aria-label={label} title={label} onClick={onClick} disabled={disabled}>{icon}</button>;
}

export type Tone = "success" | "warning" | "danger" | "info" | "neutral" | "brand";
// Older call sites name colours; they map onto the status tones.
const LEGACY_TONE: Record<string, Tone> = { gray: "neutral", orange: "warning", green: "success", blue: "info", red: "danger", yellow: "warning", purple: "info" };
const DOT: Record<Tone, string> = { success: "bg-success-fill", warning: "bg-warning-fill", danger: "bg-danger-fill", info: "bg-info-fill", neutral: "bg-line-hover", brand: "bg-brand-fill" };
export function Badge({ tone = "neutral", dot, title, children }: { tone?: Tone | keyof typeof LEGACY_TONE; dot?: boolean; title?: string; children: ReactNode }) {
  const t: Tone = (LEGACY_TONE[tone] ?? tone) as Tone;
  return <span title={title} className={clsx("badge", `badge-${t}`)}>{dot && <span className={clsx("dot", DOT[t])} />}{children}</span>;
}
/** Status shown as a coloured dot with the label in ink. */
export function StatusDot({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className="inline-flex items-center gap-1.5 whitespace-nowrap"><span className={clsx("dot", DOT[tone])} />{children}</span>;
}

/** Old name for the dashboard metric card; screens now use StatStrip. */
export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode; icon?: ReactNode; tone?: string }) {
  return <StatStrip items={[{ label, value, hint: sub }]} />;
}

export function Field({ label, children, className, hint, required }: { label: string; children: ReactNode; className?: string; hint?: ReactNode; required?: boolean }) {
  return (
    <label className={clsx("block min-w-0", className)}>
      <span className="label">{label}{required && <span className="text-danger"> *</span>}</span>
      {children}
      {hint && <span className="mt-1 block text-[12px] text-faint">{hint}</span>}
    </label>
  );
}

export const inputCls = "input";
export const Input = (p: InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={clsx("input", p.className)} />;
export const Textarea = (p: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...p} className={clsx("input", p.className)} />;

export function SearchInput({ value, onChange, placeholder, className, size }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string; size?: "sm" }) {
  return (
    <div className={clsx("relative min-w-0", className)}>
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder ?? "Search"} aria-label={placeholder ?? "Search"}
        className={clsx("input pl-8", size === "sm" && "input-sm", value && "pr-8")} />
      {value && (
        <button type="button" aria-label="Clear search" onClick={() => onChange("")} className="btn-icon btn-icon-sm absolute right-1 top-1/2 -translate-y-1/2"><X className="h-3.5 w-3.5" /></button>
      )}
    </div>
  );
}

export function Checkbox({ label, checked, onChange, disabled, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; hint?: ReactNode }) {
  return (
    <label className={clsx("inline-flex cursor-pointer select-none items-start gap-2 text-[13.5px] text-ink", disabled && "cursor-not-allowed opacity-50")}>
      <input type="checkbox" className="mt-0.5" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}{hint && <span className="block text-[12px] text-faint">{hint}</span>}</span>
    </label>
  );
}

/** Segmented tabs (buttons). Counts sit beside the label in the quiet colour. */
export function Tabs<T extends string>({ tabs, value, onChange, size }: { tabs: { value: T; label: string; count?: number }[]; value: T; onChange: (v: T) => void; size?: "sm" }) {
  return (
    <div role="tablist" className={clsx("seg no-print", size === "sm" && "seg-sm")}>
      {tabs.map((t) => (
        <button key={t.value} type="button" role="tab" aria-selected={value === t.value} data-active={value === t.value} onClick={() => onChange(t.value)}>
          {t.label}
          {t.count !== undefined && <span className={clsx("tabular text-[12px]", value === t.value ? "text-brand" : "text-faint")}>{t.count.toLocaleString("en-IN")}</span>}
        </button>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ dialogs

export function Modal({ open, onClose, title, children, footer, size = "md" }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; size?: "sm" | "md" | "lg" | "xl" }) {
  // The close callback is read through a ref so a parent re-render never re-runs the setup (which moved focus).
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const back = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeRef.current(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Focus the first real field, not the close button.
    setTimeout(() => panel.current?.querySelector<HTMLElement>("input:not([type=hidden]),textarea,[role=combobox],button[aria-haspopup]")?.focus(), 30);
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; back?.focus?.(); };
  }, [open]);
  if (!open) return null;
  return (
    <div className="dialog-backdrop fade-in fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-8" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={panel} role="dialog" aria-modal="true" aria-label={title}
        className={clsx("dialog-panel my-auto w-full", { sm: "max-w-md", md: "max-w-lg", lg: "max-w-3xl", xl: "max-w-5xl" }[size])}>
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <h2 className="dialog-title min-w-0 break-words">{title}</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="btn-icon -mr-1.5 shrink-0"><X className="h-4 w-4" /></button>
        </div>
        <div className="max-h-[75vh] overflow-y-auto p-5">{children}</div>
        {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

/** In-app confirmation; resolves true when confirmed. Red is reserved for destructive actions. */
export function ask(message: string, confirmLabel = "Confirm", opts: { body?: string; tone?: "danger" | "default" } = {}): Promise<boolean> {
  const tone = opts.tone ?? (/delete|remove|cancel|unlink/i.test(confirmLabel) ? "danger" : "default");
  return new Promise((resolve) => {
    const root = document.createElement("div");
    root.className = "dialog-backdrop fade-in fixed inset-0 z-[70] grid place-items-center p-4";
    root.innerHTML = `
      <div role="alertdialog" aria-modal="true" class="dialog-panel w-full max-w-md">
        <div class="px-5 py-4"><h2 class="dialog-title"></h2><div data-body class="mt-2 text-[13.5px] leading-relaxed text-muted"></div></div>
        <div class="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3">
          <button data-v="0" class="btn-ghost">Cancel</button>
          <button data-v="1" class="${tone === "danger" ? "btn-danger-solid" : "btn-primary"}"></button>
        </div>
      </div>`;
    root.querySelector("h2")!.textContent = message;
    const body = root.querySelector<HTMLElement>("[data-body]")!;
    if (opts.body) body.textContent = opts.body; else body.remove();
    root.querySelector('[data-v="1"]')!.textContent = confirmLabel;
    const done = (v: boolean) => { root.remove(); document.removeEventListener("keydown", key, true); resolve(v); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); done(false); } };
    document.addEventListener("keydown", key, true);
    root.addEventListener("mousedown", (e) => { if (e.target === root) done(false); });
    root.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => done(b.dataset.v === "1")));
    document.body.appendChild(root);
    (root.querySelector('[data-v="1"]') as HTMLButtonElement).focus();
  });
}

// ------------------------------------------------------------------ toasts

/** Toasts are the single destination for action results, in one polite live region.
 *  toast("Saved") / toast("Not saved", "error", "detail") */
let toastStack: HTMLDivElement | null = null;
export function toast(title: string, tone: "ok" | "warn" | "error" | "info" = "ok", detail?: string) {
  if (!toastStack || !document.body.contains(toastStack)) {
    toastStack = document.createElement("div");
    toastStack.setAttribute("role", "status");
    toastStack.setAttribute("aria-live", "polite");
    toastStack.className = "no-print pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2";
    document.body.appendChild(toastStack);
  }
  // A long server message becomes title + detail at the first sentence break.
  if (!detail && title.length > 90) {
    const i = title.search(/[.:]\s/);
    if (i > 10 && i < 90) { detail = title.slice(i + 1).trim(); title = title.slice(0, i + 1); }
  }
  const el = document.createElement("div");
  el.className = clsx("pop pointer-events-auto flex gap-3 rounded-xl border bg-surface px-4 py-3 text-ink",
    { ok: "border-success-line", warn: "border-warning-line", error: "border-danger-line", info: "border-line" }[tone]);
  const dot = document.createElement("span");
  dot.className = clsx("dot mt-[7px]", { ok: "bg-success-fill", warn: "bg-warning-fill", error: "bg-danger-fill", info: "bg-info-fill" }[tone]);
  const body = document.createElement("div");
  body.className = "min-w-0 flex-1";
  const t = document.createElement("div");
  t.className = "text-[13.5px] font-semibold break-words";
  t.textContent = title;
  body.append(t);
  if (detail) { const d = document.createElement("div"); d.className = "mt-0.5 text-[12px] text-muted break-words"; d.textContent = detail; body.append(d); }
  const close = document.createElement("button");
  close.setAttribute("aria-label", "Dismiss");
  close.className = "btn-icon btn-icon-sm -mr-1.5 -mt-1";
  close.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';
  close.addEventListener("click", () => el.remove());
  el.append(dot, body, close);
  while (toastStack.children.length >= 4) toastStack.firstChild?.remove();
  toastStack.appendChild(el);
  setTimeout(() => el.remove(), tone === "error" || tone === "warn" ? 8000 : 4000);
}
export const useToast = () => toast;

// ------------------------------------------------------------------ states

/** Skeleton that mirrors a page: header, stat strip and a table card. */
export function Loading({ text = "Loading", variant = "page" }: { text?: string; variant?: "page" | "inline" | "list" }) {
  if (variant === "inline")
    return <div className="flex items-center justify-center gap-2 py-10 text-[13px] text-faint"><Loader2 className="h-4 w-4 animate-spin" />{text}</div>;
  return (
    <div role="status" aria-label={text} className="space-y-5">
      <span className="sr-only">{text}</span>
      <div className="card flex overflow-hidden">{[0, 1, 2, 3].map((i) => <div key={i} className="flex-1 border-l border-line px-4 py-3.5 first:border-0"><div className="skeleton h-3 w-24 rounded" /><div className="skeleton mt-2.5 h-5 w-20 rounded" /></div>)}</div>
      <div className="card overflow-hidden">
        <div className="card-head"><div className="skeleton h-4 w-40 rounded" /></div>
        {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="flex h-10 items-center gap-4 border-b border-line px-4 last:border-0"><div className="skeleton h-3 w-1/4 rounded" /><div className="skeleton h-3 w-1/3 rounded" /><div className="skeleton ml-auto h-3 w-16 rounded" /></div>)}
      </div>
    </div>
  );
}

export function ErrorBox({ error }: { error: unknown }) {
  return <Notice tone="danger" title="Could not load this">{(error as Error)?.message ?? "Something went wrong."}</Notice>;
}

// ------------------------------------------------------------------ pickers built on the popover

/** Text input with suggestions: pick an existing option or type a new value. */
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
      <input ref={anchor} id={id} role="combobox" aria-expanded={open} autoComplete="off" value={value.label} placeholder={placeholder}
        onFocus={() => setOpen(true)} onClick={() => setOpen(true)} onKeyDown={onKey}
        onChange={(e) => { onChange({ id: null, label: e.target.value }); setOpen(true); setActive(0); }}
        className="input pr-14" />
      {value.id === null && value.label.trim()
        ? <span className="badge badge-brand pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 py-0 text-[11px]">New</span>
        : <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />}
      {shown.length > 0 && render(
        <ul role="listbox" className="overflow-y-auto py-1">
          {shown.map((o, i) => (
            <li key={o.id} role="option" aria-selected={value.id === o.id} onMouseEnter={() => setActive(i)} onMouseDown={(e) => e.preventDefault()} onClick={() => choose(o)}
              className={clsx("flex cursor-pointer items-center justify-between gap-2 px-3 py-1.5 text-[13.5px]", i === active ? "bg-brand-soft text-brand" : "text-ink", value.id === o.id && "font-semibold")}>
              <span className="min-w-0 break-words">{o.label}{o.hint && <span className="ml-2 font-normal text-faint">{o.hint}</span>}</span>
              {value.id === o.id && <span className="shrink-0">✓</span>}
            </li>
          ))}
        </ul>,
      )}
    </div>
  );
}

/** A button that opens a small menu of actions. */
export function Menu({ label, items, variant = "secondary", icon, disabled, size }: {
  label: string; items: { label: string; hint?: string; onClick: () => void; disabled?: boolean; danger?: boolean }[]; variant?: BtnVariant; icon?: ReactNode; disabled?: boolean; size?: "sm"; align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const { anchor, render } = usePopover<HTMLButtonElement>(open, close, 224);
  return (
    <>
      <button ref={anchor} type="button" disabled={disabled} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}
        className={clsx(BTN[variant], size === "sm" && "btn-sm", "[&>svg]:h-4 [&>svg]:w-4")}>
        {icon}{label}<ChevronDown className={clsx("!h-3.5 !w-3.5 transition-transform", open && "rotate-180")} />
      </button>
      {render(
        <div role="menu" className="py-1" onKeyDown={(e) => e.key === "Escape" && setOpen(false)}>
          {items.map((it) => (
            <button key={it.label} role="menuitem" type="button" disabled={it.disabled} onClick={() => { setOpen(false); it.onClick(); }}
              className={clsx("flex w-full flex-col items-start px-3 py-2 text-left hover:bg-hover disabled:pointer-events-none disabled:opacity-40", it.danger && "text-danger")}>
              <span className="text-[13.5px] font-medium">{it.label}</span>
              {it.hint && <span className="text-[12px] text-faint">{it.hint}</span>}
            </button>
          ))}
        </div>,
      )}
    </>
  );
}

// ------------------------------------------------------------------ simple client table (older screens)

export interface Column<T> { key: string; label: string; render?: (row: T, i: number) => ReactNode; align?: "right"; className?: string }

export function SimpleTable<T>({ rows, columns, rowKey, pageSize = 12, onRowClick, empty = "Nothing here yet" }: {
  rows: T[]; columns: Column<T>[]; rowKey: (r: T) => string | number; pageSize?: number; onRowClick?: (r: T) => void; selectedKey?: string | number | null; empty?: string;
}) {
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const cur = Math.min(page, pages - 1);
  const slice = useMemo(() => rows.slice(cur * pageSize, cur * pageSize + pageSize), [rows, cur, pageSize]);
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="tbl w-full text-[13px]">
          <thead className="bg-surface-alt">
            <tr className="border-b border-line">{columns.map((c) => <th key={c.key} className={clsx("c whitespace-nowrap px-3 py-2.5 text-[12px] font-medium text-faint first:pl-4", c.align === "right" ? "text-right" : "text-left")}>{c.label}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-line">
            {slice.map((r, i) => (
              <tr key={rowKey(r)} onClick={() => onRowClick?.(r)} className={clsx("transition-colors hover:bg-surface-alt", onRowClick && "cursor-pointer")}>
                {columns.map((c) => <td key={c.key} className={clsx("c h-10 whitespace-nowrap px-3 first:pl-4", c.align === "right" && "text-right", c.className)}>{c.render ? c.render(r, cur * pageSize + i) : String((r as Record<string, unknown>)[c.key] ?? "")}</td>)}
              </tr>
            ))}
            {!slice.length && <tr><td colSpan={columns.length}><EmptyState title={empty} compact /></td></tr>}
          </tbody>
        </table>
      </div>
      {rows.length > pageSize && (
        <div className="flex items-center justify-end gap-1 border-t border-line px-4 py-2 text-[12px] text-muted">
          <span className="mr-2">{cur * pageSize + 1} to {Math.min(rows.length, (cur + 1) * pageSize)} of {rows.length}</span>
          <button className="btn btn-sm w-8 px-0" disabled={cur === 0} onClick={() => setPage(cur - 1)} aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></button>
          <button className="btn btn-sm w-8 px-0" disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)} aria-label="Next page"><ChevronRight className="h-4 w-4" /></button>
        </div>
      )}
    </div>
  );
}
/** Kept for screens not yet moved to the full DataTable. */
export const DataTable = SimpleTable;
