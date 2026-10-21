import clsx from "clsx";
import { ClipboardCheck, CornerDownLeft, MessagesSquare, Search, Users, type LucideIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGet } from "../api";
import { fmtDate } from "../format";
import { NAV } from "./nav";

interface Hit { key: string; group: string; icon: LucideIcon; title: string; meta?: string; to: string }

const ORDER_STATUS: Record<string, string> = { "1": "Ongoing", "2": "In transit", "3": "Delivered", "5": "Deleted" };
const ENQ_STATUS: Record<string, string> = { "0": "Ongoing", "1": "Converted", "5": "Deleted" };

// Ctrl/⌘ K: jump to any page, order, enquiry or customer.
export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const orders = useGet<any[]>(open ? "orders" : null);
  const enquiries = useGet<any[]>(open ? "enquiries" : null);
  const customers = useGet<any[]>(open ? "customers" : null);

  useEffect(() => { if (open) { setQ(""); setActive(0); } }, [open]);

  const hits = useMemo<Hit[]>(() => {
    const t = q.trim().toLowerCase();
    const digits = t.replace(/^(od|en|ls|#)[\s-]*/i, "");
    const has = (...v: unknown[]) => v.some((x) => String(x ?? "").toLowerCase().includes(t));
    const pages: Hit[] = NAV.flatMap((g) => g.items).filter((i) => !t || i.label.toLowerCase().includes(t))
      .map((i) => ({ key: `p${i.to}`, group: "Pages", icon: i.icon, title: i.label, to: i.to }));
    if (!t) return pages;
    const ord: Hit[] = (orders.data ?? [])
      .filter((o) => has(o.customer_name, o.order_number, o.loading_slip_file_name) || String(o.order_id) === digits)
      .slice(0, 6)
      .map((o) => ({ key: `o${o.order_id}`, group: "Orders", icon: ClipboardCheck, title: `${o.customer_name ?? "Order"} · #${o.order_id}`, meta: [ORDER_STATUS[o.order_status], fmtDate(o.order_date)].filter(Boolean).join(" · "), to: `/orders/${o.order_id}` }));
    const enq: Hit[] = (enquiries.data ?? [])
      .filter((e) => has(e.customer_name) || String(e.enquiry_id) === digits)
      .slice(0, 5)
      .map((e) => ({ key: `e${e.enquiry_id}`, group: "Enquiries", icon: MessagesSquare, title: `${e.customer_name ?? "Enquiry"} · EN-${e.enquiry_id}`, meta: [ENQ_STATUS[e.enquiry_status], fmtDate(e.enquiry_date)].filter(Boolean).join(" · "), to: `/enquiries/${e.enquiry_id}` }));
    const cus: Hit[] = (customers.data ?? [])
      .filter((c) => has(c.name, c.phone, c.gstin))
      .slice(0, 5)
      .map((c) => ({ key: `c${c.customer_id}`, group: "Customers", icon: Users, title: c.name, meta: [c.phone, c.gstin].filter(Boolean).join(" · "), to: `/customers/${c.customer_id}` }));
    return [...ord, ...enq, ...cus, ...pages];
  }, [q, orders.data, enquiries.data, customers.data]);

  useEffect(() => { setActive(0); }, [q]);
  useEffect(() => { listRef.current?.querySelector(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" }); }, [active]);

  if (!open) return null;
  const go = (h: Hit) => { onClose(); navigate(h.to); };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { e.preventDefault(); onClose(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(hits.length - 1, a + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === "Enter" && hits[active]) { e.preventDefault(); go(hits[active]); }
  };
  const loading = q.trim() && (orders.isLoading || enquiries.isLoading || customers.isLoading);

  return (
    <div className="dialog-backdrop fade-in fixed inset-0 z-[65] flex items-start justify-center p-4 pt-[12vh]" onMouseDown={onClose}>
      <div role="dialog" aria-label="Search" className="dialog-panel w-full max-w-xl overflow-hidden" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search className="h-4 w-4 shrink-0 text-faint" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey}
            placeholder="Search orders, enquiries, customers or pages" className="h-12 w-full bg-transparent text-[14px] text-ink outline-none placeholder:text-faint" />
          <kbd className="hidden shrink-0 rounded border border-line bg-surface-alt px-1.5 py-0.5 text-[11px] text-faint sm:block">Esc</kbd>
        </div>
        <div ref={listRef} className="max-h-[52vh] overflow-y-auto py-1">
          {hits.map((h, i) => (
            <div key={h.key}>
              {(i === 0 || hits[i - 1].group !== h.group) && <div className="px-4 pb-1 pt-2.5 text-[11px] font-medium uppercase tracking-wider text-faint">{h.group}</div>}
              <button data-i={i} onMouseEnter={() => setActive(i)} onClick={() => go(h)}
                className={clsx("flex w-full items-center gap-3 px-4 py-2 text-left", i === active ? "bg-hover" : "hover:bg-surface-alt")}>
                <h.icon className={clsx("h-4 w-4 shrink-0", i === active ? "text-ink" : "text-faint")} strokeWidth={1.75} />
                <span className="min-w-0 flex-1">
                  <span className={clsx("block truncate text-[13.5px] font-medium", "text-ink")}>{h.title}</span>
                  {h.meta && <span className="block truncate text-[12px] text-faint">{h.meta}</span>}
                </span>
                {i === active && <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-faint" />}
              </button>
            </div>
          ))}
          {!hits.length && <div className="px-4 py-10 text-center text-[13px] text-faint">{loading ? "Searching" : `Nothing matches "${q}"`}</div>}
        </div>
        <div className="flex items-center gap-4 border-t border-line bg-surface-alt px-4 py-2 text-[12px] text-faint">
          <span><kbd className="font-sans">↑↓</kbd> to move</span><span><kbd className="font-sans">↵</kbd> to open</span>
          <span className="ml-auto">Order no., customer, phone or GSTIN</span>
        </div>
      </div>
    </div>
  );
}
