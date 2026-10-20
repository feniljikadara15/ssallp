import { NavLink, Outlet } from "react-router-dom";
import clsx from "clsx";
import { useState } from "react";
import {
  LayoutDashboard, MessagesSquare, ClipboardCheck, Banknote, Warehouse, Truck, UserRound, CarFront,
  Tag, Users, Package, ExternalLink, Menu, X, LogOut,
} from "lucide-react";
import { post, useGet, type Health, type Session } from "../api";

const NAV: { section: string; items: { to: string; label: string; icon: React.ElementType }[] }[] = [
  { section: "Dashboard", items: [{ to: "/", label: "Dashboard", icon: LayoutDashboard }] },
  { section: "Order Management", items: [
    { to: "/enquiries", label: "Enquiries", icon: MessagesSquare },
    { to: "/orders", label: "Orders", icon: ClipboardCheck },
  ] },
  { section: "Accounting", items: [{ to: "/cash-bills", label: "Cash Bills", icon: Banknote }] },
  { section: "Logistics", items: [
    { to: "/warehouses", label: "Warehouses", icon: Warehouse },
    { to: "/transporters", label: "Transporters", icon: Truck },
    { to: "/warehouse-keepers", label: "Warehouse Keepers", icon: UserRound },
    { to: "/transporter-vehicles", label: "Transporter Vehicle Details", icon: CarFront },
  ] },
  { section: "Products", items: [{ to: "/products", label: "Products", icon: Tag }] },
  { section: "Customers", items: [
    { to: "/customers", label: "Customers", icon: Users },
    { to: "/loading-slips", label: "Loading Slips", icon: Package },
  ] },
];

function Sidebar({ onNavigate, session }: { onNavigate?: () => void; session: Session }) {
  const user = session.user ?? { name: "Demo User", email: "demo mode" };
  const initials = user.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  // Reload so no cached business data outlives the session.
  const logout = async () => {
    await post("logout").catch(() => null);
    window.location.reload();
  };
  return (
    <div className="flex h-full flex-col bg-secondary text-white">
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-lg font-bold">S</div>
        <div className="text-sm font-medium leading-tight">Sambhavnath<br />Agencies LLP</div>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        {NAV.map((g) => (
          <div key={g.section} className="mt-3">
            <div className="px-3 pb-1 text-[10px] font-medium uppercase tracking-wider text-white/40">{g.section}</div>
            {g.items.map((it) => (
              <NavLink
                key={it.to}
                to={it.to}
                end={it.to === "/"}
                onClick={onNavigate}
                className={({ isActive }) =>
                  clsx("flex items-center gap-2.5 rounded-xl2 px-3 py-2 text-xs transition", isActive ? "bg-primary text-white" : "text-white/75 hover:bg-white/10 hover:text-white")
                }
              >
                <it.icon className="h-4 w-4" />
                {it.label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
      <div className="space-y-2 border-t border-white/10 p-4">
        <div className="flex items-center gap-2.5">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-amber-200 text-xs font-bold text-secondary">{initials}</div>
          <div className="min-w-0 flex-1 text-xs leading-tight">
            <div className="truncate font-medium">{user.name}</div>
            <div className="truncate text-white/50">{user.email}</div>
          </div>
          {session.user && session.authRequired && (
            <button onClick={logout} title="Sign out" className="rounded p-1.5 text-white/60 hover:bg-white/10 hover:text-white"><LogOut className="h-4 w-4" /></button>
          )}
        </div>
        <a href="https://wordpress-511305-4547121.cloudwaysapps.com/" target="_blank" rel="noreferrer" className="flex w-full items-center justify-center gap-1.5 rounded-xl2 bg-info px-3 py-1.5 text-xs font-medium">
          External Form <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
    </div>
  );
}

// Tells people when they're looking at sample data or when an integration
// isn't connected, so a skipped WhatsApp message isn't a surprise.
function StatusBanner() {
  const { data } = useGet<Health>("health");
  if (!data) return null;
  if (data.mode === "demo")
    return <div className="bg-amber-100 px-4 py-1.5 text-center text-[11px] text-amber-900">Demo mode: sample data that resets when the server restarts. Connect the database (DATABASE_URL) to use real data.</div>;
  const missing = [!data.zoho && "Zoho Books", !data.whatsapp && "WhatsApp"].filter(Boolean);
  if (!missing.length) return null;
  return <div className="bg-amber-100 px-4 py-1.5 text-center text-[11px] text-amber-900">{missing.join(" and ")} not connected yet: invoices, imports and messages that need {missing.length > 1 ? "them" : "it"} will show an error.</div>;
}

export default function Layout({ session }: { session: Session }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex h-full bg-[#f6f6f8] font-sans text-[#0d0d0d]">
      <aside className="hidden w-64 shrink-0 lg:block"><Sidebar session={session} /></aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64"><Sidebar session={session} onNavigate={() => setOpen(false)} /></aside>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <StatusBanner />
        <header className="flex items-center gap-3 border-b bg-white px-4 py-2.5 lg:hidden">
          <button onClick={() => setOpen(!open)} className="rounded p-1 hover:bg-black/5">{open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button>
          <span className="text-sm font-medium">Sambhavnath Agencies LLP</span>
        </header>
        <main className="flex-1 overflow-y-auto p-4 sm:p-6"><Outlet /></main>
      </div>
    </div>
  );
}
