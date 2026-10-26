import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Animated, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCart } from '@/core/cart/CartContext';
import { formatINR } from '@/core/pricing';
import { Button } from '@/ui/Button';
import { Glass } from '@/ui/Glass';
import { NotifyPrompt } from '@/ui/NotifyPrompt';
import { Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { radius, usePalette } from '@/ui/theme';

export default function OrderSuccessScreen() {
  const { order_id, amount } = useLocalSearchParams<{ order_id?: string; amount?: string }>();
  const t = usePalette();
  const insets = useSafeAreaInsets();
  const { refresh } = useCart();
  const [scale] = useState(() => new Animated.Value(0.4));

  useEffect(() => {
    // The server closed the cart when it finalised the order.
    refresh().catch(() => {});
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    Animated.spring(scale, { toValue: 1, friction: 5, useNativeDriver: true }).start();
  }, [refresh, scale]);

  return (
    <Screen>
      <View style={[styles.wrap, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
          <Animated.View style={{ transform: [{ scale }] }}>
            <LinearGradient colors={[t.success, '#34D399']} style={styles.badge}>
              <Ionicons name="checkmark" size={56} color="#fff" />
            </LinearGradient>
          </Animated.View>
          <Text variant="display" style={{ textAlign: 'center' }}>
            Order placed!
          </Text>
          <Text tone="muted" style={{ textAlign: 'center' }}>
            Thank you for shopping with ZillyBuy. We’ll keep you posted as the seller ships your order.
          </Text>
          <Glass radius={radius.lg} style={styles.card}>
            {!!order_id && (
              <View style={styles.row}>
                <Text tone="muted">Order ID</Text>
                <Text variant="label">{order_id}</Text>
              </View>
            )}
            {!!amount && Number(amount) >= 0 && (
              <View style={styles.row}>
                <Text tone="muted">Amount paid</Text>
                <Text variant="label">{formatINR(Number(amount))}</Text>
              </View>
            )}
          </Glass>
          <NotifyPrompt />
        </View>
        <View style={{ gap: 10 }}>
          <Button title="View my orders" icon="receipt-outline" onPress={() => (router.dismissAll(), router.push('/orders'))} />
          <Button title="Continue shopping" variant="glass" onPress={() => (router.dismissAll(), router.navigate('/'))} />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, paddingHorizontal: 20 },
  badge: { width: 112, height: 112, borderRadius: 56, alignItems: 'center', justifyContent: 'center' },
  card: { alignSelf: 'stretch', padding: 16, gap: 10, marginTop: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
});
