import { getSubcategories, listShopProducts, type Page, type ProductSummary, type Sort, type Subcategory } from '@/core/api/catalog';
import type { Filters } from '@/core/filters';

// A category's listing takes ~1 s when the backend's Redis has it and 10-13 s
// when it doesn't. The app keeps every listing page it fetched here, so going
// back into a category shows it at once, and the categories/home screens fetch
// every domain's first page ahead of the tap (prefetchShop), which also warms
// the backend cache for that exact query.

// Fresh pages are reused without asking again. Older ones are still shown at
// once (peekShopPage) while the screen fetches a fresh copy, up to STALE_MS.
const FRESH_MS = 5 * 60_000;
const STALE_MS = 30 * 60_000;
const MAX_ENTRIES = 60;

type Entry = { at: number; promise: Promise<Page<ProductSummary>>; value?: Page<ProductSummary> };
const pages = new Map<string, Entry>();

export const DEFAULT_SHOP_FILTERS: Filters = { sort: 'created_desc' };

// The query the shop screen sends, value for value like the website's shop
// listing (components/shop/SubCategory.js), so it shares that page's warm
// cache. It sends no in_stock at all unless filtered.
export const shopQuery = (domain: string, filters: Filters, page: number) => ({
  domain,
  subcategory: filters.category,
  status: 'all' as const,
  page,
  limit: 24,
  sort: filters.sort as Sort,
  min: filters.min,
  max: filters.max,
  in_stock: filters.inStock ? (1 as const) : undefined,
});

const keyOf = (domain: string, filters: Filters, page: number) => JSON.stringify(shopQuery(domain, filters, page));

function remember(key: string, entry: Entry) {
  pages.delete(key);
  pages.set(key, entry);
  if (pages.size > MAX_ENTRIES) pages.delete(pages.keys().next().value!);
}

// One listing page. Reuses a fresh or in-flight request for the same query;
// `fresh` (pull-to-refresh) always asks the server.
export function loadShopPage(domain: string, filters: Filters, page: number, fresh = false) {
  const key = keyOf(domain, filters, page);
  const hit = pages.get(key);
  if (!fresh && hit && Date.now() - hit.at < FRESH_MS) return hit.promise;

  const entry: Entry = { at: Date.now(), promise: listShopProducts(shopQuery(domain, filters, page)) };
  entry.promise.then(
    (value) => {
      entry.value = value;
    },
    () => {
      if (pages.get(key) === entry) pages.delete(key);
    },
  );
  remember(key, entry);
  return entry.promise;
}

// An already loaded first page to paint immediately, if there is one.
export function peekShopPage(domain: string, filters: Filters) {
  const hit = pages.get(keyOf(domain, filters, 1));
  return hit?.value && Date.now() - hit.at < STALE_MS ? hit.value : undefined;
}

const subs = new Map<string, { at: number; promise: Promise<Subcategory[]> }>();

// Subcategory chips change rarely; getSubcategories never rejects.
export function loadSubcategories(domain: string, fresh = false) {
  const hit = subs.get(domain);
  if (!fresh && hit && Date.now() - hit.at < STALE_MS) return hit.promise;
  const promise = getSubcategories(domain);
  subs.set(domain, { at: Date.now(), promise });
  return promise;
}

// Warms a domain's default listing (and its chips) ahead of the tap.
export function prefetchShop(domain: string) {
  if (!domain) return;
  loadShopPage(domain, DEFAULT_SHOP_FILTERS, 1).catch(() => {});
  loadSubcategories(domain);
}

// Every domain's first page, two at a time so the prefetch doesn't crowd out
// the requests the screen on display is making.
export async function prefetchAllShops(domains: string[]) {
  const queue = [...domains];
  const worker = async () => {
    for (let d = queue.shift(); d; d = queue.shift()) {
      await loadShopPage(d, DEFAULT_SHOP_FILTERS, 1).catch(() => {});
      await loadSubcategories(d);
    }
  };
  await Promise.all([worker(), worker()]);
}
