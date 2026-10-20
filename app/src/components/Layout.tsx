import { NavLink, Outlet } from "react-router-dom";
import clsx from "clsx";
import { useState } from "react";
import {
  LayoutDashboard, MessagesSquare, ClipboardCheck, Banknote, Warehouse, Truck, UserRound, CarFront,
  Tag, Users, Package, ExternalLink, Menu, X, RotateCcw,
} from "lucide-react";
import { useStore } from "../data/store";
import { ask } from "./ui";

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

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { reset } = useStore();
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
          <div className="grid h-8 w-8 place-items-center rounded-full bg-amber-200 text-xs font-bold text-secondary">FJ</div>
          <div className="text-xs leading-tight">
            <div className="font-medium">Fenil Jikadara</div>
            <div className="text-white/50">fenil@smallbaydigital.com</div>
          </div>
        </div>
        <a href="https://wordpress-511305-4547121.cloudwaysapps.com/" target="_blank" rel="noreferrer" className="flex w-full items-center justify-center gap-1.5 rounded-xl2 bg-info px-3 py-1.5 text-xs font-medium">
          External Form <ExternalLink className="h-3.5 w-3.5" />
        </a>
        <button onClick={async () => await ask("Reset all sample data?") && reset()} className="flex w-full items-center justify-center gap-1.5 rounded-xl2 px-3 py-1 text-[11px] text-white/50 hover:text-white">
          <RotateCcw className="h-3 w-3" /> Reset sample data
        </button>
      </div>
    </div>
  );
}

export default function Layout() {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex h-full bg-[#f6f6f8] font-sans text-[#0d0d0d]">
      <aside className="hidden w-64 shrink-0 lg:block"><Sidebar /></aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64"><Sidebar onNavigate={() => setOpen(false)} /></aside>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b bg-white px-4 py-2.5 lg:hidden">
          <button onClick={() => setOpen(!open)} className="rounded p-1 hover:bg-black/5">{open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button>
          <span className="text-sm font-medium">Sambhavnath Agencies LLP</span>
        </header>
        <main className="flex-1 overflow-y-auto p-4 sm:p-6"><Outlet /></main>
      </div>
    </div>
  );
}
