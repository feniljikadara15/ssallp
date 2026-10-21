import clsx from "clsx";
import type { ReactNode } from "react";
import { num } from "../format";

// Small dependency-free charts: HTML columns rather than a stretched SVG, so
// labels keep their proportions at every width. Bars are navy; the
// current period can be marked.

export function ChartCard({ title, subtitle, actions, children, className }: { title: string; subtitle?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={clsx("card flex w-full flex-col p-4", className)}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0"><div className="card-title">{title}</div>{subtitle && <div className="meta">{subtitle}</div>}</div>
        {actions}
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}

const compact = (n: number, money: boolean) => {
  const a = Math.abs(n), p = money ? "₹" : "";
  if (a >= 1e7) return `${p}${(n / 1e7).toFixed(a >= 1e8 ? 0 : 1)}Cr`;
  if (a >= 1e5) return `${p}${(n / 1e5).toFixed(a >= 1e6 ? 0 : 1)}L`;
  if (a >= 1e3) return `${p}${(n / 1e3).toFixed(a >= 1e4 ? 0 : 1)}K`;
  return `${p}${num(Math.round(n))}`;
};
const full = (n: number, money: boolean) => (money ? `₹${num(n)}` : num(n));

export function Bars({ data, height = 190, money, highlightLast }: { data: { label: string; value: number; title?: string }[]; height?: number; money?: boolean; highlightLast?: boolean }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  if (!data.some((d) => d.value)) return <div className="grid place-items-center text-[13px] text-faint" style={{ height }}>Nothing in this period</div>;
  return (
    <div className="flex items-end gap-1.5" style={{ height }} role="img" aria-label={data.map((d) => `${d.title ?? d.label} ${full(d.value, !!money)}`).join(", ")}>
      {data.map((d, i) => (
        <div key={i} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1" title={`${d.title ?? d.label}: ${full(d.value, !!money)}`}>
          <span className="hidden text-[11px] tabular-nums text-muted sm:inline">{d.value ? compact(d.value, !!money) : ""}</span>
          <div className="w-full max-w-10 rounded-t-[3px]" style={{ height: `${Math.max(d.value ? 2 : 0, (d.value / max) * (height - 40))}px`, background: highlightLast && i === data.length - 1 ? "#f7a77c" : "#3a4260", opacity: 1 }} />
          <span className="w-full truncate text-center text-[11px] text-faint">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

export function HBars({ data, money, max: limit = 8, empty = "Nothing in this period" }: { data: { label: string; value: number; hint?: string }[]; money?: boolean; max?: number; empty?: string }) {
  const rows = data.slice(0, limit);
  const max = Math.max(1, ...rows.map((d) => d.value));
  if (!rows.length) return <div className="grid h-40 place-items-center text-[13px] text-faint">{empty}</div>;
  return (
    <div className="space-y-2.5">
      {rows.map((d) => (
        <div key={d.label} className="text-[12px]">
          {/* Label and value on one line, bar beneath: stays readable in a narrow card. */}
          <div className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 break-words text-muted">{d.label}{d.hint && <span className="text-faint"> · {d.hint}</span>}</span>
            <span className="shrink-0 font-medium tabular-nums text-ink">{full(d.value, !!money)}</span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-track"><div className="h-1.5 rounded-full bg-navy-light" style={{ width: `${(d.value / max) * 100}%`, opacity: 0.85 }} /></div>
        </div>
      ))}
    </div>
  );
}

/** One bar split into parts with a legend (e.g. invoice vs cash). */
export function Split({ parts, money }: { parts: { label: string; value: number; color: string }[]; money?: boolean }) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  if (!total) return <div className="grid h-24 place-items-center text-[13px] text-faint">Nothing in this period</div>;
  return (
    <div>
      <div className="flex h-3 overflow-hidden rounded-full bg-track">{parts.map((p) => <div key={p.label} style={{ width: `${(p.value / total) * 100}%`, background: p.color }} title={`${p.label}: ${full(p.value, !!money)}`} />)}</div>
      <div className="mt-3 grid gap-1.5">
        {parts.map((p) => (
          <div key={p.label} className="flex items-center gap-2 text-[12px]">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: p.color }} /><span className="text-muted">{p.label}</span>
            <span className="ml-auto font-medium tabular-nums text-ink">{full(p.value, !!money)}</span>
            <span className="w-10 text-right tabular-nums text-faint">{Math.round((p.value / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
