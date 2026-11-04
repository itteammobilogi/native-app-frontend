import { listProducts, type ProductSummary } from '@/core/api/catalog';
import { getProductReviews } from '@/core/api/reviews';

// The product page's API takes ~1 s. The card the shopper tapped already has
// the name, image and price, so the page shows those at once while the full
// details load.
const previews = new Map<string, ProductSummary>();
const MAX = 50;

// First page sorted by "helpful": the rating pill and the Top reviews list.
// Same query as the website's ReviewsSection.
export const getTopReviews = (productId: number) => getProductReviews(productId, { limit: 2, sort: 'helpful' });

const GALLERY_LIMIT = 24;
export const getReviewGallery = (productId: number) => getProductReviews(productId, { limit: GALLERY_LIMIT, sort: 'recent' });

// "You may also like": the exact query the website's product page sends
// (utils/relatedProductsSsr.js).
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

// Remembers the tapped card for the product page it opens. A list row's id,
// domain_slug and category_slug are the detail's id, category and subcategory.
export function openingProduct(product: ProductSummary) {
  previews.delete(product.slug);
  previews.set(product.slug, product);
  if (previews.size > MAX) previews.delete(previews.keys().next().value!);
}

export const productPreview = (slug: string) => previews.get(slug);
