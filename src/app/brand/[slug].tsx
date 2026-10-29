import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { brandLogoUrl, getBrandCatalog, type Brand } from '@/core/api/brands';
import { filterLocally, LOCAL_SORTS, type Filters } from '@/core/filters';
import { usePaged } from '@/core/hooks/useAsync';
import { IconButton } from '@/ui/Button';
import { FilterBar, FilterSheet } from '@/ui/FilterSheet';
import { Glass } from '@/ui/Glass';
import { ProductGrid } from '@/ui/ProductGrid';
import { Header, Screen } from '@/ui/Screen';
import { Skeleton } from '@/ui/Skeleton';
import { Text } from '@/ui/Text';
import { radius, usePalette } from '@/ui/theme';

export default function BrandScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [brand, setBrand] = useState<Brand | null>(null);
  const [total, setTotal] = useState(0);
  const [filters, setFilters] = useState<Filters>({ sort: 'popular' });
  const [filterOpen, setFilterOpen] = useState(false);

  const list = usePaged(async (page) => {
    const res = await getBrandCatalog(slug, page);
    if (page === 1) {
      setBrand(res.brand);
      setTotal(res.total);
    }
    return res;
  }, [slug]);

  // The catalog endpoint has no sort or filters (same as the website), so they
  // run on the loaded rows.
  const items = filterLocally(list.items, filters);
  const filtered = !!(filters.onSale || filters.inStock || filters.min != null || filters.max != null);
  const name = brand?.name ?? slug.replace(/-/g, ' ');

  return (
    <Screen tabBar="categories">
      <Header
        title={name}
        right={<IconButton icon="search" label="Search" onPress={() => router.push({ pathname: '/search', params: { q: name } })} />}
      />
      <ProductGrid
        {...list}
        items={items}
        onEndReached={list.loadMore}
        onRefresh={list.refresh}
        onRetry={list.reload}
        emptyTitle={filtered ? 'No products match' : `No ${name} products right now`}
        emptyMessage={filtered ? 'Try removing a filter.' : 'Check back soon, or search for similar products.'}
        header={
          <View style={{ gap: 12, paddingHorizontal: 6, paddingBottom: 10 }}>
            <BrandHero brand={brand} name={name} total={total} loading={list.loading} />
            <FilterBar value={filters} onChange={setFilters} onOpen={() => setFilterOpen(true)} sorts={LOCAL_SORTS} />
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

function BrandHero({ brand, name, total, loading }: { brand: Brand | null; name: string; total: number; loading: boolean }) {
  const t = usePalette();
  const [expanded, setExpanded] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);
  const logo = brandLogoUrl(brand?.logo);

  if (loading && !brand) return <Skeleton height={150} r={radius.xl} />;

  return (
    <Glass radius={radius.xl} style={{ overflow: 'hidden' }}>
      <LinearGradient
        colors={[`${t.primary}22`, `${t.accent}14`, 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.hero}>
        <View style={styles.logoWrap}>
          {logo && !logoFailed ? (
            <Image source={{ uri: logo }} style={styles.logo} contentFit="contain" transition={200} onError={() => setLogoFailed(true)} />
          ) : (
            <Text variant="display" tone="primary">
              {name.trim()[0]?.toUpperCase()}
            </Text>
          )}
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text variant="title" numberOfLines={2}>
            {name}
          </Text>
          <View style={styles.meta}>
            <Ionicons name="cube-outline" size={14} color={t.textMuted} />
            <Text variant="caption" tone="muted">
              {total.toLocaleString('en-IN')} product{total === 1 ? '' : 's'}
            </Text>
            <Ionicons name="shield-checkmark" size={14} color={t.success} style={{ marginLeft: 6 }} />
            <Text variant="caption" tone="success">
              Genuine
            </Text>
          </View>
        </View>
      </View>
      {!!brand?.description && (
        <View style={{ paddingHorizontal: 16, paddingBottom: 14, gap: 4 }}>
          <Text tone="muted" numberOfLines={expanded ? undefined : 3} style={{ fontSize: 14, lineHeight: 20 }}>
            {brand.description}
          </Text>
          <Text variant="label" tone="primary" onPress={() => setExpanded((v) => !v)} suppressHighlighting>
            {expanded ? 'Show less' : 'Read more'}
          </Text>
        </View>
      )}
    </Glass>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 },
  logoWrap: { width: 76, height: 76, borderRadius: 20, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  logo: { width: '84%', height: '84%' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
