import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import type { ProductSummary } from '@/core/api/catalog';
import { computeProductPrice, formatINR, isProductUnavailable } from '@/core/pricing';
import { openingProduct } from '@/core/productPreview';
import { tap } from './Button';
import { Text } from './Text';
import { radius, usePalette } from './theme';

// The one product card for the app (shelves, grids, search results): a grey
// image well with the price tag on it and a "+" that opens the product to pick
// a variant and add it, then the name and the saving below.
export function ProductCard({ product, width }: { product: ProductSummary; width?: number }) {
  const t = usePalette();
  const unavailable = isProductUnavailable(product);
  const price = computeProductPrice(product);
  const open = () => {
    tap();
    openingProduct(product);
    router.push({ pathname: '/product/[slug]', params: { slug: product.slug } });
  };

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={product.name}
      onPressIn={() => openingProduct(product)}
      onPress={open}
      style={({ pressed }) => [{ width, flex: width ? undefined : 1, opacity: pressed ? 0.85 : 1 }]}>
      <View style={[styles.well, { backgroundColor: t.tileFill }]}>
        {product.image ? (
          <Image
            source={{ uri: product.image }}
            style={[styles.image, unavailable && { opacity: 0.45 }]}
            contentFit="contain"
            transition={200}
            recyclingKey={String(product.id)}
          />
        ) : (
          <Ionicons name="image-outline" size={36} color={t.textFaint} />
        )}

        {unavailable ? (
          <View style={[styles.flag, { backgroundColor: 'rgba(11,27,51,0.78)' }]}>
            <Text variant="tiny" tone="onPrimary" style={styles.flagText}>
              Unavailable
            </Text>
          </View>
        ) : (
          Number(product.is_assured) === 1 && (
            <View style={[styles.flag, { backgroundColor: t.success }]}>
              <Ionicons name="shield-checkmark" size={9} color="#fff" />
              <Text variant="tiny" tone="onPrimary" style={styles.flagText}>
                Assured
              </Text>
            </View>
          )
        )}

        <Pressable accessibilityRole="button" accessibilityLabel={`Add ${product.name}`} hitSlop={8} onPress={open} style={styles.add}>
          <Ionicons name="add" size={18} color={t.primary} />
        </Pressable>

        {price.hasPrice && (
          <View style={[styles.priceTag, { backgroundColor: t.primary }]}>
            <Text variant="tiny" tone="onPrimary" style={{ fontSize: 12, fontWeight: '800' }}>
              {formatINR(price.price)}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.body}>
        <Text variant="caption" numberOfLines={2} style={{ fontSize: 12.5, lineHeight: 16, minHeight: 32 }}>
          {product.name}
        </Text>
        {price.hasDiscount ? (
          <Text variant="tiny" numberOfLines={1}>
            <Text variant="tiny" style={{ color: t.success }}>
              {price.discountPercent}% off{' '}
            </Text>
            <Text variant="tiny" tone="faint" style={{ textDecorationLine: 'line-through', fontWeight: '500' }}>
              {formatINR(price.strike!)}
            </Text>
          </Text>
        ) : (
          !!product.brand_name && (
            <Text variant="tiny" tone="faint" numberOfLines={1} style={{ fontWeight: '500' }}>
              {product.brand_name}
            </Text>
          )
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  well: { aspectRatio: 1, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  image: { width: '78%', height: '78%' },
  flag: {
    position: 'absolute',
    top: 7,
    left: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  flagText: { fontSize: 10, lineHeight: 13 },
  add: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  priceTag: { position: 'absolute', left: 7, bottom: 7, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 7 },
  body: { paddingHorizontal: 2, paddingTop: 7, gap: 3 },
});
