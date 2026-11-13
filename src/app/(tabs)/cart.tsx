import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Cart, CartLine } from '@/core/api/cart';
import { useAuth } from '@/core/auth/AuthContext';
import { useCart } from '@/core/cart/CartContext';
import { cartPackages, formatDeliveryDate, itemCountOf, type CartPackage } from '@/core/cartBreakup';
import { attributeLabel } from '@/core/colourNames';
import { useLocation } from '@/core/location/LocationContext';
import { formatINR } from '@/core/pricing';
import { useSaved } from '@/core/saved/SavedContext';
import { tap } from '@/ui/Button';
import { PincodeSheet } from '@/ui/PincodeSheet';
import { QtyStepper } from '@/ui/QtyStepper';
import { EmptyState, Screen } from '@/ui/Screen';
import { Skeleton } from '@/ui/Skeleton';
import { Text } from '@/ui/Text';
import { radius, usePalette } from '@/ui/theme';
import { useToast } from '@/ui/Toast';

// A parcel is one seller's shipment. Lines a seller can't supply are shown in
// their own "can't ship" block and never charged.
type Parcel = { key: string; seller: number; pkg: CartPackage; lines: CartLine[]; blocked: boolean };

function parcelsOf(cart: Cart): Parcel[] {
  const pkgs = cartPackages(cart);
  const ships: Parcel[] = [];
  const blocked: Parcel[] = [];
  pkgs.forEach((pkg, i) => {
    if (pkg.lines.length) ships.push({ key: `${pkg.tid}`, seller: i + 1, pkg, lines: pkg.lines, blocked: false });
    if (pkg.unavailable.length) blocked.push({ key: `${pkg.tid}-x`, seller: i + 1, pkg, lines: pkg.unavailable, blocked: true });
  });
  return [...ships, ...blocked];
}

