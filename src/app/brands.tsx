import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { listBrands } from '@/core/api/brands';
import { usePaged } from '@/core/hooks/useAsync';
import { BrandTile } from '@/ui/BrandTile';
import { Input } from '@/ui/Input';
import { EmptyState, ErrorState, Header, Screen } from '@/ui/Screen';
import { Skeleton } from '@/ui/Skeleton';
import { Text } from '@/ui/Text';
import { radius, usePalette } from '@/ui/theme';

// Brand directory (website: /brands): every brand, featured first, loaded
// page by page as you scroll; typing searches by name.
export default function BrandsScreen() {
  const t = usePalette();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [q, setQ] = useState('');

  useEffect(() => {
    const id = setTimeout(() => setQ(query.trim()), 350);
    return () => clearTimeout(id);
  }, [query]);

  const [total, setTotal] = useState(0);
  const list = usePaged(async (page) => {
    const res = await listBrands({ q: q || undefined, page });
    if (page === 1) setTotal(res.total);
    return res;
  }, [q]);

  return (
    <Screen>
      <Header title="Brands" />
      <FlatList
        data={list.items}
        numColumns={3}
        keyExtractor={(b) => String(b.id)}
        renderItem={({ item }) => <BrandTile brand={item} />}
        columnWrapperStyle={{ gap: 10 }}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 10, paddingBottom: insets.bottom + 24, flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        onEndReached={list.loadMore}
        onEndReachedThreshold={0.6}
        ListHeaderComponent={
          <View style={{ gap: 12, marginBottom: 4 }}>
            <Input icon="search" placeholder="Find a brand…" value={query} onChangeText={setQuery} autoCorrect={false} returnKeyType="search" />
            <Text variant="label" tone="muted">
              {q ? `Results for “${q}”` : 'All brands'}
              {!list.loading && total > 0 ? ` · ${total.toLocaleString('en-IN')}` : ''}
            </Text>
          </View>
        }
        ListEmptyComponent={
          list.loading ? (
            <View style={styles.skeletons}>
              {Array.from({ length: 9 }).map((_, i) => (
                <View key={i} style={{ width: '31%', gap: 6 }}>
                  <Skeleton height={96} r={radius.lg} />
                  <Skeleton width="70%" height={10} />
                </View>
              ))}
            </View>
          ) : list.error ? (
            <ErrorState message={list.error} onRetry={list.reload} />
          ) : (
            <EmptyState icon="pricetags-outline" title="No brands found" message="Try a different name." />
          )
        }
        ListFooterComponent={list.loadingMore ? <ActivityIndicator style={{ margin: 20 }} color={t.primary} /> : null}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  skeletons: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 14 },
});
