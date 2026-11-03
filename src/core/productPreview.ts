import { getProduct, type ProductSummary } from '@/core/api/catalog';
import { prefetch } from '@/core/hooks/useAsync';

// The product page's API takes ~2 s. The card the shopper tapped already has
// the name, image and price, so the page shows those at once while the full
// details load, and the request starts on press-in rather than after the tap.
const previews = new Map<string, ProductSummary>();
const MAX = 50;

export const PRODUCT_CACHE = { key: 'product' } as const;

export function openingProduct(product: ProductSummary) {
  previews.delete(product.slug);
  previews.set(product.slug, product);
  if (previews.size > MAX) previews.delete(previews.keys().next().value!);
  prefetch(PRODUCT_CACHE, [product.slug], () => getProduct(product.slug));
}

export const productPreview = (slug: string) => previews.get(slug);
