import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { comboPricing, getCombo, type ComboItem } from '@/core/api/combos';
import { useCart } from '@/core/cart/CartContext';
import { WEBSITE_URL } from '@/core/config';
import { useAsync } from '@/core/hooks/useAsync';
import { useLocation } from '@/core/location/LocationContext';
import { formatINR, isProductUnavailable } from '@/core/pricing';
import { Button, IconButton, tap } from '@/ui/Button';
import { Glass } from '@/ui/Glass';
import { QtyStepper } from '@/ui/QtyStepper';
import { ErrorState, Header, Screen } from '@/ui/Screen';
import { Skeleton } from '@/ui/Skeleton';
import { Text } from '@/ui/Text';
import { radius, usePalette } from '@/ui/theme';
import { useToast } from '@/ui/Toast';

// Website: /zillycart/[slug]. The shopper picks items from the combo (all
// available ones start selected) and they go into the regular cart.
export default function ComboScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const t = usePalette();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const toast = useToast();
  const cart = useCart();
  const { pincodeId } = useLocation();

  const combo = useAsync(() => getCombo(slug), [slug]);
  const c = combo.data;

  // Track what the shopper unticked rather than what is ticked, so every
  // available item starts selected without syncing state after the load.
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const [qty, setQty] = useState<Record<number, number>>({});
  const [adding, setAdding] = useState<'cart' | 'buy' | null>(null);
  const [imgIndex, setImgIndex] = useState(0);

  const items = useMemo(() => c?.items ?? [], [c]);
  const available = useMemo(() => items.filter((it) => !isProductUnavailable(it)), [items]);
  const selected = available.filter((it) => !excluded.has(it.zi_id));
  const qtyOf = (it: ComboItem) => qty[it.zi_id] ?? 1;
  const selectedTotal = selected.reduce((sum, it) => sum + Number(it.price) * qtyOf(it), 0);
  const selectedMrp = selected.reduce((sum, it) => sum + Math.max(Number(it.max_value) || 0, Number(it.price)) * qtyOf(it), 0);
  const allSelected = available.length > 0 && selected.length === available.length;

  const gallery = useMemo(
    () => [c?.zc_image, ...items.map((it) => it.image)].filter((v, i, a): v is string => !!v && a.indexOf(v) === i),
    [c, items],
  );

  const toggle = (id: number) =>
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleAll = () => setExcluded(allSelected ? new Set(available.map((it) => it.zi_id)) : new Set());

  // Items go in one at a time, like the website; the first failure stops the
  // run and says which item it was.
  const addSelected = async (mode: 'cart' | 'buy') => {
    if (!selected.length) return toast('Select at least one product.', 'error');
    setAdding(mode);
    let added = 0;
    try {
      for (const it of selected) {
        try {
          await cart.add({
            product_variant_id: it.variant_id,
            product_value: it.product_value || it.sku || '',
            bpp_id: it.bpp_id,
            sor_id: it.sor_id,
            sor_value: it.sor_value,
            location_id: it.location_id,
            location_value: it.location_value,
            quantity: qtyOf(it),
            price: Number(it.price),
            pincode_id: pincodeId,
          });
          added += 1;
        } catch (e: any) {
          throw new Error(`${it.name}: ${e?.message ?? 'could not be added'}`);
        }
      }
      if (mode === 'buy') router.push('/cart');
      else toast(added === 1 ? 'Added to cart' : `${added} products added to cart`, 'success');
    } catch (e: any) {
      toast(added ? `${added} added. ${e.message}` : e.message, 'error');
    } finally {
      setAdding(null);
    }
  };

  const share = () =>
    Share.share({ message: `Check out this combo on ZillyBuy: ${c?.zc_name ?? ''} — ${WEBSITE_URL}/zillycart/${slug}` });

  if (combo.loading) {
    return (
      <Screen>
        <Header title="Combo" />
        <View style={{ padding: 16, gap: 12 }}>
          <Skeleton height={width * 0.62} r={radius.lg} />
          <Skeleton height={90} r={radius.lg} />
          <Skeleton height={90} r={radius.lg} />
        </View>
      </Screen>
    );
  }
  if (combo.error || !c) {
    return (
      <Screen>
        <Header title="Combo" />
        <ErrorState message={combo.error ?? 'Combo not found'} onRetry={combo.reload} />
      </Screen>
    );
  }

  const { actual, price, discount } = comboPricing(c);
  const cashback = Number(c.zc_cashback_amount) || 0;
  const imgWidth = width - 32;

  return (
    <Screen>
      <Header title={c.zc_name} right={<IconButton icon="share-social-outline" label="Share" onPress={share} />} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: insets.bottom + 120 }}>
        {gallery.length > 0 && (
          <View>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) => setImgIndex(Math.round(e.nativeEvent.contentOffset.x / imgWidth))}
              style={{ borderRadius: radius.lg }}>
              {gallery.map((uri) => (
                <View key={uri} style={{ width: imgWidth, aspectRatio: 16 / 11, backgroundColor: '#fff' }}>
                  <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="contain" transition={200} />
                </View>
              ))}
            </ScrollView>
            {gallery.length > 1 && (
              <View style={styles.dots}>
                {gallery.map((uri, i) => (
                  <View key={uri} style={[styles.dot, { backgroundColor: i === imgIndex ? t.primary : t.hairline, width: i === imgIndex ? 16 : 6 }]} />
                ))}
              </View>
            )}
          </View>
        )}

        <Glass radius={radius.lg} style={{ padding: 16, gap: 8 }}>
          <Text variant="tiny" tone="primary" style={{ textTransform: 'uppercase', letterSpacing: 0.8 }}>
            {c.zc_type || 'Combo offer'} · {items.length} products
          </Text>
          <Text variant="title">{c.zc_name}</Text>
          {!!c.zc_description && <Text tone="muted">{c.zc_description}</Text>}
          {price > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
              <Text variant="title">{formatINR(price)}</Text>
              {actual > price && (
                <Text tone="faint" style={{ textDecorationLine: 'line-through' }}>
                  {formatINR(actual)}
                </Text>
              )}
              {discount > 0 && <Text tone="success">{discount}% off</Text>}
            </View>
          )}
          {cashback > 0 && (
            <View style={styles.row}>
              <Ionicons name="gift-outline" size={16} color={t.success} />
              <Text variant="caption" tone="success">
                {formatINR(cashback)} cashback on this combo
              </Text>
            </View>
          )}
        </Glass>

        <View style={[styles.row, { justifyContent: 'space-between', paddingHorizontal: 4 }]}>
          <Text variant="heading">Products in this combo</Text>
          {available.length > 0 && (
            <Text variant="label" tone="primary" onPress={() => (tap(), toggleAll())} suppressHighlighting>
              {allSelected ? 'Clear all' : 'Select all'}
            </Text>
          )}
        </View>

        {items.map((it) => (
          <ComboItemRow
            key={it.zi_id}
            item={it}
            selected={!excluded.has(it.zi_id) && !isProductUnavailable(it)}
            qty={qtyOf(it)}
            onToggle={() => toggle(it.zi_id)}
            onQty={(v) => setQty((prev) => ({ ...prev, [it.zi_id]: v }))}
          />
        ))}

        <View style={styles.row}>
          <Ionicons name="shield-checkmark-outline" size={16} color={t.textMuted} />
          <Text variant="caption" tone="muted" style={{ flex: 1 }}>
            Each product ships from its own seller and is billed at its listed price.
          </Text>
        </View>
      </ScrollView>

      <Glass strong radius={0} style={[styles.bar, { paddingBottom: insets.bottom + 12 }]}>
        <View style={{ flex: 1 }}>
          <Text variant="caption" tone="muted">
            {selected.length} selected
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
            <Text variant="heading">{formatINR(selectedTotal)}</Text>
            {selectedMrp > selectedTotal && (
              <Text variant="caption" tone="faint" style={{ textDecorationLine: 'line-through' }}>
                {formatINR(selectedMrp)}
              </Text>
            )}
          </View>
        </View>
        <Button
          title="Add"
          icon="cart-outline"
          variant="glass"
          size="md"
          onPress={() => addSelected('cart')}
          loading={adding === 'cart'}
          disabled={!selected.length || !!adding}
          style={{ minWidth: 92 }}
        />
        <Button
          title="Buy now"
          size="md"
          onPress={() => addSelected('buy')}
          loading={adding === 'buy'}
          disabled={!selected.length || !!adding}
          style={{ minWidth: 110 }}
        />
      </Glass>
    </Screen>
  );
}

