import { Link, Outlet, useLocation } from "react-router-dom";
import clsx from "clsx";
import { useEffect, useState } from "react";
import { LogOut, Menu, Search, X } from "lucide-react";
import { post, prefetch, type Session } from "../api";
import { LogoMark } from "./Logo";
import { NAV } from "./nav";
import { CommandPalette } from "./CommandPalette";

// The data each page asks for first, fetched on hover so the page opens ready.
const PREFETCH: Record<string, string[]> = {
  "/orders": ["orders?paged=1&limit=100&status=1", "customer-names", "warehouses"],
  "/enquiries": ["enquiries?paged=1&limit=100&status=0", "customer-names", "warehouses"],
  "/customers": ["customers"],
  "/cash-bills": ["cash-bills?tab=pending", "cash-bills?tab=collected", "customer-names", "warehouses"],
  "/products": ["products?all=1"],
  "/warehouses": ["warehouses"],
  "/transporters": ["transporters", "warehouses"],
  "/warehouse-keepers": ["warehouse-keepers", "warehouses"],
  "/transporter-vehicles": ["vehicle-details?search="],
  "/audit": ["audit?limit=1000"],
};

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
const ALL = NAV.flatMap((g) => g.items);
// Longest matching link wins, so /orders/12 highlights Orders.
const currentItem = (path: string) =>
  ALL.filter((i) => (i.to === "/" ? path === "/" : path === i.to || path.startsWith(i.to + "/"))).sort((a, b) => b.to.length - a.to.length)[0];

function Sidebar({ onSearch, session }: { onSearch: () => void; session: Session }) {
  const { pathname } = useLocation();
  const current = currentItem(pathname);
  // Reload so no cached business data outlives the session.
  const logout = async () => {
    await post("logout").catch(() => null);
    window.location.reload();
  };
  return (
    <div className="flex h-full flex-col border-r border-navy-dark bg-navy text-white">
      <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-white/10 px-5">
        <LogoMark className="h-7 w-10" />
        <div className="leading-tight">
          <div className="text-[14px] font-bold tracking-wide">SAMBHAVNATH</div>
          <div className="text-[11px] text-brand-light/90">Order Management</div>
        </div>
      </div>
      <div className="px-3 pt-3">
        <button onClick={onSearch} className="flex h-9 w-full items-center gap-2 rounded-lg bg-white/[0.07] px-2.5 text-[13px] text-white/60 ring-1 ring-inset ring-white/10 transition-colors hover:bg-white/10 hover:text-white">
          <Search className="h-4 w-4" />
          <span className="flex-1 text-left">Search</span>
          <kbd className="rounded bg-white/10 px-1.5 py-px font-sans text-[11px] text-white/55">{isMac ? "⌘" : "Ctrl"} K</kbd>
        </button>
      </div>
      <nav className="scroll-on-navy flex-1 overflow-y-auto px-3 py-3" aria-label="Main">
        {NAV.map((g) => (
          <div key={g.section} className="mb-4">
            <div className="flex w-full items-center gap-2 px-2 pb-1.5 text-[12px] font-semibold uppercase tracking-wider text-white/45">
              {g.section}<span className="h-px flex-1 bg-white/10" />
            </div>
            {g.items.map((i) => {
              const active = i === current;
              return (
                <Link key={i.to} to={i.to} aria-current={active ? "page" : undefined}
                  onMouseEnter={() => PREFETCH[i.to]?.forEach(prefetch)} onFocus={() => PREFETCH[i.to]?.forEach(prefetch)}
                  className={clsx("group flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13.5px] transition-colors", active ? "bg-white/15 font-medium text-white" : "text-white/75 hover:bg-white/10 hover:text-white")}>
                  <i.icon className={clsx("h-[18px] w-[18px] shrink-0", active ? "text-white" : "text-white/55 group-hover:text-white/85")} strokeWidth={1.75} />
                  {i.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="border-t border-white/10 p-3">
        <div className="mb-1 truncate px-2 text-[12px] text-white/60" title={session.user?.email}>{session.user?.email ?? "Demo mode, sample data"}</div>
        {session.user && session.authRequired && (
          <button onClick={logout} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] text-white/75 transition-colors hover:bg-white/10 hover:text-white">
            <LogOut className="h-4 w-4" />Sign out
          </button>
        )}
      </div>
    </div>
  );
}

export default function Layout({ session }: { session: Session }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState(false);
  const { pathname } = useLocation();
  const current = currentItem(pathname);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setSearch((s) => !s); } };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => { setOpen(false); document.getElementById("main")?.scrollTo({ top: 0 }); }, [pathname]);

  return (
    <div className="flex h-full bg-canvas text-ink">
      <a href="#main" className="skip-link" onClick={(e) => { e.preventDefault(); document.getElementById("main")?.focus(); }}>Skip to content</a>
      <aside className="no-print hidden w-64 shrink-0 lg:block"><Sidebar session={session} onSearch={() => setSearch(true)} /></aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="dialog-backdrop fade-in absolute inset-0" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64"><Sidebar session={session} onSearch={() => { setOpen(false); setSearch(true); }} /></aside>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="no-print sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-line bg-surface px-4 lg:hidden">
          <button onClick={() => setOpen(!open)} className="btn btn-sm w-9 px-0" aria-label="Menu">{open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}</button>
          <div className="min-w-0 flex-1 truncate text-[14px] font-semibold text-ink">{current?.label ?? "Sambhavnath"}</div>
          <button onClick={() => setSearch(true)} className="btn-icon" aria-label="Search"><Search className="h-4 w-4" /></button>
        </div>
        <main id="main" tabIndex={-1} className="min-w-0 flex-1 overflow-y-auto px-4 py-5 outline-none sm:px-6 lg:px-8 lg:py-7">
          <div className="mx-auto max-w-[1500px]"><Outlet /></div>
        </main>
      </div>
      <CommandPalette open={search} onClose={() => setSearch(false)} />
    </div>
  );
}
