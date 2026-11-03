import { getProduct, listProducts, type ProductSummary } from '@/core/api/catalog';
import { getProductReviews } from '@/core/api/reviews';
import { prefetch } from '@/core/hooks/useAsync';

// The product page's API takes ~1 s. The card the shopper tapped already has
// the name, image and price, so the page shows those at once while the full
// details load, and the request starts on press-in rather than after the tap.
const previews = new Map<string, ProductSummary>();
const MAX = 50;

export const PRODUCT_CACHE = { key: 'product' } as const;
export const TOP_REVIEWS_CACHE = { key: 'product:top-reviews' } as const;
export const REVIEW_GALLERY_CACHE = { key: 'product:review-gallery' } as const;
export const RELATED_CACHE = { key: 'product:related' } as const;

// First page sorted by "helpful": the rating pill and the Top reviews list.
// Same query as the website's ReviewsSection.
export const getTopReviews = (productId: number) => getProductReviews(productId, { limit: 2, sort: 'helpful' });

const GALLERY_LIMIT = 24;
export const getReviewGallery = (productId: number) => getProductReviews(productId, { limit: GALLERY_LIMIT, sort: 'recent' });

// "You may also like": the exact query the website's product page sends
// (utils/relatedProductsSsr.js), so it is answered from the backend's warm
// cache instead of a 10 s miss (see listProducts).
const RELATED_SHOWN = 12;
export const getRelated = (domain: string | null | undefined, subcategory: string | null | undefined, slug: string) =>
  domain
    ? listProducts({
        domain,
        category: subcategory ?? undefined,
        page: 1,
        limit: 20,
        sort: 'created_desc',
        available_only: 1,
      }).then((r) => r.items.filter((x) => x.slug !== slug).slice(0, RELATED_SHOWN))
    : Promise.resolve([]);

// Everything the product page loads, started together on press-in instead of
// one after another once the details arrive. A list row's id, domain_slug and
// category_slug are the detail's id, category and subcategory, so the page's
// requests (same cache keys and deps) join these instead of starting over.
export function openingProduct(product: ProductSummary) {
  previews.delete(product.slug);
  previews.set(product.slug, product);
  if (previews.size > MAX) previews.delete(previews.keys().next().value!);
  prefetch(PRODUCT_CACHE, [product.slug], () => getProduct(product.slug));
  prefetch(TOP_REVIEWS_CACHE, [product.id], () => getTopReviews(product.id));
  prefetch(REVIEW_GALLERY_CACHE, [product.id], () => getReviewGallery(product.id));
  const related = [product.domain_slug ?? null, product.category_slug ?? null, product.slug] as const;
  prefetch(RELATED_CACHE, [...related], () => getRelated(...related));
}

export const productPreview = (slug: string) => previews.get(slug);
