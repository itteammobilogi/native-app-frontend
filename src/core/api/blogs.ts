import { ADMIN_API_URL } from '@/core/config';

import { api } from './client';

// ZillyBuy blog (website: /blogs, /blogs/[slug], /authors/[slug]); routes in
// website/node/ondc-zillybuy-node/routes/blogRoute.js.

export type BlogPost = {
  id: string;
  title: string;
  slug: string;
  short_description: string | null;
  featured_image: string | null;
  featured_image_alt: string | null;
  meta_description: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string | null;
  category_name: string | null;
  domain_slug: string | null;
  author_name: string | null;
  author_slug: string | null;
  author_bio: string | null;
  author_profile_photo: string | null;
};

export type BlogDetail = BlogPost & { content: string };

// Uploaded images live on the admin API host (website: ASSET_BASE). Author
// photos may be a bare filename, and legacy rows carry a localhost URL.
export function blogAsset(path?: string | null, folder = '') {
  const s = String(path ?? '').trim();
  if (!s) return null;
  const local = /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?(\/uploads\/.*)$/i.exec(s);
  if (local) return `${ADMIN_API_URL}${local[1]}`;
  if (/^https?:\/\//i.test(s)) return s;
  if (folder && !s.includes('/')) return `${ADMIN_API_URL}/uploads/${folder}/${s}`;
  return `${ADMIN_API_URL}${s.startsWith('/') ? '' : '/'}${s}`;
}

export const authorPhoto = (p?: string | null) => blogAsset(p, 'authors');

export const blogDate = (p: Pick<BlogPost, 'published_at' | 'created_at'>) => {
  const d = new Date(p.published_at || p.created_at);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

export async function listBlogs(page: number, limit = 10) {
  const { data } = await api.get<{ data: BlogPost[]; pagination: { page: number; totalPages: number } }>('/api/blogs', {
    params: { page, limit },
  });
  return { items: data.data ?? [], hasMore: page < (data.pagination?.totalPages ?? 0) };
}

export const getBlog = (slug: string) =>
  api.get<{ data: BlogDetail }>(`/api/blogs/blogs/${encodeURIComponent(slug)}`).then((r) => r.data.data);

// There is no working per-author endpoint in production; the website falls
// back to the full list filtered by author, and so does the app.
export async function getAuthorPosts(slug: string) {
  const { items } = await listBlogs(1, 200);
  return items.filter((p) => p.author_slug === slug);
}
