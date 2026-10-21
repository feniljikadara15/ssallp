import clsx from "clsx";
import { Calendar, ChevronDown, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

// Themed replacements for the browser's <select> and date picker. Menus render
// in a portal positioned against the viewport, so a dialog or a card with
// overflow hidden can't clip them; they flip above when there's no room below.

type ChangeEvent = { target: { value: string } };

const trigger = (size?: "sm") => clsx(
  "flex w-full min-w-0 items-center justify-between gap-2 rounded-lg border bg-surface px-3 text-left outline-none transition-colors",
  "disabled:cursor-not-allowed disabled:bg-surface-alt disabled:text-faint",
  size === "sm" ? "h-8 text-[13px]" : "h-9 text-[13.5px]",
);
const ring = (open: boolean) => (open ? "border-ink shadow-[0_0_0_1px_theme(colors.ink)]" : "border-line-strong hover:border-line-hover");

export function usePopover<T extends HTMLElement = HTMLButtonElement>(open: boolean, close: () => void, minWidth = 0, panelH = 320) {
  const anchor = useRef<T>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<React.CSSProperties | null>(null);

  const place = useCallback(() => {
    const r = anchor.current?.getBoundingClientRect();
    if (!r) return;
    const width = Math.max(r.width, minWidth, 192);
    const below = window.innerHeight - r.bottom - 12, above = r.top - 12;
    const up = below < Math.min(panelH, 220) && above > below;
    const left = Math.min(Math.max(8, r.left), window.innerWidth - width - 8);
    const maxHeight = Math.max(120, Math.min(panelH, up ? above : below));
    setPos({ position: "fixed", left, width, maxHeight, ...(up ? { bottom: window.innerHeight - r.top + 4 } : { top: r.bottom + 4 }) });
  }, [minWidth, panelH]);

  useLayoutEffect(() => {
    if (!open) return;
    place();
    const onScroll = (e: Event) => { if (!panel.current?.contains(e.target as Node)) place(); };
    // Outside-click must test the portalled panel too, or the menu closes the moment you touch it.
    const onDown = (e: MouseEvent) => { const t = e.target as Node; if (!panel.current?.contains(t) && !anchor.current?.contains(t)) close(); };
    window.addEventListener("resize", place);
    window.addEventListener("scroll", onScroll, true);
    document.addEventListener("mousedown", onDown);
    return () => { window.removeEventListener("resize", place); window.removeEventListener("scroll", onScroll, true); document.removeEventListener("mousedown", onDown); };
  }, [open, place, close]);

  const render = (children: ReactNode, className?: string) =>
    open && pos
      ? createPortal(<div ref={panel} style={pos} className={clsx("pop z-[120] flex flex-col overflow-hidden", className)}>{children}</div>, document.body)
      : null;
  return { anchor, panel, render };
}

// ------------------------------------------------------------------ Select

export interface SelectProps {
  options: { value: string | number; label: string }[];
  value?: string | number | null;
  onChange?: (e: ChangeEvent) => void;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
  size?: "sm";
  /** Required selects offer no "Clear" row. */
  required?: boolean;
  "aria-label"?: string;
}

export function Select({ options, value, onChange, placeholder = "Select", disabled, id, className, size, required, ...rest }: SelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const close = useCallback(() => { setOpen(false); setQuery(""); }, []);
  const { anchor, render } = usePopover(open, close, 200);
  const listRef = useRef<HTMLUListElement>(null);
  const searchable = options.length > 8;
  const v = String(value ?? "");
  const current = options.find((o) => String(o.value) === v);

  const shown = useMemo(() => {
    const t = query.trim().toLowerCase();
    return t ? options.filter((o) => o.label.toLowerCase().includes(t)) : options;
  }, [options, query]);
  const clearRow = !required && !!current && !query;

  useEffect(() => {
    if (!open) return;
    const i = shown.findIndex((o) => String(o.value) === v);
    setActive(Math.max(0, i));
  }, [open, query]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { listRef.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" }); }, [active, open]);

  const choose = (val: string) => {
    close();
    anchor.current?.focus();
    if (val !== v) onChange?.({ target: { value: val } });
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape" && open) { e.preventDefault(); e.stopPropagation(); close(); anchor.current?.focus(); return; }
    if (e.key === "Tab") { close(); return; }
    if (!open) { if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) { e.preventDefault(); setOpen(true); } return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(shown.length - 1, a + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); if (shown[active]) choose(String(shown[active].value)); }
    else if (!searchable && e.key.length === 1) {
      const i = shown.findIndex((o) => o.label.toLowerCase().startsWith(e.key.toLowerCase()));
      if (i >= 0) setActive(i);
    }
  };

  return (
    <div className={clsx("relative min-w-0", className)}>
      <button ref={anchor} id={id} type="button" disabled={disabled} aria-haspopup="listbox" aria-expanded={open} aria-label={rest["aria-label"] ?? placeholder}
        onClick={() => (open ? close() : setOpen(true))} onKeyDown={onKey} className={clsx(trigger(size), ring(open))}>
        <span title={current?.label} className={clsx("min-w-0 flex-1 truncate", current ? "text-ink" : "text-faint")}>{current?.label ?? placeholder}</span>
        <ChevronDown className={clsx("h-4 w-4 shrink-0 text-faint transition-transform", open && "rotate-180")} />
      </button>
      {render(
        <>
          {searchable && (
            <div className="shrink-0 border-b border-line p-1.5">
              <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={onKey} placeholder="Search" className="input input-sm" />
            </div>
          )}
          <ul ref={listRef} role="listbox" className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-1">
            {clearRow && <li><button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => choose("")} className="w-full px-3 py-1.5 text-left text-[13px] text-faint hover:bg-surface-alt">Clear</button></li>}
            {shown.map((o, i) => {
              const selected = String(o.value) === v;
              return (
                <li key={`${o.value}`} data-i={i} role="option" aria-selected={selected} onMouseEnter={() => setActive(i)} onMouseDown={(e) => e.preventDefault()} onClick={() => choose(String(o.value))}
                  className={clsx("flex cursor-pointer items-center justify-between gap-2 px-3 py-1.5 text-[13.5px]", i === active ? "bg-hover text-ink" : "text-ink", selected && "font-semibold")}>
                  <span className="min-w-0 break-words">{o.label}</span>{selected && <span className="shrink-0">✓</span>}
                </li>
              );
            })}
            {!shown.length && <li className="px-3 py-3 text-center text-[13px] text-faint">No matches</li>}
          </ul>
        </>,
      )}
    </div>
  );
}

// ------------------------------------------------------------------ DateInput

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
const todayIso = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
const show = (s: string) => `${s.slice(8, 10)} ${MONTHS[+s.slice(5, 7) - 1]} ${s.slice(0, 4)}`;

export interface DateInputProps {
  value?: string;
  onChange?: (e: ChangeEvent) => void;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
  clearable?: boolean;
  size?: "sm";
  /** Extra classes on the trigger (used by DateRange to join two inputs). */
  triggerClassName?: string;
  "aria-label"?: string;
}

/** Value is "YYYY-MM-DD" like <input type="date">; shown as "09 Oct 2026". */
export function DateInput({ value = "", onChange, placeholder = "Select date", disabled, id, className, clearable = true, size, triggerClassName, ...rest }: DateInputProps) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const { anchor, render } = usePopover(open, close, 272, 340);
  const sel = /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
  const base = sel || todayIso();
  const [view, setView] = useState({ y: +base.slice(0, 4), m: +base.slice(5, 7) - 1 });
  const [focus, setFocus] = useState(base);

  useEffect(() => {
    if (!open) return;
    const b = sel || todayIso();
    setView({ y: +b.slice(0, 4), m: +b.slice(5, 7) - 1 });
    setFocus(b);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const emit = (v: string) => onChange?.({ target: { value: v } });
  const pick = (v: string) => { emit(v); close(); anchor.current?.focus(); };

  const first = new Date(Date.UTC(view.y, view.m, 1));
  const start = new Date(first); start.setUTCDate(1 - ((first.getUTCDay() + 6) % 7)); // Monday first
  const cells = Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setUTCDate(start.getUTCDate() + i); return d; });
  const shift = (n: number) => setView((v) => { const d = new Date(Date.UTC(v.y, v.m + n, 1)); return { y: d.getUTCFullYear(), m: d.getUTCMonth() }; });
  const moveFocus = (n: number) => {
    const d = new Date(focus + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n);
    setFocus(d.toISOString().slice(0, 10)); setView({ y: d.getUTCFullYear(), m: d.getUTCMonth() });
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape" && open) { e.preventDefault(); e.stopPropagation(); close(); return; }
    if (e.key === "Tab") { close(); return; }
    if (!open) { if (["ArrowDown", "Enter", " "].includes(e.key)) { e.preventDefault(); setOpen(true); } return; }
    const step = ({ ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 } as Record<string, number>)[e.key];
    if (step) { e.preventDefault(); moveFocus(step); } else if (e.key === "Enter") { e.preventDefault(); pick(focus); }
  };
  const t = todayIso();

  return (
    <div className={clsx("relative min-w-0", className)}>
      <button ref={anchor} id={id} type="button" disabled={disabled} aria-label={rest["aria-label"] ?? placeholder} aria-haspopup="dialog" aria-expanded={open}
        onClick={() => setOpen(!open)} onKeyDown={onKey} className={clsx(trigger(size), ring(open), clearable && sel && "pr-8", triggerClassName)}>
        <span className={clsx("min-w-0 flex-1 truncate whitespace-nowrap", sel ? "text-ink" : "text-faint")}>{sel ? show(sel) : placeholder}</span>
        {!(clearable && sel) && <Calendar className="h-4 w-4 shrink-0 text-faint" />}
      </button>
      {clearable && sel && !disabled && (
        <button type="button" aria-label="Clear date" onClick={() => emit("")} className="btn-icon btn-icon-sm absolute right-1 top-1/2 -translate-y-1/2"><X className="h-3.5 w-3.5" /></button>
      )}
      {render(
        <div className="overflow-auto p-3" role="dialog" aria-label="Choose date">
          <div className="mb-2 flex items-center justify-between">
            <button type="button" aria-label="Previous month" onClick={() => shift(-1)} className="btn-icon btn-icon-sm"><ChevronLeft className="h-4 w-4" /></button>
            <div className="text-[13.5px] font-semibold text-ink">{MONTHS[view.m]} {view.y}</div>
            <button type="button" aria-label="Next month" onClick={() => shift(1)} className="btn-icon btn-icon-sm"><ChevronRight className="h-4 w-4" /></button>
          </div>
          <div className="grid grid-cols-7 text-center text-[11px] font-medium text-faint">{["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => <div key={d} className="py-1">{d}</div>)}</div>
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((d) => {
              const s = iso(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
              const inMonth = d.getUTCMonth() === view.m, isSel = s === sel, isToday = s === t, isFocus = s === focus;
              return (
                <button type="button" key={s} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(s)}
                  className={clsx("h-8 rounded-lg text-[13px] tabular-nums",
                    isSel ? "bg-navy font-semibold text-white" : isToday ? "font-semibold text-ink ring-1 ring-inset ring-line-hover" : inMonth ? "text-ink hover:bg-hover" : "text-line-hover hover:bg-surface-alt",
                    isFocus && !isSel && "bg-hover")}>
                  {d.getUTCDate()}
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex justify-between border-t border-line pt-2">
            <button type="button" onClick={() => pick(t)} className="text-[12px] font-medium text-ink hover:underline">Today</button>
            {clearable && <button type="button" onClick={() => pick("")} className="text-[12px] text-faint hover:underline">Clear</button>}
          </div>
        </div>,
      )}
    </div>
  );
}

/** Two joined date inputs that never wrap apart. The placeholder names the field. */
export function DateRange({ label, from, to, onFrom, onTo, size, className }: {
  label: string; from: string; to: string; onFrom: (v: string) => void; onTo: (v: string) => void; size?: "sm"; className?: string;
}) {
  return (
    <div className={clsx("flex min-w-0 items-center", className)} role="group" aria-label={`${label} range`}>
      <DateInput size={size} value={from} onChange={(e) => onFrom(e.target.value)} placeholder={`${label} from`} aria-label={`${label} from`}
        className="min-w-0 flex-1 sm:w-[11.5rem] sm:flex-none" triggerClassName="rounded-r-none" />
      <DateInput size={size} value={to} onChange={(e) => onTo(e.target.value)} placeholder="to" aria-label={`${label} to`}
        className="-ml-px min-w-0 flex-1 sm:w-[9.5rem] sm:flex-none" triggerClassName="rounded-l-none" />
    </div>
  );
}
