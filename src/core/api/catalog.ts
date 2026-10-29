import { create } from 'axios';

import { ADMIN_API_URL, WEBSITE_URL } from '@/core/config';
import { isProductUnavailable } from '@/core/pricing';
import { api } from './client';

// Listing row from /api/products/list-products (prices are decimal strings).
export type ProductSummary = {
  id: number; // group id
  slug: string;
  name: string;
  image: string | null;
  price: string | number | null;
  value?: string | number | null;
  max_value?: string | number | null;
  mrp?: string | number | null;
  quantity?: number | null;
  is_unavailable?: 0 | 1 | boolean;
  brand_name?: string | null;
  category_name?: string | null;
  domain_slug?: string | null;
  is_assured?: 0 | 1;
};

export type Variant = {
  id: number; // product_variant_id for the cart
  slug: string;
  name: string;
  price: string | number;
  max_value?: string | number | null;
  image?: string | null; // JSON-string array or a single URL
  quantity?: number | null;
  max_qty_per_order?: number | null;
  qty_limit?: { max: number; reason: string } | null;
  location_id: number;
  location_value: string;
  product_value: string; // ONDC item id
  variant_attributes?: { name: string; value: string }[];
  info_attributes?: { name: string; value: string }[];
  returnable?: boolean | number | null;
  cancellable?: boolean | number | null;
};

export type ProductDetail = {
  id: number;
  selected_variant_id?: number;
  name: string;
  short_desc?: string | null;
  long_desc?: string | null;
  image?: string | null;
  images?: unknown;
  carousel_images?: unknown;
  bpp_id: number;
  sor_id: number;
  sor_value?: string | null;
  brand_name?: string | null;
  brand_slug?: string | null;
  subcategory?: string | null;
  category?: string | null;
  availability?: string;
  is_assured?: 0 | 1;
  returnable?: boolean | number | null;
  cancellable?: boolean | number | null;
  max_value?: number | null;
  bpp_status?: number;
  provider_is_disabled?: number;
  manufacturer?: {
    name?: string;
    address?: string;
    country?: string;
    consumer_care?: { name?: string; email?: string; phone?: string };
  } | null;
  variants: Variant[];
};

export type Banner = { id: number; title?: string; link_url?: string; image: string };
export type QuickFilter = { id: number; title: string; subtitle?: string; href: string; icon_name?: string; bg_from?: string; bg_to?: string };
export type Domain = { id: number; slug: string; name: string };
export type Subcategory = { id: number; category_name: string; slug: string; product_count: number };

// Banners/quick filters live on the separate admin API (prodadapi), same as
// the website's home page.
const admin = create({ baseURL: ADMIN_API_URL, timeout: 15000 });

