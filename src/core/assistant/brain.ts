import type { Href } from 'expo-router';

import { askAssistant, type ChatTurn } from '@/core/api/chatbot';
import { DOMAIN_META, listProducts, type ProductSummary } from '@/core/api/catalog';
import { listOrders, type Order } from '@/core/api/orders';
import { SUPPORT } from '@/core/api/support';

// ZillyAI's routing, after the website widget (ChatbotWidget.jsx): most turns
// are answered on the device with regexes, live catalog searches and canned
// text; the LLM is only asked once per turn, to understand messages the rules
// can't (Hinglish, vague requests) and to phrase a short reply.

export type Action =
  | { kind: 'send'; label: string; value: string; icon?: string }
  | { kind: 'go'; label: string; href: Href; icon?: string }
  | { kind: 'url'; label: string; url: string; icon?: string };

export type BotReply = {
  text: string;
  products?: ProductSummary[];
  orders?: Order[];
  actions?: Action[];
  // Small line under the bubble, e.g. "Sign in to see order details".
  note?: string;
};

export type BrainContext = { loggedIn: boolean; firstName?: string; history: ChatTurn[] };

/* --------------------------------- Rules -------------------------------- */

const GRATITUDE =
  /^(thanks?( you)?( so much| a lot)?|thx|ty|tysm|much appreciated|appreciate it|(ok(ay)?|great|cool|awesome|perfect|nice)[,\s]+thanks?( you)?|dhanyavaa?d|dhanyawaa?d|shukriya|धन्यवाद|शुक्रिया)[\s!.🙏😊]*$/i;
const GREETING = /^(hi+|hello+|hey+|hii+|namaste|namaskar|hola|yo|good (morning|afternoon|evening))[\s!.,]*(zilly(ai|bot)?)?[\s!.]*$/i;
const ORDER_ID = /\bzb[a-z0-9-]{3,}\b/i;
const ORDER =
  /\b(track|tracking|order status|my orders?|last order|recent order|latest order|where is my|delivery status|mera order|order kab|order kahan|kab aayega|kab ayega)\b|मेरा ऑर्डर/i;
const SUPPORT_RE =
  /\b(contact support|customer care|support number|help ?cent(er|re)|contact details|talk to (an? )?(agent|human|support|someone)|speak to|human agent|live agent|call you|complaint|raise (a )?ticket)\b/i;
const POLICY = /\b(return|refund|replace(ment)?|cancel(lation)?|shipping|policy|policies|exchange|warranty)\b/i;
const FAQ: { re: RegExp; reply: BotReply }[] = [
  {
    re: /\b(ondc)\b/i,
    reply: {
      text: 'ZillyBuy is built on ONDC (Open Network for Digital Commerce), the Government of India–backed open network. It lets you buy from verified sellers across India, often at better prices.',
    },
  },
  {
    re: /\b(cod|cash on delivery|payment|pay|upi|card|emi)\b/i,
    reply: {
      text: 'You can pay securely with UPI, cards, net banking and wallets at checkout. Payment options can vary by seller.',
      actions: [{ kind: 'go', label: 'Open cart', href: '/cart', icon: 'bag-handle-outline' }],
    },
  },
  {
    re: /\b(delivery charge|shipping charge|free delivery|delivery fee)\b/i,
    reply: {
      text: 'Delivery charges are set by each seller and shown in your bill before you pay — nothing hidden.',
      actions: [{ kind: 'go', label: 'Shipping policy', href: '/policy/shipping-policies', icon: 'document-text-outline' }],
    },
  },
  {
    re: /\b(privacy|my data|terms|t&c|conditions)\b/i,
    reply: {
      text: 'Here are our terms and privacy policy.',
      actions: [
        { kind: 'go', label: 'Privacy policy', href: '/policy/privacy-policy', icon: 'lock-closed-outline' },
        { kind: 'go', label: 'Terms & conditions', href: '/policy/terms-and-conditions', icon: 'document-text-outline' },
      ],
    },
  },
  {
    re: /\b(login|log in|sign ?in|sign ?up|register|otp|account)\b/i,
    reply: {
      text: 'You can sign in with your mobile number and an OTP — no password needed.',
      actions: [{ kind: 'go', label: 'Sign in', href: '/login', icon: 'log-in-outline' }],
    },
  },
  {
    re: /\b(who are you|what can you do|about (you|zillybuy)|what is zillybuy|help)\b/i,
    reply: {
      text: "I'm ZillyAI, your shopping buddy. I can find products in your budget, track your orders, and answer questions on returns, refunds and delivery.",
    },
  },
];

