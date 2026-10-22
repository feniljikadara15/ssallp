import { useEffect, useState } from "react";
import { keepPreviousData, QueryClient, useMutation, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { toast } from "./components/ui";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`/api/${path.replace(/^\//, "")}`, {
    method: opts.method ?? "GET",
    credentials: "same-origin",
    headers: opts.body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401) queryClient.invalidateQueries({ queryKey: ["session"] });
    throw new ApiError(res.status, data?.error ?? `Request failed (${res.status})`);
  }
  return data as T;
}

export const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 15_000, retry: (n, e) => !(e instanceof ApiError && e.status < 500) && n < 1, refetchOnWindowFocus: true } },
});

// GET helper: the query key is the path, so invalidating ["orders"] also
// refreshes "orders/12" and friends.
// keep: while the path changes (a new filter or page), show the previous
// result instead of a loading state.
export function useGet<T = any>(path: string | null, opts: { refetchInterval?: number; keep?: boolean } = {}) {
  const key = path ? path.split(/[/?]/).filter(Boolean) : ["__disabled"];
  const { keep, ...rest } = opts;
  return useQuery<T>({ queryKey: [...key, path], queryFn: () => api<T>(path!), enabled: !!path, ...(keep ? { placeholderData: keepPreviousData } : {}), ...rest });
}

/** Starts loading a page's data before it opens (hovering a menu item). Same key as useGet. */
export function prefetch(path: string) {
  const key = path.split(/[/?]/).filter(Boolean);
  void queryClient.prefetchQuery({ queryKey: [...key, path], queryFn: () => api(path), staleTime: 15_000 });
}

/** The value once it has stopped changing for a moment (typing in a search box). */
export function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

type Invalidate = (string | QueryKey)[];

// Mutation helper: calls the API, shows the server's message (or the error)
// as a toast, then refreshes the listed queries.
export function useAction<V = any>(fn: (v: V) => Promise<any>, invalidate: Invalidate = [], opts: { quiet?: boolean; onSuccess?: (data: any, v: V) => void } = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: async (data, v) => {
      await Promise.all(invalidate.map((k) => qc.invalidateQueries({ queryKey: Array.isArray(k) ? k : [k] })));
      if (!opts.quiet && data?.message) toast(data.message + (data.whatsapp?.note && !data.whatsapp.sent ? ` · ${data.whatsapp.note}` : ""), data.whatsapp && !data.whatsapp.sent ? "warn" : "ok");
      opts.onSuccess?.(data, v);
    },
    onError: (e: Error) => toast(e.message, "error"),
  });
}

export const post = (path: string, body: unknown = {}) => api(path, { method: "POST", body });
export const patch = (path: string, body: unknown = {}) => api(path, { method: "PATCH", body });
export const del = (path: string) => api(path, { method: "DELETE" });

export interface Session { user: { email: string; name: string } | null; authRequired: boolean; mode: "demo" | "live" }
export interface Health { mode: "demo" | "live"; zoho: boolean; whatsapp: boolean; authRequired: boolean }
