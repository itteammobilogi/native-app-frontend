import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import {
  getNavbharatBanners,
  getNavbharatCategories,
  groupDomains,
  listNavbharat,
} from '@/core/api/navbharat';
import { useAsync, usePaged } from '@/core/hooks/useAsync';
import { BannerCarousel } from '@/ui/BannerCarousel';
import { Chip } from '@/ui/Chip';
import { Input } from '@/ui/Input';
import { ProductGrid } from '@/ui/ProductGrid';
import { ProductRail } from '@/ui/ProductRail';
import { Header, Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { radius, usePalette } from '@/ui/theme';

type Filter = { kind: 'all' } | { kind: 'deals' } | { kind: 'domain'; slug: string; category?: string } | { kind: 'category'; slug: string };

// NavBharat (Made-in-India) store, the app's version of the website's
// /navbharat, /navbharat/all, /navbharat/deals and /navbharat/<slug>, all on
// one screen: the filter chips switch between them in place.
export default function NavbharatScreen() {
  const t = usePalette();
  const params = useLocalSearchParams<{ deals?: string; domain?: string; category?: string }>();
  const [filter, setFilter] = useState<Filter>(() =>
    params.deals
      ? { kind: 'deals' }
      : params.domain
        ? { kind: 'domain', slug: params.domain }
        : params.category
          ? { kind: 'category', slug: params.category }
          : { kind: 'all' },
  );
  const [query, setQuery] = useState('');
  const [name, setName] = useState('');

  useEffect(() => {
    const id = setTimeout(() => setName(query.trim()), 350);
    return () => clearTimeout(id);
  }, [query]);

  const banners = useAsync(() => getNavbharatBanners().catch(() => []), []);
  const categories = useAsync(() => getNavbharatCategories().catch(() => []), []);
  const deals = useAsync(() => listNavbharat({ deals: true, limit: 12 }).then((p) => p.items), []);
  const domains = groupDomains(categories.data ?? []);

  const domainSlug = filter.kind === 'domain' ? filter.slug : undefined;
  const categorySlug = filter.kind === 'category' ? filter.slug : filter.kind === 'domain' ? filter.category : undefined;
  const [total, setTotal] = useState<number | null>(null);

  const list = usePaged(
    async (page) => {
      const res = await listNavbharat({
        page,
        name: name || undefined,
        deals: filter.kind === 'deals',
        domain_slug: domainSlug,
        category_slug: categorySlug,
      });
      if (page === 1) setTotal(res.total);
      return res;
    },
    [filter.kind, domainSlug, categorySlug, name],
  );

  const subcats = domainSlug ? (categories.data ?? []).filter((c) => c.domain_slug === domainSlug && Number(c.product_count) > 0) : [];
  const landing = filter.kind === 'all' && !name;
  const heading =
    filter.kind === 'deals'
      ? 'NavBharat deals'
      : filter.kind === 'all'
        ? 'All NavBharat products'
        : filter.kind === 'domain'
          ? (subcats.find((c) => c.category_slug === filter.category)?.category_name ?? domains.find((d) => d.slug === filter.slug)?.name ?? filter.slug)
          : ((categories.data ?? []).find((c) => c.category_slug === filter.slug)?.category_name ?? filter.slug.replace(/-/g, ' '));

  const onRefresh = () => {
    [banners, categories, deals].forEach((s) => s.refresh());
    list.refresh();
  };

  return (
    <Screen>
      <Header title="NavBharat" />
      <ProductGrid
        {...list}
        onEndReached={list.loadMore}
        onRefresh={onRefresh}
        onRetry={list.reload}
        emptyTitle={name ? `No results for “${name}”` : 'Nothing here yet'}
        emptyMessage="Try another category or search term."
        header={
          <View style={{ paddingBottom: 8 }}>
            {landing && (
              <>
                <View style={{ marginHorizontal: -10 }}>
                  <BannerCarousel banners={banners.data} loading={banners.loading} aspect={0.45} />
                </View>
                <Intro />
              </>
            )}

            <View style={{ paddingHorizontal: 6, marginTop: landing ? 16 : 0 }}>
              <Input icon="search" placeholder="Search Made-in-India products…" value={query} onChangeText={setQuery} autoCorrect={false} returnKeyType="search" />
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              <Chip label="All" active={filter.kind === 'all'} onPress={() => setFilter({ kind: 'all' })} />
              <Chip label="🔥 Deals" active={filter.kind === 'deals'} onPress={() => setFilter({ kind: 'deals' })} />
              {domains.map((d) => (
                <Chip key={d.slug} label={d.name} active={domainSlug === d.slug} onPress={() => setFilter({ kind: 'domain', slug: d.slug })} />
              ))}
            </ScrollView>

            {subcats.length > 1 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.chips, { paddingTop: 0 }]}>
                {subcats.map((c) => (
                  <Chip
                    key={c.category_slug}
                    label={c.category_name}
                    active={filter.kind === 'domain' && filter.category === c.category_slug}
                    onPress={() =>
                      setFilter({
                        kind: 'domain',
                        slug: domainSlug!,
                        category: filter.kind === 'domain' && filter.category === c.category_slug ? undefined : c.category_slug,
                      })
                    }
                  />
                ))}
              </ScrollView>
            )}

            {landing && (
              <View style={{ marginHorizontal: -10, marginTop: -14, marginBottom: 12 }}>
                <ProductRail title="Deal of the day" icon="flash" items={deals.data} loading={deals.loading} onSeeAll={() => setFilter({ kind: 'deals' })} />
              </View>
            )}

            <View style={styles.listHead}>
              <Text variant="heading" style={{ textTransform: 'capitalize', flexShrink: 1 }} numberOfLines={1}>
                {heading}
              </Text>
              {!list.loading && total != null && (
                <Text variant="caption" tone="muted">
                  {total.toLocaleString('en-IN')} items
                </Text>
              )}
            </View>
            {filter.kind === 'deals' && (
              <View style={[styles.dealNote, { backgroundColor: `${t.warning}1A` }]}>
                <Ionicons name="time-outline" size={14} color={t.warning} />
                <Text variant="caption" style={{ color: t.warning }}>
                  Limited-time prices from Indian makers
                </Text>
              </View>
            )}
          </View>
        }
      />
    </Screen>
  );
}