export default function CartScreen() {
  const t = usePalette();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { isLoggedIn } = useAuth();
  const { wishlist } = useSaved();
  const { location } = useLocation();
  const { cart, loading, confirming, refresh, setQuantity, remove, clear } = useCart();
  const [refreshing, setRefreshing] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);

  // Quotes expire; re-fetching also makes the server re-quote stale lines.
  useFocusEffect(
    useCallback(() => {
      refresh().catch(() => {});
    }, [refresh]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh().catch(() => {});
    setRefreshing(false);
  };

  const change = async (line: CartLine, qty: number) => {
    try {
      if (qty <= 0) await remove(line);
      else await setQuantity(line, qty);
    } catch (e: any) {
      toast(e.message, 'error');
    }
  };

  const confirmClear = () =>
    Alert.alert('Clear cart?', 'This removes every item from your cart.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: () => clear().catch((e) => toast(e.message, 'error')) },
    ]);

  const parcels = parcelsOf(cart);
  const shipping = parcels.filter((p) => !p.blocked);
  const sellers = new Set(cart.products.map((l) => l.t_id)).size;
  const items = itemCountOf(cart);
  const canCheckout = shipping.length > 0 && cart.transactionIds.length > 0 && !confirming;
  const total = Number(cart.grandTotal || 0);

  const checkout = () => {
    if (!isLoggedIn) return router.push({ pathname: '/login', params: { next: '/checkout' } });
    router.push('/checkout');
  };

  // No tab bar on the cart (see GlassTabBar); the checkout bar sits at the
  // bottom edge, its padding running behind the system navigation.
  const barSpace = insets.bottom;
  const empty = !loading && cart.products.length === 0;

  return (
    <Screen statusBar="light">
      {/* Blue header */}
      <View style={[styles.header, { paddingTop: insets.top + 10, backgroundColor: t.dark ? '#0B4A99' : t.primary }]}>
        <View pointerEvents="none" style={[styles.ring, { width: 200, height: 200, top: -80, right: -50 }]} />
        <View style={styles.headRow}>
          {/* Always shown: with no tab bar on the cart, this is the way back. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={8}
            onPress={() => (router.canGoBack() ? router.back() : router.navigate('/'))}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </Pressable>
          <Text variant="title" tone="onPrimary" style={{ flex: 1 }}>
            Your cart
          </Text>
          <Pressable accessibilityRole="link" onPress={() => (tap(), router.push('/wishlist'))} style={styles.savedPill}>
            <Ionicons name="bookmark-outline" size={13} color="#fff" />
            <Text variant="tiny" tone="onPrimary">
              Saved · {wishlist.length}
            </Text>
          </Pressable>
        </View>

        {!empty && (
          <View style={styles.stats}>
            <Stat value={items} label={items === 1 ? 'item' : 'items'} />
            <Stat value={sellers} label={sellers === 1 ? 'seller' : 'sellers'} />
            <Stat value={shipping.length} label={shipping.length === 1 ? 'parcel ships' : 'parcels ship'} />
          </View>
        )}

        <View style={styles.headRow}>
          <Ionicons name="location-outline" size={15} color="#fff" />
          <Text variant="caption" tone="onPrimary" numberOfLines={1} style={{ flex: 1 }}>
            {location ? (
              <>
                Delivering to <Text variant="caption" tone="onPrimary" style={{ fontWeight: '800' }}>{`${location.pincode}, ${location.label}`}</Text>
              </>
            ) : (
              'Set your delivery pincode'
            )}
          </Text>
          <Text
            variant="caption"
            tone="onPrimary"
            style={{ fontWeight: '800', textDecorationLine: 'underline' }}
            onPress={() => (tap(), setPinOpen(true))}
            suppressHighlighting>
            {location ? 'Change' : 'Set'}
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={{ padding: 16, gap: 12 }}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} height={120} r={radius.lg} />
          ))}
        </View>
      ) : empty ? (
        <View style={{ flex: 1, paddingBottom: barSpace + 24 }}>
          <EmptyState
            icon="bag-handle-outline"
            title="Your cart is empty"
            message="Looks like you haven't added anything yet."
            action="Start shopping"
            onAction={() => router.navigate('/')}
          />
        </View>
      ) : (
        <>
          <ScrollView
            contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: barSpace + 96 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.primary} />}>
            {confirming && (
              <View style={[styles.notice, { backgroundColor: t.tileFill }]}>
                <ActivityIndicator size="small" color={t.primary} />
                <Text variant="caption" tone="muted" style={{ flex: 1 }}>
                  Confirming latest prices with sellers…
                </Text>
              </View>
            )}
            {!!cart.message && (
              <View style={[styles.notice, { backgroundColor: `${t.warning}18` }]}>
                <Ionicons name="information-circle" size={18} color={t.warning} />
                <Text variant="caption" style={{ flex: 1 }}>
                  {cart.message}
                </Text>
              </View>
            )}

            {parcels.map((parcel, i) => (
              <ParcelCard key={parcel.key} parcel={parcel} index={i + 1} onChange={change} />
            ))}

            {/* Coupons are checked against the address at checkout */}
            <View style={[styles.coupon, { borderColor: t.primary, backgroundColor: t.dark ? '#0F1B33' : '#F3F8FF' }]}>
              <Ionicons name="pricetags-outline" size={20} color={t.primary} />
              <View style={{ flex: 1 }}>
                <Text variant="label" style={{ fontSize: 13 }}>
                  Have a coupon code?
                </Text>
                <Text variant="tiny" tone="muted" style={{ fontWeight: '500' }}>
                  Apply it at checkout; it&apos;s checked before you pay
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                disabled={!canCheckout}
                onPress={() => (tap(), checkout())}
                style={[styles.applyBtn, { backgroundColor: t.primary, opacity: canCheckout ? 1 : 0.5 }]}>
                <Text variant="caption" tone="onPrimary" style={{ fontWeight: '700' }}>
                  Apply
                </Text>
              </Pressable>
            </View>

            <Bill cart={cart} parcels={parcels} items={items} />

            <View style={styles.secure}>
              <Ionicons name="lock-closed-outline" size={13} color={t.success} />
              <Text variant="tiny" tone="muted" style={{ fontWeight: '500' }}>
                Payments secured by Cashfree · UPI, cards, net banking
              </Text>
            </View>
            <Text variant="caption" tone="danger" onPress={confirmClear} suppressHighlighting style={{ textAlign: 'center', fontWeight: '600' }}>
              Clear cart
            </Text>
          </ScrollView>

          {/* Checkout bar, docked to the bottom */}
          <View style={[styles.bar, { bottom: 0, paddingBottom: insets.bottom + 10, backgroundColor: t.glassFill, borderTopColor: t.hairline }]}>
            <View>
              <Text variant="tiny" tone="muted" style={{ fontWeight: '500' }}>
                To pay
              </Text>
              <Text variant="title" style={{ fontSize: 19 }}>
                {formatINR(total)}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              disabled={!canCheckout}
              onPress={() => (tap(), checkout())}
              style={({ pressed }) => [
                styles.checkoutBtn,
                { backgroundColor: !canCheckout ? t.textFaint : pressed ? t.primaryPressed : t.primary },
              ]}>
              <Text variant="label" tone="onPrimary">
                {!isLoggedIn
                  ? 'Login to checkout'
                  : `Checkout ${shipping.length} parcel${shipping.length === 1 ? '' : 's'}`}
              </Text>
              <Ionicons name="arrow-forward" size={17} color="#fff" />
            </Pressable>
          </View>
        </>
      )}

      <PincodeSheet visible={pinOpen} onClose={() => setPinOpen(false)} />
    </Screen>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.stat}>
      <Text variant="title" tone="onPrimary" style={{ fontSize: 20 }}>
        {value}
      </Text>
      <Text variant="tiny" style={{ color: 'rgba(255,255,255,0.85)', fontWeight: '500' }}>
        {label}
      </Text>
    </View>
  );
}

