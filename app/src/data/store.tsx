import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { createSeed } from "./seed";
import type { DB } from "./types";

// Local, in-browser data store standing in for the Postgres backend while the
// UI is being rebuilt. Swap `update` callers for API calls when the backend lands.
const KEY = "ssallp-oms-db-v3";

function load(): DB {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return createSeed();
}

interface Store {
  db: DB;
  update: (fn: (draft: DB) => void) => void;
  reset: () => void;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<DB>(load);
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(db)); } catch {}
  }, [db]);
  const update = (fn: (d: DB) => void) =>
    setDb((prev) => {
      const next = structuredClone(prev);
      fn(next);
      return next;
    });
  const reset = () => setDb(createSeed());
  return <Ctx.Provider value={{ db, update, reset }}>{children}</Ctx.Provider>;
}

export function useStore() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStore outside provider");
  return v;
}

export const nextId = <T,>(rows: T[], key: keyof T) =>
  rows.reduce((m, r) => Math.max(m, Number(r[key]) || 0), 0) + 1;

export const inr = (n: number) =>
  "₹" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });

export const fmtDate = (iso: string) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("T")[0].split("-");
  return `${d}-${m}-${y}`;
};

export function downloadCsv(name: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const cols = Object.keys(rows[0]);
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = name;
  a.click();
}
