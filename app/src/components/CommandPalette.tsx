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
      .map((o) => ({ key: `o${o.order_id}`, group: "Orders", icon: ClipboardCheck, title: `${o.customer_name ?? "Order"} · #${o.order_id}`, meta: [ORDER_STATUS[o.order_status], fmtDate(o.order_date)].filter(Boolean).join(" · "), to: `/orders?id=${o.order_id}` }));
    const enq: Hit[] = (enquiries.data ?? [])
      .filter((e) => has(e.customer_name) || String(e.enquiry_id) === digits)
      .slice(0, 5)
      .map((e) => ({ key: `e${e.enquiry_id}`, group: "Enquiries", icon: MessagesSquare, title: `${e.customer_name ?? "Enquiry"} · EN-${e.enquiry_id}`, meta: [ENQ_STATUS[e.enquiry_status], fmtDate(e.enquiry_date)].filter(Boolean).join(" · "), to: `/enquiries?id=${e.enquiry_id}` }));
    const cus: Hit[] = (customers.data ?? [])
      .filter((c) => has(c.name, c.phone, c.gstin))
      .slice(0, 5)
      .map((c) => ({ key: `c${c.customer_id}`, group: "Customers", icon: Users, title: c.name, meta: [c.phone, c.gstin].filter(Boolean).join(" · "), to: `/customers?q=${encodeURIComponent(c.name)}` }));
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
    <div className="fade-in fixed inset-0 z-[65] flex items-start justify-center bg-secondary/40 p-4 pt-[12vh] backdrop-blur-[2px]" onMouseDown={onClose}>
      <div role="dialog" aria-label="Search" className="pop-in w-full max-w-xl overflow-hidden rounded-xl2 bg-white shadow-2xl shadow-black/25" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-black/[0.06] px-4">
          <Search className="h-4 w-4 shrink-0 text-gray-400" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey}
            placeholder="Search orders, enquiries, customers or pages…" className="h-12 w-full bg-transparent text-sm text-secondary outline-none placeholder:text-gray-400" />
          <kbd className="hidden shrink-0 rounded border border-black/10 bg-gray-50 px-1.5 py-0.5 text-2xs text-gray-500 sm:block">Esc</kbd>
        </div>
        <div ref={listRef} className="max-h-[52vh] overflow-y-auto p-1.5">
          {hits.map((h, i) => (
            <div key={h.key}>
              {(i === 0 || hits[i - 1].group !== h.group) && <div className="px-2.5 pb-1 pt-2.5 text-2xs font-medium uppercase tracking-wide text-gray-400">{h.group}</div>}
              <button data-i={i} onMouseEnter={() => setActive(i)} onClick={() => go(h)}
                className={clsx("flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left", i === active ? "bg-primary-50" : "hover:bg-gray-50")}>
                <h.icon className={clsx("h-4 w-4 shrink-0", i === active ? "text-primary" : "text-gray-400")} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-secondary">{h.title}</span>
                  {h.meta && <span className="block truncate text-2xs text-gray-500">{h.meta}</span>}
                </span>
                {i === active && <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-gray-400" />}
              </button>
            </div>
          ))}
          {!hits.length && <div className="px-3 py-10 text-center text-xs text-gray-400">{loading ? "Searching…" : `Nothing matches “${q}”`}</div>}
        </div>
        <div className="flex items-center gap-4 border-t border-black/[0.06] bg-gray-50/70 px-4 py-2 text-2xs text-gray-500">
          <span><kbd className="font-sans">↑↓</kbd> to move</span><span><kbd className="font-sans">↵</kbd> to open</span>
          <span className="ml-auto">Order no., customer, phone or GSTIN</span>
        </div>
      </div>
    </div>
  );
}
