import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { DOMAIN_META, getSubcategories, listProducts, type Sort } from '@/core/api/catalog';
import { SERVER_SORTS, type Filters } from '@/core/filters';
import { useAsync, usePaged } from '@/core/hooks/useAsync';
import { IconButton } from '@/ui/Button';
import { Chip } from '@/ui/Chip';
import { FilterBar, FilterSheet } from '@/ui/FilterSheet';
import { ProductGrid } from '@/ui/ProductGrid';
import { Header, Screen } from '@/ui/Screen';

export default function ShopScreen() {
  const { domain, subcategory: initialSub } = useLocalSearchParams<{ domain: string; subcategory?: string }>();
  const [filters, setFilters] = useState<Filters>({ sort: 'created_desc', category: initialSub });
  const [filterOpen, setFilterOpen] = useState(false);

  const subs = useAsync(() => getSubcategories(domain), [domain]);
  const categories = (subs.data ?? []).map((s) => ({ value: s.slug, label: s.category_name }));

  const list = usePaged(
    (page) =>
      listProducts({
        domain,
        subcategory: filters.category,
        sort: filters.sort as Sort,
        min: filters.min,
        max: filters.max,
        in_stock: filters.inStock ? 1 : undefined,
        page,
      }),
    [domain, filters],
  );

  const title = DOMAIN_META[domain]?.name ?? domain?.replace(/-/g, ' ');
  const setCategory = (category?: string) => setFilters((f) => ({ ...f, category }));

  return (
    <Screen tabBar="categories">
      <Header
        title={title}
        right={<IconButton icon="search" label="Search" onPress={() => router.push('/search')} />}
      />
      <ProductGrid
        {...list}
        onEndReached={list.loadMore}
        onRefresh={list.refresh}
        onRetry={list.reload}
        emptyTitle="No products match"
        emptyMessage="Try removing a filter or picking another category."
        header={
          <View style={{ gap: 10, paddingBottom: 8 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 6 }}>
              <Chip label="All" active={!filters.category} onPress={() => setCategory(undefined)} />
              {categories.map((c) => (
                <Chip key={c.value} label={c.label} active={filters.category === c.value} onPress={() => setCategory(c.value)} />
              ))}
            </ScrollView>
            <View style={{ paddingHorizontal: 6 }}>
              <FilterBar
                value={filters}
                onChange={setFilters}
                onOpen={() => setFilterOpen(true)}
                sorts={SERVER_SORTS}
                categories={categories}
                count={list.loading ? null : `${list.items.length}${list.hasMore ? '+' : ''} items`}
              />
            </View>
          </View>
        }
      />
      <FilterSheet
        visible={filterOpen}
        onClose={() => setFilterOpen(false)}
        value={filters}
        onApply={setFilters}
        sorts={SERVER_SORTS}
        categories={categories}
      />
    </Screen>
  );
}
