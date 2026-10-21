import { NavLink, Outlet, useLocation } from "react-router-dom";
import clsx from "clsx";
import { useEffect, useState } from "react";
import { ExternalLink, LogOut, Menu, Search, X, AlertTriangle, FlaskConical } from "lucide-react";
import { post, useGet, type Health, type Session } from "../api";
import { LogoMark } from "./Logo";
import { NAV } from "./nav";
import { CommandPalette } from "./CommandPalette";

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

function Sidebar({ onNavigate, onSearch, session }: { onNavigate?: () => void; onSearch: () => void; session: Session }) {
  const user = session.user ?? { name: "Demo User", email: "Demo mode" };
  const initials = user.name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  // Reload so no cached business data outlives the session.
  const logout = async () => {
    await post("logout").catch(() => null);
    window.location.reload();
  };
  return (
    <div className="flex h-full flex-col bg-secondary text-white">
      <div className="flex items-center gap-3 px-5 pb-4 pt-5">
        <LogoMark className="h-8 w-11" />
        <div className="min-w-0 leading-tight">
          <div className="text-[13px] font-semibold">Sambhavnath</div>
          <div className="text-2xs text-white/45">Agencies LLP</div>
        </div>
      </div>
      <div className="px-3">
        <button onClick={onSearch} className="flex w-full items-center gap-2 rounded-lg bg-white/[0.06] px-3 py-2 text-xs text-white/55 ring-1 ring-inset ring-white/[0.08] transition hover:bg-white/10 hover:text-white/80">
          <Search className="h-3.5 w-3.5" />
          <span className="flex-1 text-left">Search</span>
          <kbd className="rounded bg-white/10 px-1.5 py-px font-sans text-2xs text-white/50">{isMac ? "⌘" : "Ctrl"} K</kbd>
        </button>
      </div>
      <nav className="mt-2 flex-1 overflow-y-auto px-3 pb-4">
        {NAV.map((g) => (
          <div key={g.section} className="mt-4">
            <div className="px-3 pb-1.5 text-2xs font-medium uppercase tracking-wider text-white/35">{g.section}</div>
            <div className="space-y-0.5">
              {g.items.map((it) => (
                <NavLink
                  key={it.to}
                  to={it.to}
                  end={it.to === "/"}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    clsx(
                      "group relative flex items-center gap-2.5 rounded-lg px-3 py-[7px] text-[13px] transition",
                      isActive ? "bg-white/[0.09] font-medium text-white" : "text-white/65 hover:bg-white/[0.05] hover:text-white",
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && <span className="absolute inset-y-1.5 left-0 w-[3px] rounded-full bg-primary" />}
                      <it.icon className={clsx("h-4 w-4 shrink-0", isActive ? "text-primary" : "text-white/45 group-hover:text-white/70")} />
                      {it.label}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>
      <div className="border-t border-white/[0.08] p-3">
        <a href="https://wordpress-511305-4547121.cloudwaysapps.com/" target="_blank" rel="noreferrer"
          className="mb-2 flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs text-white/60 transition hover:bg-white/[0.05] hover:text-white">
          <ExternalLink className="h-4 w-4 text-white/45" /> Customer enquiry form
        </a>
        <div className="flex items-center gap-2.5 rounded-lg bg-white/[0.04] p-2">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/90 text-2xs font-semibold text-white">{initials}</div>
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-xs font-medium">{user.name}</div>
            <div className="truncate text-2xs text-white/45">{user.email}</div>
          </div>
          {session.user && session.authRequired && (
            <button onClick={logout} title="Sign out" aria-label="Sign out" className="rounded-md p-1.5 text-white/50 transition hover:bg-white/10 hover:text-white"><LogOut className="h-4 w-4" /></button>
          )}
        </div>
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
    return (
      <div className="flex items-center justify-center gap-2 border-b border-amber-200/70 bg-amber-50 px-4 py-1.5 text-2xs text-amber-900">
        <FlaskConical className="h-3.5 w-3.5 shrink-0" /> Demo mode: sample data that resets when the server restarts.
      </div>
    );
  const missing = [!data.zoho && "Zoho Books", !data.whatsapp && "WhatsApp"].filter(Boolean);
  if (!missing.length) return null;
  return (
    <div className="flex items-center justify-center gap-2 border-b border-amber-200/70 bg-amber-50 px-4 py-1.5 text-2xs text-amber-900">
      <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {missing.join(" and ")} not connected: actions that need {missing.length > 1 ? "them" : "it"} will show an error.
    </div>
  );
}

export default function Layout({ session }: { session: Session }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setSearch((s) => !s); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => setOpen(false), [pathname]);

  return (
    <div className="flex h-full bg-[#f5f6f8] text-secondary">
      <aside className="hidden w-[248px] shrink-0 lg:block"><Sidebar session={session} onSearch={() => setSearch(true)} /></aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="fade-in absolute inset-0 bg-secondary/50" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-[264px] shadow-2xl"><Sidebar session={session} onSearch={() => { setOpen(false); setSearch(true); }} onNavigate={() => setOpen(false)} /></aside>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <StatusBanner />
        <header className="flex items-center gap-3 border-b border-black/[0.06] bg-white px-4 py-2.5 lg:hidden">
          <button aria-label="Menu" onClick={() => setOpen(!open)} className="rounded-lg p-1.5 hover:bg-black/5">{open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button>
          <LogoMark className="h-6 w-8 text-secondary" />
          <span className="flex-1 truncate text-sm font-semibold text-secondary">Sambhavnath Agencies</span>
          <button aria-label="Search" onClick={() => setSearch(true)} className="rounded-lg p-1.5 text-gray-500 hover:bg-black/5"><Search className="h-5 w-5" /></button>
        </header>
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1600px] p-4 sm:p-6 lg:px-8 lg:py-7">
            <Outlet />
          </div>
        </main>
      </div>
      <CommandPalette open={search} onClose={() => setSearch(false)} />
    </div>
  );
}
