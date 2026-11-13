import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import type { ProductSummary } from '@/core/api/catalog';
import { tap } from './Button';
import { ProductCard } from './ProductCard';
import { ProductCardSkeleton } from './Skeleton';
import { Text } from './Text';
import { usePalette } from './theme';

export const SHELF_CARD = 136;

// A titled horizontal product shelf (home category shelves, deals, NavBharat,
// brand): a square thumbnail, the title and a one-line subtitle, "All ›", then
// the products side by side.
export function ProductRail({
  title,
  subtitle,
  icon,
  image,
  items,
  loading,
  onSeeAll,
}: {
  title: string;
  subtitle?: string;
  icon: keyof typeof Ionicons.glyphMap;
  image?: string | null; // thumbnail; falls back to the icon
  items?: ProductSummary[];
  loading: boolean;
  onSeeAll?: () => void;
}) {
  const t = usePalette();
  if (!loading && !items?.length) return null;
  return (
    <View style={{ marginTop: 22 }}>
      <View style={styles.head}>
        <View style={[styles.thumb, { backgroundColor: t.dark ? t.tileFill : '#EAF3FF' }]}>
          {image ? (
            <Image source={{ uri: image }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
          ) : (
            <Ionicons name={icon} size={18} color={t.primary} />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="heading" numberOfLines={1} style={{ fontSize: 16 }}>
            {title}
          </Text>
          {!!subtitle && (
            <Text variant="tiny" tone="muted" numberOfLines={1} style={{ fontWeight: '500' }}>
              {subtitle}
            </Text>
          )}
        </View>
        {onSeeAll && (
          <Pressable accessibilityRole="link" accessibilityLabel={`All ${title}`} hitSlop={10} onPress={() => (tap(), onSeeAll())} style={styles.all}>
            <Text variant="label" tone="primary" style={{ fontSize: 13 }}>
              All
            </Text>
            <Ionicons name="chevron-forward" size={14} color={t.primary} />
          </Pressable>
        )}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}>
        {loading
          ? Array.from({ length: 3 }).map((_, i) => <ProductCardSkeleton key={i} width={SHELF_CARD} />)
          : items!.map((p) => <ProductCard key={`${p.id}-${p.slug}`} product={p} width={SHELF_CARD} />)}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, marginBottom: 12 },
  thumb: { width: 38, height: 38, borderRadius: 10, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  all: { flexDirection: 'row', alignItems: 'center', gap: 1 },
});
