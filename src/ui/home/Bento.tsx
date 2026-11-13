import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { brandLogoUrl } from '@/core/api/brands';
import type { ProductSummary } from '@/core/api/catalog';
import type { Combo } from '@/core/api/combos';
import { computeProductPrice, formatINR } from '@/core/pricing';
import { AiOrb } from '../assistant/AiOrb';
import { tap } from '../Button';
import { Skeleton } from '../Skeleton';
import { Text } from '../Text';
import { radius, usePalette } from '../theme';

type BrandLite = { id: number; name: string; slug: string; logo?: string | null };

const GAP = 10;

// The home page's tile grid under the banner: deal of the day, under ₹99,
// exclusive deals, Made in India, top brands and a combo.
export function Bento({
  deals,
  trending,
  navbharat,
  brands,
  combo,
  loading,
}: {
  deals?: ProductSummary[];
  trending?: ProductSummary[];
  navbharat?: ProductSummary[];
  brands?: BrandLite[];
  combo?: Combo;
  loading: boolean;
}) {
  const t = usePalette();
  if (loading && !deals?.length) {
    return (
      <View style={styles.grid}>
        <View style={styles.row}>
          <Skeleton height={236} r={radius.lg} style={{ flex: 1 }} />
          <View style={{ flex: 1, gap: GAP }}>
            <Skeleton height={113} r={radius.lg} />
            <Skeleton height={113} r={radius.lg} />
          </View>
        </View>
        <Skeleton height={110} r={radius.lg} />
      </View>
    );
  }

  const deal = deals?.find((p) => p.image) ?? deals?.[0];
  // Two of the cheapest products on show for the "Under ₹99" tile.
  const cheap = [...(deals ?? []), ...(trending ?? [])]
    .filter((p) => p.image && computeProductPrice(p).hasPrice)
    .sort((a, b) => computeProductPrice(a).price - computeProductPrice(b).price)
    .slice(0, 2);
  // Another exclusive deal for the Exclusive tile (not the deal of the day).
  const exclusive = deals?.filter((p) => p.image && p !== deal)[0] ?? deal;
  const madeInIndia = navbharat?.find((p) => p.image);

  return (
    <View style={styles.grid}>
      <View style={styles.row}>
        {deal ? <DealTile product={deal} /> : <View style={{ flex: 1 }} />}
        <View style={{ flex: 1, gap: GAP }}>
          <Tile
            style={{ flex: 1 }}
            outlined
            onPress={() => router.push({ pathname: '/products', params: { flag: 'all', max: '99', title: 'Under ₹99' } })}>
            <View style={styles.tileImages}>
              {cheap.map((p) => (
                <View key={p.id} style={[styles.imageWell, { backgroundColor: t.tileFill }]}>
                  <Image source={{ uri: p.image! }} style={styles.wellImage} contentFit="contain" />
                </View>
              ))}
            </View>
            <Text variant="heading" style={{ fontSize: 15 }}>
              Under ₹99
            </Text>
            <Text variant="tiny" tone="muted" numberOfLines={1} style={{ fontWeight: '500' }}>
              Everyday picks, small prices
            </Text>
          </Tile>

          <Tile
            style={{ flex: 1, backgroundColor: '#0F1B33' }}
            onPress={() => router.push({ pathname: '/products', params: { flag: 'deals', title: 'Exclusive deals' } })}>
            <View style={[styles.tileImages, { justifyContent: 'space-between' }]}>
              <View style={styles.exclusiveTag}>
                <Ionicons name="diamond-outline" size={10} color="#FBBF24" />
                <Text variant="tiny" style={{ color: '#FBBF24', fontSize: 9, letterSpacing: 0.6 }}>
                  DEALS
                </Text>
              </View>
              {exclusive?.image && (
                <View style={[styles.imageWell, { backgroundColor: '#FFFFFF' }]}>
                  <Image source={{ uri: exclusive.image }} style={styles.wellImage} contentFit="contain" />
                </View>
              )}
            </View>
            <Text variant="heading" tone="onPrimary" style={{ fontSize: 15 }}>
              Exclusive
            </Text>
            <Text variant="tiny" numberOfLines={1} style={{ color: 'rgba(255,255,255,0.7)', fontWeight: '500' }}>
              Special prices on ZillyBuy
            </Text>
          </Tile>
        </View>
      </View>

      <Tile style={[styles.wide, { backgroundColor: t.dark ? '#2A2116' : '#FFF4E8' }]} onPress={() => router.push('/navbharat')}>
        <View style={{ flex: 1, gap: 3, paddingRight: 8 }}>
          <Text variant="tiny" style={{ color: '#EA580C', letterSpacing: 0.8 }}>
            ★ NAVBHARAT
          </Text>
          <Text variant="heading" style={{ fontSize: 16 }}>
            Made in India, made for everyday
          </Text>
          <Text variant="tiny" tone="muted" numberOfLines={2} style={{ fontWeight: '500' }}>
            Homegrown brands from across the country
          </Text>
        </View>
        <View style={styles.wideImageWrap}>
          {madeInIndia ? (
            <Image source={{ uri: madeInIndia.image! }} style={styles.wideImage} contentFit="contain" />
          ) : (
            <Ionicons name="flag-outline" size={30} color="#EA580C" />
          )}
          <View style={styles.wideGo}>
            <Ionicons name="arrow-forward" size={14} color="#FFFFFF" />
          </View>
        </View>
      </Tile>

      {(!!brands?.length || combo) && (
        <View style={styles.row}>
          {!!brands?.length && <BrandsTile brands={brands.slice(0, 6)} />}
          {combo ? <ComboBentoTile combo={combo} /> : <View style={{ flex: 1 }} />}
        </View>
      )}
    </View>
  );
}