// "Made in India" intro + trust points (website: the NavBharat trust strip).
function Intro() {
  const t = usePalette();
  return (
    <View style={{ paddingHorizontal: 6 }}>
      <LinearGradient colors={['#FF9933', '#FFFFFF', '#138808']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.flag} />
      <Text variant="title">Made in India, made for everyday</Text>
      <Text tone="muted" style={{ marginTop: 4, fontSize: 14, lineHeight: 20 }}>
        Handpicked products from Indian brands, artisans, MSMEs and self-help groups, sold on ONDC.
      </Text>
      <View style={styles.trust}>
        {(
          [
            ['hand-left-outline', 'Supports local makers'],
            ['ribbon-outline', 'Authentic Indian craft'],
            ['shield-checkmark-outline', 'Secure payments'],
          ] as const
        ).map(([icon, label]) => (
          <View key={label} style={[styles.trustItem, { backgroundColor: `${t.primary}0F`, borderRadius: radius.md }]}>
            <Ionicons name={icon} size={18} color={t.primary} />
            <Text variant="tiny" tone="muted" style={{ textAlign: 'center' }}>
              {label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { gap: 8, paddingHorizontal: 6, paddingVertical: 12 },
  listHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingHorizontal: 6 },
  dealNote: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: 8, marginHorizontal: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  flag: { height: 4, width: 56, borderRadius: 2, marginBottom: 10 },
  trust: { flexDirection: 'row', gap: 8, marginTop: 14 },
  trustItem: { flex: 1, alignItems: 'center', gap: 6, paddingVertical: 12, paddingHorizontal: 6 },
});
