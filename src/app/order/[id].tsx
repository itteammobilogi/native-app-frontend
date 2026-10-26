import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  canDownloadInvoice,
  downloadInvoice,
  getItemHistory,
  getTracking,
  listOrders,
  type ItemHistory,
  type OrderItem,
} from '@/core/api/orders';
import { useAsync } from '@/core/hooks/useAsync';
import { formatINR } from '@/core/pricing';
import { Button, tap } from '@/ui/Button';
import { Glass } from '@/ui/Glass';
import { humanize, OrderStatus } from '@/ui/OrderStatus';
import { ErrorState, Header, Screen } from '@/ui/Screen';
import { Skeleton } from '@/ui/Skeleton';
import { Text } from '@/ui/Text';
import { radius, usePalette } from '@/ui/theme';
import { useToast } from '@/ui/Toast';

// There is no order-detail endpoint; the website builds this view from the
// orders list too.
export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = usePalette();
  const insets = useSafeAreaInsets();
  const order = useAsync(() => listOrders().then((all) => all.find((o) => String(o.id) === id) ?? null), [id]);
  const tracking = useAsync(() => getTracking(Number(id)), [id]);
  const o = order.data;
  const toast = useToast();
  const [invoiceBusy, setInvoiceBusy] = useState(false);

  const invoice = async () => {
    if (!o) return;
    setInvoiceBusy(true);
    try {
      await downloadInvoice(o.id, o.order_id);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not download the invoice.', 'error');
    } finally {
      setInvoiceBusy(false);
    }
  };

  return (
    <Screen>
      <Header title="Order details" />
      {order.loading ? (
        <View style={{ padding: 16, gap: 12 }}>
          <Skeleton height={110} r={radius.lg} />
          <Skeleton height={200} r={radius.lg} />
        </View>
      ) : order.error || !o ? (
        <ErrorState message={order.error ?? 'Order not found'} onRetry={order.reload} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: insets.bottom + 24 }}>
          <Glass radius={radius.lg} style={{ padding: 16, gap: 10 }}>
            <View style={styles.between}>
              <Text variant="heading">{o.order_id}</Text>
              <OrderStatus state={o.cancelled ? 'Cancelled' : o.order_state} />
            </View>
            <Text variant="caption" tone="muted">
              Placed on {o.createdAt}
            </Text>
            <View style={[styles.divider, { backgroundColor: t.hairline }]} />
            <View style={styles.between}>
              <Text tone="muted">Order total</Text>
              <Text variant="heading">{formatINR(Number(o.netAmount || o.amount))}</Text>
            </View>
            {Number(o.netAmount) < Number(o.amount) && (
              <View style={styles.between}>
                <Text tone="muted">You saved</Text>
                <Text tone="success">{formatINR(Number(o.amount) - Number(o.netAmount))}</Text>
              </View>
            )}
          </Glass>

          {!!tracking.data?.length && (
            <Glass radius={radius.lg} style={{ padding: 16, gap: 10 }}>
              <Text variant="heading">Track shipment</Text>
              {tracking.data.map((tr) => (
                <View key={tr.fulfillmentId} style={styles.between}>
                  <View style={{ flex: 1 }}>
                    <Text variant="caption" tone="muted">
                      Tracking
                    </Text>
                    <Text variant="label" numberOfLines={1}>
                      {tr.isUrl ? 'Live tracking available' : tr.trackingValue}
                    </Text>
                  </View>
                  {!!(tr.trackingLink || (tr.isUrl && tr.trackingValue)) && (
                    <Button
                      title="Track"
                      size="md"
                      icon="navigate"
                      onPress={() => WebBrowser.openBrowserAsync((tr.trackingLink || tr.trackingValue) as string)}
                    />
                  )}
                </View>
              ))}
            </Glass>
          )}

          <Text variant="heading" style={{ marginLeft: 4 }}>
            Items ({o.items.length})
          </Text>
          {o.items.map((it) => (
            <ItemCard key={it.id} item={it} />
          ))}

          {canDownloadInvoice(o) && (
            <Button title="Download invoice" variant="glass" icon="document-text-outline" onPress={invoice} loading={invoiceBusy} />
          )}

          <Button
            title="Need help with this order?"
            variant="ghost"
            icon="help-buoy-outline"
            onPress={() => router.push({ pathname: '/tickets', params: { orderId: String(o.id) } })}
          />
        </ScrollView>
      )}
    </Screen>
  );
}

function ItemCard({ item }: { item: OrderItem }) {
  const t = usePalette();
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<ItemHistory[] | null>(null);

  const toggle = async () => {
    tap();
    setOpen((v) => !v);
    if (!history) setHistory(await getItemHistory(item.id));
  };

  return (
    <Glass radius={radius.lg} style={{ padding: 12, gap: 10 }}>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Pressable
          onPress={() => item.slug && router.push({ pathname: '/product/[slug]', params: { slug: item.slug } })}
          style={styles.thumb}>
          {item.image ? <Image source={{ uri: item.image }} style={{ width: '88%', height: '88%' }} contentFit="contain" /> : null}
        </Pressable>
        <View style={{ flex: 1, gap: 4 }}>
          <Text variant="label" numberOfLines={2}>
            {item.title}
          </Text>
          {!!item.variant_attributes?.length && (
            <Text variant="caption" tone="muted">
              {item.variant_attributes.map((a) => a.value).join(' · ')}
            </Text>
          )}
          <Text variant="caption" tone="muted">
            Qty {item.quantity} · {formatINR(Number(item.price))}
          </Text>
          <OrderStatus state={item.isCancelled ? 'Cancelled' : item.fulfillmentState || 'Pending'} />
        </View>
      </View>
      <Pressable onPress={toggle} style={styles.historyToggle}>
        <Text variant="label" tone="primary">
          {open ? 'Hide status history' : 'Show status history'}
        </Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={t.primary} />
      </Pressable>
      {open &&
        (history === null ? (
          <ActivityIndicator color={t.primary} />
        ) : history.length === 0 ? (
          <Text variant="caption" tone="muted">
            No updates from the seller yet.
          </Text>
        ) : (
          <View style={{ gap: 0 }}>
            {history.map((h, i) => (
              <View key={h.id} style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ alignItems: 'center' }}>
                  <View style={[styles.node, { backgroundColor: i === history.length - 1 ? t.primary : t.textFaint }]} />
                  {i < history.length - 1 && <View style={[styles.line, { backgroundColor: t.hairline }]} />}
                </View>
                <View style={{ paddingBottom: 14 }}>
                  <Text variant="label">{humanize(h.status)}</Text>
                  <Text variant="caption" tone="faint">
                    {h.timestamp}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        ))}
    </Glass>
  );
}

const styles = StyleSheet.create({
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  divider: { height: StyleSheet.hairlineWidth },
  thumb: { width: 76, height: 76, borderRadius: radius.md, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  historyToggle: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  node: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  line: { width: 2, flex: 1, marginVertical: 2 },
});
