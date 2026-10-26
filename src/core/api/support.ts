import { WEBSITE_URL } from '@/core/config';
import { api } from './client';

// Contact details shown on the website's contact-us page.
export const SUPPORT = {
  phone: '+91 7718014809',
  phoneHref: 'tel:+917718014809',
  whatsappHref: 'https://wa.me/917718014809',
  email: 'support@zillybuy.com',
  hours: 'Mon–Sat, 10:00 AM – 8:00 PM',
  address: 'Ozone Bizz Center, 11th Floor, Jehangir Boman Behram Rd, Bellasis Rd, Mumbai, Maharashtra 400008',
  mapsHref: 'https://www.google.com/maps?q=Ozone+Bizz+Center+Bellasis+Road+Mumbai+Central+400008',
};

export const FAQ = [
  {
    q: 'How can I track my order?',
    a: 'Open My orders after signing in to see the latest tracking status and delivery updates.',
  },
  {
    q: 'How can I cancel or return my order?',
    a: 'Eligible products can be cancelled or returned from your orders, based on the seller policy and order status.',
  },
  {
    q: 'What is the refund timeline?',
    a: 'Refunds are processed once the return or cancellation is approved; bank settlement time may vary.',
  },
  {
    q: 'I received a wrong or damaged item. What should I do?',
    a: 'Contact support right away with your order details and clear photos so our team can help you quickly.',
  },
  {
    q: 'How can I become a seller on ZillyBuy?',
    a: 'Send us a message below and our team will guide you through seller onboarding.',
  },
];

// POST /api/contactus/send-message (website: submitContactForm).
export async function sendContactMessage(p: { name: string; email: string; message: string; user_id?: number }) {
  const { data } = await api.post<{ success?: boolean; message?: string }>('/api/contactus/send-message', p);
  return data;
}

/* ------------------------------ Policy pages ------------------------------ */

export const POLICIES = {
  'terms-and-conditions': 'Terms & conditions',
  'term-of-use': 'Terms of use',
  'privacy-policy': 'Privacy policy',
  'return-policies': 'Return policy',
  'refund-cancellation-policies': 'Refund & cancellation',
  'refund-replacement-policies': 'Refund & replacement',
  'shipping-policies': 'Shipping & delivery',
} as const;

export type PolicySlug = keyof typeof POLICIES;

export type PolicyBlock = { type: 'title' | 'h2' | 'h3' | 'p' | 'li'; text: string };

const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“',
  ndash: '–', mdash: '—', hellip: '…', bull: '•', copy: '©', reg: '®', trade: '™', rupee: '₹',
};

const decode = (s: string) =>
  s.replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e: string) =>
    e[0] === '#'
      ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : Number(e.slice(1)))
      : (ENTITIES[e.toLowerCase()] ?? m),
  );

const clean = (s: string) =>
  decode(s.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ''))
    .replace(/[ \t\r\f\v]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .trim();

// The policy text lives in the website's pages (mostly hardcoded JSX, not the
// CMS), so read the server-rendered page and keep only its headings,
// paragraphs and list items; the app renders those natively.
export function parsePolicyHtml(html: string): PolicyBlock[] {
  let body = html.replace(/<(script|style|noscript|svg|nav|header|footer)\b[\s\S]*?<\/\1>/gi, '');
  const start = body.search(/<h1\b/i);
  if (start < 0) return [];
  body = body.slice(start);

  const blocks: PolicyBlock[] = [];
  const re = /<(h[1-4]|p|li)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) {
    const tag = m[1].toLowerCase();
    const text = clean(m[2]);
    if (!text || blocks.at(-1)?.text === text) continue;
    const type = tag === 'h1' ? 'title' : tag === 'h2' ? 'h2' : tag[0] === 'h' ? 'h3' : tag === 'li' ? 'li' : 'p';
    blocks.push({ type, text });
  }
  return blocks;
}

export async function getPolicy(slug: PolicySlug): Promise<PolicyBlock[]> {
  const res = await fetch(`${WEBSITE_URL}/${slug}`, { headers: { Accept: 'text/html' } });
  if (!res.ok) throw new Error('Could not load this page. Please try again.');
  const blocks = parsePolicyHtml(await res.text());
  if (!blocks.length) throw new Error('Could not load this page. Please try again.');
  return blocks;
}