function ParcelCard({ parcel, index, onChange }: { parcel: Parcel; index: number; onChange: (line: CartLine, qty: number) => void }) {
  const t = usePalette();
  const { pkg, blocked } = parcel;
  const date = formatDeliveryDate(pkg.deliveryDate);
  const units = parcel.lines.reduce((s, l) => s + Number(l.quantity || 0), 0);
  const tone = blocked ? t.danger : t.success;

  const meta = [
    `${units} item${units === 1 ? '' : 's'}`,
    pkg.delivery > 0 ? `${formatINR(pkg.delivery)} delivery` : pkg.delivery === 0 && pkg.lines.length ? 'free delivery' : null,
    `from Seller ${parcel.seller}`,
  ].filter(Boolean);

  return (
    <View style={[styles.card, { borderColor: blocked ? `${t.danger}40` : t.glassBorder, backgroundColor: t.glassFill }]}>
      <View style={[styles.parcelHead, { backgroundColor: `${tone}12` }]}>
        <View style={[styles.parcelIcon, { backgroundColor: `${tone}22` }]}>
          <Ionicons name={blocked ? 'alert-circle-outline' : 'cube-outline'} size={15} color={tone} />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="caption" style={{ fontWeight: '800', color: blocked ? t.danger : t.text }}>
            Parcel {index} · {blocked ? "can't ship right now" : date ? `arrives ${date}` : 'ships from the seller'}
          </Text>
          <Text variant="tiny" tone={blocked ? 'danger' : 'muted'} style={{ fontWeight: '500' }}>
            {blocked ? `Seller ${parcel.seller} can't supply ${units === 1 ? 'this item' : 'these items'} today. You won't be charged.` : meta.join(' · ')}
          </Text>
        </View>
      </View>

      {parcel.lines.map((line, i) => (
        <LineRow key={line.id} line={line} blocked={blocked} first={i === 0} onChange={(q) => onChange(line, q)} />
      ))}
    </View>
  );
}

