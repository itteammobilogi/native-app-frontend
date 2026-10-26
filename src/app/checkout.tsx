import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { listAddresses, type Address } from '@/core/api/address';
import { cartError, waitForSellers } from '@/core/api/cart';
import { errorMessage } from '@/core/api/client';
import { applyCoupon, createCashfreeOrder, submitBilling, type CouponResult } from '@/core/api/orders';
import { useAuth } from '@/core/auth/AuthContext';
import { useCart } from '@/core/cart/CartContext';
import { useAsync } from '@/core/hooks/useAsync';
import { formatINR } from '@/core/pricing';
import { AddressCard } from '@/ui/AddressCard';
import { BillSummary } from '@/ui/BillSummary';
import { Button } from '@/ui/Button';
import { Glass } from '@/ui/Glass';
import { Input } from '@/ui/Input';
import { OrderSummary } from '@/ui/OrderSummary';
import { EmptyState, Header, Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { radius, usePalette } from '@/ui/theme';
import { useToast } from '@/ui/Toast';

type Step = 'idle' | 'billing' | 'seller' | 'payment';
const STEP_TEXT: Record<Step, string> = {
  idle: '',
  billing: 'Saving delivery details…',
  seller: 'Waiting for the seller to confirm your order…',
  payment: 'Preparing secure payment…',
};

// Website flow (pages/checkout/index.js): billing → wait for ONDC on_init →
// create Cashfree order → pay. All ONDC calls happen on the server.
export default function CheckoutScreen() {
  const t = usePalette();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { user, isLoggedIn } = useAuth();
  const { cart, refresh } = useCart();
  const [addressId, setAddressId] = useState<number | null>(null);
  const [step, setStep] = useState<Step>('idle');
  const [couponInput, setCouponInput] = useState('');
  const [coupon, setCoupon] = useState<CouponResult | null>(null);
  const [couponBusy, setCouponBusy] = useState(false);
  const [couponError, setCouponError] = useState('');

  useEffect(() => {
    if (!isLoggedIn) router.replace({ pathname: '/login', params: { next: '/checkout' } });
  }, [isLoggedIn]);

  const addresses = useAsync(() => (user ? listAddresses(user.id) : Promise.resolve([] as Address[])), [user?.id]);

  useFocusEffect(
    useCallback(() => {
      if (!addresses.loading) addresses.refresh();
      refresh().catch(() => {});
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  // Falls back to the default address (the list is sorted default-first).
  const address = addresses.data?.find((a) => a.id === addressId) ?? addresses.data?.[0] ?? null;
  const tids = cart.transactionIds;
  const payable = coupon ? coupon.netAmount : Number(cart.grandTotal || 0);

  const apply = async () => {
    const code = couponInput.trim().toUpperCase();
    if (!code) return;
    setCouponBusy(true);
    setCouponError('');
    try {
      const r = await applyCoupon(code, tids, address?.id);
      setCoupon(r);
      toast(`Coupon applied — you save ${formatINR(r.discountAmount)}`, 'success');
    } catch (e) {
      setCoupon(null);
      setCouponError(cartError(e).message);
    } finally {
      setCouponBusy(false);
    }
  };

  const placeOrder = async () => {
    if (!address) return toast('Add a delivery address first', 'error');
    if (!tids.length) return toast('Your cart is empty', 'error');

    try {
      setStep('billing');
      const since = Date.now();
      await submitBilling(address, tids);

      setStep('seller');
      const init = await waitForSellers(tids, 'on_init', { since });
      if (init.nacked.length || init.timedOut) {
        await refresh();
        toast(
          init.timedOut
            ? "The seller didn't respond in time. Please try again."
            : 'A seller could not accept part of your order. Please review your cart.',
          'error',
        );
        setStep('idle');
        return;
      }

      setStep('payment');
      const fresh = await refresh();
      const order = await createCashfreeOrder({
        transactionIds: fresh.transactionIds,
        selectedAddressId: address.id,
        couponCode: coupon?.code,
      });

      if (order.free_order) {
        router.replace({ pathname: '/order-success', params: { order_id: order.order_id, amount: '0' } });
        return;
      }
      if (!order.payment_session_id || !(Number(order.order_amount) > 0)) {
        throw new Error('Invalid order amount from server');
      }
      router.push({
        pathname: '/payment',
        params: { session: order.payment_session_id, order_id: order.order_id, amount: String(order.order_amount) },
      });
      setStep('idle');
    } catch (e: any) {
      setStep('idle');
      const d = e?.response?.data;
      if (d?.error === 'Order already paid') {
        router.replace({ pathname: '/order-success', params: { order_id: d.order_id, amount: String(d.order_amount ?? '') } });
        return;
      }
      if (String(d?.errorCode || '').startsWith('COUPON_')) setCoupon(null);
      if (['QTY_LIMIT', 'SELLER_UNAVAILABLE', 'CART_CHANGED', 'QUOTE_EXPIRED'].includes(d?.code)) {
        await refresh().catch(() => {});
        toast(d.error || 'Your cart changed. Please review it.', 'error');
        router.back();
        return;
      }
      toast(d?.error || errorMessage(e), 'error');
    }
  };

  const busy = step !== 'idle';

  if (!cart.products.length) {
    return (
      <Screen>
        <Header title="Checkout" />
        <EmptyState icon="bag-handle-outline" title="Your cart is empty" action="Continue shopping" onAction={() => router.navigate('/')} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Header title="Checkout" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: insets.bottom + 130 }} keyboardShouldPersistTaps="handled">
        <Steps active={busy ? 2 : 1} />

        {/* Address */}
        <View style={styles.between}>
          <Text variant="heading">Deliver to</Text>
          <Text variant="label" tone="primary" onPress={() => router.push('/address-form')} suppressHighlighting>
            + Add new
          </Text>
        </View>
        {addresses.loading ? (
          <ActivityIndicator color={t.primary} />
        ) : !addresses.data?.length ? (
          <Glass radius={radius.lg} style={{ padding: 16, gap: 12, alignItems: 'center' }}>
            <Ionicons name="location-outline" size={28} color={t.primary} />
            <Text tone="muted">No saved address yet.</Text>
            <Button title="Add delivery address" size="md" onPress={() => router.push('/address-form')} style={{ alignSelf: 'stretch' }} />
          </Glass>
        ) : (
          addresses.data.map((a) => (
            <AddressCard key={a.id} address={a} selected={a.id === address?.id} onPress={() => !busy && setAddressId(a.id)} />
          ))
        )}

        {/* Items */}
        <OrderSummary cart={cart} />

        {/* Coupon */}
        <Glass radius={radius.lg} style={{ padding: 16, gap: 10 }}>
          <Text variant="heading">Coupon</Text>
          {coupon ? (
            <View style={styles.between}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="pricetag" size={18} color={t.success} />
                <Text variant="label" tone="success">
                  {coupon.code} applied
                </Text>
              </View>
              <Text variant="label" tone="danger" onPress={() => setCoupon(null)} suppressHighlighting>
                Remove
              </Text>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
              <View style={{ flex: 1 }}>
                <Input
                  icon="pricetag-outline"
                  placeholder="Enter coupon code"
                  autoCapitalize="characters"
                  value={couponInput}
                  onChangeText={(v) => (setCouponInput(v), setCouponError(''))}
                  error={couponError}
                />
              </View>
              <Button title="Apply" size="lg" variant="glass" onPress={apply} loading={couponBusy} disabled={!couponInput.trim()} />
            </View>
          )}
        </Glass>

        <BillSummary cart={cart} discount={coupon?.discountAmount} total={payable} />

        <View style={styles.secure}>
          <Ionicons name="lock-closed" size={14} color={t.success} />
          <Text variant="caption" tone="muted">
            Payments are processed securely by Cashfree
          </Text>
        </View>
      </ScrollView>

      <Glass strong radius={radius.xl} intensity={70} style={[styles.bar, { bottom: Math.max(insets.bottom, 12) }]}>
        {busy ? (
          <View style={styles.progress}>
            <ActivityIndicator color={t.primary} />
            <Text variant="label" style={{ flex: 1 }}>
              {STEP_TEXT[step]}
            </Text>
          </View>
        ) : (
          <>
            <View style={{ flex: 1, paddingLeft: 10 }}>
              <Text variant="caption" tone="muted">
                To pay
              </Text>
              <Text variant="title" style={{ fontSize: 20 }}>
                {formatINR(payable)}
              </Text>
            </View>
            <Button title="Place order" icon="lock-closed" onPress={placeOrder} disabled={!address} style={{ flex: 1.4 }} />
          </>
        )}
      </Glass>
    </Screen>
  );
}

function Steps({ active }: { active: number }) {
  const t = usePalette();
  const steps = ['Cart', 'Address', 'Payment'];
  return (
    <View style={styles.steps}>
      {steps.map((s, i) => {
        const on = i <= active;
        return (
          <View key={s} style={{ flexDirection: 'row', alignItems: 'center', flex: i < steps.length - 1 ? 1 : undefined }}>
            <View style={[styles.stepDot, { backgroundColor: on ? t.primary : t.hairline }]}>
              {i < active ? <Ionicons name="checkmark" size={12} color="#fff" /> : <Text variant="tiny" tone={on ? 'onPrimary' : 'faint'}>{i + 1}</Text>}
            </View>
            <Text variant="tiny" tone={on ? 'default' : 'faint'} style={{ marginLeft: 6 }}>
              {s}
            </Text>
            {i < steps.length - 1 && <View style={[styles.stepLine, { backgroundColor: i < active ? t.primary : t.hairline }]} />}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  secure: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  bar: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 8, minHeight: 70 },
  progress: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12 },
  steps: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  stepDot: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  stepLine: { flex: 1, height: 2, marginHorizontal: 8, borderRadius: 1 },
});
