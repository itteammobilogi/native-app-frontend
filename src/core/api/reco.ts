import type { ProductSummary } from './catalog';
import { api } from './client';

// "Picked for you", the website's home strip (components/reco/ForYouStrip.js):
// products from the shopper's own past orders, via GET /api/reco/for-you. The
// client sends the login token. A shopper who isn't logged in or has no
// orders gets no rows back.
// Like the website's fetchForYou, it never rejects: a strip that can't load
// just doesn't show.
export async function getForYou(limit = 12): Promise<ProductSummary[]> {
  try {
    const { data } = await api.get('/api/reco/for-you', { params: { limit } });
    const rows: ProductSummary[] = Array.isArray(data?.rows) ? data.rows : [];
    return rows.filter((p) => typeof p?.slug === 'string' && p.slug.trim().length > 0);
  } catch {
    return [];
  }
}
