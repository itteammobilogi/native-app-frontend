// Ported as-is from website/nextjs/ondc-zillybuy-ui/src/utils/productPricing.js,
// the single source of truth for price / strike / discount on the website. Read
// that file's header before changing anything here: never invent an MRP, and
// never use the API's `discount_percent` (it's a variant spread, not a discount).

type Priceable = {
  price?: unknown;
  max_value?: unknown;
  mrp?: unknown;
};

const toNumber = (v: unknown) => {
  if (v === null || v === undefined || v === '') return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export function computeProductPrice(p: Priceable | null | undefined) {
  const price = toNumber(p?.price);
  const mrp = [p?.max_value, p?.mrp].map(toNumber).find((v) => v > price);
  const hasDiscount = price > 0 && mrp !== undefined;

  return {
    price,
    // Zero is not a price — a card shows no number rather than "₹0".
    hasPrice: price > 0,
    strike: hasDiscount ? (mrp as number) : null,
    hasDiscount,
    discountPercent: hasDiscount
      ? Math.max(0, Math.round((((mrp as number) - price) / (mrp as number)) * 100))
      : 0,
  };
}

type Availability = {
  is_unavailable?: unknown;
  bpp_status?: unknown;
  provider_is_disabled?: unknown;
  quantity?: unknown;
};

// `is_unavailable` is decided by the API; only fall back to the raw flags when
// a surface doesn't send it (same rules as the website).
export function isProductUnavailable(p: Availability | null | undefined) {
  if (p?.is_unavailable != null) return Number(p.is_unavailable) === 1;
  if (Number(p?.bpp_status ?? 1) === 0) return true;
  if (Number(p?.provider_is_disabled || 0) === 1) return true;
  if (p?.quantity != null && Number(p.quantity) <= 0) return true;
  return false;
}

const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });
export const formatINR = (n: number) => `₹${inr.format(n)}`;
