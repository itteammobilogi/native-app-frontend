import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { errorMessage } from '@/core/api/client';

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

type AsyncState<T> = { key: string | null; data?: T; error: string | null };

// Minimal fetch-state hook: initial load, pull-to-refresh and error text.
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]) {
  const key = keyOf(deps);
  const [state, setState] = useState<AsyncState<T>>({ key: null, error: null });
  const [refreshing, setRefreshing] = useState(false);
  const fnRef = useLatest(fn);
  const seq = useRef(0);

  const fetchFor = useCallback(
    async (k: string) => {
      const id = ++seq.current;
      try {
        const data = await fnRef.current();
        if (id === seq.current) setState({ key: k, data, error: null });
      } catch (e) {
        if (id === seq.current) setState((s) => ({ key: k, data: s.data, error: errorMessage(e) }));
      } finally {
        if (id === seq.current) setRefreshing(false);
      }
    },
    [fnRef],
  );

  useEffect(() => {
    fetchFor(key);
  }, [key, fetchFor]);

  const reload = () => {
    setState((s) => ({ ...s, key: null }));
    fetchFor(key);
  };
  const refresh = () => {
    setRefreshing(true);
    fetchFor(key);
  };
  const setData = (update: (prev: T | undefined) => T | undefined) =>
    setState((s) => ({ ...s, data: update(s.data) }));

  return {
    data: state.data,
    error: state.key === key ? state.error : null,
    loading: state.key !== key,
    refreshing,
    reload,
    refresh,
    setData,
  };
}

type PagedState<T> = { key: string | null; items: T[]; page: number; hasMore: boolean; error: string | null };

// Infinite list on top of a page loader.
export function usePaged<T>(load: (page: number) => Promise<{ items: T[]; hasMore: boolean }>, deps: unknown[]) {
  const key = keyOf(deps);
  const [state, setState] = useState<PagedState<T>>({ key: null, items: [], page: 1, hasMore: true, error: null });
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const loadRef = useLatest(load);
  const seq = useRef(0);

  const fetchFirst = useCallback(
    async (k: string) => {
      const id = ++seq.current;
      try {
        const res = await loadRef.current(1);
        if (id === seq.current) setState({ key: k, items: res.items, page: 1, hasMore: res.hasMore, error: null });
      } catch (e) {
        if (id === seq.current) setState({ key: k, items: [], page: 1, hasMore: false, error: errorMessage(e) });
      } finally {
        if (id === seq.current) setRefreshing(false);
      }
    },
    [loadRef],
  );

  useEffect(() => {
    fetchFirst(key);
  }, [key, fetchFirst]);

  const loading = state.key !== key;

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
    items: loading ? [] : state.items,
    hasMore: state.hasMore,
    loading,
    loadingMore,
    refreshing,
    error: loading ? null : state.error,
    loadMore,
    refresh: () => {
      setRefreshing(true);
      fetchFirst(key);
    },
    reload: () => {
      setState((s) => ({ ...s, key: null }));
      fetchFirst(key);
    },
  };
}
