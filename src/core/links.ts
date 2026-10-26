import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';

import { POLICIES } from '@/core/api/support';
import { WEBSITE_URL } from '@/core/config';

// Website domain slugs as used in /navbharat/<slug> (website: navbharat/[slug].js);
// any other slug there is a category.
const NAVBHARAT_DOMAINS = new Set([
  'bpc',
  'fashion',
  'grocery',
  'home-kitchen',
  'appliances',
  'electronics',
  'health-wellness',
  'automotives-components-accessories',
]);

// Banners and quick filters link to website paths (absolute or relative).
// Open the matching app screen; only paths the app has no screen for fall
// back to the in-app browser.
export function openSiteLink(url?: string | null) {
  if (!url) return;
  let path = url.trim();
  const m = path.match(/^https?:\/\/(www\.)?zillybuy\.com(\/.*)?$/i);
  if (m) path = m[2] || '/';
  if (/^https?:\/\//i.test(path)) {
    WebBrowser.openBrowserAsync(path).catch(() => {});
    return;
  }
  const [pathname, query = ''] = path.split('?');
  const parts = pathname.split('/').filter(Boolean);
  const qs = new URLSearchParams(query);
  const [first, second, third] = parts;

  if (parts.length === 0) return router.push('/');

  if (first === 'product' && second) {
    return router.push({ pathname: '/product/[slug]', params: { slug: second } });
  }
  if (first === 'shop' && second) {
    // The website routes beauty as beauty-and-personal-care; the API slug is bpc.
    const domain = /beauty/.test(second) ? 'bpc' : second;
    return router.push({ pathname: '/shop/[domain]', params: { domain } });
  }
  if (first === 'shop' && qs.get('category')) {
    return router.push({ pathname: '/shop/[domain]', params: { domain: qs.get('category')! } });
  }
  if (first === 'shop') return router.push('/categories');
  if (first === 'adds' && second === 'banner-products' && third) {
    return router.push({ pathname: '/collection/[slug]', params: { slug: third } });
  }
  if (first === 'exclusive-deals') {
    return router.push({ pathname: '/products', params: { flag: 'deals', title: 'Exclusive Deals' } });
  }
  if (first === 'featured-deals') {
    return router.push({ pathname: '/products', params: { flag: 'featured', title: 'Featured Products' } });
  }
  if (first === 'navbharat') {
    if (second === 'deals') return router.push({ pathname: '/navbharat', params: { deals: '1' } });
    if (second && second !== 'all') {
      const key = NAVBHARAT_DOMAINS.has(second) ? 'domain' : 'category';
      return router.push({ pathname: '/navbharat', params: { [key]: second } });
    }
    return router.push('/navbharat');
  }
  if (first === 'brands' && second) {
    return router.push({ pathname: '/brand/[slug]', params: { slug: second.toLowerCase() } });
  }
  if (first === 'brands') return router.push('/brands');
  if (first === 'blogs' && second) return router.push({ pathname: '/blog/[slug]', params: { slug: second } });
  if (first === 'blogs') return router.push('/blogs');
  if ((first === 'authors' || first === 'blogauthor') && second) {
    return router.push({ pathname: '/blog-author/[slug]', params: { slug: second } });
  }
  if (first === 'about-us') return router.push('/about');
  if (first === 'connect') return router.push('/connect');
  if (first === 'affiliate') return router.push('/affiliate');
  if (first === 'zillycart' && second) return router.push({ pathname: '/combo/[slug]', params: { slug: second } });
  if (first === 'zillycart') return router.push('/combos');
  if ((first === 'search' || first === 'smart-search') && second) {
    return router.push({ pathname: '/search', params: { q: decodeURIComponent(second).replace(/-/g, ' ') } });
  }
  if (first === 'search' || first === 'smart-search') {
    const q = qs.get('q') ?? qs.get('query');
    return router.push(q ? { pathname: '/search', params: { q } } : '/search');
  }
  if (first === 'tickets' && second) {
    return router.push({ pathname: '/ticket/[id]', params: { id: second, status: qs.get('status') ?? '' } });
  }
  if (first === 'tickets') return router.push(qs.get('orderId') ? { pathname: '/tickets', params: { orderId: qs.get('orderId')! } } : '/tickets');
  if (first === 'delete-account') return router.push('/delete-account');
  if (first === 'contact-us' || first === 'faq') return router.push('/support');
  if (first in POLICIES) return router.push({ pathname: '/policy/[slug]', params: { slug: first } });
  if (first === 'terms-of-use') return router.push({ pathname: '/policy/[slug]', params: { slug: 'term-of-use' } });
  if (first === 'orders') return router.push('/orders');
  if (first === 'cart') return router.push('/cart');
  if (first === 'checkout') return router.push('/checkout');
  if (first === 'profile') return router.push('/account');
  if (first === 'address') return router.push('/addresses');

  WebBrowser.openBrowserAsync(`${WEBSITE_URL}${path.startsWith('/') ? '' : '/'}${path}`).catch(() => {});
}
