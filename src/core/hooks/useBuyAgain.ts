import { useState } from 'react';

import { getProduct, variantUnavailable } from '@/core/api/catalog';
import type { OrderItem } from '@/core/api/orders';
import { useCart } from '@/core/cart/CartContext';
import { useLocation } from '@/core/location/LocationContext';

// "Buy again" for a past order item. Orders don't carry the ONDC ids the cart
// needs, so load the live product by the item's slug and add its current
// variant at today's price.
export function useBuyAgain() {
  const cart = useCart();
  const { pincodeId } = useLocation();
  const [busyId, setBusyId] = useState<number | null>(null);

  const buyAgain = async (item: OrderItem) => {
    if (!item.slug) throw new Error('This product is no longer listed.');
    setBusyId(item.id);
    try {
      const p = await getProduct(item.slug);
      const v = p.variants?.find((x) => x.id === p.selected_variant_id) ?? p.variants?.[0];
      if (!v || variantUnavailable(p, v)) throw new Error('This product is currently unavailable.');
      await cart.add({
        product_variant_id: v.id,
        product_value: v.product_value,
        bpp_id: p.bpp_id,
        sor_id: p.sor_id,
        sor_value: p.sor_value,
        location_id: v.location_id,
        location_value: v.location_value,
        quantity: 1,
        price: Number(v.price),
        pincode_id: pincodeId,
      });
    } finally {
      setBusyId(null);
    }
  };

  return { buyAgain, busyId };
}
