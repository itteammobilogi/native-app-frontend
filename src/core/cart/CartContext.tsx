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
  setQuantity: (line: CartLine, quantity: number) => Promise<void>;
  remove: (line: CartLine) => Promise<void>;
  clear: () => Promise<void>;
};

const Ctx = createContext<CartState | null>(null);

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

  const gid = useCallback(async () => (guestId.current ??= await ensureGuestId()), []);

  const refresh = useCallback(async () => {
    try {
      const next = await getCart(await gid());
      setCart(next);
      return next;
    } finally {
      setLoading(false);
    }
  }, [gid]);

  // After any change the server re-quotes with each seller (ONDC /select)
  // asynchronously; poll until they answer, then show the confirmed prices.
  const settle = useCallback(
    async (t_ids: number[]) => {
      await refresh();
      if (!t_ids.length) return;
      setConfirming(true);
      try {
        await waitForSellers(t_ids, 'on_select');
        await refresh();
      } finally {
        setConfirming(false);
      }
    },
    [refresh],
  );

  // On login: fold the guest cart into the member cart, like the website does.
  useEffect(() => {
    if (!ready) return;
    (async () => {
      if (user && prevUserId.current !== user.id) {
        await mergeGuestCart(await gid()).catch(() => {});
      }
      prevUserId.current = user?.id ?? null;
      refresh().catch(() => {});
    })();
  }, [ready, user, gid, refresh]);

  const add = useCallback<CartState['add']>(
    async (p) => {
      const guest_id = await gid();
      try {
        const res = await addToCart({ ...p, guest_id });
        settle([res.t_id]).catch(() => {});
      } catch (e: any) {
        // Already in this seller's transaction → bump the quantity instead.
        if (e?.response?.status === 409 && e.response.data?.t_id && !e.response.data?.code) {
          const current = await refresh();
          const line = current.products.find((l) => l.product_variant_id === p.product_variant_id);
          if (line) {
            await updateQty({ item_id: line.id, increment_by: p.quantity, guest_id });
            settle([line.t_id]).catch(() => {});
            return;
          }
        }
        throw new Error(cartError(e).message);
      }
    },
    [gid, refresh, settle],
  );

  const setQuantity = useCallback<CartState['setQuantity']>(
    async (line, quantity) => {
      // Optimistic so the stepper feels instant; the refresh corrects it.
      setCart((c) => ({
        ...c,
        products: c.products.map((l) => (l.id === line.id ? { ...l, quantity, price: l.unit_price * quantity } : l)),
      }));
      try {
        await updateQty({ item_id: line.id, quantity, guest_id: await gid() });
        settle([line.t_id]).catch(() => {});
      } catch (e) {
        await refresh();
        throw new Error(cartError(e).message);
      }
    },
    [gid, refresh, settle],
  );

  const remove = useCallback<CartState['remove']>(
    async (line) => {
      setCart((c) => ({ ...c, products: c.products.filter((l) => l.id !== line.id) }));
      try {
        await removeFromCart(line.id, line.t_id, await gid());
      } catch (e: any) {
        if (e?.response?.status !== 404) {
          await refresh();
          throw new Error(cartError(e).message);
        }
      }
      settle([line.t_id]).catch(() => {});
    },
    [gid, refresh, settle],
  );

  const clear = useCallback(async () => {
    await clearCart(await gid());
    setCart(EMPTY_CART);
  }, [gid]);

  const count = useMemo(() => cart.products.reduce((n, l) => n + Number(l.quantity || 0), 0), [cart]);

  const value = useMemo(
    () => ({ cart, count, loading, confirming, refresh, add, setQuantity, remove, clear }),
    [cart, count, loading, confirming, refresh, add, setQuantity, remove, clear],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useCart must be used inside <CartProvider>');
  return ctx;
}
