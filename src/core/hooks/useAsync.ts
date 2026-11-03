import { isAxiosError } from 'axios';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { errorMessage } from '@/core/api/client';
import { fetchShared, forget, isFresh, peek, put, readPersisted } from '@/core/cache';

// Keep the latest loader in a ref without touching refs during render.
function useLatest<T>(value: T) {
  const ref = useRef(value);
  useLayoutEffect(() => {
    ref.current = value;
  });
  return ref;
}

// `loading` is derived from whether the result belongs to the current deps,
// so a deps change shows the loading state without a setState in the effect.
const keyOf = (deps: unknown[]) => JSON.stringify(deps);

// Opt-in response caching (see core/cache). `key` names the loader and is
// combined with the deps, so it must be unique per loader. A cached answer is
// shown at once; it's refetched in the background once older than
// `staleTime`. `persist` also keeps it on disk across launches.
export type CacheOptions = { key: string; persist?: boolean; staleTime?: number };

const DEFAULT_STALE_MS = 30_000;
export const FIVE_MIN = 5 * 60_000;
// Home and the Categories tab share the domain list.
export const DOMAINS_CACHE: CacheOptions = { key: 'domains', persist: true, staleTime: 10 * 60_000 };
const cacheKeyOf = (cache: CacheOptions | undefined, key: string) => (cache ? `${cache.key}:${key}` : null);

// 404 / 410: the thing itself is gone (a product removed or retired by the
// admin), not a failed request, so the cached copy must not keep showing.
const isGone = (e: unknown) => isAxiosError(e) && (e.response?.status === 404 || e.response?.status === 410);

// Starts a cached load early (e.g. on press-in). A useAsync with the same
// cache options and deps then picks up the running request or its answer.
export function prefetch<T>(cache: CacheOptions, deps: unknown[], fn: () => Promise<T>) {
  const cacheKey = cacheKeyOf(cache, keyOf(deps))!;
  const hit = peek(cacheKey);
  if (hit && isFresh(hit, cache.staleTime ?? DEFAULT_STALE_MS)) return;
  fetchShared(cacheKey, fn, !!cache.persist).catch(() => {});
}

type AsyncState<T> = { key: string | null; data?: T; error: string | null };

// Minimal fetch-state hook: initial load, pull-to-refresh and error text.
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[], cache?: CacheOptions) {
  const key = keyOf(deps);
  const cacheKey = cacheKeyOf(cache, key);
  const persist = !!cache?.persist;
  const staleTime = cache?.staleTime ?? DEFAULT_STALE_MS;
  const [state, setState] = useState<AsyncState<T>>(() => {
    const hit = cacheKey ? peek<T>(cacheKey) : undefined;
    return hit ? { key, data: hit.data, error: null } : { key: null, error: null };
  });
  const [refreshing, setRefreshing] = useState(false);
  const fnRef = useLatest(fn);
  const seq = useRef(0);

  const fetchFor = useCallback(
    async (k: string, ck: string | null) => {
      const id = ++seq.current;
      try {
        const data = ck ? await fetchShared(ck, () => fnRef.current(), persist) : await fnRef.current();
        if (id === seq.current) setState({ key: k, data, error: null });
      } catch (e) {
        // A failed refresh of cached data keeps showing that data, unless the
        // server said it no longer exists: then the copy goes too.
        const gone = isGone(e);
        if (gone && ck) forget(ck);
        if (id === seq.current)
          setState((s) =>
            ck && !gone && s.key === k && s.data !== undefined
              ? s
              : { key: k, data: gone ? undefined : s.data, error: errorMessage(e) },
          );
      } finally {
        if (id === seq.current) setRefreshing(false);
      }
    },
    [fnRef, persist],
  );

  useEffect(() => {
    if (!cacheKey) {
      fetchFor(key, null);
      return;
    }
    const hit = peek<T>(cacheKey);
    if (hit) {
      // Shown already (see `cached` below); adopt it as state so setData acts
      // on it, and refetch only once it's stale.
      setState((s) => (s.key === key ? s : { key, data: hit.data, error: null }));
      if (!isFresh(hit, staleTime)) fetchFor(key, cacheKey);
      return;
    }
    // Cold start: the disk copy usually beats the network, so show it while
    // the request runs. The network answer replaces it when it lands.
    const id = seq.current + 1;
    if (persist) {
      readPersisted<T>(cacheKey).then((saved) => {
        if (saved && seq.current === id) setState((s) => (s.key === key ? s : { key, data: saved.data, error: null }));
      });
    }
    fetchFor(key, cacheKey);
  }, [key, cacheKey, persist, staleTime, fetchFor]);

  // After a deps change, a cached answer for the new deps shows at once.
  const cached = state.key !== key && cacheKey ? peek<T>(cacheKey) : undefined;

  const reload = () => {
    setState((s) => ({ ...s, key: null }));
    fetchFor(key, cacheKey);
  };
  const refresh = () => {
    setRefreshing(true);
    fetchFor(key, cacheKey);
  };
  const setData = (update: (prev: T | undefined) => T | undefined) =>
    setState((s) => {
      const data = update(s.data);
      if (cacheKey && s.key === key) put(cacheKey, data, persist);
      return { ...s, data };
    });

  return {
    data: cached ? cached.data : state.data,
    error: state.key === key ? state.error : null,
    loading: state.key !== key && !cached,
    refreshing,
    reload,
    refresh,
    setData,
  };
}

