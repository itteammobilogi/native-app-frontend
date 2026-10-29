import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, Share, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  getProduct,
  listProducts,
  plainText,
  productGallery,
  variantUnavailable,
  type ProductSummary,
  type Variant,
} from '@/core/api/catalog';
import { getProductReviews } from '@/core/api/reviews';
import { useCart } from '@/core/cart/CartContext';
import { attributeLabel, colourNameMap, swatchHex } from '@/core/colourNames';
import { WEBSITE_URL } from '@/core/config';
import { useAsync } from '@/core/hooks/useAsync';
import { useLocation } from '@/core/location/LocationContext';
import { useSaved } from '@/core/saved/SavedContext';
import { Button, IconButton, tap } from '@/ui/Button';
import { Glass } from '@/ui/Glass';
import { usePageInsets } from '@/ui/GlassTabBar';
import { Price } from '@/ui/Price';
import { ProductCard } from '@/ui/ProductCard';
import { QtyStepper } from '@/ui/QtyStepper';
import { ReviewsSection } from '@/ui/reviews/ReviewsSection';
import { ErrorState, Screen } from '@/ui/Screen';
import { Skeleton } from '@/ui/Skeleton';
import { Text } from '@/ui/Text';
import { radius, usePalette } from '@/ui/theme';
import { useToast } from '@/ui/Toast';

// "Blue · M": colour swatches arrive as hex, shown by name (see colourNames).
const variantLabel = (v: Variant, names: Map<string, string>) => attributeLabel(v.variant_attributes, names) || v.name;