function DealTile({ product }: { product: ProductSummary }) {
  const t = usePalette();
  const price = computeProductPrice(product);
  return (
    <Tile
      style={{ flex: 1, backgroundColor: t.dark ? '#13213D' : '#EAF3FF', minHeight: 236 }}
      onPress={() => router.push({ pathname: '/product/[slug]', params: { slug: product.slug } })}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
        <View style={[styles.flash, { backgroundColor: t.primary }]}>
          <Ionicons name="flash" size={11} color="#FFFFFF" />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="label" style={{ fontSize: 13 }}>
            Deal of the day
          </Text>
          <Text variant="tiny" tone="muted" numberOfLines={1} style={{ fontWeight: '500' }}>
            {product.brand_name || product.name}
          </Text>
        </View>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel="All deals"
          hitSlop={8}
          onPress={() => (tap(), router.push({ pathname: '/products', params: { flag: 'deals', title: 'Deals of the day' } }))}
          style={styles.more}>
          <Ionicons name="chevron-forward" size={12} color={t.primary} />
        </Pressable>
      </View>

      <View style={styles.dealStage}>
        <View style={[styles.circle, { width: 132, height: 132, borderColor: t.dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,102,204,0.08)' }]} />
        <View style={[styles.circle, { width: 96, height: 96, backgroundColor: '#FFFFFF', borderColor: 'transparent' }]} />
        {product.image && <Image source={{ uri: product.image }} style={{ width: 92, height: 92 }} contentFit="contain" transition={200} />}
      </View>

      {price.hasPrice && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={[styles.pricePill, { backgroundColor: t.primary }]}>
            <Text variant="label" tone="onPrimary" style={{ fontSize: 13, fontWeight: '800' }}>
              {formatINR(price.price)}
            </Text>
          </View>
          {price.hasDiscount && (
            <Text variant="tiny" style={{ color: t.success }}>
              {price.discountPercent}% off
            </Text>
          )}
        </View>
      )}
    </Tile>
  );
}

function BrandsTile({ brands }: { brands: BrandLite[] }) {
  const t = usePalette();
  return (
    <Tile style={{ flex: 1 }} outlined onPress={() => router.push('/brands')}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
        <Text variant="label" style={{ flex: 1, fontSize: 13 }}>
          Top brands
        </Text>
        <Text variant="tiny" tone="primary">
          All ›
        </Text>
      </View>
      <View style={styles.brandGrid}>
        {brands.map((b) => {
          const logo = brandLogoUrl(b.logo);
          return (
            <Pressable
              key={b.id}
              accessibilityRole="link"
              accessibilityLabel={b.name}
              onPress={() => (tap(), router.push({ pathname: '/brand/[slug]', params: { slug: b.slug } }))}
              style={[styles.brandCell, { borderColor: t.glassBorder }]}>
              {logo ? (
                <Image source={{ uri: logo }} style={{ width: '80%', height: '80%' }} contentFit="contain" />
              ) : (
                <Text variant="label" tone="primary">
                  {b.name.trim()[0]?.toUpperCase()}
                </Text>
              )}
            </Pressable>
          );
        })}
      </View>
    </Tile>
  );
}

function ComboBentoTile({ combo }: { combo: Combo }) {
  return (
    <Tile
      style={{ flex: 1, padding: 0, overflow: 'hidden', backgroundColor: '#0F1B33', minHeight: 150 }}
      onPress={() => router.push({ pathname: '/combo/[slug]', params: { slug: combo.zc_slug } })}>
      {combo.zc_image && <Image source={{ uri: combo.zc_image }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />}
      <LinearGradient colors={['transparent', 'rgba(5,11,26,0.88)']} style={StyleSheet.absoluteFill} />
      <View style={[styles.comboTag]}>
        <Text variant="tiny" tone="onPrimary" style={{ fontSize: 9, letterSpacing: 0.6 }}>
          COMBO
        </Text>
      </View>
      <View style={{ flex: 1 }} />
      <View style={{ padding: 10, gap: 2 }}>
        <Text variant="label" tone="onPrimary" numberOfLines={2} style={{ fontSize: 13 }}>
          {combo.zc_name}
        </Text>
        <Text variant="tiny" style={{ color: '#4ADE80' }}>
          Explore ›
        </Text>
      </View>
    </Tile>
  );
}

// Blue "Ask ZillyAI" strip.
export function AiStrip() {
  const t = usePalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Ask ZillyAI"
      onPress={() => (tap(), router.push('/assistant'))}
      style={({ pressed }) => [styles.ai, { backgroundColor: t.primary, opacity: pressed ? 0.9 : 1 }]}>
      <View style={styles.aiOrb}>
        <AiOrb size={30} />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="label" tone="onPrimary">
          Ask ZillyAI
        </Text>
        <Text variant="tiny" numberOfLines={2} style={{ color: 'rgba(255,255,255,0.85)', fontWeight: '500' }}>
          Find products, track orders and get help, in your words
        </Text>
      </View>
      <View style={styles.aiTry}>
        <Text variant="label" tone="primary" style={{ fontSize: 13 }}>
          Try
        </Text>
      </View>
    </Pressable>
  );
}

function Tile({
  children,
  style,
  outlined,
  onPress,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  outlined?: boolean;
  onPress: () => void;
}) {
  const t = usePalette();
  return (
    <Pressable
      onPress={() => (tap(), onPress())}
      style={({ pressed }) => [
        styles.tile,
        outlined && { backgroundColor: t.glassFill, borderWidth: 1, borderColor: t.glassBorder },
        style,
        pressed && { opacity: 0.88 },
      ]}>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  grid: { paddingHorizontal: 16, gap: GAP },
  row: { flexDirection: 'row', gap: GAP },
  tile: { borderRadius: radius.lg, padding: 12 },
  flash: { width: 20, height: 20, borderRadius: 6, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  more: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  dealStage: { flex: 1, minHeight: 140, alignItems: 'center', justifyContent: 'center' },
  circle: { position: 'absolute', borderRadius: 999, borderWidth: 1 },
  pricePill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  // The picture row at the top of the two small tiles: fixed height, so the
  // titles under it line up and nothing overlaps.
  tileImages: { flex: 1, minHeight: 50, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'flex-end', gap: 6, marginBottom: 6 },
  imageWell: { width: 50, height: 50, borderRadius: 12, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  wellImage: { width: '84%', height: '84%' },
  exclusiveTag: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6, backgroundColor: 'rgba(251,191,36,0.14)' },
  wide: { flexDirection: 'row', alignItems: 'center', minHeight: 110 },
  wideImageWrap: { width: 110, height: 86, borderRadius: radius.md, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  wideImage: { width: '80%', height: '80%' },
  wideGo: {
    position: 'absolute',
    right: -6,
    bottom: -6,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#EA580C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  brandCell: {
    width: '30.5%',
    aspectRatio: 1.2,
    borderRadius: 10,
    borderWidth: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  comboTag: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#0066CC',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  ai: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 16,
    marginTop: 14,
    padding: 12,
    borderRadius: radius.lg,
  },
  aiOrb: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  aiTry: { backgroundColor: '#FFFFFF', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 },
});
