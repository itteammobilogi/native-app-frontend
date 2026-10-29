import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { listBrands } from '@/core/api/brands';
import { listCombos, type Combo } from '@/core/api/combos';
import { useUnreadNotifications } from '@/core/hooks/useUnreadNotifications';
import { useSaved } from '@/core/saved/SavedContext';
import { useAuth } from '@/core/auth/AuthContext';
import { useCart } from '@/core/cart/CartContext';
import {
  absUrl,
  DOMAIN_META,
  domainName,
  getBanners,
  getDeals,
  getDomains,
  getQuickFilters,
  getTrending,
  type Banner,
} from '@/core/api/catalog';
import { useAsync } from '@/core/hooks/useAsync';
import { openSiteLink } from '@/core/links';
import { useLocation } from '@/core/location/LocationContext';
import { IconButton, tap } from '@/ui/Button';
import { AiOrb } from '@/ui/assistant/AiOrb';
import { BannerCarousel } from '@/ui/BannerCarousel';
import { BrandTile } from '@/ui/BrandTile';
import { ComboTile } from '@/ui/ComboTile';
import { Glass } from '@/ui/Glass';
import { useIntroRevealed } from '@/ui/introGate';
import { PincodeSheet } from '@/ui/PincodeSheet';
import { ProductRail } from '@/ui/ProductRail';
import { Screen, SectionTitle } from '@/ui/Screen';
import { Skeleton } from '@/ui/Skeleton';
import { Text } from '@/ui/Text';
import { radius, TAB_BAR_HEIGHT, usePalette } from '@/ui/theme';