export default function ProductScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const t = usePalette();
  const insets = usePageInsets();
  const { width } = useWindowDimensions();
  const toast = useToast();
  const cart = useCart();
  const { pincodeId } = useLocation();

  const product = useAsync(() => getProduct(slug), [slug]);
  const p = product.data;
  // Reviews are keyed by the product group id; first page sorted by
  // "helpful" feeds both the rating pill and the Top reviews list.
  const reviews = useAsync(
    () => (p ? getProductReviews(p.id, { limit: 2, sort: 'helpful' }) : Promise.resolve(undefined)),
    [p?.id],
  );
  const rating = reviews.data?.summary;
  const related = useAsync(
    () =>
      p?.category
        ? listProducts({ domain: p.category, subcategory: p.subcategory ?? undefined, available_only: 1, limit: 12 }).then((r) =>
            r.items.filter((x) => x.slug !== slug),
          )
        : Promise.resolve([]),
    [p?.category, p?.subcategory],
  );

  const [variantId, setVariantId] = useState<number | null>(null);
  const [qty, setQty] = useState(1);
  const [imgIndex, setImgIndex] = useState(0);
  const [adding, setAdding] = useState<'cart' | 'buy' | null>(null);
  const [showFullDesc, setShowFullDesc] = useState(false);

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

  const { addRecent } = useSaved();
  useEffect(() => {
    if (summary) addRecent(summary);
    // Record once per product load, not on every variant switch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p?.id, addRecent]);

  const addToCart = async (mode: 'cart' | 'buy') => {
    if (!p || !variant) return;
    setAdding(mode);
    try {
      // ONDC ids come from the product (seller) and the variant (item/location).
      await cart.add({
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
      });
      if (mode === 'buy') router.push('/cart');
      else toast('Added to cart', 'success');
    } catch (e: any) {
      toast(e?.message ?? 'Could not add to cart', 'error');
    } finally {
      setAdding(null);
    }
  };

  if (product.error) {
    return (
      <Screen tabBar="index">
        <TopButtons />
        <ErrorState message={product.error} onRetry={product.reload} />
      </Screen>
    );
  }

  const imgW = width - 32;

  return (
    <Screen tabBar="index">
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 120 }} showsVerticalScrollIndicator={false}>
        {/* Gallery */}
        <View style={{ paddingTop: insets.top + 60, paddingHorizontal: 16 }}>
          <Glass radius={radius.xl} style={{ overflow: 'hidden' }}>
            <View style={{ backgroundColor: '#fff', height: imgW, borderRadius: radius.xl, overflow: 'hidden' }}>
              {product.loading ? (
                <Skeleton height={imgW} r={0} />
              ) : (
                <FlatList
                  data={gallery.length ? gallery : [null]}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  keyExtractor={(u, i) => `${u}-${i}`}
                  onMomentumScrollEnd={(e) => setImgIndex(Math.round(e.nativeEvent.contentOffset.x / imgW))}
                  renderItem={({ item }) => (
                    <View style={{ width: imgW, height: imgW, alignItems: 'center', justifyContent: 'center' }}>
                      {item ? (
                        <Image source={{ uri: item }} style={{ width: '90%', height: '90%' }} contentFit="contain" transition={200} />
                      ) : (
                        <Ionicons name="image-outline" size={48} color="#C7CED9" />
                      )}
                    </View>
                  )}
                />
              )}
            </View>
          </Glass>
          {gallery.length > 1 && (
            <View style={styles.dots}>
              {gallery.map((u, i) => (
                <View
                  key={u}
                  style={[styles.dot, { backgroundColor: i === imgIndex ? t.primary : t.hairline, width: i === imgIndex ? 18 : 6 }]}
                />
              ))}
            </View>
          )}
        </View>

        {/* Info */}
        <View style={{ padding: 16, gap: 14 }}>
          {product.loading || !p ? (
            <Glass style={{ padding: 16, gap: 10 }}>
              <Skeleton width="40%" />
              <Skeleton height={22} />
              <Skeleton width="70%" height={22} />
              <Skeleton width="35%" height={28} />
            </Glass>
          ) : (
            <>
              <Glass radius={radius.lg} style={{ padding: 16, gap: 10 }}>
                {!!p.brand_name && (
                  <Text variant="tiny" tone="primary" style={{ textTransform: 'uppercase', letterSpacing: 0.8 }}>
                    {p.brand_name}
                  </Text>
                )}
                <Text variant="title" style={{ fontSize: 20, lineHeight: 26 }}>
                  {variant?.name || p.name}
                </Text>
                {!!rating?.total_ratings && (
                  <View style={styles.rating}>
                    <View style={[styles.ratingPill, { backgroundColor: t.success }]}>
                      <Text variant="tiny" tone="onPrimary">
                        {Number(rating.average_rating).toFixed(1)}
                      </Text>
                      <Ionicons name="star" size={10} color="#fff" />
                    </View>
                    <Text variant="caption" tone="muted">
                      {rating.total_ratings} ratings
                    </Text>
                  </View>
                )}
                {variant && <Price product={variant} size="lg" />}
                <Text variant="caption" tone="faint">
                  Inclusive of all taxes
                </Text>
                {unavailable && (
                  <View style={[styles.notice, { backgroundColor: `${t.danger}18` }]}>
                    <Ionicons name="alert-circle" size={16} color={t.danger} />
                    <Text variant="label" tone="danger">
                      Currently unavailable
                    </Text>
                  </View>
                )}
              </Glass>

              {/* Variants */}
              {p.variants.length > 1 && (
                <Glass radius={radius.lg} style={{ padding: 16, gap: 12 }}>
                  <Text variant="heading">Options</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {p.variants.map((v) => {
                      const active = v.id === variant?.id;
                      const off = variantUnavailable(p, v);
                      const swatch = swatchHex(v.variant_attributes);
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
                            styles.variant,
                            {
                              borderColor: active ? t.primary : t.glassBorder,
                              backgroundColor: active ? `${t.primary}14` : t.inputFill,
                              opacity: off ? 0.5 : 1,
                            },
                          ]}>
                          {swatch && <View style={[styles.swatch, { backgroundColor: swatch, borderColor: t.hairline }]} />}
                          <Text variant="label" style={{ fontSize: 13, color: active ? t.primary : t.text }}>
                            {variantLabel(v, colourNames)}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </Glass>
              )}

              {/* Quantity + policies */}
              <Glass radius={radius.lg} style={{ padding: 16, gap: 14 }}>
                <View style={styles.between}>
                  <Text variant="heading">Quantity</Text>
                  <QtyStepper value={qty} max={maxQty} onChange={setQty} disabled={unavailable} />
                </View>
                <View style={styles.policies}>
                  <Policy icon="refresh-outline" label={truthy(variant?.returnable ?? p.returnable) ? 'Returnable' : 'Not returnable'} />
                  <Policy icon="close-circle-outline" label={truthy(variant?.cancellable ?? p.cancellable) ? 'Cancellable' : 'Not cancellable'} />
                  <Policy icon="shield-checkmark-outline" label="Secure payment" />
                </View>
              </Glass>

              {/* Specs */}
              {!!variant?.info_attributes?.length && (
                <Glass radius={radius.lg} style={{ padding: 16, gap: 10 }}>
                  <Text variant="heading">Specifications</Text>
                  {variant.info_attributes.map((a, i) => (
                    <View key={`${a.name}-${i}`} style={[styles.spec, { borderBottomColor: t.hairline }]}>
                      <Text variant="caption" tone="muted" style={{ flex: 1, textTransform: 'capitalize' }}>
                        {a.name.replace(/_/g, ' ')}
                      </Text>
                      <Text variant="caption" style={{ flex: 1.4 }}>
                        {a.value}
                      </Text>
                    </View>
                  ))}
                </Glass>
              )}

              {/* Description */}
              {!!description && (
                <Glass radius={radius.lg} style={{ padding: 16, gap: 8 }}>
                  <Text variant="heading">About this item</Text>
                  <Text tone="muted" numberOfLines={showFullDesc ? undefined : 6} style={{ lineHeight: 22 }}>
                    {description}
                  </Text>
                  {description.length > 280 && (
                    <Text variant="label" tone="primary" onPress={() => setShowFullDesc((v) => !v)} suppressHighlighting>
                      {showFullDesc ? 'Show less' : 'Read more'}
                    </Text>
                  )}
                </Glass>
              )}

              {/* Manufacturer */}
              {!!p.manufacturer?.name && (
                <Glass radius={radius.lg} style={{ padding: 16, gap: 6 }}>
                  <Text variant="heading">Manufacturer</Text>
                  <Text tone="muted">{p.manufacturer.name}</Text>
                  {!!p.manufacturer.address && (
                    <Text variant="caption" tone="faint">
                      {p.manufacturer.address}
                    </Text>
                  )}
                  {!!p.manufacturer.consumer_care?.phone && (
                    <Text variant="caption" tone="faint">
                      Customer care: {p.manufacturer.consumer_care.phone}
                    </Text>
                  )}
                </Glass>
              )}

              <ReviewsSection
                productId={p.id}
                productName={p.name}
                top={reviews.data}
                loading={reviews.loading}
                onChanged={reviews.refresh}
              />
            </>
          )}
        </View>

        {!!related.data?.length && (
          <View>
            <Text variant="heading" style={{ paddingHorizontal: 16, marginBottom: 12 }}>
              You may also like
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}>
              {related.data.map((r) => (
                <ProductCard key={`${r.id}-${r.slug}`} product={r} width={160} />
              ))}
            </ScrollView>
          </View>
        )}
      </ScrollView>

      <TopButtons
        product={summary}
        onShare={() => Share.share({ message: `${p?.name ?? 'Check this out'} — ${WEBSITE_URL}/product/${slug}` })}
      />

      {/* Sticky action bar, just above the tab bar */}
      {p && (
        <Glass strong radius={radius.xl} intensity={70} style={[styles.actionBar, { bottom: insets.bottom + 8 }]}>
          <Button
            title="Add to cart"
            icon="bag-add-outline"
            variant="glass"
            onPress={() => addToCart('cart')}
            loading={adding === 'cart'}
            disabled={unavailable || !!adding}
            style={{ flex: 1 }}
          />
          <Button
            title="Buy now"
            icon="flash"
            onPress={() => addToCart('buy')}
            loading={adding === 'buy'}
            disabled={unavailable || !!adding}
            style={{ flex: 1 }}
          />
        </Glass>
      )}
    </Screen>
  );
}

