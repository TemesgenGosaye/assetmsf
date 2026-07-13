/**
 * useLiveData — stale-while-revalidate hook for any async data fetcher.
 *
 * Behaviour:
 *  1. If the cache already has data → render it INSTANTLY (loading = false)
 *  2. Kick off a background fetch in all cases
 *  3. When fresh data arrives → update state silently (no spinner, no flicker)
 *  4. Only show `loading = true` when there is truly no data yet (first ever visit)
 *
 * Usage:
 *   const { data: employees, loading, refresh } = useLiveData(
 *     "employees:list",
 *     () => listEmployees(),
 *     []
 *   );
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { getCachedValue, peekCachedValue, subscribeToCache } from "@/lib/data-cache";

type Options = {
  ttlMs?:    number;
  maxAgeMs?: number;
  /** Poll interval in ms. 0 = no polling (default). */
  pollMs?:   number;
};

export function useLiveData<T>(
  cacheKey: string,
  fetcher: () => Promise<T>,
  deps: React.DependencyList = [],
  options?: Options,
): {
  data: T | undefined;
  loading: boolean;
  error: Error | null;
  refresh: () => void;
} {
  // Seed from cache synchronously so the component never starts blank
  const [data,    setData]    = useState<T | undefined>(() => peekCachedValue<T>(cacheKey));
  const [loading, setLoading] = useState<boolean>(() => peekCachedValue<T>(cacheKey) === undefined);
  const [error,   setError]   = useState<Error | null>(null);
  const mountedRef = useRef(true);

  // Keep fetcher stable across renders
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const load = useCallback((force = false) => {
    getCachedValue<T>(
      cacheKey,
      () => fetcherRef.current(),
      { ttlMs: options?.ttlMs, maxAgeMs: options?.maxAgeMs, force },
    )
      .then((result) => {
        if (!mountedRef.current) return;
        setData(result);
        setLoading(false);
        setError(null);
      })
      .catch((err) => {
        if (!mountedRef.current) return;
        setError(err instanceof Error ? err : new Error(String(err)));
        setLoading(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, options?.ttlMs, options?.maxAgeMs]);

  useEffect(() => {
    mountedRef.current = true;

    // If there's no data yet → show loading; otherwise serve stale instantly
    if (peekCachedValue<T>(cacheKey) === undefined) {
      setLoading(true);
    }

    // Subscribe to background revalidation so SWR updates arrive silently
    const unsub = subscribeToCache<T>(cacheKey, (fresh) => {
      if (mountedRef.current) {
        setData(fresh);
        setLoading(false);
      }
    });

    load();

    return () => {
      mountedRef.current = false;
      unsub();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, load, ...deps]);

  // Optional polling
  useEffect(() => {
    if (!options?.pollMs || options.pollMs <= 0) return;
    const id = setInterval(() => load(), options.pollMs);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, options?.pollMs]);

  const refresh = useCallback(() => {
    setLoading(peekCachedValue<T>(cacheKey) === undefined);
    load(true);
  }, [cacheKey, load]);

  return { data, loading, error, refresh };
}