const PRODUCT_WORDS =
  /\b(show|find|search|buy|need|want|looking for|recommend|suggest|best|cheap|under|below|budget|price|gift|phone|mobile|laptop|earbuds|headphone|watch|shoe|shirt|kurta|saree|dress|jeans|bag|tv|fridge|mixer|cooker|cream|shampoo|serum|perfume|oil|rice|atta|tea|coffee|toy|bottle|charger|speaker)s?\b/i;

// Gift / occasion requests need judgement ("gift for mom" isn't a search
// term), so they go to the LLM rather than straight to the catalog.
const ADVICE = /\b(gifts?|occasion|wedding|shaadi|birthday|anniversary|party|festival|diwali|holi|trip|vacation|travel|what should i|kya (lu|lun|khareed))\b/i;

const STOPWORDS = new Set(
  (
    'show me find search for buy i want need looking suggest recommend please some any best good nice top a an the my to of in on with and or ' +
    'under below less than upto up within around budget price rs inr rupees cheap cheapest latest new ' +
    'dikhao dikha chahiye chaiye mujhe koi wala wali wale ka ki ke ke liye liye se kam tak andar niche hai do de'
  ).split(' '),
);

export function parseBudget(s: string): number | undefined {
  const toNum = (n: string, k?: string) => Number(n.replace(/,/g, '')) * (k ? 1000 : 1);
  const before = s.match(/(?:under|below|less than|upto|up to|within|max|budget|<)\s*(?:of\s*)?(?:rs\.?|₹|inr)?\s*(\d[\d,]*)\s*(k)?\b/i);
  if (before) return toNum(before[1], before[2]);
  const after = s.match(/(?:₹|rs\.?\s*)?(\d[\d,]*)\s*(k)?\s*(?:rs|rupees|₹)?\s*(?:tak|ke andar|ke niche|se kam|ke under|budget)/i);
  if (after) return toNum(after[1], after[2]);
  return undefined;
}

const cleanQuery = (s: string) =>
  s
    .toLowerCase()
    .replace(/(?:₹|rs\.?)?\s*\d[\d,]*\s*k?\b/g, ' ')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !STOPWORDS.has(w))
    .slice(0, 5)
    .join(' ');

const CATEGORY_ACTIONS: Action[] = Object.entries(DOMAIN_META).map(([slug, m]) => ({
  kind: 'go',
  label: m.name,
  href: { pathname: '/shop/[domain]', params: { domain: slug } },
  icon: m.icon,
}));

const SUPPORT_ACTIONS: Action[] = [
  { kind: 'url', label: 'Call us', url: SUPPORT.phoneHref, icon: 'call-outline' },
  { kind: 'url', label: 'WhatsApp', url: SUPPORT.whatsappHref, icon: 'logo-whatsapp' },
  { kind: 'go', label: 'Help & support', href: '/support', icon: 'headset-outline' },
];

/* -------------------------------- Catalog ------------------------------- */

async function searchCatalog(query: string, budget?: number) {
  const run = (name: string) =>
    listProducts({ name, max: budget, limit: 8, available_only: 1 })
      .then((p) => p.items)
      .catch(() => [] as ProductSummary[]);
  let items = await run(query);
  // "red cotton kurta for wedding" can be too specific: retry on the last word
  // (usually the product noun).
  const words = query.split(' ');
  if (!items.length && words.length > 1) items = await run(words[words.length - 1]);
  return items;
}

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;

async function productReply(query: string, budget: number | undefined, lead?: string): Promise<BotReply | null> {
  if (!query) return null;
  const items = await searchCatalog(query, budget);
  if (!items.length) return null;
  const where = budget ? ` under ${inr(budget)}` : '';
  return {
    text: lead || `Here are ${items.length} live pick${items.length === 1 ? '' : 's'} for “${query}”${where}. Tap any card to see details.`,
    products: items,
    actions: [
      { kind: 'go', label: 'See all results', href: { pathname: '/search', params: { q: query } }, icon: 'search' },
      ...(budget ? [] : [{ kind: 'send' as const, label: 'Under ₹1,000', value: `${query} under 1000` }]),
    ],
  };
}

/* --------------------------------- Orders ------------------------------- */

