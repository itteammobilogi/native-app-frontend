import type { Cart, CartLine, QuoteEntry } from '@/core/api/cart';

// One package = one seller transaction (t_id). Its charges come from that
// seller's ONDC quote, summed with exactly the rules the server charges by
// (website/node utils/cartTotals.js): delivery, tax and misc/convenience/
// platform fees add, discount/offer subtracts, anything else (e.g. packing)
// is not charged separately. So the packages always add up to the bill.
export type CartPackage = {
  tid: number;
  lines: CartLine[]; // buyable lines
  unavailable: CartLine[]; // shown, never charged
  itemCount: number; // units, not lines
  itemTotal: number;
  delivery: number;
  tax: number;
  misc: number;
  discount: number; // positive
  total: number;
  deliveryDate: string | null; // "DD-MM-YYYY", the latest among the package's lines
};

const typeOf = (e: QuoteEntry) => String(e['@ondc/org/title_type'] || e.title_type || '').toLowerCase();
const valueOf = (e: QuoteEntry) => {
  const n = Number(e.price?.value ?? 0);
  return Number.isFinite(n) ? n : 0;
};

const dateKey = (d: string) => d.split('-').reverse().join(''); // DD-MM-YYYY -> YYYYMMDD

export function cartPackages(cart: Cart): CartPackage[] {
  const byTid = new Map<number, CartLine[]>();
  for (const line of cart.products) {
    byTid.set(line.t_id, [...(byTid.get(line.t_id) ?? []), line]);
  }

  return [...byTid.entries()].map(([tid, all]) => {
    const lines = all.filter((l) => !l.is_unavailable);
    const unavailable = all.filter((l) => l.is_unavailable);
    const quote = all.find((l) => l.price_breakup_raw?.length)?.price_breakup_raw ?? [];

    let delivery = 0;
    let tax = 0;
    let misc = 0;
    let discount = 0;
    for (const e of quote) {
      const type = typeOf(e);
      const v = valueOf(e);
      if (type === 'delivery') delivery += v;
      else if (type === 'tax') tax += v;
      else if (type === 'misc' || type === 'convenience_fee' || type === 'platform_fee') misc += v;
      else if (type === 'discount' || type === 'offer') discount += Math.abs(v);
    }

    const itemTotal = lines.reduce((s, l) => s + Number(l.unit_price || 0) * Number(l.quantity || 0), 0);
    const dates = lines.map((l) => l.expected_delivery_date).filter((d): d is string => !!d);
    const deliveryDate = dates.sort((a, b) => dateKey(a).localeCompare(dateKey(b))).at(-1) ?? null;

    return {
      tid,
      lines,
      unavailable,
      itemCount: lines.reduce((s, l) => s + Number(l.quantity || 0), 0),
      itemTotal,
      delivery,
      tax,
      misc,
      discount,
      total: itemTotal + delivery + tax + misc - discount,
      deliveryDate,
    };
  });
}

// "24-10-2026" -> "Sat, 24 Oct"
export function formatDeliveryDate(d?: string | null) {
  if (!d) return null;
  const [dd, mm, yyyy] = d.split('-').map(Number);
  const date = new Date(yyyy, (mm || 1) - 1, dd || 1);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

export const itemCountOf = (cart: Cart) =>
  cart.products.filter((l) => !l.is_unavailable).reduce((s, l) => s + Number(l.quantity || 0), 0);
