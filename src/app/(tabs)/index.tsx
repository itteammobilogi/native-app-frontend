import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { blogAsset, listBlogs, type BlogPost } from '@/core/api/blogs';
import { listBrands } from '@/core/api/brands';
import {
  absUrl,
  DOMAIN_META,
  domainName,
  getBanners,
  getDeals,
  getDomains,
  getGuideBanners,
  getTrending,
  type Banner,
  type ProductSummary,
  type Subcategory,
} from '@/core/api/catalog';
import { listCombos, type Combo } from '@/core/api/combos';
import { listNavbharat } from '@/core/api/navbharat';
import { getForYou } from '@/core/api/reco';
import { useAuth } from '@/core/auth/AuthContext';
import { useCart } from '@/core/cart/CartContext';
import { useAsync } from '@/core/hooks/useAsync';
import { openSiteLink } from '@/core/links';
import { useUnreadNotifications } from '@/core/hooks/useUnreadNotifications';
import { useSaved } from '@/core/saved/SavedContext';
import { DEFAULT_SHOP_FILTERS, loadShopPage, loadSubcategories, peekShopPage, prefetchShop } from '@/core/shopListing';
import { tap } from '@/ui/Button';
import { BannerCarousel } from '@/ui/BannerCarousel';
import { AiStrip, Bento } from '@/ui/home/Bento';
import { HEADER_OVERLAP, HomeHeader } from '@/ui/home/HomeHeader';
import { useRevealStage } from '@/ui/introGate';
import { OndcLogo } from '@/ui/Logo';
import { PincodeSheet } from '@/ui/PincodeSheet';
import { ProductRail } from '@/ui/ProductRail';
import { Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { radius, TAB_BAR_HEIGHT, usePalette } from '@/ui/theme';

type Shelf = { items: ProductSummary[]; subs: Subcategory[] };

export default function HomeScreen() {
  const t = usePalette();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { user } = useAuth();
  const { count } = useCart();
  const { recent } = useSaved();
  const unread = useUnreadNotifications();
  const [pinOpen, setPinOpen] = useState(false);
  const [picked, setPicked] = useState<string | null>(null); // shelf chip; null = all

  // Each strip loads independently (like the website), so one slow or failing
  // source doesn't blank the whole page.
  const banners = useAsync(() => getBanners().catch(() => [] as Banner[]), []);
  const domains = useAsync(getDomains, []);
  const deals = useAsync(getDeals, []);
  const trending = useAsync(getTrending, []);
  const navbharat = useAsync(() => listNavbharat({ limit: 6 }).then((p) => p.items).catch(() => [] as ProductSummary[]), []);
  // ~420 kB per call (each brand carries its page HTML), so only the tile's
  // fields are kept.
  const brands = useAsync(
    () => listBrands({ featured: true, limit: 12 }).then((p) => p.items.map(({ id, name, slug, logo }) => ({ id, name, slug, logo }))),
    [],
  );
  const combos = useAsync(() => listCombos().catch(() => [] as Combo[]), []);
  // Photo cards near the bottom: the admin's live app banners, or, when
  // there are none, the newest blog post.
  const guides = useAsync(getGuideBanners, []);
  const latestPost = useAsync(() => listBlogs(1, 1).then((r) => r.items).catch(() => [] as BlogPost[]), []);
  // "Picked for you" comes from the shopper's own orders; like the website it
  // needs at least two products to show.
  const forYou = useAsync(() => (user ? getForYou() : Promise.resolve([])), [user?.id]);

  // One shelf per category, from the same cached first page the category
  // screen opens with. Loaded two categories at a time (a cold listing takes
  // 10 s+ on the backend), painting any page already in memory at once.
  const [shelves, setShelves] = useState<Record<string, Shelf>>({});
  const [shelfRound, setShelfRound] = useState(0);
  useEffect(() => {
    const slugs = (domains.data ?? []).map((d) => d.slug).filter(Boolean);
    if (!slugs.length) return;
    let alive = true;
    const fresh = shelfRound > 0;
    const queue = [...slugs];
    const worker = async () => {
      for (let slug = queue.shift(); slug && alive; slug = queue.shift()) {
        const [page, subs] = await Promise.all([
          loadShopPage(slug, DEFAULT_SHOP_FILTERS, 1, fresh).catch(() => null),
          loadSubcategories(slug, fresh),
        ]);
        const s = slug;
        if (alive) setShelves((prev) => ({ ...prev, [s]: { items: page?.items.slice(0, 10) ?? [], subs } }));
      }
    };
    worker();
    worker();
    return () => {
      alive = false;
    };
  }, [domains.data, shelfRound]);

  const refreshing = deals.refreshing || trending.refreshing;
  const onRefresh = () => {
    [banners, domains, deals, trending, navbharat, brands, combos, forYou, guides, latestPost].forEach((s) => s.refresh());
    setShelfRound((n) => n + 1);
  };

  // Below the header, wait for the launch intro to settle, then mount the
  // page a few sections per frame, top first (the data is already loading).
  const stage = useRevealStage(3);
  const domainList = domains.data ?? [];
  const shownDomains = picked ? domainList.filter((d) => d.slug === picked) : domainList;
  const post = latestPost.data?.[0];
  // Nothing until the admin banners have answered, so the blog fallback
  // doesn't flash in first and get swapped out.
  const guideCards: Guide[] = guides.loading
    ? []
    : guides.data?.length
    ? guides.data.map((g) => ({
        key: `g${g.id}`,
        image: g.image,
        label: g.label.toUpperCase(),
        title: g.title,
        open: () => openSiteLink(g.link_url),
      }))
    : post
      ? [
          {
            key: `b${post.id}`,
            image: blogAsset(post.featured_image),
            label: [(post.category_name || 'Guide').toUpperCase(), shortDate(post.published_at || post.created_at)].filter(Boolean).join(' · '),
            title: post.title,
            open: () => router.push({ pathname: '/blog/[slug]', params: { slug: post.slug } }),
          },
        ]
      : [];

  return (
    <Screen statusBar="light">
      <ScrollView
        contentContainerStyle={{ paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.primary} progressViewOffset={insets.top} />}>
        <HomeHeader unread={unread} cartCount={count} onPincode={() => setPinOpen(true)} />

        <View style={{ marginTop: -HEADER_OVERLAP, minHeight: HEADER_OVERLAP }}>
          <BannerCarousel banners={banners.data} loading={banners.loading} aspect={0.45} />
        </View>

        {stage >= 1 && (
          <>
            <Bento
              deals={deals.data}
              trending={trending.data}
              navbharat={navbharat.data}
              brands={brands.data}
              combo={combos.data?.[0]}
              loading={deals.loading}
            />
            <AiStrip />
          </>
        )}

        {stage >= 2 && (
          <>
            {/* Shelf chips: all shelves, or just one category's */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={{ marginTop: 18 }}>
              <ShelfChip label="All shelves" active={!picked} onPress={() => setPicked(null)} />
              {domainList.map((d) => (
                <ShelfChip
                  key={d.slug}
                  label={domainName(d)}
                  image={absUrl(DOMAIN_META[d.slug]?.image)}
                  active={picked === d.slug}
                  onPress={() => setPicked(picked === d.slug ? null : d.slug)}
                />
              ))}
            </ScrollView>
            <View style={[styles.divider, { backgroundColor: t.hairline }]} />

            {shownDomains.map((d) => {
              // A page already in memory paints before this round's load lands.
              const cached = shelves[d.slug] ? undefined : peekShopPage(d.slug, DEFAULT_SHOP_FILTERS);
              const shelf = shelves[d.slug] ?? (cached && { items: cached.items.slice(0, 10), subs: [] });
              const meta = DOMAIN_META[d.slug];
              const name = domainName(d);
              return (
                <ProductRail
                  key={d.slug}
                  title={`${name} shelf`}
                  subtitle={shelf?.subs.length ? shelf.subs.slice(0, 3).map((s) => s.category_name).join(', ') : undefined}
                  icon={(meta?.icon as keyof typeof Ionicons.glyphMap) ?? 'pricetags-outline'}
                  image={absUrl(meta?.image)}
                  items={shelf?.items}
                  loading={!shelf}
                  onSeeAll={() => {
                    prefetchShop(d.slug);
                    router.push({ pathname: '/shop/[domain]', params: { domain: d.slug } });
                  }}
                />
              );
            })}
          </>
        )}

        {stage >= 3 && (
          <>
            {!picked && (forYou.data?.length ?? 0) >= 2 && (
              <ProductRail title="Picked for you" subtitle="Based on your orders" icon="sparkles" items={forYou.data} loading={false} />
            )}
            {!picked && (
              <ProductRail title="Recently viewed" subtitle="Pick up where you left off" icon="time-outline" items={recent.slice(0, 12)} loading={false} />
            )}

            {/* Guide cards: the admin's app banners, or else the newest blog post */}
            {guideCards.length === 1 ? (
              <GuideCard card={guideCards[0]} width={width - 32} style={{ marginHorizontal: 16, marginTop: 26 }} />
            ) : guideCards.length > 1 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                snapToInterval={width - 32 - 24 + 10}
                decelerationRate="fast"
                contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}
                style={{ marginTop: 26 }}>
                {guideCards.map((card) => (
                  <GuideCard key={card.key} card={card} width={width - 32 - 24} />
                ))}
              </ScrollView>
            ) : null}

            <View style={styles.trust}>
              {[
                ['lock-closed-outline', 'Secure payments'],
                ['checkmark-circle-outline', 'Verified sellers'],
                ['refresh-outline', 'Easy returns'],
              ].map(([icon, label]) => (
                <View key={label} style={styles.trustItem}>
                  <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={17} color={t.primary} />
                  <Text variant="caption" tone="muted">
                    {label}
                  </Text>
                </View>
              ))}
            </View>
            <View style={styles.powered}>
              <Text variant="caption" tone="faint">
                Powered by
              </Text>
              <OndcLogo height={22} />
            </View>
          </>
        )}
      </ScrollView>

      <PincodeSheet visible={pinOpen} onClose={() => setPinOpen(false)} />
    </Screen>
  );
}

