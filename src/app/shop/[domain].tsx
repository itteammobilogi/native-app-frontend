import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { DOMAIN_META } from '@/core/api/catalog';
import { PRICE_PRESETS, SERVER_SORTS, type Filters } from '@/core/filters';
import { useAsync, usePaged } from '@/core/hooks/useAsync';
import { loadShopPage, loadSubcategories, peekShopPage, prefetchShopVariants } from '@/core/shopListing';
import { IconButton } from '@/ui/Button';
import { Chip } from '@/ui/Chip';
import { FilterBar, FilterSheet } from '@/ui/FilterSheet';
import { ProductGrid } from '@/ui/ProductGrid';
import { Header, Screen } from '@/ui/Screen';

export default function ShopScreen() {
  const { domain, subcategory: initialSub } = useLocalSearchParams<{ domain: string; subcategory?: string }>();
  const [filters, setFilters] = useState<Filters>({ sort: 'created_desc', category: initialSub });
  const [filterOpen, setFilterOpen] = useState(false);

  const subs = useAsync(() => loadSubcategories(domain), [domain]);
  const categories = (subs.data ?? []).map((s) => ({ value: s.slug, label: s.category_name }));

  // Cached in the app (core/shopListing): a page the categories screen
  // prefetched, or one seen earlier, shows at once while it's refetched.
  const list = usePaged(
    (page, fresh) => loadShopPage(domain, filters, page, fresh),
    [domain, filters],
    () => peekShopPage(domain, filters),
  );

  // Once this list is in, fetch the same list in the other sort orders, so
  // switching sort shows it at once.
  const listReady = !list.loading && !list.error;
  useEffect(() => {
    if (!listReady) return;
    prefetchShopVariants(
      domain,
      SERVER_SORTS.filter((s) => s.value !== filters.sort).map((s) => ({ ...filters, sort: s.value })),
    );
  }, [listReady, domain, filters]);

  // Price presets are only fetched when the filter drawer opens: five heavy
  // queries per category is too many to send for every visit, and the
  // drawer is open a few seconds before "Apply".
  const openFilters = () => {
    setFilterOpen(true);
    prefetchShopVariants(
      domain,
      PRICE_PRESETS.map((p) => ({ ...filters, min: p.min, max: p.max })),
    );
  };

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
                onOpen={openFilters}
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
