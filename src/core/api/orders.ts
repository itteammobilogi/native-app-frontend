import { fetch } from 'expo/fetch';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { getToken } from '@/core/auth/storage';
import { API_BASE_URL } from '@/core/config';

import type { Address } from './address';
import { api } from './client';

export type OrderItem = {
  id: number; // transaction item id (ti_id)
  t_id: number;
  title: string;
  image: string | null;
  slug: string | null;
  price: number;
  quantity: number;
  cancelledQuantity?: number;
  isCancelled?: boolean;
  variant_attributes?: { name: string; value: string }[];
  fulfillmentState?: string;
};

export type Order = {
  id: number; // internal id: tracking, invoice, cancel
  order_id: string; // ZB-… shown to the user
  createdAt: string; // dd-mm-yyyy
  order_state: string;
  items: OrderItem[];
  cancelled: boolean;
  amount: string;
  netAmount: string;
};

// "No orders" comes back as 404 — treat it as an empty list.
export const listOrders = () =>
  api
    .get<{ orders: Order[] }>('/api/orders/user/orders')
    .then((r) => r.data.orders ?? [])
    .catch((e) => {
      if (e?.response?.status === 404) return [] as Order[];
      throw e;
    });

export type ItemHistory = { id: number; status: string; timestamp: string };

export const getItemHistory = (tiId: number) =>
  api
    .get<{ itemHistory: ItemHistory[] }>(`/api/orders/item-history/${tiId}`)
    .then((r) => r.data.itemHistory ?? [])
    .catch(() => [] as ItemHistory[]);

export type Tracking = { fulfillmentId: string; trackingValue: string; trackingLink: string | null; isUrl: boolean };

export const getTracking = (orderId: number) =>
  api
    .get<{ tracking: Tracking[] }>(`/api/orders/orders/${orderId}/tracking`)
    .then((r) => r.data.tracking ?? [])
    .catch(() => [] as Tracking[]);

// The website offers the invoice only once an order is completed.
export const canDownloadInvoice = (o: Order) => !o.cancelled && o.order_state?.toLowerCase() === 'completed';

// GET /api/orders/invoice/:id streams a PDF behind auth, so it can't just be
// opened in the browser: fetch it with the token, save it to the cache and
// hand it to the share sheet (which offers "open in PDF viewer", save, send).
export async function downloadInvoice(orderId: number, orderRef: string) {
  const token = await getToken();
  const res = await fetch(`${API_BASE_URL}/api/orders/invoice/${orderId}`, {
    headers: { Accept: 'application/pdf', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
    throw new Error(body.message || body.error || 'Could not download the invoice.');
  }
  const file = new File(Paths.cache, `ZillyBuy-Invoice-${orderRef || orderId}.pdf`);
  if (file.exists) file.delete();
  file.write(await res.bytes());

  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device.');
  await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: 'Invoice' });
}

// ---- Checkout ----

// Binds the address to the cart's transactions and starts ONDC /init on the
// server. Passing an existing address id reuses it.
export const submitBilling = (address: Address, transactionIds: number[]) =>
  api
    .post<{ message: string; address_id: number }>('/api/products/cart/userCheckout', {
      id: address.id,
      name: address.name,
      email: address.email,
      phone: address.phone,
      house_name: address.house_name,
      building: address.building,
      locality: address.locality,
      city: address.city,
      state: address.state,
      country: address.country || 'India',
      area_code: address.area_code,
      tax_number: address.tax_number ?? null,
      is_default: address.is_default,
      transactionIds,
    })
    .then((r) => r.data);

export type CashfreeOrder = {
  payment_session_id: string | null;
  order_id: string;
  order_amount: number;
  discountAmount?: number;
  couponApplied?: boolean;
  free_order?: boolean;
};

export const createCashfreeOrder = (p: { transactionIds: number[]; selectedAddressId: number; couponCode?: string }) =>
  api.post<CashfreeOrder>('/api/payment/cashfree/order', { ...p, utm_source: 'app' }).then((r) => r.data);

export type CouponResult = { code: string; grandTotal: number; discountAmount: number; netAmount: number };

export const applyCoupon = (code: string, transactionIds: number[], selectedAddressId?: number) =>
  api
    .post<CouponResult & { success: boolean }>('/api/coupon/apply', { code, transactionIds, selectedAddressId })
    .then((r) => r.data);
