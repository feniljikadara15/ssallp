import clsx from "clsx";
import { Calendar, Check, ChevronDown, ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

// Themed replacements for the browser's <select> and date picker. The menus
// render in a portal so they aren't clipped by modals or scrolling cards.

type ChangeEvent = { target: { value: string } };

export const triggerCls =
  "flex w-full min-w-0 items-center gap-2 rounded-lg border border-black/15 bg-white px-2.5 py-1.5 text-left text-xs shadow-[0_1px_0_rgba(0,0,0,0.02)] outline-none transition " +
  "hover:border-black/30 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400 disabled:hover:border-black/15";

export function usePopover<T extends HTMLElement = HTMLButtonElement>(open: boolean, close: () => void, minWidth = 0) {
  const anchor = useRef<T>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number; width: number; maxHeight: number; above: boolean } | null>(null);

  const place = useCallback(() => {
    const r = anchor.current?.getBoundingClientRect();
    if (!r) return;
    const below = window.innerHeight - r.bottom - 8, above = r.top - 8;
    const flip = below < 240 && above > below;
    const width = Math.max(r.width, minWidth);
    const left = Math.min(Math.max(8, r.left), window.innerWidth - width - 8);
    setPos({ left, top: flip ? r.top - 4 : r.bottom + 4, width, maxHeight: Math.min(320, flip ? above : below), above: flip });
  }, [minWidth]);

  useLayoutEffect(() => {
    if (!open) return;
    place();
    const onScroll = (e: Event) => { if (!panel.current?.contains(e.target as Node)) place(); };
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!panel.current?.contains(t) && !anchor.current?.contains(t)) close();
    };
    window.addEventListener("resize", place);
    window.addEventListener("scroll", onScroll, true);
    document.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", onScroll, true);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open, place, close]);

  const render = (children: ReactNode, className?: string) =>
    open && pos
      ? createPortal(
          <div
            ref={panel}
            style={{ left: pos.left, top: pos.top, width: pos.width, maxHeight: pos.maxHeight, transform: pos.above ? "translateY(-100%)" : undefined }}
            className={clsx("pop-in fixed z-[60] flex flex-col overflow-hidden rounded-xl border border-black/10 bg-white shadow-xl shadow-black/10", className)}
          >
            {children}
          </div>,
          document.body,
        )
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
  "aria-label"?: string;
}

export function Select({ options, value, onChange, placeholder, disabled, id, className, ...rest }: SelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const close = useCallback(() => { setOpen(false); setQuery(""); }, []);
  const { anchor, render } = usePopover(open, close, 200);
  const listRef = useRef<HTMLDivElement>(null);
  const searchable = options.length > 8;

  const all = useMemo(
    () => [...(placeholder !== undefined ? [{ value: "", label: placeholder, empty: true }] : []), ...options.map((o) => ({ ...o, empty: false }))],
    [options, placeholder],
  );
  const shown = useMemo(() => {
    const t = query.trim().toLowerCase();
    return t ? all.filter((o) => !o.empty && o.label.toLowerCase().includes(t)) : all;
  }, [all, query]);
  const current = options.find((o) => String(o.value) === String(value ?? ""));

  useEffect(() => {
    if (!open) return;
    const i = shown.findIndex((o) => String(o.value) === String(value ?? ""));
    setActive(i >= 0 ? i : 0);
  }, [open, query]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const choose = (v: string | number) => {
    close();
    anchor.current?.focus();
    if (String(v) !== String(value ?? "")) onChange?.({ target: { value: String(v) } });
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape" && open) { e.preventDefault(); e.stopPropagation(); close(); anchor.current?.focus(); return; }
    if (e.key === "Tab") { close(); return; }
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) { e.preventDefault(); setOpen(true); }
      return;
    }
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(shown.length - 1, a + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === "Home") { e.preventDefault(); setActive(0); }
    else if (e.key === "End") { e.preventDefault(); setActive(shown.length - 1); }
    else if (e.key === "Enter") { e.preventDefault(); if (shown[active]) choose(shown[active].value); }
    else if (!searchable && e.key.length === 1) {
      const i = shown.findIndex((o) => !o.empty && o.label.toLowerCase().startsWith(e.key.toLowerCase()));
      if (i >= 0) setActive(i);
    }
  };

  return (
    <>
      <button
        ref={anchor}
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={rest["aria-label"]}
        onClick={() => (open ? close() : setOpen(true))}
        onKeyDown={onKey}
        className={clsx(triggerCls, open && "border-primary ring-2 ring-primary/20", className)}
      >
        <span className={clsx("min-w-0 flex-1 truncate", !current && "text-gray-400")}>{current?.label ?? placeholder ?? "Select"}</span>
        <ChevronDown className={clsx("h-3.5 w-3.5 shrink-0 text-gray-400 transition-transform", open && "rotate-180 text-primary")} />
      </button>
      {render(
        <>
          {searchable && (
            <div className="relative border-b border-black/5 p-1.5">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKey}
                placeholder="Search…"
                className="w-full rounded-md bg-gray-50 py-1.5 pl-7 pr-2 text-xs outline-none placeholder:text-gray-400 focus:bg-white focus:ring-1 focus:ring-primary/30"
              />
            </div>
          )}
          <div ref={listRef} role="listbox" className="overflow-y-auto p-1">
            {shown.map((o, i) => {
              const selected = String(o.value) === String(value ?? "");
              return (
                <div
                  key={`${o.value}-${i}`}
                  data-i={i}
                  role="option"
                  aria-selected={selected}
                  onMouseEnter={() => setActive(i)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => choose(o.value)}
                  className={clsx(
                    "flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-xs",
                    i === active && "bg-primary-50",
                    selected ? "font-medium text-primary-700" : o.empty ? "text-gray-400" : "text-secondary",
                  )}
                >
                  <span className="min-w-0 flex-1 truncate">{o.label}</span>
                  {selected && !o.empty && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
                </div>
              );
            })}
            {!shown.length && <div className="px-2.5 py-3 text-center text-xs text-gray-400">No matches</div>}
          </div>
        </>,
      )}
    </>
  );
}

