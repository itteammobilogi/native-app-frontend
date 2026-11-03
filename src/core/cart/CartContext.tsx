import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import {
  addToCart,
  cartError,
  clearCart,
  EMPTY_CART,
  getCart,
  mergeGuestCart,
  removeFromCart,
  updateQty,
  waitForSellers,
  type AddPayload,
  type Cart,
  type CartLine,
} from '@/core/api/cart';
import { useAuth } from '@/core/auth/AuthContext';
import { getGuestId, saveGuestId } from '@/core/auth/storage';

type CartState = {
  cart: Cart;
  count: number;
  loading: boolean;
  confirming: boolean; // waiting for sellers to confirm prices after a change
  refresh: () => Promise<Cart>;
  add: (p: Omit<AddPayload, 'guest_id'>) => Promise<void>;
  has: (variantId: number) => boolean;
  setQuantity: (line: CartLine, quantity: number) => Promise<void>;
  remove: (line: CartLine) => Promise<void>;
  clear: () => Promise<void>;
};

const Ctx = createContext<CartState | null>(null);

// The cart with its lines replaced, totals moved by the same amount, so the
// bill changes the moment a line is removed or re-quantified. The next server
// read (a few hundred ms later) replaces it with the real numbers.
function withLines(c: Cart, products: CartLine[]): Cart {
  if (!products.length) return EMPTY_CART;
  const sum = (lines: CartLine[]) => lines.reduce((n, l) => n + Number(l.price || 0), 0);
  const delta = sum(products) - sum(c.products);
  const tids = new Set(products.map((l) => l.t_id));
  const itemTotal = c.breakupSummary.item_total;
  return {
    ...c,
    products,
    grandTotal: Math.max(0, Number(c.grandTotal || 0) + delta),
    breakupSummary: { ...c.breakupSummary, item_total: itemTotal == null ? itemTotal : Math.max(0, itemTotal + delta) },
    transactionIds: c.transactionIds.filter((id) => tids.has(id)),
  };
}

