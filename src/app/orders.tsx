import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { listOrders } from '@/core/api/orders';
import { useAsync } from '@/core/hooks/useAsync';
import { formatINR } from '@/core/pricing';
import { tap } from '@/ui/Button';
import { Glass } from '@/ui/Glass';
import { OrderStatus } from '@/ui/OrderStatus';
import { EmptyState, ErrorState, Header, Screen } from '@/ui/Screen';
import { Skeleton } from '@/ui/Skeleton';
import { Text } from '@/ui/Text';
import { radius, usePalette } from '@/ui/theme';

export default function OrdersScreen() {
  const t = usePalette();
  const insets = useSafeAreaInsets();
  const orders = useAsync(listOrders, []);

  return (
    <Screen>
      <Header title="My orders" />
      {orders.loading ? (
        <View style={{ padding: 16, gap: 12 }}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} height={130} r={radius.lg} />
          ))}
        </View>
      ) : orders.error ? (
        <ErrorState message={orders.error} onRetry={orders.reload} />
      ) : (
        <FlatList
          data={orders.data}
          keyExtractor={(o) => String(o.id)}
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: insets.bottom + 24, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={orders.refreshing} onRefresh={orders.refresh} tintColor={t.primary} />}
          ListEmptyComponent={
            <EmptyState
              icon="receipt-outline"
              title="No orders yet"
              message="When you place an order, it will show up here."
              action="Start shopping"
              onAction={() => router.navigate('/')}
            />
          }
          renderItem={({ item: o }) => {
            const first = o.items[0];
            return (
              <Pressable
                onPress={() => (tap(), router.push({ pathname: '/order/[id]', params: { id: String(o.id) } }))}
                style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.98 : 1 }] })}>
                <Glass radius={radius.lg} style={{ padding: 14, gap: 12 }}>
                  <View style={styles.between}>
                    <View>
                      <Text variant="label">{o.order_id}</Text>
                      <Text variant="caption" tone="muted">
                        Placed on {o.createdAt}
                      </Text>
                    </View>
                    <OrderStatus state={o.cancelled ? 'Cancelled' : o.order_state} />
                  </View>
                  <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                    <View style={styles.thumbs}>
                      {o.items.slice(0, 3).map((it, i) => (
                        <View key={it.id} style={[styles.thumb, { marginLeft: i ? -18 : 0, borderColor: t.glassBorder }]}>
                          {it.image ? <Image source={{ uri: it.image }} style={{ width: '85%', height: '85%' }} contentFit="contain" /> : null}
                        </View>
                      ))}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text variant="caption" numberOfLines={2}>
                        {first?.title}
                        {o.items.length > 1 ? ` + ${o.items.length - 1} more` : ''}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.between}>
                    <Text variant="heading">{formatINR(Number(o.netAmount || o.amount))}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Text variant="label" tone="primary">
                        View details
                      </Text>
                      <Ionicons name="chevron-forward" size={16} color={t.primary} />
                    </View>
                  </View>
                </Glass>
              </Pressable>
            );
          }}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  thumbs: { flexDirection: 'row' },
  thumb: { width: 52, height: 52, borderRadius: 14, backgroundColor: '#fff', borderWidth: 2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
