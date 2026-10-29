import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import type { ProductSummary } from '@/core/api/catalog';
import { readJson, writeJson } from '@/core/storage/jsonStore';

// Wishlist and recently viewed products. The website has neither, so there
// is no server copy: both live on this device as product snapshots (price as
// last seen), and opening one always loads the live product.

const WISHLIST_MAX = 200;
const RECENT_MAX = 20;

type SavedState = {
  wishlist: ProductSummary[];
  recent: ProductSummary[];
  isSaved: (id: number) => boolean;
  toggleSaved: (p: ProductSummary) => boolean; // returns the new saved state
  removeSaved: (id: number) => void;
  addRecent: (p: ProductSummary) => void;
  clearRecent: () => void;
};

const SavedContext = createContext<SavedState | null>(null);

// Keep only what a ProductCard needs, so stored JSON stays small.
const snapshot = (p: ProductSummary): ProductSummary => ({
  id: p.id,
  slug: p.slug,
  name: p.name,
  image: p.image,
  price: p.price,
  max_value: p.max_value ?? p.mrp ?? null,
  brand_name: p.brand_name ?? null,
  is_assured: p.is_assured,
  is_unavailable: p.is_unavailable,
});

export function SavedProvider({ children }: { children: React.ReactNode }) {
  const [wishlist, setWishlist] = useState<ProductSummary[]>([]);
  const [recent, setRecent] = useState<ProductSummary[]>([]);
  // Writes before the initial read finishes would overwrite the stored list.
  const loaded = useRef(false);

  useEffect(() => {
    Promise.all([readJson<ProductSummary[]>('wishlist', []), readJson<ProductSummary[]>('recent', [])]).then(([w, r]) => {
      setWishlist((cur) => (cur.length ? cur : w));
      setRecent((cur) => (cur.length ? cur : r));
      loaded.current = true;
    });
  }, []);

  useEffect(() => {
    if (loaded.current) writeJson('wishlist', wishlist);
  }, [wishlist]);
  useEffect(() => {
    if (loaded.current) writeJson('recent', recent);
  }, [recent]);

  const savedIds = useMemo(() => new Set(wishlist.map((p) => p.id)), [wishlist]);
  const isSaved = useCallback((id: number) => savedIds.has(id), [savedIds]);

  const toggleSaved = useCallback(
    (p: ProductSummary) => {
      const next = !savedIds.has(p.id);
      setWishlist((cur) => (next ? [snapshot(p), ...cur.filter((x) => x.id !== p.id)].slice(0, WISHLIST_MAX) : cur.filter((x) => x.id !== p.id)));
      return next;
    },
    [savedIds],
  );

  const removeSaved = useCallback((id: number) => setWishlist((cur) => cur.filter((x) => x.id !== id)), []);

  const addRecent = useCallback(
    (p: ProductSummary) => setRecent((cur) => [snapshot(p), ...cur.filter((x) => x.id !== p.id)].slice(0, RECENT_MAX)),
    [],
  );
  const clearRecent = useCallback(() => setRecent([]), []);

  const value = useMemo(
    () => ({ wishlist, recent, isSaved, toggleSaved, removeSaved, addRecent, clearRecent }),
    [wishlist, recent, isSaved, toggleSaved, removeSaved, addRecent, clearRecent],
  );
  return <SavedContext.Provider value={value}>{children}</SavedContext.Provider>;
}

export function useSaved() {
  const ctx = useContext(SavedContext);
  if (!ctx) throw new Error('useSaved must be used inside <SavedProvider>');
  return ctx;
}
