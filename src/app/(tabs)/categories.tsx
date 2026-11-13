import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { absUrl, DOMAIN_META, domainName, getDomains, type Subcategory } from '@/core/api/catalog';
import { useAsync } from '@/core/hooks/useAsync';
import { loadSubcategories, prefetchAllShops, prefetchShop } from '@/core/shopListing';
import { tap } from '@/ui/Button';
import { Screen } from '@/ui/Screen';
import { Skeleton } from '@/ui/Skeleton';
import { Text } from '@/ui/Text';
import { radius, TAB_BAR_HEIGHT, usePalette } from '@/ui/theme';

export default function CategoriesScreen() {
  const t = usePalette();
  const insets = useSafeAreaInsets();
  const domains = useAsync(getDomains, []);
  const [subs, setSubs] = useState<Record<string, Subcategory[]>>({});

  // Fetch every category's first page now, so the tap opens a filled list,
  // and its subcategories for the counts and the popular aisles.
  useEffect(() => {
    if (!domains.data) return;
    let alive = true;
    prefetchAllShops(domains.data.map((d) => d.slug));
    for (const d of domains.data) {
      loadSubcategories(d.slug).then((list) => {
        if (alive) setSubs((s) => ({ ...s, [d.slug]: list }));
      });
    }
    return () => {
      alive = false;
    };
  }, [domains.data]);

  const open = (domain: string, subcategory?: string) => {
    tap();
    router.push({ pathname: '/shop/[domain]', params: subcategory ? { domain, subcategory } : { domain } });
  };

  return (
    <Screen statusBar="light">
      <ScrollView
        contentContainerStyle={{ paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 32 }}
        refreshControl={
          <RefreshControl refreshing={domains.refreshing} onRefresh={domains.refresh} tintColor={t.primary} progressViewOffset={insets.top} />
        }>
        <View style={[styles.header, { paddingTop: insets.top + 12, backgroundColor: t.dark ? '#0B4A99' : t.primary }]}>
          <View pointerEvents="none" style={styles.ring} />
          <Text variant="title" tone="onPrimary">
            Shelves
          </Text>
          <Text variant="caption" style={{ color: 'rgba(255,255,255,0.85)' }}>
            Everything sold by sellers on ZillyBuy, aisle by aisle
          </Text>
          <Pressable
            accessibilityRole="search"
            onPress={() => (tap(), router.push('/search'))}
            style={[styles.search, { backgroundColor: t.glassFill }]}>
            <Ionicons name="search" size={18} color={t.textFaint} />
            <Text variant="caption" tone="faint" style={{ flex: 1, fontSize: 13 }}>
              Search for products, brands…
            </Text>
          </Pressable>
        </View>

        <View style={styles.list}>
          {domains.loading && Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} height={96} r={radius.lg} />)}

          {domains.data?.map((d) => {
            const meta = DOMAIN_META[d.slug];
            const list = subs[d.slug] ?? [];
            const count = list.reduce((n, s) => n + Number(s.product_count || 0), 0);
            return (
              <Pressable
                key={d.slug}
                onPressIn={() => prefetchShop(d.slug)}
                onPress={() => open(d.slug)}
                style={({ pressed }) => [styles.row, { backgroundColor: t.glassFill, borderColor: t.glassBorder, opacity: pressed ? 0.85 : 1 }]}>
                <View style={[styles.thumb, { backgroundColor: t.tileFill }]}>
                  {meta ? (
                    <Image source={{ uri: absUrl(meta.image)! }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
                  ) : (
                    <Ionicons name="pricetags-outline" size={28} color={t.primary} />
                  )}
                </View>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text variant="heading" numberOfLines={1}>
                    {domainName(d)}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name={(meta?.icon as keyof typeof Ionicons.glyphMap) ?? 'pricetag-outline'} size={14} color={t.textMuted} />
                    <Text variant="caption" tone="muted" numberOfLines={1} style={{ flex: 1 }}>
                      {list.length
                        ? `${list.length} aisles${count ? ` · ${count.toLocaleString('en-IN')} items` : ''}`
                        : `Explore ${domainName(d).toLowerCase()}`}
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color={t.textFaint} />
              </Pressable>
            );
          })}
        </View>

        {/* Popular aisles: the biggest few subcategories of each shelf */}
        {Object.keys(subs).length > 0 && (
          <View style={{ paddingHorizontal: 16, gap: 10, marginTop: 8 }}>
            <Text variant="heading">Popular aisles</Text>
            <View style={styles.wrap}>
              {(domains.data ?? []).flatMap((d) =>
                [...(subs[d.slug] ?? [])]
                  .sort((a, b) => Number(b.product_count) - Number(a.product_count))
                  .slice(0, 3)
                  .map((s) => (
                    <Pressable
                      key={`${d.slug}-${s.slug}`}
                      onPress={() => open(d.slug, s.slug)}
                      style={[styles.aisle, { backgroundColor: t.glassFill, borderColor: t.glassBorder }]}>
                      <Text variant="caption" style={{ fontWeight: '600' }}>
                        {s.category_name}
                      </Text>
                    </Pressable>
                  )),
              )}
            </View>
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingBottom: 18, gap: 4, overflow: 'hidden' },
  ring: {
    position: 'absolute',
    width: 220,
    height: 220,
    top: -90,
    right: -60,
    borderRadius: 999,
    borderWidth: 22,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 46, paddingHorizontal: 14, borderRadius: radius.md, marginTop: 12 },
  list: { padding: 16, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 12, borderRadius: radius.lg, borderWidth: 1 },
  thumb: { width: 72, height: 72, borderRadius: radius.md, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  aisle: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1 },
});