function LineRow({ line, blocked, first, onChange }: { line: CartLine; blocked: boolean; first: boolean; onChange: (q: number) => void }) {
  const t = usePalette();
  const max = line.qty_limit?.max ?? 99;
  const status = line.is_over_limit
    ? { text: `Max ${max} per order, reduce quantity`, color: t.warning }
    : line.quote_state === 'awaiting'
      ? { text: 'Confirming price…', color: t.textMuted }
      : null;
  const open = () => line.slug && (tap(), router.push({ pathname: '/product/[slug]', params: { slug: line.slug } }));
  const similar = () => {
    tap();
    router.push({ pathname: '/search', params: { q: line.title.split(/\s+/).slice(0, 3).join(' ') } });
  };

  return (
    <View style={[styles.line, !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.hairline }]}>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Pressable onPress={open} style={[styles.thumb, { backgroundColor: t.tileFill, opacity: blocked ? 0.55 : 1 }]}>
          {line.image ? (
            <Image source={{ uri: line.image }} style={{ width: '82%', height: '82%' }} contentFit="contain" />
          ) : (
            <Ionicons name="image-outline" size={26} color="#C7CED9" />
          )}
        </Pressable>
        <View style={{ flex: 1, gap: 4 }}>
          <Text variant="label" numberOfLines={2} style={{ fontSize: 14, opacity: blocked ? 0.6 : 1 }} onPress={open} suppressHighlighting>
            {line.title}
          </Text>
          {!!line.variant_attributes?.length && (
            <Text variant="tiny" tone="muted" numberOfLines={1} style={{ fontWeight: '500' }}>
              {attributeLabel(line.variant_attributes)}
            </Text>
          )}
          {blocked ? (
            <Text variant="tiny" tone="faint" style={{ fontWeight: '500' }}>
              Was {formatINR(Number(line.unit_price))} · {line.quantity} unit{line.quantity === 1 ? '' : 's'}
            </Text>
          ) : (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <View>
                  <Text variant="heading" style={{ fontSize: 17 }}>
                    {formatINR(Number(line.price || line.unit_price * line.quantity))}
                  </Text>
                  {line.quantity > 1 && (
                    <Text variant="tiny" tone="faint" style={{ fontWeight: '500' }}>
                      {formatINR(Number(line.unit_price))} each
                    </Text>
                  )}
                </View>
                <QtyStepper small removable value={line.quantity} max={max} onChange={onChange} disabled={line.id < 0} />
              </View>
              {status && (
                <Text variant="tiny" style={{ color: status.color }}>
                  {status.text}
                </Text>
              )}
            </>
          )}
        </View>
      </View>

      {blocked && (
        <View style={styles.actions}>
          <Pressable onPress={() => (tap(), onChange(0))} style={[styles.action, { backgroundColor: t.dark ? '#FFFFFF' : '#0B1B33' }]}>
            <Ionicons name="trash-outline" size={14} color={t.dark ? '#0B1B33' : '#fff'} />
            <Text variant="caption" style={{ fontWeight: '700', color: t.dark ? '#0B1B33' : '#fff' }}>
              Remove
            </Text>
          </Pressable>
          <Pressable onPress={similar} style={[styles.action, { borderWidth: 1, borderColor: t.primary }]}>
            <Ionicons name="search-outline" size={14} color={t.primary} />
            <Text variant="caption" tone="primary" style={{ fontWeight: '700' }}>
              Find similar
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

// The bill as the sellers quoted it: items, each parcel's delivery, fees and
// discounts; parcels that can't ship are listed as not charged.
function Bill({ cart, parcels, items }: { cart: Cart; parcels: Parcel[]; items: number }) {
  const t = usePalette();
  const b = cart.breakupSummary ?? {};
  const shipping = parcels.filter((p) => !p.blocked);
  const discount = Math.abs(Number(b.discount || 0));
  const rows: [string, string, string?][] = [[`Items (${items})`, formatINR(Number(b.item_total ?? 0))]];
  if (discount) rows.push(['Seller discount', `− ${formatINR(discount)}`, t.success]);
  parcels.forEach((p, i) => {
    if (p.blocked) rows.push([`Parcel ${i + 1}`, 'not charged', t.textFaint]);
    else rows.push([`Delivery, Parcel ${i + 1}`, p.pkg.delivery > 0 ? formatINR(p.pkg.delivery) : 'Free', p.pkg.delivery > 0 ? undefined : t.success]);
  });
  if (Number(b.misc || 0)) rows.push(['Packing & other charges', formatINR(Number(b.misc))]);
  if (Number(b.tax || 0)) rows.push(['Taxes', formatINR(Number(b.tax))]);

  return (
    <View style={[styles.card, { borderColor: t.glassBorder, backgroundColor: t.dark ? t.glassFill : '#F8FAFC', padding: 14, gap: 9 }]}>
      <View style={styles.between}>
        <Text variant="heading" style={{ fontSize: 16 }}>
          Bill
        </Text>
        <Text variant="tiny" tone="faint" style={{ fontWeight: '500' }}>
          {shipping.length} parcel{shipping.length === 1 ? '' : 's'} · taxes included
        </Text>
      </View>
      {rows.map(([label, value, color]) => (
        <View key={label} style={styles.billRow}>
          <Text variant="caption" tone="muted">
            {label}
          </Text>
          <View style={[styles.leader, { borderColor: t.hairline }]} />
          <Text variant="caption" style={[{ fontWeight: '600' }, color ? { color } : null]}>
            {value}
          </Text>
        </View>
      ))}
      <View style={[styles.divider, { backgroundColor: t.hairline }]} />
      <View style={styles.between}>
        <Text variant="heading">To pay</Text>
        <Text variant="heading">{formatINR(Number(cart.grandTotal || 0))}</Text>
      </View>
      <View style={[styles.billNote, { backgroundColor: t.glassFill }]}>
        <Ionicons name="information-circle-outline" size={14} color={t.textFaint} />
        <Text variant="tiny" tone="muted" style={{ flex: 1, fontWeight: '500' }}>
          Each seller sets its own price, delivery and taxes. Prices are re-checked at checkout.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingBottom: 14, gap: 12, overflow: 'hidden' },
  ring: { position: 'absolute', borderRadius: 999, borderWidth: 22, borderColor: 'rgba(255,255,255,0.06)' },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  savedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  stats: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1, padding: 10, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.14)' },
  notice: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: radius.md },
  card: { borderWidth: 1, borderRadius: radius.lg, overflow: 'hidden' },
  parcelHead: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10 },
  parcelIcon: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  line: { padding: 12, gap: 12 },
  thumb: { width: 76, height: 76, borderRadius: 12, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  actions: { flexDirection: 'row', gap: 8 },
  action: { flex: 1, height: 38, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  coupon: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.lg, borderWidth: 1.5, borderStyle: 'dashed' },
  applyBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  billRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  leader: { flex: 1, borderBottomWidth: 1, borderStyle: 'dotted', marginBottom: 4 },
  divider: { height: 1, marginVertical: 2 },
  billNote: { flexDirection: 'row', gap: 6, padding: 8, borderRadius: 10, alignItems: 'flex-start' },
  secure: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    elevation: 12,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -4 },
  },
  checkoutBtn: { flex: 1, height: 50, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
});
