import { create } from 'axios';

import { ADMIN_API_URL } from '@/core/config';
import type { Banner, Page, ProductSummary } from './catalog';
import { api } from './client';

// NavBharat (Made-in-India) storefront, same sources as the website's
// pages/navbharat: banners on the admin API, catalog on /api/navbharat.
const admin = create({ baseURL: ADMIN_API_URL, timeout: 15000 });

export type NavbharatCategory = {
  category_id: number;
  category_name: string;
  category_slug: string;
  domain_slug: string;
  domain_name: string;
  product_count: number;
};

export type NavbharatDomain = { slug: string; name: string; count: number };

const PAGE = 24;

// Website label overrides for terse domain names.
const DOMAIN_LABELS: Record<string, string> = {
  bpc: 'Beauty & Personal Care',
  'home-kitchen': 'Home & Kitchen',
  'health-wellness': 'Health & Wellness',
  'automotives-components-accessories': 'Automotive',
};

export async function getNavbharatBanners(): Promise<Banner[]> {
  const { data } = await admin.get('/active-navbharat-banners');
  return (data?.data ?? [])
    .filter((b: any) => b.mobile_image || b.desktop_image)
    .sort((a: any, b: any) => Number(a.position ?? 0) - Number(b.position ?? 0))
    .map((b: any) => ({
      id: b.id,
      title: b.title,
      link_url: b.link_url,
      image: String(b.mobile_image || b.desktop_image).replace(/^http:\/\//, 'https://'),
    }));
}

export async function getNavbharatCategories(): Promise<NavbharatCategory[]> {
  const { data } = await api.get('/api/navbharat/categories');
  return data?.categories ?? [];
}

// Domains ordered by how many NavBharat products they hold (website order).
export function groupDomains(categories: NavbharatCategory[]): NavbharatDomain[] {
  const map = new Map<string, NavbharatDomain>();
  for (const c of categories) {
    const d = map.get(c.domain_slug) ?? { slug: c.domain_slug, name: DOMAIN_LABELS[c.domain_slug] ?? c.domain_name, count: 0 };
    d.count += Number(c.product_count) || 0;
    map.set(c.domain_slug, d);
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

export async function listNavbharat({
  domain_slug,
  category_slug,
  deals,
  name,
  page = 1,
  limit = PAGE,
}: {
  domain_slug?: string;
  category_slug?: string;
  deals?: boolean;
  name?: string;
  page?: number;
  limit?: number;
}): Promise<Page<ProductSummary>> {
  // /api/navbharat/products ignores is_navbharat_deals, so deals come from
  // list-products with the NavBharat flags (website: pages/navbharat/deals.js).
  if (deals) {
    const { data } = await api.get('/api/products/list-products', {
      params: { is_navbharat: 1, msme_scope: 'all', is_navbharat_deals: 1, sort: 'featured', limit, page, ...(name ? { name } : {}) },
    });
    const totalPages = Number(data?.totalPages ?? 1);
    return { items: data?.rows ?? [], page, hasMore: data?.hasMore ?? page < totalPages, total: Number(data?.total ?? 0) };
  }

  const offset = (page - 1) * limit;
  const { data } = await api.get('/api/navbharat/products', {
    params: {
      sort: 'featured',
      limit,
      offset,
      ...(domain_slug ? { domain_slug } : {}),
      ...(category_slug ? { category_slug } : {}),
      ...(name ? { name } : {}),
    },
  });
  const items: ProductSummary[] = data?.products ?? [];
  const total = Number(data?.total ?? 0);
  return { items, page, hasMore: offset + items.length < total, total };
}
