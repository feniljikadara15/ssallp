import clsx from "clsx";
import type { ReactNode } from "react";

export default function ListItem({ title, subtitle, right, tag, active, onClick }: { title: ReactNode; subtitle?: ReactNode; right?: ReactNode; tag?: ReactNode; active?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={clsx("flex w-full items-start justify-between gap-2 rounded-xl border px-3 py-2.5 text-left transition", active ? "border-primary bg-primary-50" : "border-black/10 bg-white hover:border-primary/40")}
    >
      <div className="min-w-0">
        <div className="truncate text-xs font-medium text-secondary">{title}</div>
        {subtitle && <div className="mt-0.5 truncate text-[11px] text-gray-500">{subtitle}</div>}
        {tag && <div className="mt-1">{tag}</div>}
      </div>
      {right && <div className="shrink-0 text-[11px] font-bold text-secondary">{right}</div>}
    </button>
  );
}
