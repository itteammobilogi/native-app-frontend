import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { CartLine } from '@/core/api/cart';
import { useAuth } from '@/core/auth/AuthContext';
import { useCart } from '@/core/cart/CartContext';
import { formatDeliveryDate } from '@/core/cartBreakup';
import { formatINR } from '@/core/pricing';
import { BillSummary } from '@/ui/BillSummary';
import { Button, tap } from '@/ui/Button';
import { Glass } from '@/ui/Glass';
import { QtyStepper } from '@/ui/QtyStepper';
import { EmptyState, Screen } from '@/ui/Screen';
import { Skeleton } from '@/ui/Skeleton';
import { Text } from '@/ui/Text';
import { radius, TAB_BAR_HEIGHT, usePalette } from '@/ui/theme';
import { useToast } from '@/ui/Toast';

export default function CartScreen() {
  const t = usePalette();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { isLoggedIn } = useAuth();
  const { cart, loading, confirming, refresh, setQuantity, remove, clear } = useCart();
  const [refreshing, setRefreshing] = useState(false);

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

  const buyable = cart.products.filter((l) => !l.is_unavailable);
  const canCheckout = buyable.length > 0 && cart.transactionIds.length > 0 && !confirming;

  const checkout = () => {
    if (!isLoggedIn) return router.push({ pathname: '/login', params: { next: '/checkout' } });
    router.push('/checkout');
  };

  const bottomPad = TAB_BAR_HEIGHT + insets.bottom + 24;

  return (
    <Screen>
      <View style={[styles.head, { paddingTop: insets.top + 12 }]}>
        <Text variant="display">Cart</Text>
        {cart.products.length > 0 && (
          <Text variant="label" tone="danger" onPress={confirmClear} suppressHighlighting>
            Clear all
          </Text>
        )}
      </View>

      {loading ? (
        <View style={{ padding: 16, gap: 12 }}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} height={110} r={radius.lg} />
          ))}
        </View>
      ) : cart.products.length === 0 ? (
        <View style={{ flex: 1, paddingBottom: bottomPad }}>
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
            contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: bottomPad + 90 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.primary} />}>
            {confirming && (
              <Glass radius={radius.md} style={styles.banner}>
                <ActivityIndicator size="small" color={t.primary} />
                <Text variant="caption" tone="muted" style={{ flex: 1 }}>
                  Confirming latest prices with sellers…
                </Text>
              </Glass>
            )}
            {!!cart.message && (
              <Glass radius={radius.md} style={styles.banner}>
                <Ionicons name="information-circle" size={18} color={t.warning} />
                <Text variant="caption" style={{ flex: 1 }}>
                  {cart.message}
                </Text>
              </Glass>
            )}

            {cart.products.map((line) => (
              <CartRow key={line.id} line={line} onChange={(q) => change(line, q)} />
            ))}

            <BillSummary cart={cart} />

            <View style={styles.safe}>
              <Ionicons name="shield-checkmark" size={16} color={t.success} />
              <Text variant="caption" tone="muted">
                Safe and secure payments · 100% authentic products
              </Text>
            </View>
          </ScrollView>

          <Glass strong radius={radius.xl} intensity={70} style={[styles.checkout, { bottom: TAB_BAR_HEIGHT + Math.max(insets.bottom, 12) + 10 }]}>
            <View style={{ flex: 1 }}>
              <Text variant="caption" tone="muted">
                Total
              </Text>
              <Text variant="title" style={{ fontSize: 20 }}>
                {formatINR(Number(cart.grandTotal || 0))}
              </Text>
            </View>
            <Button
              title={isLoggedIn ? 'Checkout' : 'Login to checkout'}
              icon="arrow-forward"
              onPress={checkout}
              disabled={!canCheckout}
              style={{ flex: 1.4 }}
            />
          </Glass>
        </>
      )}
    </Screen>
  );
}

function CartRow({ line, onChange }: { line: CartLine; onChange: (q: number) => void }) {
  const t = usePalette();
  const max = line.qty_limit?.max ?? 99;
  const status = line.is_unavailable
    ? { text: 'Unavailable from seller', color: t.danger }
    : line.is_over_limit
      ? { text: `Max ${max} per order — reduce quantity`, color: t.warning }
      : line.quote_state === 'awaiting'
        ? { text: 'Confirming price…', color: t.textMuted }
        : null;
  const delivery = formatDeliveryDate(line.expected_delivery_date);

  return (
    <Glass radius={radius.lg} style={styles.row}>
      <Pressable
        onPress={() => line.slug && (tap(), router.push({ pathname: '/product/[slug]', params: { slug: line.slug } }))}
        style={styles.thumb}>
        {line.image ? (
          <Image source={{ uri: line.image }} style={{ width: '88%', height: '88%' }} contentFit="contain" />
        ) : (
          <Ionicons name="image-outline" size={28} color="#C7CED9" />
        )}
      </Pressable>
      <View style={{ flex: 1, gap: 6 }}>
        <Text variant="label" numberOfLines={2} style={{ opacity: line.is_unavailable ? 0.6 : 1 }}>
          {line.title}
        </Text>
        {!!line.variant_attributes?.length && (
          <Text variant="caption" tone="muted" numberOfLines={1}>
            {line.variant_attributes.map((a) => a.value).join(' · ')}
          </Text>
        )}
        {status ? (
          <Text variant="caption" style={{ color: status.color }}>
            {status.text}
          </Text>
        ) : (
          !!delivery && (
            <View style={styles.delivery}>
              <Ionicons name="time-outline" size={12} color={t.success} />
              <Text variant="tiny" tone="success">
                Delivery by {delivery}
              </Text>
            </View>
          )
        )}
        <View style={styles.rowBottom}>
          <View>
            <Text variant="heading">{formatINR(Number(line.price || line.unit_price * line.quantity))}</Text>
            {line.quantity > 1 && (
              <Text variant="tiny" tone="faint">
                {formatINR(Number(line.unit_price))} each
              </Text>
            )}
          </View>
          <QtyStepper small removable value={line.quantity} max={max} onChange={onChange} disabled={line.is_unavailable && line.quantity <= 0} />
        </View>
      </View>
    </Glass>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: 16 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  row: { flexDirection: 'row', gap: 12, padding: 10 },
  thumb: { width: 86, height: 86, borderRadius: radius.md, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  delivery: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rowBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  safe: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 4 },
  checkout: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, paddingLeft: 18 },
});