function ComboItemRow({
  item,
  selected,
  qty,
  onToggle,
  onQty,
}: {
  item: ComboItem;
  selected: boolean;
  qty: number;
  onToggle: () => void;
  onQty: (v: number) => void;
}) {
  const t = usePalette();
  const unavailable = isProductUnavailable(item);
  const mrp = Number(item.max_value) || 0;
  const price = Number(item.price);
  return (
    <Glass radius={radius.lg} style={{ padding: 12, opacity: unavailable ? 0.6 : 1 }}>
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: selected, disabled: unavailable }}
          accessibilityLabel={`Select ${item.name}`}
          disabled={unavailable}
          hitSlop={8}
          onPress={() => (tap(), onToggle())}>
          <Ionicons name={selected ? 'checkbox' : 'square-outline'} size={24} color={selected ? t.primary : t.textFaint} />
        </Pressable>
        <Pressable
          onPress={() => item.slug && router.push({ pathname: '/product/[slug]', params: { slug: item.slug } })}
          style={styles.thumb}>
          {item.image ? <Image source={{ uri: item.image }} style={{ width: '88%', height: '88%' }} contentFit="contain" /> : null}
        </Pressable>
        <View style={{ flex: 1, gap: 4 }}>
          {!!item.brand_name && (
            <Text variant="tiny" tone="faint">
              {item.brand_name}
            </Text>
          )}
          <Text variant="label" numberOfLines={2}>
            {item.name}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
            <Text variant="label">{formatINR(price)}</Text>
            {mrp > price && (
              <Text variant="caption" tone="faint" style={{ textDecorationLine: 'line-through' }}>
                {formatINR(mrp)}
              </Text>
            )}
          </View>
          {unavailable ? (
            <Text variant="caption" tone="danger">
              Currently unavailable
            </Text>
          ) : (
            <View style={{ alignSelf: 'flex-start' }}>
              <QtyStepper small value={qty} max={Math.max(1, Math.min(item.zi_quantity || 10, 10))} onChange={onQty} disabled={!selected} />
            </View>
          )}
        </View>
      </View>
    </Glass>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 10 },
  dot: { height: 6, borderRadius: 3 },
  thumb: { width: 72, height: 72, borderRadius: radius.md, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 12 },
});
