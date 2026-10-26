import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { ScrollView, StyleSheet, View } from 'react-native';

import type { ProductSummary } from '@/core/api/catalog';
import { ProductCard } from './ProductCard';
import { ProductCardSkeleton } from './Skeleton';
import { Text } from './Text';
import { usePalette } from './theme';

// Titled horizontal product strip with "See all" (home, NavBharat, brand).
export function ProductRail({
  title,
  icon,
  items,
  loading,
  onSeeAll,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  items?: ProductSummary[];
  loading: boolean;
  onSeeAll?: () => void;
}) {
  const t = usePalette();
  if (!loading && !items?.length) return null;
  return (
    <View style={{ marginTop: 22 }}>
      <View style={styles.head}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <LinearGradient colors={t.primaryGradient} style={styles.icon}>
            <Ionicons name={icon} size={14} color="#fff" />
          </LinearGradient>
          <Text variant="heading">{title}</Text>
        </View>
        {onSeeAll && (
          <Text variant="label" tone="primary" onPress={onSeeAll} suppressHighlighting>
            See all
          </Text>
        )}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}>
        {loading
          ? Array.from({ length: 3 }).map((_, i) => <ProductCardSkeleton key={i} width={160} />)
          : items!.map((p) => <ProductCard key={`${p.id}-${p.slug}`} product={p} width={160} />)}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 12 },
  icon: { width: 24, height: 24, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
});
