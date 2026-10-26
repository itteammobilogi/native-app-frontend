import { ADMIN_API_URL } from '@/core/config';
import type { Page, ProductSummary } from './catalog';
import { api } from './client';

// Shapes from GET /api/brands/getallbrands and /api/brands/:slug/products-catalog
// (website: pages/brands/index.js and brands/[slug].js).
export type Brand = {
  id: number;
  name: string;
  slug: string;
  logo?: string | null;
  description?: string | null;
};

const BRANDS_PAGE = 30;
const PRODUCTS_PAGE = 24;

// Brand logos are stored with the API host but served by the admin API, so
// the website rebases every logo path onto it; do the same.
export const brandLogoUrl = (logo?: string | null) => {
  if (!logo) return null;
  const path = logo.replace(/^https?:\/\/[^/]+/i, '');
  return `${ADMIN_API_URL}${path.startsWith('/') ? '' : '/'}${path}`;
};

// All active brands (the API lists featured ones first); `featured` limits it
// to the curated set the home strip shows, `q` searches by name.
export async function listBrands({
  q,
  page = 1,
  featured,
  limit = BRANDS_PAGE,
}: {
  q?: string;
  page?: number;
  featured?: boolean;
  limit?: number;
}): Promise<Page<Brand>> {
  const { data } = await api.get('/api/brands/getallbrands', {
    params: { status: 1, page, limit, ...(q ? { q } : {}), ...(featured ? { is_featured: 1 } : {}) },
  });
  const pages = Number(data?.meta?.pages ?? 1);
  return { items: data?.rows ?? [], page, hasMore: page < pages, total: Number(data?.meta?.total ?? 0) };
}

export async function getBrandCatalog(slug: string, page = 1): Promise<Page<ProductSummary> & { brand: Brand | null }> {
  const { data } = await api.get(`/api/brands/${encodeURIComponent(slug)}/products-catalog`, {
    params: { page, limit: PRODUCTS_PAGE },
  });
  const rows: any[] = data?.products ?? [];
  return {
    brand: data?.brand ?? null,
    // This endpoint sends the selling price as `value`, not `price`.
    items: rows.map((r) => ({ ...r, price: r.price ?? r.value })),
    page,
    hasMore: !!data?.meta?.has_next,
    total: Number(data?.meta?.total ?? rows.length),
  };
}