export default function HomeScreen() {
  const t = usePalette();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { count } = useCart();
  const { location } = useLocation();
  const [pinOpen, setPinOpen] = useState(false);

  // Each strip loads independently (like the website), so one slow or failing
  // source doesn't blank the whole page.
  const banners = useAsync(() => getBanners().catch(() => [] as Banner[]), []);
  const filters = useAsync(() => getQuickFilters().catch(() => []), []);
  const domains = useAsync(getDomains, []);
  const deals = useAsync(getDeals, []);
  const trending = useAsync(getTrending, []);
  const brands = useAsync(() => listBrands({ featured: true, limit: 12 }).then((p) => p.items), []);

  const refreshing = deals.refreshing || trending.refreshing;
  const { recent, wishlist } = useSaved();
  const unread = useUnreadNotifications();
  const combos = useAsync(() => listCombos().catch(() => [] as Combo[]), []);

  const onRefresh = () => [banners, filters, domains, deals, trending, brands, combos].forEach((s) => s.refresh());

  const firstName = user?.name?.trim().split(/\s+/)[0];
  // Below the search bar, wait for the launch intro to settle before mounting
  // (the data above is already loading).
  const revealed = useIntroRevealed();

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 32 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.primary} />}>
        {/* Top bar */}
        <View style={styles.topBar}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="caption" tone="muted">
              {firstName ? `Hi ${firstName} 👋` : 'Welcome to'}
            </Text>
            <Text variant="title" style={{ fontSize: 24 }}>
              Zilly<Text variant="title" tone="primary" style={{ fontSize: 24 }}>Buy</Text>
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <IconButton icon="heart-outline" label="Wishlist" badge={wishlist.length} onPress={() => router.push('/wishlist')} />
            <IconButton icon="notifications-outline" label="Notifications" badge={unread} onPress={() => router.push('/notifications')} />
            <IconButton icon="bag-handle-outline" label="Cart" badge={count} onPress={() => router.push('/cart')} />
          </View>
        </View>

        <Pressable onPress={() => setPinOpen(true)} style={styles.locationRow} accessibilityRole="button">
          <Ionicons name="location" size={16} color={t.primary} />
          <Text variant="label" numberOfLines={1} style={{ flexShrink: 1 }}>
            {location ? `Deliver to ${location.label} · ${location.pincode}` : 'Set delivery pincode'}
          </Text>
          <Ionicons name="chevron-down" size={14} color={t.textMuted} />
        </Pressable>

        {/* Search */}
        <Pressable onPress={() => (tap(), router.push('/search'))} style={{ paddingHorizontal: 16, marginBottom: 18 }}>
          <Glass radius={radius.md} style={styles.search}>
            <Ionicons name="search" size={20} color={t.textMuted} />
            <Text tone="faint" style={{ flex: 1 }}>
              Search products, brands…
            </Text>
            <View style={[styles.searchKbd, { backgroundColor: t.primary }]}>
              <Ionicons name="arrow-forward" size={16} color="#fff" />
            </View>
          </Glass>
        </Pressable>

        {revealed && (
          <>
            <BannerCarousel banners={banners.data} loading={banners.loading} />

            {/* Quick filters */}
            {!!filters.data?.length && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pills}>
                {filters.data.map((f) => (
                  <Pressable key={f.id} onPress={() => (tap(), openSiteLink(f.href))}>
                    <Glass radius={radius.pill} style={styles.pill}>
                      <Ionicons name={pillIcon(f.icon_name)} size={16} color={t.primary} />
                      <View>
                        <Text variant="label" style={{ fontSize: 13 }}>
                          {f.title}
                        </Text>
                        {!!f.subtitle && (
                          <Text variant="tiny" tone="muted">
                            {f.subtitle}
                          </Text>
                        )}
                      </View>
                    </Glass>
                  </Pressable>
                ))}
              </ScrollView>
            )}

            {/* Categories */}
            <SectionTitle title="Shop by category" action="See all" onAction={() => router.push('/categories')} />
            <View style={styles.catGrid}>
              {(domains.data ?? []).slice(0, 8).map((d) => {
                const meta = DOMAIN_META[d.slug];
                return (
                  <Pressable
                    key={d.slug}
                    style={styles.catItem}
                    onPress={() => (tap(), router.push({ pathname: '/shop/[domain]', params: { domain: d.slug } }))}>
                    <Glass radius={radius.lg} style={styles.catTile}>
                      {meta ? (
                        <Image source={{ uri: absUrl(meta.image)! }} style={styles.catImage} contentFit="cover" transition={200} />
                      ) : (
                        <Ionicons name="pricetags-outline" size={26} color={t.primary} />
                      )}
                    </Glass>
                    <Text variant="caption" numberOfLines={2} style={{ textAlign: 'center' }}>
                      {domainName(d)}
                    </Text>
                  </Pressable>
                );
              })}
              {domains.loading &&
                Array.from({ length: 8 }).map((_, i) => (
                  <View key={i} style={styles.catItem}>
                    <Skeleton height={72} r={radius.lg} />
                    <Skeleton width="70%" height={10} />
                  </View>
                ))}
            </View>

            {/* Brands: featured strip, "See all" opens the full searchable list */}
            {(brands.loading || !!brands.data?.length) && (
              <View style={{ marginTop: 8 }}>
                <SectionTitle title="Top brands" action="See all" onAction={() => (tap(), router.push('/brands'))} />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.brandRow}>
                  {brands.loading
                    ? Array.from({ length: 4 }).map((_, i) => (
                        <View key={i} style={{ width: BRAND_TILE, gap: 6 }}>
                          <Skeleton height={86} r={radius.lg} />
                          <Skeleton width="70%" height={10} />
                        </View>
                      ))
                    : brands.data!.map((b) => <BrandTile key={b.id} brand={b} width={BRAND_TILE} />)}
                </ScrollView>
              </View>
            )}

            {!!combos.data?.length && (
              <View style={{ marginTop: 8 }}>
                <SectionTitle title="ZillyCart combos" action="See all" onAction={() => (tap(), router.push('/combos'))} />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.brandRow}>
                  {combos.data.map((c) => (
                    <ComboTile key={c.zc_id} combo={c} width={240} />
                  ))}
                </ScrollView>
              </View>
            )}

            <ProductRail title="Recently viewed" icon="time-outline" items={recent} loading={false} />

            <ProductRail
              title="Deals of the day"
              icon="flash"
              items={deals.data}
              loading={deals.loading}
              onSeeAll={() => router.push({ pathname: '/products', params: { flag: 'deals', title: 'Deals of the day' } })}
            />
            <ProductRail
              title="Trending now"
              icon="trending-up"
              items={trending.data}
              loading={trending.loading}
              onSeeAll={() => router.push({ pathname: '/products', params: { flag: 'featured', title: 'Trending now' } })}
            />

            {/* Trust strip */}
            <Glass radius={radius.lg} style={styles.trust}>
              {[
                ['shield-checkmark-outline', 'Secure payments'],
                ['cube-outline', 'ONDC sellers'],
                ['refresh-outline', 'Easy returns'],
              ].map(([icon, label]) => (
                <View key={label} style={styles.trustItem}>
                  <Ionicons name={icon as any} size={22} color={t.primary} />
                  <Text variant="tiny" tone="muted" style={{ textAlign: 'center' }}>
                    {label}
                  </Text>
                </View>
              ))}
            </Glass>
          </>
        )}
      </ScrollView>

      {/* ZillyAI launcher, floating above the tab bar */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Ask ZillyAI"
        onPress={() => (tap(), router.push('/assistant'))}
        style={({ pressed }) => [
          styles.aiLauncher,
          { bottom: TAB_BAR_HEIGHT + Math.max(insets.bottom, 12) + 14, transform: [{ scale: pressed ? 0.95 : 1 }] },
        ]}>
        <Glass strong radius={radius.pill} style={styles.aiPill}>
          <AiOrb size={34} pulse />
          <Text variant="label" style={{ fontSize: 13 }}>
            Ask ZillyAI
          </Text>
        </Glass>
      </Pressable>

      <PincodeSheet visible={pinOpen} onClose={() => setPinOpen(false)} />
    </Screen>
  );
}

const BRAND_TILE = 96;

const pillIcon = (name?: string): keyof typeof Ionicons.glyphMap =>
  (({ tag: 'pricetag', flame: 'flame', percent: 'pricetags', sparkles: 'sparkles', zap: 'flash' }) as const)[
    name as 'tag'
  ] ?? 'pricetag';

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 6 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, marginBottom: 14 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 54, paddingLeft: 16, paddingRight: 7 },
  searchKbd: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  pills: { paddingHorizontal: 16, gap: 10, marginBottom: 22 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 9 },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 10 },
  catItem: { width: '25%', paddingHorizontal: 6, marginBottom: 14, alignItems: 'center', gap: 6 },
  catTile: { width: '100%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  catImage: { width: '100%', height: '100%' },
  aiLauncher: { position: 'absolute', right: 16 },
  aiPill: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 5, paddingRight: 14, paddingVertical: 5 },
  brandRow: { paddingHorizontal: 16, gap: 10 },
  trust: { flexDirection: 'row', marginHorizontal: 16, marginTop: 28, paddingVertical: 16 },
  trustItem: { flex: 1, alignItems: 'center', gap: 6 },
});
