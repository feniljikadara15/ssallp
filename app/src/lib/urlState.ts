import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

// Filters and tabs live in the URL, so a filtered view can be linked, bookmarked
// and survives a reload. Empty or default values are left out of the URL.
export function useUrlState<K extends string>(defaults: Record<K, string>) {
  const [params, setParams] = useSearchParams();
  const state = useMemo(
    () => Object.fromEntries(Object.entries(defaults).map(([k, d]) => [k, params.get(k) ?? d])) as Record<K, string>,
    [params], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const set = useCallback((patch: Partial<Record<K, string>>) => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      for (const [k, v] of Object.entries(patch) as [K, string | undefined][]) {
        if (v === undefined || v === "" || v === defaults[k]) next.delete(k); else next.set(k, v);
      }
      return next;
    }, { replace: true });
  }, [setParams]); // eslint-disable-line react-hooks/exhaustive-deps
  const clear = useCallback((keys: K[]) => set(Object.fromEntries(keys.map((k) => [k, ""])) as Partial<Record<K, string>>), [set]);
  return [state, set, clear] as const;
}