const truthy = (v: unknown) => v === true || Number(v) === 1;

function TopButtons({ onShare, product }: { onShare?: () => void; product?: ProductSummary | null }) {
  const t = usePalette();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { count } = useCart();
  const { isSaved, toggleSaved } = useSaved();
  const saved = product ? isSaved(product.id) : false;
  return (
    <View style={[styles.top, { top: insets.top + 8 }]} pointerEvents="box-none">
      <IconButton icon="chevron-back" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {product && (
          <IconButton
            icon={saved ? 'heart' : 'heart-outline'}
            color={saved ? t.danger : undefined}
            label={saved ? 'Remove from wishlist' : 'Save to wishlist'}
            onPress={() => {
              const nowSaved = toggleSaved(product);
              toast(nowSaved ? 'Saved to your wishlist' : 'Removed from wishlist', nowSaved ? 'success' : 'info');
            }}
          />
        )}
        {onShare && <IconButton icon="share-outline" label="Share" onPress={onShare} />}
        <IconButton icon="bag-handle-outline" label="Cart" badge={count} onPress={() => router.push('/cart')} />
      </View>
    </View>
  );
}

function Policy({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  const t = usePalette();
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 6 }}>
      <View style={[styles.policyIcon, { backgroundColor: `${t.primary}14` }]}>
        <Ionicons name={icon} size={18} color={t.primary} />
      </View>
      <Text variant="tiny" tone="muted" style={{ textAlign: 'center' }}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: 10 },
  dot: { height: 6, borderRadius: 3 },
  rating: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ratingPill: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: radius.sm },
  variant: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.md, borderWidth: 1.5 },
  swatch: { width: 16, height: 16, borderRadius: 8, borderWidth: 1 },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  policies: { flexDirection: 'row', gap: 8 },
  policyIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  spec: { flexDirection: 'row', gap: 12, paddingBottom: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  actionBar: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', gap: 10, padding: 8 },
});
