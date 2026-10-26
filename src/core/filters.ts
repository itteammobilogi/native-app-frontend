import type { ProductSummary } from '@/core/api/catalog';
import { computeProductPrice, isProductUnavailable } from '@/core/pricing';

// Filter state shared by every product listing's filter drawer. Listings
// backed by list-products send these to the API; the brand and collection
// endpoints have no filters, so those screens run them on the loaded rows.
export type Filters = {
  sort: string;
  min?: number;
  max?: number;
  inStock?: boolean;
  onSale?: boolean;
  category?: string;
};

export type Option = { value: string; label: string };

export const PRICE_PRESETS: { label: string; min?: number; max?: number }[] = [
  { label: 'Under ₹500', max: 500 },
  { label: '₹500 – ₹1,000', min: 500, max: 1000 },
  { label: '₹1,000 – ₹5,000', min: 1000, max: 5000 },
  { label: '₹5,000 – ₹10,000', min: 5000, max: 10000 },
  { label: 'Above ₹10,000', min: 10000 },
];

export const SERVER_SORTS: Option[] = [
  { value: 'created_desc', label: 'Newest' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
];

export const LOCAL_SORTS: Option[] = [
  { value: 'popular', label: 'Popular' },
  { value: 'discount', label: 'Biggest discount' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
];

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;

export function priceLabel(min?: number, max?: number) {
  const preset = PRICE_PRESETS.find((p) => p.min === min && p.max === max);
  if (preset) return preset.label;
  if (min != null && max != null) return `${inr(min)} – ${inr(max)}`;
  if (min != null) return `Above ${inr(min)}`;
  if (max != null) return `Under ${inr(max)}`;
  return null;
}

// Number of filters that differ from the defaults (sort excluded).
export const activeFilterCount = (f: Filters) =>
  Number(f.min != null || f.max != null) + Number(!!f.inStock) + Number(!!f.onSale) + Number(!!f.category);

type Row = { p: ProductSummary; price: ReturnType<typeof computeProductPrice>; off: boolean };

const BY: Record<string, (a: Row, b: Row) => number> = {
  popular: () => 0,
  discount: (a, b) => b.price.discountPercent - a.price.discountPercent,
  price_asc: (a, b) => a.price.price - b.price.price,
  price_desc: (a, b) => b.price.price - a.price.price,
};

// Like the website's brands/[slug]: filter and sort the loaded rows,
// unavailable items last.
export function filterLocally(items: ProductSummary[], f: Filters) {
  const rows: Row[] = items.map((p) => ({ p, price: computeProductPrice(p), off: isProductUnavailable(p) }));
  const kept = rows.filter(
    (r) =>
      (!f.onSale || r.price.hasDiscount) &&
      (!f.inStock || !r.off) &&
      (f.min == null || r.price.price >= f.min) &&
      (f.max == null || r.price.price <= f.max),
  );
  const by = BY[f.sort] ?? BY.popular;
  return [...kept].sort((a, b) => Number(a.off) - Number(b.off) || by(a, b)).map((r) => r.p);
}
