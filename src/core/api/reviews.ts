import { getToken } from '@/core/auth/storage';
import { API_BASE_URL } from '@/core/config';
import { api } from './client';

// Shapes from website/node/ondc-zillybuy-node/controllers/reviewController.js.
export type Review = {
  id: number;
  rating: number;
  title: string | null;
  body: string | null;
  is_verified_purchase: boolean;
  helpful_up: number;
  helpful_down: number;
  created_at: string;
  user_name: string | null;
  images: string[]; // "/uploads/reviews/…" relative to the API host
  my_vote: -1 | 0 | 1; // filled in when the request carries our token
};

export type ReviewSummary = {
  average_rating: number;
  total_ratings: number;
  histogram?: Record<string, number>;
  histogram_percent?: Record<string, number>;
  reviews_with_images?: number;
  // The website renders these when present (the API doesn't send them yet).
  tags?: { name: string; count?: number }[];
  summary_text?: string;
};

export type ReviewSort = 'recent' | 'helpful' | 'highest' | 'lowest';

export type ReviewsPage = {
  summary: ReviewSummary | null;
  reviews: Review[];
  pagination: { page: number; limit: number; total: number; total_pages: number };
};

export type MyReview = {
  id: number;
  rating: number;
  title: string | null;
  body: string | null;
  status: 'pending' | 'approved' | 'rejected';
  admin_note?: string | null;
  images: string[];
};

// Same rule as the website's reviewImageUrl.
export const reviewImageUrl = (path?: string | null) => {
  if (!path) return '';
  const p = String(path).trim();
  if (p.startsWith('http')) return p;
  return `${API_BASE_URL}${p.startsWith('/') ? '' : '/'}${p}`;
};

export async function getProductReviews(
  productId: number,
  { page = 1, limit = 10, sort = 'recent' }: { page?: number; limit?: number; sort?: ReviewSort } = {},
): Promise<ReviewsPage> {
  const { data } = await api.get(`/api/reviews/product/${productId}`, { params: { page, limit, sort } });
  return {
    summary: data?.summary ?? null,
    reviews: Array.isArray(data?.reviews) ? data.reviews : [],
    pagination: data?.pagination ?? { page, limit, total: 0, total_pages: 0 },
  };
}

export const getMyReview = (productId: number) =>
  api
    .get<{ review: MyReview | null }>(`/api/reviews/me/${productId}`)
    .then((r) => r.data.review ?? null)
    .catch(() => null);

export const voteReview = (reviewId: number, vote: 1 | -1) =>
  api
    .post<{ helpful_up: number; helpful_down: number; my_vote: -1 | 0 | 1 }>(`/api/reviews/${reviewId}/helpful`, { vote })
    .then((r) => r.data);

export type PickedImage = { uri: string; fileName?: string | null; mimeType?: string };

// Multipart upload. Uses fetch rather than axios: React Native's fetch builds
// the multipart boundary itself, which axios doesn't do reliably on RN.
// Submitting again replaces the user's existing review (back into moderation).
export async function submitReview(p: {
  product_id: number;
  rating: number;
  title?: string;
  body?: string;
  images?: PickedImage[];
}) {
  const form = new FormData();
  form.append('product_id', String(p.product_id));
  form.append('rating', String(p.rating));
  if (p.title) form.append('title', p.title);
  if (p.body) form.append('body', p.body);
  (p.images ?? []).slice(0, 5).forEach((img, i) => {
    const type = img.mimeType || 'image/jpeg';
    const ext = type.split('/')[1] || 'jpg';
    // RN's FormData accepts {uri, name, type} file descriptors.
    form.append('images', { uri: img.uri, name: img.fileName || `review-${i}.${ext}`, type } as unknown as Blob);
  });

  const token = await getToken();
  const res = await fetch(`${API_BASE_URL}/api/reviews`, {
    method: 'POST',
    headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      data?.message || data?.error || (res.status === 409 ? 'You have already reviewed this product.' : 'Failed to submit review.'),
    );
  }
  return data as { success: boolean; message?: string };
}