// ------------------------------------------------------------------ DatePicker

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
const todayIso = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

export interface DateInputProps {
  value?: string;
  onChange?: (e: ChangeEvent) => void;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
  clearable?: boolean;
  "aria-label"?: string;
}

// Value is "YYYY-MM-DD" like <input type="date">; shown as DD-MM-YYYY.
export function DateInput({ value = "", onChange, placeholder = "DD-MM-YYYY", disabled, id, className, clearable = true, ...rest }: DateInputProps) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const { anchor, render } = usePopover(open, close, 272);
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

  const emit = (v: string) => { onChange?.({ target: { value: v } }); };
  const pick = (v: string) => { emit(v); close(); anchor.current?.focus(); };

  const first = new Date(Date.UTC(view.y, view.m, 1));
  const lead = (first.getUTCDay() + 6) % 7; // weeks start on Monday
  const days = new Date(Date.UTC(view.y, view.m + 1, 0)).getUTCDate();
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const shift = (n: number) => setView((v) => { const d = new Date(Date.UTC(v.y, v.m + n, 1)); return { y: d.getUTCFullYear(), m: d.getUTCMonth() }; });
  const moveFocus = (n: number) => {
    const d = new Date(focus + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + n);
    const f = d.toISOString().slice(0, 10);
    setFocus(f);
    setView({ y: d.getUTCFullYear(), m: d.getUTCMonth() });
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape" && open) { e.preventDefault(); e.stopPropagation(); close(); return; }
    if (e.key === "Tab") { close(); return; }
    if (!open) { if (["ArrowDown", "Enter", " "].includes(e.key)) { e.preventDefault(); setOpen(true); } return; }
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    if (step) { e.preventDefault(); moveFocus(step); }
    else if (e.key === "Enter") { e.preventDefault(); pick(focus); }
  };
  const t = todayIso();

  return (
    <>
      <div className={clsx("relative min-w-0", className)}>
        <button
          ref={anchor}
          id={id}
          type="button"
          disabled={disabled}
          aria-label={rest["aria-label"]}
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          onKeyDown={onKey}
          className={clsx(triggerCls, open && "border-primary ring-2 ring-primary/20", clearable && sel && "pr-7")}
        >
          <Calendar className={clsx("h-3.5 w-3.5 shrink-0", open ? "text-primary" : "text-gray-400")} />
          <span className={clsx("min-w-0 flex-1 truncate tabular-nums", !sel && "text-gray-400")}>{sel ? sel.split("-").reverse().join("-") : placeholder}</span>
        </button>
        {clearable && sel && !disabled && (
          <button type="button" aria-label="Clear date" onClick={() => emit("")} className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-gray-400 hover:bg-black/5 hover:text-secondary">
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
      {render(
        <div className="p-3" role="dialog" aria-label="Choose date">
          <div className="mb-2 flex items-center justify-between">
            <button type="button" aria-label="Previous month" onClick={() => shift(-1)} className="rounded-md p-1 text-gray-500 hover:bg-black/5 hover:text-secondary"><ChevronLeft className="h-4 w-4" /></button>
            <div className="text-xs font-medium text-secondary">{MONTHS[view.m]} {view.y}</div>
            <button type="button" aria-label="Next month" onClick={() => shift(1)} className="rounded-md p-1 text-gray-500 hover:bg-black/5 hover:text-secondary"><ChevronRight className="h-4 w-4" /></button>
          </div>
          <div className="grid grid-cols-7 gap-0.5 text-center">
            {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => <div key={d} className="py-1 text-[10px] font-medium uppercase text-gray-400">{d}</div>)}
            {cells.map((d, i) => {
              if (!d) return <div key={i} />;
              const v = iso(view.y, view.m, d);
              return (
                <button
                  type="button"
                  key={i}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(v)}
                  className={clsx(
                    "h-8 rounded-md text-xs tabular-nums transition",
                    v === sel ? "bg-primary font-medium text-white" : v === focus ? "bg-primary-50 text-secondary" : "text-secondary hover:bg-primary-50",
                    v === t && v !== sel && "font-semibold text-primary ring-1 ring-inset ring-primary/40",
                  )}
                >
                  {d}
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex justify-between border-t border-black/5 pt-2">
            <button type="button" onClick={() => pick(t)} className="rounded-md px-2 py-1 text-xs font-medium text-primary hover:bg-primary-50">Today</button>
            {clearable && <button type="button" onClick={() => pick("")} className="rounded-md px-2 py-1 text-xs text-gray-500 hover:bg-black/5">Clear</button>}
          </div>
        </div>,
      )}
    </>
  );
}
