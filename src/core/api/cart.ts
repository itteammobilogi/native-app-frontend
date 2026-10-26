import { api } from './client';

// The cart lives on the server (controllers/cartController.js), one
// transaction (t_id) per seller store. Guests are identified by a guest_id we
// generate and always send — the website sends it even when logged in.

export type CartLine = {
  id: number; // transaction_items.id
  t_id: number;
  product_variant_id: number;
  title: string;
  image: string | null;
  slug: string | null;
  unit_price: number;
  quantity: number;
  price: number;
  is_unavailable: boolean;
  is_over_limit?: boolean;
  qty_limit?: { max: number; reason: string } | null;
  quote_state?: 'fresh' | 'expired' | 'awaiting' | 'blocked' | 'missing';
  variant_attributes?: { name: string; value: string }[];
  expected_delivery_date?: string | null; // "DD-MM-YYYY"
  product_value?: string; // ONDC item id, matches @ondc/org/item_id in the quote
  // The seller's whole ONDC quote for this line's transaction (same array on
  // every line of one t_id): items, delivery, tax, misc, discount.
  price_breakup_raw?: QuoteEntry[];
};

export type QuoteEntry = {
  '@ondc/org/item_id'?: string;
  '@ondc/org/title_type'?: string;
  title_type?: string;
  title?: string;
  price?: { currency?: string; value?: string | number };
};

export type Cart = {
  products: CartLine[];
  breakupSummary: { item_total?: number; delivery?: number; misc?: number; tax?: number; discount?: number };
  grandTotal: number;
  transactionIds: number[];
  someUnavailable?: boolean;
  someExpired?: boolean;
  someOverLimit?: boolean;
  message?: string | null;
};

export const EMPTY_CART: Cart = { products: [], breakupSummary: {}, grandTotal: 0, transactionIds: [] };

export const getCart = (guest_id: string) =>
  api.post<Cart>('/api/products/cart/user', { guest_id }).then((r) => ({ ...EMPTY_CART, ...r.data }));

export type AddPayload = {
  product_variant_id: number;
  product_value: string;
  bpp_id: number;
  sor_id: number;
  sor_value?: string | null;
  location_id: number;
  location_value: string;
  quantity: number;
  price: number;
  pincode_id: number;
  guest_id: string;
};

export const addToCart = (p: AddPayload) =>
  api
    .post<{ success: boolean; message: string; t_id: number }>('/api/products/cart/member/addproduct', {
      ...p,
      utm_source: 'app',
    })
    .then((r) => r.data);

export const updateQty = (p: { item_id: number; guest_id: string } & ({ quantity: number } | { increment_by: number })) =>
  api.post('/api/products/cart/update-qty', p).then((r) => r.data);

export const removeFromCart = (itemId: number, transactionId: number, guest_id: string) =>
  api.post('/api/products/cart/remove/cart', { itemId, transactionId, guest_id }).then((r) => r.data);

export const clearCart = (guest_id: string) =>
  api.post('/api/products/cart/clear/cart', { guest_id }).then((r) => r.data);

export const mergeGuestCart = (guest_id: string) =>
  api.post('/api/products/cart/merge', { guest_id }).then((r) => r.data);

export type WebhookResult = {
  t_id: number;
  received: boolean;
  success_flag: 'ACK' | 'NACK' | null;
  error: string | null;
  created_at: string | null;
};

export const webhookStatus = (t_ids: number[], endpoint: 'on_select' | 'on_init') =>
  api
    .post<{ results: WebhookResult[] }>('/api/products/cart/webhook-status', { t_ids, endpoint })
    .then((r) => r.data.results ?? []);

// Polls until every seller has answered (or we give up). Mirrors the website's
// useSelectWait (2.5s × 20s for select) and checkout (5s × 60s for init).
export async function waitForSellers(
  t_ids: number[],
  endpoint: 'on_select' | 'on_init',
  { interval = endpoint === 'on_init' ? 5000 : 2500, timeout = endpoint === 'on_init' ? 60000 : 20000, since = 0 } = {},
) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    await new Promise((r) => setTimeout(r, interval));
    try {
      const results = (await webhookStatus(t_ids, endpoint)).filter(
        // Ignore answers to an earlier round (e.g. after changing address).
        (r) => !since || !r.created_at || new Date(r.created_at).getTime() >= since - 10000,
      );
      const nacked = results.filter((r) => r.success_flag === 'NACK').map((r) => r.t_id);
      if (nacked.length) return { done: true, nacked, timedOut: false };
      if (results.length >= t_ids.length && results.every((r) => r.received)) {
        return { done: true, nacked: [], timedOut: false };
      }
    } catch {
      /* transient — keep polling */
    }
  }
  return { done: false, nacked: [], timedOut: true };
}

// Pull a readable message + code out of a cart/checkout error response.
export function cartError(err: any): { code?: string; message: string } {
  const d = err?.response?.data;
  return { code: d?.code ?? d?.errorCode, message: d?.error || d?.message || 'Could not update your cart.' };
}