const https = (u?: string | null) => (u ? u.replace(/^http:\/\//, 'https://') : null);

// Site-relative assets (e.g. /category/electronics.webp) are served by the website.
export const absUrl = (u?: string | null) => {
  if (!u) return null;
  if (/^https?:\/\//.test(u)) return https(u);
  return `${WEBSITE_URL}${u.startsWith('/') ? '' : '/'}${u}`;
};

export async function getBanners(): Promise<Banner[]> {
  const { data } = await admin.get('/active-banners');
  return (data?.data ?? [])
    .map((b: any) => ({ id: b.id, title: b.title, link_url: b.link_url, image: https(b.mobile_image || b.desktop_image) }))
    .filter((b: Banner) => !!b.image);
}

export async function getQuickFilters(): Promise<QuickFilter[]> {
  const { data } = await admin.get('/home/active-quick-filters');
  return data?.data ?? [];
}

// Domain display names/images. The API names some domains tersely ("BPC"),
// and the website shows its own artwork for each tile.
export const DOMAIN_META: Record<string, { name: string; image: string; icon: string }> = {
  electronics: { name: 'Electronics', image: '/category/electronics.webp', icon: 'phone-portrait-outline' },
  bpc: { name: 'Beauty & Personal Care', image: '/category/beauty-personal-care.webp', icon: 'sparkles-outline' },
  'home-kitchen': { name: 'Home & Kitchen', image: '/category/home-kitchen.webp', icon: 'home-outline' },
  fashion: { name: 'Fashion', image: '/category/fashion.webp', icon: 'shirt-outline' },
  'health-wellness': { name: 'Health & Wellness', image: '/category/health-wellness.webp', icon: 'fitness-outline' },
  appliances: { name: 'Appliances', image: '/category/Appliances.webp', icon: 'tv-outline' },
  grocery: { name: 'Grocery', image: '/category/grocery.webp', icon: 'basket-outline' },
};

const FALLBACK_DOMAINS: Domain[] = Object.entries(DOMAIN_META).map(([slug, m], i) => ({ id: -i - 1, slug, name: m.name }));

export async function getDomains(): Promise<Domain[]> {
  try {
    const { data } = await api.get('/api/categories/domains');
    const list: Domain[] = data?.domains ?? [];
    return list.length ? list : FALLBACK_DOMAINS;
  } catch {
    return FALLBACK_DOMAINS;
  }
}

export const domainName = (d: Domain) => DOMAIN_META[d.slug]?.name ?? d.name;

export async function getSubcategories(domain: string): Promise<Subcategory[]> {
  try {
    const { data } = await api.get('/api/categories/subcategories', { params: { domain } });
    return (Array.isArray(data) ? data : []).filter((s: Subcategory) => Number(s.product_count) > 0);
  } catch {
    return [];
  }
}

export type Sort = 'created_desc' | 'price_asc' | 'price_desc';

export type ListParams = {
  domain?: string;
  subcategory?: string;
  sort?: Sort;
  page?: number;
  limit?: number;
  min?: number;
  max?: number;
  in_stock?: 1;
  available_only?: 1;
  is_featured?: 1;
  is_exclusive_deals?: 1;
  name?: string;
};

export type Page<T> = { items: T[]; page: number; hasMore: boolean; total: number };

export async function listProducts(params: ListParams): Promise<Page<ProductSummary>> {
  const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''));
  const { data } = await api.get('/api/products/list-products', { params: { limit: 24, ...clean } });
  const page = Number(data?.page ?? params.page ?? 1);
  const totalPages = Number(data?.totalPages ?? 1);
  return {
    items: data?.rows ?? data?.data ?? [],
    page,
    hasMore: data?.hasMore ?? page < totalPages,
    total: Number(data?.total ?? 0),
  };
}

// Same fallback as the website's Deals of the Day strip.
export async function getDeals() {
  const deals = await listProducts({ is_exclusive_deals: 1, available_only: 1, limit: 12 });
  if (deals.items.length) return deals.items;
  return (await listProducts({ is_featured: 1, available_only: 1, limit: 12 })).items;
}

export const getTrending = () => listProducts({ is_featured: 1, limit: 12 }).then((p) => p.items);

// Banner/quick-filter collections: /adds/banner-products/<slug> on the site.
export async function getCollection(slug: string, page = 1): Promise<Page<ProductSummary> & { title?: string }> {
  const { data } = await admin.get(`/${encodeURIComponent(slug)}/products`, { params: { page, limit: 24 } });
  const rows: any[] = data?.rows ?? [];
  const total = Number(data?.count ?? data?.total ?? data?.totalCount ?? data?.pagination?.total ?? 0);
  return {
    title: data?.banner?.title,
    // These rows carry the selling price as `value`, not `price`.
    items: rows.map((r) => ({ ...r, price: r.price ?? r.value })),
    page,
    hasMore: total ? page * 24 < total : rows.length === 24,
    total,
  };
}

export type SearchResult = {
  products: ProductSummary[];
  categories: { id: number; name: string; category_slug: string; domain_slug: string }[];
  brands: { id: number; name: string; slug: string }[];
  nextAfter: number | null;
};

export async function search(q: string, limit = 24, after = 0, signal?: AbortSignal): Promise<SearchResult> {
  const { data } = await api.get('/api/products/search', { params: { q, limit, after }, signal });
  return {
    products: data?.products ?? [],
    categories: data?.categories ?? [],
    brands: data?.brands ?? [],
    nextAfter: data?.nextAfter ?? null,
  };
}

export async function getProduct(slug: string): Promise<ProductDetail> {
  const { data } = await api.get(`/api/products/single/product/${encodeURIComponent(slug)}`);
  return data;
}

// Port of the website's parseMediaList: arrays, JSON strings, objects or CSV,
// keeping only http(s) URLs.
export function parseMedia(v: unknown): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.flatMap(parseMedia);
  if (typeof v === 'object') return Object.values(v as object).flatMap(parseMedia);
  if (typeof v !== 'string') return [];
  const s = v.trim();
  if (s.startsWith('[') || s.startsWith('{')) {
    try {
      return parseMedia(JSON.parse(s));
    } catch {
      /* fall through to CSV */
    }
  }
  return s
    .split(',')
    .map((x) => x.trim())
    .filter((x) => /^https?:\/\//.test(x))
    .map((x) => https(x) as string);
}

export function productGallery(p: ProductDetail, variant?: Variant | null) {
  const urls = [...parseMedia(variant?.image), ...parseMedia(p.carousel_images), ...parseMedia(p.images), ...parseMedia(p.image)];
  return [...new Set(urls)];
}

// A variant can't be bought when the seller is off, it's out of stock, or it
// has no price.
export const variantUnavailable = (p: ProductDetail, v?: Variant | null) =>
  !v ||
  isProductUnavailable({ bpp_status: p.bpp_status, provider_is_disabled: p.provider_is_disabled, quantity: v.quantity }) ||
  !(Number(v.price) > 0);

// long_desc may be plain text, HTML or a JSON {"blocks":[{text}]} string.
export function plainText(v?: string | null) {
  if (!v) return '';
  let s = v;
  if (s.trim().startsWith('{')) {
    try {
      const j = JSON.parse(s);
      if (Array.isArray(j?.blocks)) s = j.blocks.map((b: any) => b?.text ?? '').join('\n');
    } catch {
      /* keep as is */
    }
  }
  return s
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|li|div|h\d)>/gi, '\n')
    .replace(/<li>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
