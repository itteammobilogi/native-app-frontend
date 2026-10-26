import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { listOrders } from '@/core/api/orders';
import { listTickets, type Ticket } from '@/core/api/tickets';
import { useAuth } from '@/core/auth/AuthContext';
import { useAsync } from '@/core/hooks/useAsync';
import { formatRelativeTime } from '@/core/format';
import { IconButton, tap } from '@/ui/Button';
import { Chip } from '@/ui/Chip';
import { Glass } from '@/ui/Glass';
import { EmptyState, ErrorState, Header, Screen } from '@/ui/Screen';
import { Skeleton } from '@/ui/Skeleton';
import { Text } from '@/ui/Text';
import { radius, usePalette } from '@/ui/theme';
import { RaiseTicketSheet } from '@/ui/tickets/RaiseTicketSheet';
import { TicketStatus } from '@/ui/tickets/TicketStatus';

const FILTERS = [
  { value: '', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
];

// Website: /tickets. `orderId` (internal id) opens the raise form for that
// order, as the order screen's "Need help?" does.
export default function TicketsScreen() {
  const t = usePalette();
  const insets = useSafeAreaInsets();
  const { isLoggedIn } = useAuth();
  const { orderId } = useLocalSearchParams<{ orderId?: string }>();
  const [filter, setFilter] = useState('');
  const [formOpen, setFormOpen] = useState(!!orderId);

  const tickets = useAsync(() => (isLoggedIn ? listTickets() : Promise.resolve([] as Ticket[])), [isLoggedIn]);
  const orders = useAsync(() => (isLoggedIn ? listOrders() : Promise.resolve([])), [isLoggedIn]);

  // Unread counts change when a thread is read, so refetch on return to the
  // list (but not on the first focus, which the initial load covers).
  const focused = useRef(false);
  const { refresh } = tickets;
  useFocusEffect(
    useCallback(() => {
      if (focused.current) refresh();
      focused.current = true;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  const filtered = useMemo(
    () =>
      (tickets.data ?? [])
        .filter((tk) => !filter || (tk.status || '').toLowerCase() === filter)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [tickets.data, filter],
  );

  if (!isLoggedIn) {
    return (
      <Screen>
        <Header title="Support tickets" />
        <EmptyState
          icon="chatbubbles-outline"
          title="Log in to see your tickets"
          message="Raise a ticket for any order and chat with our support team."
          action="Log in"
          onAction={() => router.push({ pathname: '/login', params: { next: '/tickets' } })}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <Header title="Support tickets" right={<IconButton icon="add" label="Raise a ticket" onPress={() => setFormOpen(true)} />} />
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingBottom: 8 }}>
          {FILTERS.map((f) => (
            <Chip key={f.value || 'all'} label={f.label} active={filter === f.value} onPress={() => setFilter(f.value)} />
          ))}
        </ScrollView>
      </View>

      {tickets.loading ? (
        <View style={{ padding: 16, gap: 12 }}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} height={120} r={radius.lg} />
          ))}
        </View>
      ) : tickets.error ? (
        <ErrorState message={tickets.error} onRetry={tickets.reload} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(tk) => String(tk.id)}
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: insets.bottom + 24, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={tickets.refreshing} onRefresh={tickets.refresh} tintColor={t.primary} />}
          ListEmptyComponent={
            filter ? (
              <EmptyState icon="filter-outline" title="No tickets match this filter" />
            ) : (
              <EmptyState
                icon="chatbubbles-outline"
                title="No tickets yet"
                message="Facing an issue with an order? Raise a ticket and our team will help."
                action="Raise a ticket"
                onAction={() => setFormOpen(true)}
              />
            )
          }
          renderItem={({ item }) => <TicketCard ticket={item} />}
        />
      )}

      <RaiseTicketSheet
        visible={formOpen}
        onClose={() => setFormOpen(false)}
        orders={orders.data ?? []}
        initialOrderId={orderId}
        onCreated={tickets.refresh}
      />
    </Screen>
  );
}

function TicketCard({ ticket }: { ticket: Ticket }) {
  const t = usePalette();
  const unread = Number(ticket.unread_count) || 0;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => (tap(), router.push({ pathname: '/ticket/[id]', params: { id: String(ticket.id), status: ticket.status ?? '', subject: ticket.subject } }))}
      style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.98 : 1 }] })}>
      <Glass radius={radius.lg} style={{ padding: 14, gap: 8 }}>
        <View style={styles.between}>
          <View style={{ flex: 1, gap: 2 }}>
            {!!ticket.order_id && (
              <Text variant="tiny" tone="faint">
                Order {ticket.order_id}
              </Text>
            )}
            <Text variant="label" numberOfLines={1}>
              {ticket.subject}
            </Text>
          </View>
          <TicketStatus status={ticket.status} />
        </View>
        {!!ticket.description && (
          <Text variant="caption" tone="muted" numberOfLines={2}>
            {ticket.description}
          </Text>
        )}
        <View style={[styles.between, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.hairline, paddingTop: 8 }]}>
          <Text variant="caption" tone="faint">
            {formatRelativeTime(ticket.created_at)}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="chatbubble-ellipses-outline" size={16} color={t.primary} />
            <Text variant="label" tone="primary">
              Chat with support
            </Text>
            {unread > 0 && (
              <View style={[styles.badge, { backgroundColor: t.danger }]}>
                <Text variant="tiny" tone="onPrimary">
                  {unread > 9 ? '9+' : unread}
                </Text>
              </View>
            )}
          </View>
        </View>
      </Glass>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  badge: { minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center' },
});