// Same shape as the website's fallback guest id.
const newGuestId = () => `guest_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

async function ensureGuestId() {
  let id = await getGuestId();
  if (!id) {
    id = newGuestId();
    await saveGuestId(id);
  }
  return id;
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { user, ready } = useAuth();
  const [cart, setCart] = useState<Cart>(EMPTY_CART);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const guestId = useRef<string | null>(null);
  const prevUserId = useRef<number | null>(null);
  // Bumped by every cart read and every change. A read only lands if nothing
  // newer has started since: the cart read takes 0.4-1.5 s, so without this a
  // read that began before a remove could answer after it and put the removed
  // line (or the old quantity) back on screen.
  const version = useRef(0);
  const settling = useRef(0);
  // The cart as last shown, for add() to see whether a line already exists.
  const cartRef = useRef(cart);
  useEffect(() => {
    cartRef.current = cart;
  }, [cart]);

  const gid = useCallback(async () => (guestId.current ??= await ensureGuestId()), []);

  const refresh = useCallback(async () => {
    const v = ++version.current;
    try {
      const next = await getCart(await gid());
      if (v === version.current) setCart(next);
      return next;
    } finally {
      setLoading(false);
    }
  }, [gid]);

  // Call before and after writing a change: reads already in flight (or
  // started while the write was on its way) are now out of date.
  const invalidate = () => void ++version.current;

  // After a change the server re-quotes with the seller (ONDC /select)
  // asynchronously; poll until they answer, then show the confirmed prices.
  // Skipped when the server says no re-quote is pending (e.g. the seller's
  // last line was removed), which used to hold "Confirming prices" and keep
  // checkout disabled for the full 20 s timeout.
  const settle = useCallback(
    async (t_ids: number[], selectPending = true) => {
      await refresh();
      if (!t_ids.length || !selectPending) return;
      settling.current += 1;
      setConfirming(true);
      try {
        await waitForSellers(t_ids, 'on_select');
        await refresh();
      } finally {
        // Overlapping changes each settle; the banner stays until the last.
        settling.current -= 1;
        if (!settling.current) setConfirming(false);
      }
    },
    [refresh],
  );

  // On login: fold the guest cart into the member cart, like the website does.
  useEffect(() => {
    if (!ready) return;
    (async () => {
      if (user && prevUserId.current !== user.id) {
        invalidate();
        await mergeGuestCart(await gid()).catch(() => {});
        invalidate();
      }
      prevUserId.current = user?.id ?? null;
      refresh().catch(() => {});
    })();
  }, [ready, user, gid, refresh]);

  // Adds to a line already in the cart. Shown at once; the seller re-quote
  // for the new quantity runs after.
  const bump = useCallback(
    async (line: CartLine, by: number, guest_id: string) => {
      invalidate();
      setCart((c) =>
        withLines(
          c,
          c.products.map((l) =>
            l.id === line.id ? { ...l, quantity: l.quantity + by, price: l.unit_price * (l.quantity + by) } : l,
          ),
        ),
      );
      try {
        const res = await updateQty({ item_id: line.id, increment_by: by, guest_id });
        invalidate();
        settle([line.t_id], res?.select_pending !== false).catch(() => {});
      } catch (e) {
        await refresh().catch(() => {});
        throw new Error(cartError(e).message);
      }
    },
    [refresh, settle],
  );

  const add = useCallback<CartState['add']>(
    async (p) => {
      const guest_id = await gid();
      // Already in the cart: the server would answer 409 and we'd read the
      // cart to find the line, three round trips in a row before anything
      // changed on screen. Go straight to the quantity update instead.
      const existing = cartRef.current.products.find((l) => l.product_variant_id === p.product_variant_id);
      if (existing) return bump(existing, p.quantity, guest_id);

      invalidate();
      try {
        const res = await addToCart({ ...p, guest_id });
        invalidate();
        settle([res.t_id], res.select_pending !== false).catch(() => {});
      } catch (e: any) {
        // In this seller's transaction but not in the cart we last read
        // (added from another device, say) → bump the quantity instead.
        if (e?.response?.status === 409 && e.response.data?.t_id && !e.response.data?.code) {
          const current = await refresh();
          const line = current.products.find((l) => l.product_variant_id === p.product_variant_id);
          if (line) return bump(line, p.quantity, guest_id);
        }
        throw new Error(cartError(e).message);
      }
    },
    [gid, refresh, settle, bump],
  );

  // Whether this variant is already a line in the cart.
  const has = useCallback((variantId: number) => cart.products.some((l) => l.product_variant_id === variantId), [cart]);

  const setQuantity = useCallback<CartState['setQuantity']>(
    async (line, quantity) => {
      // Optimistic so the stepper feels instant; the refresh corrects it.
      invalidate();
      setCart((c) =>
        withLines(
          c,
          c.products.map((l) => (l.id === line.id ? { ...l, quantity, price: l.unit_price * quantity } : l)),
        ),
      );
      try {
        const res = await updateQty({ item_id: line.id, quantity, guest_id: await gid() });
        invalidate();
        settle([line.t_id], res?.select_pending !== false).catch(() => {});
      } catch (e) {
        await refresh();
        throw new Error(cartError(e).message);
      }
    },
    [gid, refresh, settle],
  );

  const remove = useCallback<CartState['remove']>(
    async (line) => {
      invalidate();
      setCart((c) => withLines(c, c.products.filter((l) => l.id !== line.id)));
      let selectPending = false; // already gone (404): nothing to re-quote
      try {
        const res = await removeFromCart(line.id, line.t_id, await gid());
        invalidate();
        selectPending = res?.select_pending !== false;
      } catch (e: any) {
        if (e?.response?.status !== 404) {
          await refresh();
          throw new Error(cartError(e).message);
        }
      }
      settle([line.t_id], selectPending).catch(() => {});
    },
    [gid, refresh, settle],
  );

  const clear = useCallback(async () => {
    invalidate();
    await clearCart(await gid());
    invalidate();
    setCart(EMPTY_CART);
  }, [gid]);

  const count = useMemo(() => cart.products.reduce((n, l) => n + Number(l.quantity || 0), 0), [cart]);

  const value = useMemo(
    () => ({ cart, count, loading, confirming, refresh, add, has, setQuantity, remove, clear }),
    [cart, count, loading, confirming, refresh, add, has, setQuantity, remove, clear],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useCart must be used inside <CartProvider>');
  return ctx;
}
