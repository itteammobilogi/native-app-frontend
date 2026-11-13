import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  DOMAIN_META,
  getProduct,
  plainText,
  productGallery,
  variantUnavailable,
  type ProductDetail,
  type ProductSummary,
  type Variant,
} from '@/core/api/catalog';
import { useCart } from '@/core/cart/CartContext';
import { attributeLabel, colourNameMap, swatchHex } from '@/core/colourNames';
import { WEBSITE_URL } from '@/core/config';
import { useAsync } from '@/core/hooks/useAsync';
import { useLocation } from '@/core/location/LocationContext';
import { computeProductPrice, formatINR } from '@/core/pricing';
import { getRelated, getTopReviews, productPreview } from '@/core/productPreview';
import { useSaved } from '@/core/saved/SavedContext';
import { tap } from '@/ui/Button';
import { PincodeSheet } from '@/ui/PincodeSheet';
import { ProductRail } from '@/ui/ProductRail';
import { QtyStepper } from '@/ui/QtyStepper';
import { ReviewsSection } from '@/ui/reviews/ReviewsSection';
import { ErrorState, Screen } from '@/ui/Screen';
import { Skeleton } from '@/ui/Skeleton';
import { Text } from '@/ui/Text';
import { radius, usePalette } from '@/ui/theme';
import { useToast } from '@/ui/Toast';

// "Blue · M": colour swatches arrive as hex, shown by name (see colourNames).
const variantLabel = (v: Variant, names: Map<string, string>) => attributeLabel(v.variant_attributes, names) || v.name;

const TABS = ['Overview', 'Details', 'Seller', 'Reviews'] as const;
type Tab = (typeof TABS)[number];

