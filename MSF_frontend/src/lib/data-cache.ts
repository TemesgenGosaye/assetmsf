/**
 * In-memory cache with stale-while-revalidate (SWR) semantics.
 *
 * Behaviour:
 *  - FRESH  (age < ttl)          → return cached value instantly, no network call
 *  - STALE  (ttl < age < maxAge) → return cached value instantly AND kick off a
 *                                   background revalidation; subscribers are notified
 *                                   when the new value arrives
 *  - EXPIRED (age > maxAge)      → block until fresh data is fetched (shows skeleton)
 *  - IN-FLIGHT                   → deduplicate: return the same Promise to all callers
 */

const DEFAULT_TTL    = 60_000;   // serve from cache for 1 min (feel instant)
const DEFAULT_MAX_AGE = 300_000; // after 5 min show skeleton again (cold refresh)

type Subscriber<T> = (value: T) => void;

type CacheEntry<T> = {
  value?: T;
  fetchedAt: number;        // when the value was last set
  expiry: number;           // fetchedAt + ttl  (end of "fresh" window)
  maxExpiry: number;        // fetchedAt + maxAge (end of "stale" window)
  promise?: Promise<T>;     // in-flight dedup
  subscribers: Set<Subscriber<T>>;
};

const store = new Map<string, CacheEntry<unknown>>();

function now() { return Date.now(); }

export type CacheOptions = {
  ttlMs?:    number;  // how long to treat data as fresh (default 60s)
  maxAgeMs?: number;  // how long to keep serving stale (default 5min)
  force?:    boolean; // bypass cache and force network fetch
};

// ── Core SWR function ─────────────────────────────────────────────────────

export async function getCachedValue<T>(
  key: string,
  fetcher: () => Promise<T>,
  options?: CacheOptions,
): Promise<T> {
  const ttl    = options?.ttlMs    ?? DEFAULT_TTL;
  const maxAge = options?.maxAgeMs ?? DEFAULT_MAX_AGE;
  const ts     = now();

  const current = store.get(key) as CacheEntry<T> | undefined;

  // ── Force refresh: skip cache entirely ──────────────────────────────
  if (options?.force) {
    return fetchAndStore(key, fetcher, ttl, maxAge, current);
  }

  // ── In-flight: deduplicate ───────────────────────────────────────────
  if (current?.promise) {
    return current.promise;
  }

  // ── FRESH: serve instantly ───────────────────────────────────────────
  if (current?.value !== undefined && ts < current.expiry) {
    return Promise.resolve(current.value);
  }

  // ── STALE: serve instantly + revalidate in background ────────────────
  if (current?.value !== undefined && ts < current.maxExpiry) {
    // Don't await — fire and forget, notify subscribers when done
    revalidateInBackground(key, fetcher, ttl, maxAge, current);
    return Promise.resolve(current.value);
  }

  // ── EXPIRED / MISSING: block until fetched ───────────────────────────
  return fetchAndStore(key, fetcher, ttl, maxAge, current);
}

function fetchAndStore<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number,
  maxAge: number,
  current?: CacheEntry<T>,
): Promise<T> {
  const pending = fetcher()
    .then((result) => {
      const entry = store.get(key) as CacheEntry<T>;
      const t = now();
      store.set(key, {
        value:      result,
        fetchedAt:  t,
        expiry:     t + ttl,
        maxExpiry:  t + maxAge,
        promise:    undefined,
        subscribers: entry?.subscribers ?? new Set(),
      });
      // Notify any SWR background-refresh subscribers
      entry?.subscribers.forEach(cb => cb(result));
      return result;
    })
    .catch((error) => {
      // Restore the old value (if any) so stale serving can continue
      const entry = store.get(key) as CacheEntry<T> | undefined;
      if (entry) {
        store.set(key, { ...entry, promise: undefined });
      } else {
        store.delete(key);
      }
      throw error;
    });

  store.set(key, {
    value:      current?.value,
    fetchedAt:  current?.fetchedAt ?? 0,
    expiry:     current?.expiry ?? 0,
    maxExpiry:  current?.maxExpiry ?? 0,
    promise:    pending,
    subscribers: current?.subscribers ?? new Set(),
  });

  return pending;
}

function revalidateInBackground<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number,
  maxAge: number,
  current: CacheEntry<T>,
) {
  // Guard: only one background fetch at a time per key
  if (current.promise) return;
  fetchAndStore(key, fetcher, ttl, maxAge, current).catch(() => {/* swallow bg errors */});
}

// ── Subscription (for stale-while-revalidate UI updates) ─────────────────

/**
 * Subscribe to background revalidation results for a key.
 * The callback is called whenever a background fetch completes with new data.
 * Returns an unsubscribe function.
 */
export function subscribeToCache<T>(key: string, callback: Subscriber<T>): () => void {
  let entry = store.get(key) as CacheEntry<T> | undefined;
  if (!entry) {
    entry = {
      value: undefined,
      fetchedAt: 0,
      expiry: 0,
      maxExpiry: 0,
      promise: undefined,
      subscribers: new Set(),
    };
    store.set(key, entry);
  }
  (entry.subscribers as Set<Subscriber<T>>).add(callback);
  return () => {
    (entry!.subscribers as Set<Subscriber<T>>).delete(callback);
  };
}

// ── Utilities ─────────────────────────────────────────────────────────────

export function invalidateCache(key: string) {
  const entry = store.get(key);
  if (entry) {
    // Keep subscribers, wipe data so next call is a blocking fetch
    store.set(key, { ...entry, value: undefined, fetchedAt: 0, expiry: 0, maxExpiry: 0, promise: undefined });
  } else {
    store.delete(key);
  }
}

export function invalidateCacheByPrefix(prefix: string) {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) invalidateCache(key);
  }
}

export function peekCachedValue<T>(key: string): T | undefined {
  const entry = store.get(key) as CacheEntry<T> | undefined;
  return entry?.value;
}

export function setCachedValue<T>(key: string, value: T) {
  const entry = store.get(key) as CacheEntry<T> | undefined;
  const t = now();
  const freshEntry: CacheEntry<T> = {
    value,
    fetchedAt: t,
    expiry: t + DEFAULT_TTL,
    maxExpiry: t + DEFAULT_MAX_AGE,
    promise: undefined,
    subscribers: entry?.subscribers ?? new Set(),
  };
  if (entry) {
    entry.subscribers.forEach(cb => (cb as Subscriber<T>)(value));
  }
  store.set(key, freshEntry);
}

export function clearCache() {
  store.clear();
}
