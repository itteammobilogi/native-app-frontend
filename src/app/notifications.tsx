import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { listNotifications, markNotificationsRead, notificationMeta, type AppNotification } from '@/core/api/notifications';
import { useAuth } from '@/core/auth/AuthContext';
import { formatRelativeTime } from '@/core/format';
import { useAsync } from '@/core/hooks/useAsync';
import { openSiteLink } from '@/core/links';
import { tap } from '@/ui/Button';
import { Glass } from '@/ui/Glass';
import { usePageInsets } from '@/ui/GlassTabBar';
import { EmptyState, ErrorState, Header, Screen } from '@/ui/Screen';
import { Skeleton } from '@/ui/Skeleton';
import { Text } from '@/ui/Text';
import { radius, usePalette } from '@/ui/theme';

// Website: the navbar bell. Opening the inbox marks everything read (as the
// website does when the bell opens); unread rows stay highlighted for this visit.
export default function NotificationsScreen() {
  const t = usePalette();
  const insets = usePageInsets();
  const { isLoggedIn } = useAuth();
  const list = useAsync(async () => {
    if (!isLoggedIn) return [] as AppNotification[];
    const r = await listNotifications();
    if (r.unread) markNotificationsRead();
    return r.items;
  }, [isLoggedIn]);

  if (!isLoggedIn) {
    return (
      <Screen tabBar="account">
        <Header title="Notifications" />
        <EmptyState
          icon="notifications-outline"
          title="Log in to see notifications"
          message="Order updates, support replies and offers show up here."
          action="Log in"
          onAction={() => router.push({ pathname: '/login', params: { next: '/notifications' } })}
        />
      </Screen>
    );
  }

  const open = (n: AppNotification) => {
    const meta = notificationMeta(n);
    if (n.type === 'ticket_reply' && meta.ticket_id) {
      tap();
      router.push({ pathname: '/ticket/[id]', params: { id: String(meta.ticket_id) } });
    } else if (meta.link_url) {
      tap();
      openSiteLink(meta.link_url);
    }
  };

  return (
    <Screen tabBar="account">
      <Header title="Notifications" />
      {list.loading ? (
        <View style={{ padding: 16, gap: 10 }}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} height={74} r={radius.lg} />
          ))}
        </View>
      ) : list.error ? (
        <ErrorState message={list.error} onRetry={list.reload} />
      ) : (
        <FlatList
          data={list.data ?? []}
          keyExtractor={(n) => String(n.id)}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: insets.bottom + 24, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={list.refresh} tintColor={t.primary} />}
          ListEmptyComponent={
            <EmptyState icon="notifications-off-outline" title="No notifications yet" message="Order updates, support replies and offers show up here." />
          }
          renderItem={({ item: n }) => {
            const meta = notificationMeta(n);
            const actionable = (n.type === 'ticket_reply' && !!meta.ticket_id) || !!meta.link_url;
            const unread = !Number(n.is_read);
            return (
              <Pressable disabled={!actionable} onPress={() => open(n)}>
                <Glass radius={radius.lg} style={[styles.row, unread && { borderLeftWidth: 3, borderLeftColor: t.primary }]}>
                  <View style={[styles.icon, { backgroundColor: `${t.primary}14` }]}>
                    <Ionicons
                      name={n.type === 'ticket_reply' ? 'chatbubbles-outline' : n.type === 'broadcast' ? 'megaphone-outline' : 'notifications-outline'}
                      size={18}
                      color={t.primary}
                    />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text variant="label">{n.title}</Text>
                    {!!n.body && (
                      <Text variant="caption" tone="muted" numberOfLines={3}>
                        {n.body}
                      </Text>
                    )}
                    <Text variant="tiny" tone="faint">
                      {formatRelativeTime(n.created_at)}
                      {actionable ? (n.type === 'ticket_reply' ? ' · View ticket →' : ' · View →') : ''}
                    </Text>
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
  row: { flexDirection: 'row', gap: 12, padding: 12, alignItems: 'flex-start' },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