const STATUS_PHRASES: Record<string, string> = {
  created: 'placed and waiting for the seller to accept',
  accepted: 'accepted by the seller',
  'in-progress': 'being prepared',
  packed: 'packed and ready to ship',
  'order-picked-up': 'picked up by the courier',
  'out-for-delivery': 'out for delivery',
  'order-delivered': 'delivered',
  completed: 'delivered',
  cancelled: 'cancelled',
};

const phrase = (state: string) => STATUS_PHRASES[state?.toLowerCase()] ?? state?.replace(/[-_]/g, ' ').toLowerCase() ?? 'being processed';

async function orderReply(message: string, ctx: BrainContext): Promise<BotReply> {
  if (!ctx.loggedIn) {
    return {
      text: 'I can check your orders once you sign in — it only takes an OTP.',
      note: 'Order details are shown only after sign-in.',
      actions: [{ kind: 'go', label: 'Sign in', href: '/login', icon: 'log-in-outline' }],
    };
  }
  const orders = await listOrders();
  if (!orders.length) {
    return {
      text: "You haven't placed any orders yet. Want me to find something for you?",
      actions: CATEGORY_ACTIONS.slice(0, 4),
    };
  }
  const id = message.match(ORDER_ID)?.[0]?.toLowerCase();
  const order = id ? orders.find((o) => o.order_id.toLowerCase() === id) : orders[0];
  if (!order) {
    return {
      text: `I couldn't find order ${id?.toUpperCase()} on your account. Here's your most recent one instead.`,
      orders: [orders[0]],
      actions: SUPPORT_ACTIONS,
    };
  }
  const n = order.items.length;
  const lines = order.items.slice(0, 4).map((i) => `• ${i.title} (x${i.quantity})`);
  const others = orders.filter((o) => o !== order).slice(0, 2);
  return {
    text: `${id ? 'Order' : 'Your latest order'} #${order.order_id} (${n} item${n === 1 ? '' : 's'}) is ${phrase(order.order_state)}.\n${lines.join('\n')}`,
    orders: [order],
    actions: [
      ...others.map((o) => ({ kind: 'send' as const, label: `#${o.order_id}`, value: `Track order ${o.order_id}`, icon: 'cube-outline' })),
      { kind: 'go', label: 'All orders', href: '/orders', icon: 'list-outline' },
      { kind: 'go', label: 'Need help', href: '/support', icon: 'headset-outline' },
    ],
  };
}

/* ------------------------------- Policies ------------------------------- */

function policyReply(message: string): BotReply {
  const m = message.toLowerCase();
  if (/refund|cancel/.test(m)) {
    return {
      text: 'You can cancel an item from the order page until it ships. Refunds go back to your original payment method once the seller confirms — usually within 5–7 working days.',
      actions: [
        { kind: 'go', label: 'Refund & cancellation', href: '/policy/refund-cancellation-policies', icon: 'document-text-outline' },
        { kind: 'go', label: 'My orders', href: '/orders', icon: 'cube-outline' },
      ],
    };
  }
  if (/return|replace|exchange|warranty/.test(m)) {
    return {
      text: 'Returnable items can be returned from the order page within the return window shown on the product. Some items (like innerwear or personal care) may not be returnable.',
      actions: [
        { kind: 'go', label: 'Return policy', href: '/policy/return-policies', icon: 'document-text-outline' },
        { kind: 'go', label: 'Refund & replacement', href: '/policy/refund-replacement-policies', icon: 'swap-horizontal-outline' },
        { kind: 'go', label: 'My orders', href: '/orders', icon: 'cube-outline' },
      ],
    };
  }
  return {
    text: 'Delivery time depends on the seller and your pincode — you’ll see the estimate on each product. You can follow every step from the order page.',
    actions: [
      { kind: 'go', label: 'Shipping policy', href: '/policy/shipping-policies', icon: 'document-text-outline' },
      { kind: 'send', label: 'Track my order', value: 'Track my latest order', icon: 'locate-outline' },
    ],
  };
}

/* ---------------------------------- LLM --------------------------------- */

const UNDERSTAND_PROMPT =
  'You are the intent parser for ZillyAI, the shopping assistant of ZillyBuy, an Indian ONDC marketplace (electronics, fashion, ' +
  'home & kitchen, appliances, beauty, grocery, health). Users write in English, Hindi or Hinglish. Reply with strictly valid JSON ' +
  'and nothing else: {"intent":"product_search"|"order"|"support"|"policy"|"general","searchQuery":string|null,"budget":number|null,' +
  '"reply":string}. searchQuery: 1-4 English words a catalog search would match (e.g. "running shoes men"), no prices; for gift or ' +
  'occasion requests pick the most fitting product. budget: rupees as a number, or null. reply: friendly, at most 2 short sentences, ' +
  'in the same language and script as the user, no markdown, never invent prices or products.';

