import clsx from "clsx";
import type { ReactNode } from "react";

// A row in the master list of a master-detail page.
export default function ListItem({ title, subtitle, right, rightSub, tag, active, onClick }: {
  title: ReactNode; subtitle?: ReactNode; right?: ReactNode; rightSub?: ReactNode; tag?: ReactNode; active?: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-current={active || undefined}
      className={clsx(
        "group relative flex w-full items-start justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition",
        active ? "bg-primary-50/70 ring-1 ring-inset ring-primary/25" : "hover:bg-gray-50",
      )}
    >
      {active && <span className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-primary" />}
      <div className="min-w-0 flex-1">
        <div className={clsx("truncate text-[13px] font-medium", active ? "text-primary-700" : "text-secondary")}>{title}</div>
        {subtitle && <div className="mt-0.5 truncate text-2xs text-gray-500">{subtitle}</div>}
        {tag && <div className="mt-1.5 flex flex-wrap gap-1">{tag}</div>}
      </div>
      {(right || rightSub) && (
        <div className="shrink-0 text-right">
          {right && <div className="tabular text-2xs text-gray-500">{right}</div>}
          {rightSub && <div className="tabular mt-0.5 text-xs font-semibold text-secondary">{rightSub}</div>}
        </div>
      )}
    </button>
  );
}

// On phones the detail panel sits below the list; bring it into view after a pick.
export function revealDetail() {
  if (window.innerWidth >= 1024) return;
  setTimeout(() => document.getElementById("detail-panel")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
}
