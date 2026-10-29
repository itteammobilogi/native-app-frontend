import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { listProducts, type ListParams, type Sort } from '@/core/api/catalog';
import { SERVER_SORTS, type Filters } from '@/core/filters';
import { usePaged } from '@/core/hooks/useAsync';
import { FilterBar, FilterSheet } from '@/ui/FilterSheet';
import { ProductGrid } from '@/ui/ProductGrid';
import { Header, Screen } from '@/ui/Screen';

// "See all" for the home rails and the Exclusive / Featured quick filters
// (website: /exclusive-deals, /featured-deals): flags on list-products.
const FLAGS: Record<string, ListParams> = {
  deals: { is_exclusive_deals: 1, available_only: 1 },
  featured: { is_featured: 1, available_only: 1 },
};

export default function ProductsScreen() {
  const { flag = 'featured', title } = useLocalSearchParams<{ flag?: string; title?: string }>();
  const [filters, setFilters] = useState<Filters>({ sort: 'created_desc' });
  const [filterOpen, setFilterOpen] = useState(false);

  const list = usePaged(async (page) => {
    const params: ListParams = {
      sort: filters.sort as Sort,
      min: filters.min,
      max: filters.max,
      in_stock: filters.inStock ? 1 : undefined,
      page,
    };
    const res = await listProducts({ ...FLAGS[flag], ...params });
    // Same fallback as the home strip: no live deals → show featured.
    if (flag === 'deals' && page === 1 && !res.items.length) {
      return listProducts({ ...FLAGS.featured, ...params });
    }
    return res;
  }, [flag, filters]);

  return (
    <Screen tabBar="index">
      <Header title={title ?? 'Products'} />
      <ProductGrid
        {...list}
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
              sorts={SERVER_SORTS}
              count={list.loading ? null : `${list.items.length}${list.hasMore ? '+' : ''} items`}
            />
          </View>
        }
      />
      <FilterSheet
        visible={filterOpen}
        onClose={() => setFilterOpen(false)}
        value={filters}
        onApply={setFilters}
        sorts={SERVER_SORTS}
      />
    </Screen>
  );
}