type Understanding = { intent?: string; searchQuery?: string | null; budget?: number | null; reply?: string };

async function understand(message: string, history: ChatTurn[]): Promise<Understanding | null> {
  try {
    const raw = await askAssistant({ message, systemPrompt: UNDERSTAND_PROMPT, history: history.slice(-6), temperature: 0.2, maxOutputTokens: 200 });
    const json = raw.replace(/```(?:json)?/g, '');
    return JSON.parse(json.slice(json.indexOf('{'), json.lastIndexOf('}') + 1));
  } catch {
    return null;
  }
}

/* --------------------------------- Router ------------------------------- */

const fallback = (): BotReply => ({
  text: 'I can help with finding products, tracking orders, returns, refunds and delivery. Pick a category to start, or tell me what you need.',
  actions: CATEGORY_ACTIONS,
});

export async function respond(raw: string, ctx: BrainContext): Promise<BotReply> {
  const message = raw.trim();

  if (GRATITUDE.test(message)) {
    return {
      text: "You're welcome! 😊 Anything else I can find for you?",
      actions: CATEGORY_ACTIONS.slice(0, 4),
    };
  }
  if (GREETING.test(message)) {
    return {
      text: `Hi${ctx.firstName ? ` ${ctx.firstName}` : ''}! 👋 What are you shopping for today? I can also track orders and help with returns.`,
      actions: STARTERS.slice(0, 4).map((s) => ({ kind: 'send', label: s.label, value: s.value, icon: s.icon })),
    };
  }
  if (ORDER_ID.test(message) || ORDER.test(message)) return orderReply(message, ctx);
  if (SUPPORT_RE.test(message)) {
    return {
      text: `Our support team is here ${SUPPORT.hours}. Reach them on ${SUPPORT.phone} or ${SUPPORT.email}, or raise a request from Help & support.`,
      actions: SUPPORT_ACTIONS,
    };
  }
  if (POLICY.test(message) && !PRODUCT_WORDS.test(message)) return policyReply(message);
  const faq = FAQ.find((f) => f.re.test(message));
  if (faq && !PRODUCT_WORDS.test(message)) return faq.reply;

  // Plain English product request: search straight away.
  const budget = parseBudget(message);
  if ((PRODUCT_WORDS.test(message) || budget) && !ADVICE.test(message)) {
    const hit = await productReply(cleanQuery(message), budget);
    if (hit) return hit;
  }

  // Everything else (Hinglish, vague or occasion requests): one LLM call.
  const u = await understand(message, ctx.history);
  if (!u) return fallback();
  switch (u.intent) {
    case 'order':
      return orderReply(message, ctx);
    case 'support':
      return { text: u.reply || 'Our support team can help.', actions: SUPPORT_ACTIONS };
    case 'policy':
      return policyReply(message);
    case 'product_search': {
      const query = cleanQuery(u.searchQuery ?? '') || cleanQuery(message);
      const b = u.budget ?? budget ?? undefined;
      const hit = await productReply(query, b, u.reply);
      if (hit) return hit;
      return {
        text: `I couldn't find live matches for “${query}”${b ? ` under ${inr(b)}` : ''} right now. Try a different word, or browse a category.`,
        actions: [...(b ? [{ kind: 'send' as const, label: `Show ${query} at any price`, value: `show ${query}` }] : []), ...CATEGORY_ACTIONS.slice(0, 4)],
      };
    }
    default:
      return u.reply ? { text: u.reply, actions: CATEGORY_ACTIONS.slice(0, 4) } : fallback();
  }
}

// Starter prompts on the welcome screen.
export const STARTERS: { label: string; value: string; icon: string }[] = [
  { label: 'Track my order', value: 'Track my latest order', icon: 'locate-outline' },
  { label: 'Phones under ₹15k', value: 'Show me phones under 15000', icon: 'phone-portrait-outline' },
  { label: 'Gift for mom', value: 'Suggest a gift for my mom', icon: 'gift-outline' },
  { label: 'Return policy', value: 'How do returns work?', icon: 'refresh-outline' },
  { label: '2000 tak ke earbuds', value: '2000 tak ke earbuds dikhao', icon: 'headset-outline' },
  { label: 'Talk to support', value: 'Contact support', icon: 'chatbubbles-outline' },
];
