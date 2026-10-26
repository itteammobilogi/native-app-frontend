import { View } from 'react-native';

import { computeProductPrice, formatINR } from '@/core/pricing';
import { Text } from './Text';
import { usePalette } from './theme';

type Props = {
  product: { price?: unknown; max_value?: unknown; mrp?: unknown };
  size?: 'sm' | 'lg';
};

// Price + strike + discount, always via computeProductPrice (never the API's
// discount_percent, never a made-up MRP). Renders nothing when there's no price.
export function Price({ product, size = 'sm' }: Props) {
  const t = usePalette();
  const p = computeProductPrice(product);
  if (!p.hasPrice) return null;
  const lg = size === 'lg';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', columnGap: 6 }}>
      <Text variant={lg ? 'title' : 'heading'} style={lg ? { fontSize: 26 } : { fontSize: 15 }}>
        {formatINR(p.price)}
      </Text>
      {p.strike != null && (
        <Text variant={lg ? 'body' : 'caption'} tone="faint" style={{ textDecorationLine: 'line-through' }}>
          {formatINR(p.strike)}
        </Text>
      )}
      {p.hasDiscount && (
        <Text variant={lg ? 'label' : 'tiny'} style={{ color: t.success }}>
          {p.discountPercent}% off
        </Text>
      )}
    </View>
  );
}
