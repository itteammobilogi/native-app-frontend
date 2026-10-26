import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import type { ProductSummary } from '@/core/api/catalog';
import { isProductUnavailable } from '@/core/pricing';
import { tap } from './Button';
import { Glass } from './Glass';
import { Price } from './Price';
import { Text } from './Text';
import { radius, usePalette } from './theme';

// The one product card for the app (grid, rails, search results).
export function ProductCard({ product, width }: { product: ProductSummary; width?: number }) {
  const t = usePalette();
  const unavailable = isProductUnavailable(product);

  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={product.name}
      onPress={() => {
        tap();
        router.push({ pathname: '/product/[slug]', params: { slug: product.slug } });
      }}
      style={({ pressed }) => [{ width, flex: width ? undefined : 1, transform: [{ scale: pressed ? 0.97 : 1 }] }]}>
      <Glass radius={radius.lg} style={styles.card}>
        <View style={[styles.imageWrap, { backgroundColor: t.dark ? 'rgba(255,255,255,0.92)' : '#FFFFFF' }]}>
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
          {unavailable && (
            <View style={[styles.badge, { backgroundColor: 'rgba(11,27,51,0.78)' }]}>
              <Text variant="tiny" tone="onPrimary">
                Unavailable
              </Text>
            </View>
          )}
          {!unavailable && Number(product.is_assured) === 1 && (
            <View style={[styles.badge, { backgroundColor: t.primary }]}>
              <Ionicons name="shield-checkmark" size={10} color="#fff" />
              <Text variant="tiny" tone="onPrimary">
                Assured
              </Text>
            </View>
          )}
        </View>
        <View style={styles.body}>
          {!!product.brand_name && (
            <Text variant="tiny" tone="faint" numberOfLines={1} style={{ textTransform: 'uppercase', letterSpacing: 0.6 }}>
              {product.brand_name}
            </Text>
          )}
          <Text variant="caption" numberOfLines={2} style={{ fontSize: 13, lineHeight: 17, minHeight: 34 }}>
            {product.name}
          </Text>
          <Price product={product} />
        </View>
      </Glass>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { padding: 8 },
  imageWrap: {
    aspectRatio: 1,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: { width: '88%', height: '88%' },
  badge: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  body: { paddingHorizontal: 4, paddingTop: 8, paddingBottom: 4, gap: 4 },
});