export default function ProductScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const t = usePalette();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const toast = useToast();
  const cart = useCart();
  const { location, pincodeId } = useLocation();

  const product = useAsync(() => getProduct(slug), [slug]);
  const p = product.data;
  // The tapped card's name, image and price, shown while the details load.
  const preview = productPreview(slug);
  // Reviews and related products don't wait for the details: the tapped
  // card has the group id, domain and subcategory too.
  const groupId = p?.id ?? preview?.id;
  const domain = p?.category ?? preview?.domain_slug ?? null;
  const subcategory = p?.subcategory ?? preview?.category_slug ?? null;
  const reviews = useAsync(() => (groupId ? getTopReviews(groupId) : Promise.resolve(undefined)), [groupId]);
  const rating = reviews.data?.summary;
  const related = useAsync(() => getRelated(domain, subcategory, slug), [domain, subcategory, slug]);

  const [variantId, setVariantId] = useState<number | null>(null);
  const [qty, setQty] = useState(1);
  const [imgIndex, setImgIndex] = useState(0);
  const [showFullDesc, setShowFullDesc] = useState(false);
  const [showMaker, setShowMaker] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);

  // Tabs jump to their section; the one in view is underlined.
  const scrollRef = useRef<ScrollView>(null);
  const [sectionY, setSectionY] = useState<Partial<Record<Tab, number>>>({});
  const [activeTab, setActiveTab] = useState<Tab>('Overview');
  const mark = (tab: Tab) => (e: { nativeEvent: { layout: { y: number } } }) => {
    const y = e.nativeEvent.layout.y;
    setSectionY((s) => (s[tab] === y ? s : { ...s, [tab]: y }));
  };

  const variant = useMemo(() => {
    if (!p?.variants?.length) return null;
    const id = variantId ?? p.selected_variant_id;
    return p.variants.find((v) => v.id === id) ?? p.variants[0];
  }, [p, variantId]);

  const gallery = useMemo(() => (p ? productGallery(p, variant) : []), [p, variant]);
  const colourNames = useMemo(() => colourNameMap(p?.variants), [p?.variants]);
  const maxQty = Math.max(1, variant?.qty_limit?.max ?? variant?.max_qty_per_order ?? 10);
  const unavailable = p ? variantUnavailable(p, variant) : true;
  const description = plainText(p?.long_desc) || plainText(p?.short_desc);
  const tagline = plainText(p?.short_desc);
  const price = computeProductPrice(variant ?? preview);

  // Card-sized view of this product, for the wishlist and recently viewed.
  const summary = useMemo<ProductSummary | null>(
    () =>
      p
        ? {
            id: p.id,
            slug,
            name: p.name,
            image: gallery[0] ?? null,
            price: variant?.price ?? null,
            max_value: variant?.max_value ?? p.max_value ?? null,
            brand_name: p.brand_name ?? null,
            is_assured: p.is_assured,
            is_unavailable: unavailable ? 1 : 0,
          }
        : null,
    [p, slug, gallery, variant, unavailable],
  );

  const { addRecent, isSaved, toggleSaved } = useSaved();
  useEffect(() => {
    if (summary) addRecent(summary);
    // Record once per product load, not on every variant switch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p?.id, addRecent]);

  const addToCart = () => {
    if (!p || !variant) return;
    // The line shows in the cart at once (cart.add's `show`); a failure takes
    // it back out and says so. ONDC ids come from the product (seller) and
    // the variant (item/location).
    cart
      .add(
        {
          product_variant_id: variant.id,
          product_value: variant.product_value,
          bpp_id: p.bpp_id,
          sor_id: p.sor_id,
          sor_value: p.sor_value,
          location_id: variant.location_id,
          location_value: variant.location_value,
          quantity: qty,
          price: Number(variant.price),
          pincode_id: pincodeId,
        },
        { title: p.name, image: gallery[0] ?? null, slug, variant_attributes: variant.variant_attributes },
      )
      .catch((e: any) => toast(e?.message ?? 'Could not add to cart', 'error'));
    toast('Added to cart', 'success');
  };

  const share = () => Share.share({ message: `${p?.name ?? 'Check this out'} — ${WEBSITE_URL}/product/${slug}` });
  const saved = summary ? isSaved(summary.id) : false;
  const onSave = () => {
    if (!summary) return;
    const nowSaved = toggleSaved(summary);
    toast(nowSaved ? 'Saved to your wishlist' : 'Removed from wishlist', nowSaved ? 'success' : 'info');
  };

  const topBar = (
    <TopBar
      domain={domain}
      subcategory={subcategory}
      saved={saved}
      onShare={p ? share : undefined}
      onSave={summary ? onSave : undefined}
      tabs={!!p}
      active={activeTab}
      onTab={(tab) => {
        tap();
        setActiveTab(tab);
        scrollRef.current?.scrollTo({ y: Math.max(0, (sectionY[tab] ?? 0) - 8), animated: true });
      }}
    />
  );

  if (product.error) {
    return (
      <Screen>
        {topBar}
        <ErrorState message={product.error} onRetry={product.reload} />
      </Screen>
    );
  }

  const slideW = width - 64; // the next photo peeks in from the right
  const photos = product.loading ? [preview?.image ?? null] : gallery.length ? gallery : [null];
  const specs = p ? specRows(p, variant) : [];
  const highlights = (p?.content?.highlights ?? []).filter(Boolean).slice(0, 4);
  const returnDays = returnWindowDays(variant?.return_window ?? p?.return_window);
  const returnable = truthy(variant?.returnable ?? p?.returnable);
  const cancellable = truthy(variant?.cancellable ?? p?.cancellable);
  const care = p ? careContact(p) : undefined;
  const maker = p?.manufacturer?.name || p?.brand_name || undefined;
  const pricesDiffer = !!p && new Set(p.variants.map((v) => Number(v.price))).size > 1;

  return (
    <Screen>
      {topBar}
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingBottom: insets.bottom + 96 }}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={64}
        onScroll={(e) => {
          const y = e.nativeEvent.contentOffset.y + 40;
          const current = [...TABS].reverse().find((tab) => sectionY[tab] != null && y >= sectionY[tab]!) ?? 'Overview';
          if (current !== activeTab) setActiveTab(current);
        }}>
        {/* ── Overview ─────────────────────────────── */}
        <View onLayout={mark('Overview')} style={{ paddingTop: 12 }}>
          <View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={slideW + 10}
              decelerationRate="fast"
              contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}
              onMomentumScrollEnd={(e) => setImgIndex(Math.round(e.nativeEvent.contentOffset.x / (slideW + 10)))}>
              {photos.map((uri, i) => (
                <View key={`${uri}-${i}`} style={[styles.slide, { width: slideW, height: slideW, backgroundColor: t.dark ? t.tileFill : '#EEF4FF' }]}>
                  {uri ? (
                    <Image source={{ uri }} style={{ width: '82%', height: '82%' }} contentFit="contain" transition={200} />
                  ) : product.loading ? (
                    <Skeleton width="100%" height="100%" r={0} />
                  ) : (
                    <Ionicons name="image-outline" size={48} color="#C7CED9" />
                  )}
                </View>
              ))}
            </ScrollView>
            {Number(p?.is_assured ?? preview?.is_assured) === 1 && (
              <View style={[styles.assured, { backgroundColor: t.success }]}>
                <Ionicons name="shield-checkmark" size={12} color="#fff" />
                <Text variant="tiny" tone="onPrimary">
                  Assured
                </Text>
              </View>
            )}
            {gallery.length > 1 && (
              <View style={[styles.counter, { left: 16 + slideW - 52 }]}>
                <Text variant="tiny" tone="onPrimary">
                  {imgIndex + 1}/{gallery.length}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.pad}>
            {/* Brand + rating */}
            <View style={styles.between}>
              {!!(p?.brand_name ?? preview?.brand_name) && (
                <Pressable
                  disabled={!p?.brand_slug}
                  onPress={() => p?.brand_slug && (tap(), router.push({ pathname: '/brand/[slug]', params: { slug: p.brand_slug } }))}
                  style={[styles.brandChip, { backgroundColor: t.tileFill }]}>
                  <View style={[styles.brandAvatar, { backgroundColor: t.primary }]}>
                    <Text variant="tiny" tone="onPrimary">
                      {(p?.brand_name ?? preview?.brand_name ?? '').trim()[0]?.toUpperCase()}
                    </Text>
                  </View>
                  <Text variant="caption" style={{ fontWeight: '700' }} numberOfLines={1}>
                    {p?.brand_name ?? preview?.brand_name}
                  </Text>
                  {!!p?.brand_slug && <Ionicons name="chevron-forward" size={12} color={t.textFaint} />}
                </Pressable>
              )}
              <View style={{ flex: 1 }} />
              {Number(rating?.total_ratings) > 0 ? (
                <View style={styles.inline}>
                  <Ionicons name="star" size={12} color="#F59E0B" />
                  <Text variant="caption" style={{ fontWeight: '700' }}>
                    {Number(rating!.average_rating).toFixed(1)}
                  </Text>
                  <Text variant="caption" tone="faint">
                    ({rating!.total_ratings})
                  </Text>
                </View>
              ) : (
                !reviews.loading && (
                  <View style={styles.inline}>
                    <Ionicons name="star-outline" size={12} color={t.textFaint} />
                    <Text variant="caption" tone="faint">
                      No reviews yet
                    </Text>
                  </View>
                )
              )}
            </View>

            <Text variant="title" style={{ fontSize: 19, lineHeight: 25 }}>
              {variant?.name || p?.name || preview?.name}
            </Text>
            {!!tagline && tagline !== p?.name && (
              <Text variant="caption" tone="muted" numberOfLines={2} style={{ lineHeight: 17 }}>
                {tagline}
              </Text>
            )}

            {/* Price block */}
            {price.hasPrice && (
              <View style={styles.priceRow}>
                <View style={[styles.priceMain, { backgroundColor: t.primary }, !price.hasDiscount && { borderRadius: radius.lg }]}>
                  <Text variant="tiny" style={{ color: 'rgba(255,255,255,0.75)', letterSpacing: 0.8 }}>
                    PRICE
                  </Text>
                  <View style={[styles.inline, { alignItems: 'baseline', gap: 6 }]}>
                    <Text variant="display" tone="onPrimary" style={{ fontSize: 28 }}>
                      {formatINR(price.price)}
                    </Text>
                    {price.strike != null && (
                      <Text variant="caption" style={{ color: 'rgba(255,255,255,0.7)', textDecorationLine: 'line-through' }}>
                        {formatINR(price.strike)}
                      </Text>
                    )}
                  </View>
                  <Text variant="tiny" style={{ color: 'rgba(255,255,255,0.85)', fontWeight: '500' }}>
                    Inclusive of all taxes
                  </Text>
                </View>
                {price.hasDiscount && (
                  <View style={[styles.priceOff, { backgroundColor: t.dark ? '#0F2E22' : '#E3F8EC' }]}>
                    <Text variant="title" style={{ color: t.success, fontSize: 22 }}>
                      {price.discountPercent}%
                    </Text>
                    <Text variant="tiny" style={{ color: t.success }}>
                      OFF
                    </Text>
                    <Text variant="tiny" tone="muted" style={{ fontWeight: '500' }}>
                      save {formatINR(price.strike! - price.price)}
                    </Text>
                  </View>
                )}
              </View>
            )}
            {p && unavailable && (
              <View style={[styles.notice, { backgroundColor: `${t.danger}14` }]}>
                <Ionicons name="alert-circle" size={16} color={t.danger} />
                <Text variant="label" tone="danger">
                  Currently unavailable
                </Text>
              </View>
            )}

            {product.loading && (
              <View style={{ gap: 10 }}>
                <Skeleton height={64} r={radius.lg} />
                <Skeleton height={120} r={radius.lg} />
              </View>
            )}

            {/* Options */}
            {p && p.variants.length > 1 && (
              <View style={{ gap: 8 }}>
                <Text variant="label" style={{ fontSize: 13 }}>
                  Options{' '}
                  {pricesDiffer && (
                    <Text variant="caption" tone="faint">
                      · prices differ
                    </Text>
                  )}
                </Text>
                <View style={styles.options}>
                  {p.variants.map((v) => {
                    const active = v.id === variant?.id;
                    const off = variantUnavailable(p, v);
                    const swatch = swatchHex(v.variant_attributes);
                    const vp = computeProductPrice(v);
                    return (
                      <Pressable
                        key={v.id}
                        onPress={() => {
                          tap();
                          setVariantId(v.id);
                          setQty(1);
                          setImgIndex(0);
                        }}
                        style={[
                          styles.option,
                          {
                            borderColor: active ? t.primary : t.glassBorder,
                            backgroundColor: active ? (t.dark ? '#13213D' : '#EEF4FF') : t.glassFill,
                            opacity: off ? 0.5 : 1,
                          },
                        ]}>
                        <View style={styles.inline}>
                          {swatch && <View style={[styles.swatch, { backgroundColor: swatch, borderColor: t.hairline }]} />}
                          <Text variant="caption" numberOfLines={1} style={{ fontWeight: '700', color: active ? t.primary : t.text, flexShrink: 1 }}>
                            {variantLabel(v, colourNames)}
                          </Text>
                        </View>
                        <Text variant="tiny" tone={off ? 'faint' : 'muted'} style={{ fontWeight: '500' }}>
                          {off ? 'Unavailable' : vp.hasPrice ? formatINR(vp.price) : 'See price'}
                        </Text>
                        {active && (
                          <View style={[styles.check, { backgroundColor: t.primary }]}>
                            <Ionicons name="checkmark" size={11} color="#fff" />
                          </View>
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Delivery */}
            {p && (
              <View style={[styles.card, { borderColor: t.glassBorder, backgroundColor: t.glassFill }]}>
                <View style={[styles.deliveryHead, { backgroundColor: t.tileFill }]}>
                  <Ionicons name="location-outline" size={15} color={t.textMuted} />
                  <Text variant="caption" numberOfLines={1} style={{ flex: 1 }}>
                    {location ? (
                      <>
                        To <Text variant="caption" style={{ fontWeight: '800' }}>{`${location.pincode}, ${location.label}`}</Text>
                      </>
                    ) : (
                      'Set your delivery pincode'
                    )}
                  </Text>
                  <Text variant="caption" tone="primary" style={{ fontWeight: '700' }} onPress={() => (tap(), setPinOpen(true))} suppressHighlighting>
                    {location ? 'Change' : 'Set'}
                  </Text>
                </View>
                <View style={{ padding: 14 }}>
                  <Step
                    icon={unavailable ? 'close' : 'checkmark'}
                    filled
                    tone={unavailable ? t.danger : t.primary}
                    title={unavailable ? 'Out of stock with the seller' : 'In stock with the seller'}
                    note="Sold through the ONDC network"
                    line
                  />
                  <Step icon="cube-outline" tone={t.primary} title="Packed and shipped by the seller" note={maker ? `Made by ${maker}` : undefined} line />
                  <Step icon="time-outline" tone={t.primary} title="Delivery date and charge at checkout" note="Set by the seller for your pincode" />
                </View>
              </View>
            )}

            {/* Return / cancel policy */}
            {p && (
              <View style={styles.wrapRow}>
                <PolicyChip ok={returnable} label={returnable ? (returnDays ? `${returnDays}-day returns` : 'Returnable') : 'Not returnable'} />
                <PolicyChip ok={cancellable} label={cancellable ? 'Cancellable' : 'Not cancellable'} />
              </View>
            )}

            {/* Highlights */}
            {highlights.length > 0 && (
              <View style={styles.grid}>
                {highlights.map((h, i) => (
                  <View key={i} style={[styles.highlight, { backgroundColor: t.tileFill }]}>
                    <View style={[styles.hlIcon, { backgroundColor: t.glassFill }]}>
                      <Ionicons name={HIGHLIGHT_ICONS[i % HIGHLIGHT_ICONS.length]} size={15} color={t.primary} />
                    </View>
                    <Text variant="tiny" numberOfLines={3} style={{ flex: 1, fontWeight: '600', lineHeight: 14 }}>
                      {h}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Trust chips */}
          {p && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.trust}>
              {(
                [
                  ['storefront-outline', 'ONDC network seller', t.success],
                  ['lock-closed-outline', 'Secure payment', t.primary],
                  ...(Number(p.is_assured) === 1 ? [['shield-checkmark-outline', 'ZillyBuy Assured', t.primary]] : []),
                ] as [keyof typeof Ionicons.glyphMap, string, string][]
              ).map(([icon, label, color]) => (
                <View key={label} style={[styles.trustChip, { borderColor: t.glassBorder, backgroundColor: t.glassFill }]}>
                  <Ionicons name={icon} size={14} color={color} />
                  <Text variant="tiny" style={{ fontWeight: '600' }}>
                    {label}
                  </Text>
                </View>
              ))}
            </ScrollView>
          )}
        </View>

        {/* ── Details ──────────────────────────────── */}
        {p && (
          <View onLayout={mark('Details')} style={[styles.band, { backgroundColor: t.dark ? '#0F1424' : '#F6F8FB' }]}>
            <View style={styles.between}>
              <Text variant="heading">Details</Text>
              <Text variant="tiny" tone="faint" style={{ fontWeight: '500' }}>
                From the seller&apos;s listing
              </Text>
            </View>
            {!!description && (
              <>
                <Text variant="caption" tone="muted" numberOfLines={showFullDesc ? undefined : 3} style={{ lineHeight: 19 }}>
                  {description}
                </Text>
                {description.length > 160 && (
                  <Pressable onPress={() => (tap(), setShowFullDesc((v) => !v))} style={styles.inline} hitSlop={6}>
                    <Text variant="caption" tone="primary" style={{ fontWeight: '700' }}>
                      {showFullDesc ? 'Show less' : 'Read the full description'}
                    </Text>
                    <Ionicons name={showFullDesc ? 'chevron-up' : 'chevron-forward'} size={13} color={t.primary} />
                  </Pressable>
                )}
              </>
            )}
            {specs.length > 0 && (
              <View style={styles.grid}>
                {specs.map(([label, value]) => (
                  <View key={label} style={[styles.spec, { backgroundColor: t.glassFill }]}>
                    <Text variant="tiny" tone="faint" style={{ fontWeight: '500' }} numberOfLines={1}>
                      {label}
                    </Text>
                    <Text variant="caption" style={{ fontWeight: '700' }} numberOfLines={2}>
                      {value}
                    </Text>
                  </View>
                ))}
              </View>
            )}
            {!!p.manufacturer?.name && (
              <Pressable onPress={() => (tap(), setShowMaker((v) => !v))} style={[styles.spec, { backgroundColor: t.glassFill, gap: 6 }]}>
                <View style={styles.inline}>
                  <Ionicons name="business-outline" size={16} color={t.primary} />
                  <Text variant="caption" style={{ fontWeight: '700', flex: 1 }}>
                    Manufacturer & care
                  </Text>
                  <Ionicons name={showMaker ? 'chevron-up' : 'chevron-forward'} size={14} color={t.textFaint} />
                </View>
                {showMaker && (
                  <View style={{ gap: 3 }}>
                    <Text variant="caption">{p.manufacturer.name}</Text>
                    {!!p.manufacturer.address && p.manufacturer.address !== p.manufacturer.name && (
                      <Text variant="tiny" tone="muted" style={{ fontWeight: '500' }}>
                        {p.manufacturer.address}
                      </Text>
                    )}
                    {!!care && (
                      <Text variant="tiny" tone="muted" style={{ fontWeight: '500' }}>
                        Customer care: {care}
                      </Text>
                    )}
                  </View>
                )}
              </Pressable>
            )}
          </View>
        )}

        {/* ── Seller ───────────────────────────────── */}
        {p && (
          <View onLayout={mark('Seller')} style={[styles.pad, { paddingTop: 20 }]}>
            <Text variant="heading">Seller</Text>
            <View style={[styles.card, { borderColor: t.glassBorder, backgroundColor: t.glassFill, padding: 14, gap: 12 }]}>
              <View style={[styles.inline, { gap: 12, alignItems: 'flex-start' }]}>
                <View style={[styles.sellerAvatar, { backgroundColor: t.dark ? t.tileFill : '#EEF4FF' }]}>
                  <Text variant="heading" tone="primary">
                    {(p.brand_name || maker || 'S').trim()[0]?.toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="label" numberOfLines={1}>
                    {p.brand_name || maker || 'ONDC seller'}
                  </Text>
                  <Text variant="tiny" tone="muted" style={{ fontWeight: '500' }}>
                    Sells on the ONDC network
                  </Text>
                </View>
                {p.bpp_status !== 0 && p.provider_is_disabled !== 1 && (
                  <View style={[styles.verified, { backgroundColor: t.dark ? '#0F2E22' : '#E3F8EC' }]}>
                    <Ionicons name="checkmark-circle-outline" size={12} color={t.success} />
                    <Text variant="tiny" style={{ color: t.success }}>
                      Active
                    </Text>
                  </View>
                )}
              </View>
              {(!!care || !!maker) && (
                <View style={[styles.inline, { gap: 16, flexWrap: 'wrap' }]}>
                  {!!care && (
                    <View style={[styles.inline, { flexShrink: 1 }]}>
                      <Ionicons name="call-outline" size={13} color={t.textFaint} />
                      <Text variant="tiny" tone="muted" style={{ fontWeight: '500' }}>
                        Customer care {care}
                      </Text>
                    </View>
                  )}
                  {!!maker && (
                    <View style={[styles.inline, { flexShrink: 1 }]}>
                      <Ionicons name="business-outline" size={13} color={t.textFaint} />
                      <Text variant="tiny" tone="muted" numberOfLines={1} style={{ fontWeight: '500', flexShrink: 1 }}>
                        Made by {maker}
                      </Text>
                    </View>
                  )}
                </View>
              )}
              {!!p.brand_slug && (
                <Pressable
                  onPress={() => (tap(), router.push({ pathname: '/brand/[slug]', params: { slug: p.brand_slug! } }))}
                  style={[styles.outlineBtn, { borderColor: t.primary }]}>
                  <Text variant="caption" tone="primary" style={{ fontWeight: '700' }}>
                    See everything from {p.brand_name ?? 'this brand'}
                  </Text>
                </Pressable>
              )}
            </View>
          </View>
        )}

        {/* ── Reviews ──────────────────────────────── */}
        {p && (
          <View onLayout={mark('Reviews')} style={[styles.pad, { paddingTop: 20 }]}>
            <ReviewsSection productId={p.id} productName={p.name} top={reviews.data} loading={reviews.loading} onChanged={reviews.refresh} />
          </View>
        )}

        <ProductRail
          title="Goes well with"
          subtitle={domain ? DOMAIN_META[domain]?.name : undefined}
          icon="sparkles-outline"
          items={related.data}
          loading={false}
          onSeeAll={domain ? () => router.push({ pathname: '/shop/[domain]', params: { domain } }) : undefined}
        />
      </ScrollView>

      {/* Sticky bar: quantity + add to cart */}
      {p && (
        <View style={[styles.bar, { paddingBottom: insets.bottom + 10, backgroundColor: t.glassFill, borderTopColor: t.hairline }]}>
          <QtyStepper value={qty} max={maxQty} onChange={setQty} disabled={unavailable} />
          <Pressable
            accessibilityRole="button"
            disabled={unavailable}
            onPress={() => (tap(), addToCart())}
            style={({ pressed }) => [styles.addBtn, { backgroundColor: unavailable ? t.textFaint : pressed ? t.primaryPressed : t.primary }]}>
            <Ionicons name="bag-add-outline" size={18} color="#fff" />
            <Text variant="label" tone="onPrimary" style={{ flex: 1 }}>
              {unavailable ? 'Unavailable' : 'Add to cart'}
            </Text>
            {!unavailable && price.hasPrice && (
              <Text variant="label" tone="onPrimary">
                {formatINR(price.price * qty)}
              </Text>
            )}
          </Pressable>
        </View>
      )}

      <PincodeSheet visible={pinOpen} onClose={() => setPinOpen(false)} />
    </Screen>
  );
}

const truthy = (v: unknown) => v === true || Number(v) === 1;

const HIGHLIGHT_ICONS: (keyof typeof Ionicons.glyphMap)[] = ['sparkles-outline', 'resize-outline', 'layers-outline', 'construct-outline'];

const COUNTRIES: Record<string, string> = { IND: 'India', IN: 'India', CHN: 'China', USA: 'USA' };
const label = (s: string) => s.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

// Spec tiles: the variant's listed attributes, then net quantity and country
// of origin when the seller sent them.
function specRows(p: ProductDetail, v: Variant | null): [string, string][] {
  const rows = new Map<string, string>();
  for (const a of v?.info_attributes ?? []) if (a.value) rows.set(label(a.name), String(a.value));
  if (v?.net_quantity) rows.set('Net quantity', v.net_quantity);
  const origin = p.tags?.find((g) => g.code === 'origin')?.list?.find((x) => x.code === 'country')?.value ?? p.manufacturer?.country;
  if (origin) rows.set('Country of origin', COUNTRIES[origin] ?? origin);
  return [...rows].slice(0, 8);
}

// "P7D" → 7 (the ONDC return window, an ISO 8601 duration).
function returnWindowDays(w?: string | null) {
  const days = w?.match(/^P(\d+)D$/)?.[1];
  return days ? Number(days) : undefined;
}

function careContact(p: ProductDetail) {
  return p.manufacturer?.consumer_care?.phone || p.contact_details_consumer_care?.split(',')[2]?.trim() || undefined;
}

function TopBar({
  domain,
  subcategory,
  saved,
  onShare,
  onSave,
  tabs,
  active,
  onTab,
}: {
  domain: string | null;
  subcategory: string | null;
  saved: boolean;
  onShare?: () => void;
  onSave?: () => void;
  tabs: boolean;
  active: Tab;
  onTab: (tab: Tab) => void;
}) {
  const t = usePalette();
  const insets = useSafeAreaInsets();
  const { count } = useCart();
  const domainLabel = domain ? (DOMAIN_META[domain]?.name ?? label(domain)) : undefined;
  const subLabel = subcategory ? label(subcategory.replace(/-/g, ' ')) : undefined;

  return (
    <View style={[styles.topBar, { paddingTop: insets.top + 6, backgroundColor: t.glassFill, borderBottomColor: t.hairline }]}>
      <View style={styles.topRow}>
        <TopIcon icon="arrow-back" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
        <Text variant="caption" numberOfLines={1} style={{ flex: 1 }}>
          {domainLabel && (
            <Text
              variant="caption"
              tone="muted"
              onPress={() => domain && router.push({ pathname: '/shop/[domain]', params: { domain } })}
              suppressHighlighting>
              {domainLabel}
            </Text>
          )}
          {domainLabel && subLabel && <Text variant="caption" tone="faint">{'  ›  '}</Text>}
          {subLabel && (
            <Text variant="caption" tone="primary" style={{ fontWeight: '600' }}>
              {subLabel}
            </Text>
          )}
        </Text>
        {onShare && <TopIcon icon="share-outline" label="Share" onPress={onShare} />}
        {onSave && (
          <TopIcon
            icon={saved ? 'heart' : 'heart-outline'}
            color={saved ? t.danger : undefined}
            label={saved ? 'Remove from wishlist' : 'Save to wishlist'}
            onPress={onSave}
          />
        )}
        <TopIcon icon="bag-handle-outline" label="Cart" badge={count} onPress={() => router.push('/cart')} />
      </View>
      {tabs && (
        <View style={styles.tabs}>
          {TABS.map((tab) => {
            const on = tab === active;
            return (
              <Pressable key={tab} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => onTab(tab)} style={styles.tab}>
                <Text variant="caption" style={{ fontWeight: on ? '700' : '500', color: on ? t.primary : t.textMuted }}>
                  {tab}
                </Text>
                <View style={[styles.tabLine, { backgroundColor: on ? t.primary : 'transparent' }]} />
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

function TopIcon({
  icon,
  label: a11y,
  color,
  badge,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color?: string;
  badge?: number;
  onPress: () => void;
}) {
  const t = usePalette();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={a11y} hitSlop={6} onPress={() => (tap(), onPress())} style={styles.topIcon}>
      <Ionicons name={icon} size={21} color={color ?? t.text} />
      {!!badge && badge > 0 && (
        <View style={[styles.badge, { backgroundColor: t.primary }]}>
          <Text variant="tiny" tone="onPrimary" style={{ fontSize: 9, lineHeight: 11 }}>
            {badge > 99 ? '99+' : badge}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

function Step({
  icon,
  title,
  note,
  tone,
  filled,
  line,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  note?: string;
  tone: string;
  filled?: boolean;
  line?: boolean;
}) {
  const t = usePalette();
  return (
    <View style={{ flexDirection: 'row', gap: 12 }}>
      <View style={{ alignItems: 'center' }}>
        <View style={[styles.stepDot, filled ? { backgroundColor: tone } : { backgroundColor: t.dark ? t.tileFill : '#EEF4FF' }]}>
          <Ionicons name={icon} size={13} color={filled ? '#fff' : tone} />
        </View>
        {line && <View style={[styles.stepLine, { backgroundColor: t.dark ? t.tileFill : '#DCE8FA' }]} />}
      </View>
      <View style={{ flex: 1, paddingBottom: line ? 12 : 0, gap: 1 }}>
        <Text variant="caption" style={{ fontWeight: '700' }}>
          {title}
        </Text>
        {!!note && (
          <Text variant="tiny" tone="muted" style={{ fontWeight: '500' }}>
            {note}
          </Text>
        )}
      </View>
    </View>
  );
}

function PolicyChip({ ok, label: text }: { ok: boolean; label: string }) {
  const t = usePalette();
  const color = ok ? t.success : t.danger;
  return (
    <View style={[styles.policy, { backgroundColor: `${color}14` }]}>
      <Ionicons name={ok ? 'checkmark-circle-outline' : 'close-circle-outline'} size={14} color={color} />
      <Text variant="tiny" style={{ color }}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: { borderBottomWidth: StyleSheet.hairlineWidth, zIndex: 2 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingBottom: 4 },
  topIcon: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: 3,
    right: 2,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabs: { flexDirection: 'row', paddingHorizontal: 8 },
  tab: { flex: 1, alignItems: 'center', paddingTop: 6, gap: 8 },
  tabLine: { height: 2.5, width: '70%', borderRadius: 2 },
  slide: { borderRadius: 20, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  assured: {
    position: 'absolute',
    top: 12,
    left: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  counter: { position: 'absolute', bottom: 12, backgroundColor: 'rgba(11,27,51,0.6)', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  pad: { paddingHorizontal: 16, paddingTop: 14, gap: 12 },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  brandChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 3, paddingRight: 10, paddingVertical: 3, borderRadius: 999, maxWidth: '60%' },
  brandAvatar: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  priceRow: { flexDirection: 'row' },
  priceMain: { flex: 1.6, padding: 14, gap: 2, borderTopLeftRadius: radius.lg, borderBottomLeftRadius: radius.lg },
  priceOff: { flex: 1, alignItems: 'center', justifyContent: 'center', borderTopRightRadius: radius.lg, borderBottomRightRadius: radius.lg },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: radius.sm },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: { width: '31.6%', minHeight: 54, borderWidth: 1.5, borderRadius: 14, alignItems: 'center', justifyContent: 'center', gap: 2, paddingHorizontal: 6 },
  check: { position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  swatch: { width: 14, height: 14, borderRadius: 7, borderWidth: 1 },
  card: { borderWidth: 1, borderRadius: radius.lg, overflow: 'hidden' },
  deliveryHead: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 10 },
  stepDot: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  stepLine: { width: 2, flex: 1, marginVertical: 2 },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  policy: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  highlight: { width: '48.6%', flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 14, minHeight: 58 },
  hlIcon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  trust: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 18, gap: 8 },
  trustChip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  band: { paddingHorizontal: 16, paddingVertical: 20, gap: 12 },
  spec: { width: '48.6%', padding: 12, borderRadius: 14, gap: 2 },
  sellerAvatar: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  verified: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  outlineBtn: { borderWidth: 1.5, borderRadius: 12, alignItems: 'center', paddingVertical: 11 },
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    elevation: 12,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -4 },
  },
  addBtn: { flex: 1, height: 48, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16 },
});
