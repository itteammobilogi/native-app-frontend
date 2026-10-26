import { api } from './client';

// ZillyCart combos (website: /zillycart and /zillycart/[slug]). A combo is a
// curated list of products; buying it adds the chosen items to the normal
// cart one by one, each at its own price.

export type Combo = {
  zc_id: number;
  zc_name: string;
  zc_slug: string;
  zc_type: string | null;
  zc_image: string | null;
  zc_description: string | null;
  zc_actual_price: string;
  zc_offer_price: string;
  zc_cashback_amount?: string;
  zc_end_date?: string | null;
};

// One combo row joined with its product + variant; carries the same ONDC ids
// the product page sends to /cart/member/addproduct.
export type ComboItem = {
  zi_id: number;
  zi_quantity: number; // admin cap on how many of this item a shopper can add
  product_id: number;
  variant_id: number;
  name: string;
  brand_name: string | null;
  image: string | null;
  slug: string | null;
  price: string;
  max_value: string | null; // MRP
  bpp_id: number;
  sor_id: number;
  sor_value: string | null;
  product_value: string | null;
  sku: string | null;
  location_id: number;
  location_value: string;
  is_unavailable?: number;
};

export type ComboDetail = Combo & { items: ComboItem[] };

// The website falls back to the plural path when the singular one 404s.
async function getWithFallback<T>(path: string) {
  try {
    return (await api.get<{ data: T }>(`/api/zillycart${path}`)).data.data;
  } catch (e: any) {
    if (e?.response?.status !== 404) throw e;
    return (await api.get<{ data: T }>(`/api/zillycarts${path}`)).data.data;
  }
}

export const listCombos = () => getWithFallback<Combo[]>('').then((d) => d ?? []);

export const getCombo = (slug: string) => getWithFallback<ComboDetail>(`/${encodeURIComponent(slug)}`);

// Combo price as the website shows it: the offer price when set, else the
// actual price. Both are 0 on combos the admin hasn't priced.
export function comboPricing(c: Combo) {
  const actual = Number(c.zc_actual_price) || 0;
  const offer = Number(c.zc_offer_price) || 0;
  const price = offer > 0 ? offer : actual;
  const savings = Math.max(actual - price, 0);
  return { actual, price, savings, discount: actual > 0 && savings > 0 ? Math.round((savings / actual) * 100) : 0 };
}
