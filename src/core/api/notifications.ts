import { api } from './client';

// In-app notification inbox (website: Navbar/NotificationBell.js). Holds the
// user's own notifications plus broadcasts, newest 50.

export type AppNotification = {
  id: number;
  type: 'ticket_reply' | 'broadcast' | string;
  title: string;
  body: string | null;
  metadata: { ticket_id?: number | string; link_url?: string } | string | null;
  created_at: string;
  is_read: 0 | 1 | boolean;
};

export const notificationMeta = (n: AppNotification) => {
  if (typeof n.metadata !== 'string') return n.metadata ?? {};
  try {
    return JSON.parse(n.metadata) as { ticket_id?: number | string; link_url?: string };
  } catch {
    return {};
  }
};

export const listNotifications = () =>
  api
    .get<{ data: AppNotification[]; unread_count: number }>('/api/orders/notifications')
    .then((r) => ({ items: r.data.data ?? [], unread: Number(r.data.unread_count) || 0 }));

export const markNotificationsRead = () => api.put('/api/orders/notifications/read', {}).catch(() => {});
