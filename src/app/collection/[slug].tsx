import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { getCollection } from '@/core/api/catalog';
import { filterLocally, LOCAL_SORTS, type Filters } from '@/core/filters';
import { usePaged } from '@/core/hooks/useAsync';
import { FilterBar, FilterSheet } from '@/ui/FilterSheet';
import { ProductGrid } from '@/ui/ProductGrid';
import { Header, Screen } from '@/ui/Screen';

// Banner / quick-filter collections (website: /adds/banner-products/<slug>).
// The endpoint has no filters, so they run on the loaded rows.
export default function CollectionScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [title, setTitle] = useState<string>();
  const [filters, setFilters] = useState<Filters>({ sort: 'popular' });
  const [filterOpen, setFilterOpen] = useState(false);

  const list = usePaged(async (page) => {
    const res = await getCollection(slug, page);
    if (res.title) setTitle(res.title);
    return res;
  }, [slug]);

  const items = filterLocally(list.items, filters);

  return (
    <Screen>
      <Header title={title ?? slug.replace(/-/g, ' ')} />
      <ProductGrid
        {...list}
        items={items}
        onEndReached={list.loadMore}
        onRefresh={list.refresh}
        onRetry={list.reload}
        emptyTitle="No products match"
        emptyMessage="Try removing a filter."
        header={
          <View style={{ paddingHorizontal: 6, paddingBottom: 8 }}>
            <FilterBar
              value={filters}
              onChange={setFilters}
              onOpen={() => setFilterOpen(true)}
              sorts={LOCAL_SORTS}
              count={list.loading ? null : `${items.length}${list.hasMore ? '+' : ''} items`}
            />
          </View>
        }
      />
      <FilterSheet
        visible={filterOpen}
        onClose={() => setFilterOpen(false)}
        value={filters}
        onApply={setFilters}
        sorts={LOCAL_SORTS}
        toggles={['inStock', 'onSale']}
      />
    </Screen>
  );
}