type Guide = { key: string; image: string | null; label: string; title: string; open: () => void };

// Photo with the label and title over a dark fade at the bottom.
function GuideCard({ card, width, style }: { card: Guide; width: number; style?: StyleProp<ViewStyle> }) {
  const t = usePalette();
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={card.title}
      onPress={() => (tap(), card.open())}
      style={({ pressed }) => [styles.promo, { width, backgroundColor: t.tileFill, opacity: pressed ? 0.9 : 1 }, style]}>
      <Image source={card.image ? { uri: card.image } : undefined} style={{ width, height: Math.round(width * 0.375) }} contentFit="cover" transition={250} />
      <LinearGradient
        colors={['transparent', 'rgba(20,20,28,0.55)', 'rgba(20,20,28,0.78)']}
        locations={[0.25, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.promoText}>
        {!!card.label && (
          <Text variant="tiny" style={{ color: 'rgba(255,255,255,0.9)', letterSpacing: 1.2, fontWeight: '800' }}>
            {card.label}
          </Text>
        )}
        <Text variant="heading" tone="onPrimary" numberOfLines={2} style={{ fontSize: 16, lineHeight: 21 }}>
          {card.title}
        </Text>
      </View>
    </Pressable>
  );
}

// "28 OCT"
function shortDate(iso?: string | null) {
  const d = iso ? new Date(iso) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }).toUpperCase() : '';
}

function ShelfChip({ label, image, active, onPress }: { label: string; image?: string | null; active: boolean; onPress: () => void }) {
  const t = usePalette();
  const on = t.dark ? '#FFFFFF' : '#0B1B33';
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={() => (tap(), onPress())}
      style={[
        styles.chip,
        active ? { backgroundColor: on, borderColor: on } : { backgroundColor: t.glassFill, borderColor: t.glassBorder },
      ]}>
      {image && <Image source={{ uri: image }} style={styles.chipImage} contentFit="cover" />}
      <Text variant="caption" style={{ fontWeight: '700', color: active ? (t.dark ? '#0B1B33' : '#FFFFFF') : t.text }}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chips: { paddingHorizontal: 16, gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  chipImage: { width: 24, height: 24, borderRadius: 12, marginLeft: -6 },
  divider: { height: 1, marginTop: 14 },
  promo: { borderRadius: 20, overflow: 'hidden' },
  promoText: { position: 'absolute', left: 16, right: 16, bottom: 14, gap: 4 },
  trust: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', columnGap: 16, rowGap: 8, marginTop: 22, paddingHorizontal: 16 },
  trustItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  powered: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 10 },
});