type PagedState<T> = { key: string | null; items: T[]; page: number; hasMore: boolean; error: string | null };

type FirstPage<T> = { items: T[]; hasMore: boolean };

// Infinite list on top of a page loader. With `cache`, the first page is
// cached like useAsync's data (later pages always come from the network).
export function usePaged<T>(load: (page: number) => Promise<FirstPage<T>>, deps: unknown[], cache?: CacheOptions) {
  const key = keyOf(deps);
  const cacheKey = cacheKeyOf(cache, key);
  const persist = !!cache?.persist;
  const staleTime = cache?.staleTime ?? DEFAULT_STALE_MS;
  const [state, setState] = useState<PagedState<T>>(() => {
    const hit = cacheKey ? peek<FirstPage<T>>(cacheKey) : undefined;
    return hit
      ? { key, items: hit.data.items, page: 1, hasMore: hit.data.hasMore, error: null }
      : { key: null, items: [], page: 1, hasMore: true, error: null };
  });
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const loadRef = useLatest(load);
  const seq = useRef(0);

  const fetchFirst = useCallback(
    async (k: string, ck: string | null, background = false) => {
      const id = ++seq.current;
      try {
        const first = () => loadRef.current(1).then((r) => ({ items: r.items, hasMore: r.hasMore }));
        const res = ck ? await fetchShared(ck, first, persist) : await first();
        if (id !== seq.current) return;
        // A background refresh doesn't yank away pages the user scrolled into.
        setState((s) =>
          background && s.key === k && s.page > 1 ? s : { key: k, items: res.items, page: 1, hasMore: res.hasMore, error: null },
        );
      } catch (e) {
        if (id !== seq.current) return;
        // Keep what's on screen if only the background refresh failed.
        setState((s) =>
          background && s.key === k ? s : { key: k, items: [], page: 1, hasMore: false, error: errorMessage(e) },
        );
      } finally {
        if (id === seq.current) setRefreshing(false);
      }
    },
    [loadRef, persist],
  );

  useEffect(() => {
    if (!cacheKey) {
      fetchFirst(key, null);
      return;
    }
    const hit = peek<FirstPage<T>>(cacheKey);
    if (hit) {
      // Adopt it as state so loadMore continues from it.
      setState((s) => (s.key === key ? s : { key, items: hit.data.items, page: 1, hasMore: hit.data.hasMore, error: null }));
      if (!isFresh(hit, staleTime)) fetchFirst(key, cacheKey, true);
      return;
    }
    const id = seq.current + 1;
    if (persist) {
      readPersisted<FirstPage<T>>(cacheKey).then((saved) => {
        if (saved && seq.current === id)
          setState((s) => (s.key === key ? s : { key, items: saved.data.items, page: 1, hasMore: saved.data.hasMore, error: null }));
      });
    }
    fetchFirst(key, cacheKey);
  }, [key, cacheKey, persist, staleTime, fetchFirst]);

  const cached = state.key !== key && cacheKey ? peek<FirstPage<T>>(cacheKey) : undefined;
  const loading = state.key !== key && !cached;

  const loadMore = async () => {
    if (!state.hasMore || loading || loadingMore) return;
    const id = seq.current;
    setLoadingMore(true);
    try {
      const res = await loadRef.current(state.page + 1);
      if (id !== seq.current) return;
      setState((s) => {
        // Listings round-robin sellers, so a later page can repeat an item.
        const seen = new Set(s.items.map((p: any) => p?.id ?? p));
        const fresh = res.items.filter((p: any) => !seen.has(p?.id ?? p));
        return { ...s, items: [...s.items, ...fresh], page: s.page + 1, hasMore: res.hasMore && res.items.length > 0 };
      });
    } catch {
      setState((s) => ({ ...s, hasMore: false }));
    } finally {
      setLoadingMore(false);
    }
  };

  return {
    items: cached ? cached.data.items : loading ? [] : state.items,
    hasMore: cached ? cached.data.hasMore : state.hasMore,
    loading,
    loadingMore,
    refreshing,
    error: loading ? null : state.error,
    loadMore,
    refresh: () => {
      setRefreshing(true);
      fetchFirst(key, cacheKey);
    },
    reload: () => {
      setState((s) => ({ ...s, key: null }));
      fetchFirst(key, cacheKey);
    },
  };
}
