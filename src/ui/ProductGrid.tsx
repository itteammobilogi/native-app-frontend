import { ActivityIndicator, FlatList, RefreshControl, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { ProductSummary } from '@/core/api/catalog';
import { ProductCard } from './ProductCard';
import { EmptyState, ErrorState } from './Screen';
import { ProductCardSkeleton } from './Skeleton';
import { usePalette } from './theme';

type Props = {
  items: ProductSummary[];
  loading: boolean;
  loadingMore?: boolean;
  refreshing?: boolean;
  error?: string | null;
  onEndReached?: () => void;
  onRefresh?: () => void;
  onRetry?: () => void;
  header?: React.ReactElement | null;
  emptyTitle?: string;
  emptyMessage?: string;
  bottomInset?: number;
};

// Two-column infinite product grid with skeleton, empty and error states.
export function ProductGrid({
  items,
  loading,
  loadingMore,
  refreshing = false,
  error,
  onEndReached,
  onRefresh,
  onRetry,
  header,
  emptyTitle = 'Nothing here yet',
  emptyMessage = 'Try another category or search.',
  bottomInset = 24,
}: Props) {
  const t = usePalette();
  const insets = useSafeAreaInsets();

  const empty = loading ? (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 10 }}>
      {Array.from({ length: 6 }).map((_, i) => (
        <View key={i} style={{ width: '50%', padding: 6 }}>
          <ProductCardSkeleton />
        </View>
      ))}
    </View>
  ) : error ? (
    <ErrorState message={error} onRetry={onRetry ?? (() => {})} />
  ) : (
    <EmptyState icon="search-outline" title={emptyTitle} message={emptyMessage} />
  );

  return (
    <FlatList
      data={loading ? [] : items}
      numColumns={2}
      keyExtractor={(p, i) => `${p.id}-${p.slug}-${i}`}
      renderItem={({ item }) => (
        <View style={{ width: '50%', padding: 6 }}>
          <ProductCard product={item} />
        </View>
      )}
      ListHeaderComponent={header}
      ListEmptyComponent={empty}
      ListFooterComponent={loadingMore ? <ActivityIndicator style={{ margin: 20 }} color={t.primary} /> : null}
      contentContainerStyle={{ paddingHorizontal: 10, paddingBottom: insets.bottom + bottomInset, flexGrow: 1 }}
      onEndReachedThreshold={0.6}
      onEndReached={onEndReached}
      refreshControl={
        onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.primary} /> : undefined
      }
      showsVerticalScrollIndicator={false}
      initialNumToRender={8}
      windowSize={7}
      removeClippedSubviews
    />
  );
}
