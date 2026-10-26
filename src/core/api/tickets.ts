import { getToken } from '@/core/auth/storage';
import { API_BASE_URL } from '@/core/config';

import { api } from './client';
import type { PickedImage } from './reviews';

// Support tickets (website: /tickets and /tickets/[id]); routes live under
// /api/orders in website/node/ondc-zillybuy-node/routes/orderRoute.js.

export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

export type Ticket = {
  id: number;
  order_id: string | null; // display id (ZB-…) when the order still exists
  subject: string;
  description: string | null;
  name: string | null;
  phone: string | null;
  email: string | null;
  status: TicketStatus | string | null;
  attachments: string[];
  unread_count: number;
  created_at: string;
};

export type TicketMessage = {
  id: number;
  ticket_id: number;
  sender_type: 'customer' | 'support';
  message: string | null;
  attachments: string[];
  created_at: string;
};

// Chat is read-only once support has closed the ticket.
export const isTicketClosed = (s?: string | null) => ['closed', 'resolved'].includes((s || '').toLowerCase());

// Attachment paths come back as /uploads/...; anything else is already absolute.
export const attachmentUrl = (path: string) => (path.startsWith('/') ? `${API_BASE_URL}${path}` : path);

// "No tickets" is a 404.
export const listTickets = () =>
  api
    .get<{ tickets: Ticket[] }>('/api/orders/tickets')
    .then((r) => r.data.tickets ?? [])
    .catch((e) => {
      if (e?.response?.status === 404) return [] as Ticket[];
      throw e;
    });

export const getUnreadTicketCount = () =>
  api
    .get<{ unread_count: number }>('/api/orders/tickets/unread-count')
    .then((r) => Number(r.data.unread_count) || 0)
    .catch(() => 0);

export const getTicketMessages = (ticketId: number) =>
  api.get<{ messages: TicketMessage[] }>(`/api/orders/tickets/${ticketId}/messages`).then((r) => r.data.messages ?? []);

export const markTicketRead = (ticketId: number) =>
  api.put(`/api/orders/tickets/${ticketId}/messages/read`, {}).catch(() => {});

// Multipart via fetch, same reason as submitReview: RN's fetch builds the
// boundary itself. The server takes up to 5 images/PDFs of 5 MB each.
async function postMultipart(path: string, form: FormData, fallback: string) {
  const token = await getToken();
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.success === false) throw new Error(data?.message || data?.error || fallback);
  return data as { success: boolean; message?: string };
}

function appendImages(form: FormData, images: PickedImage[], prefix: string) {
  images.slice(0, 5).forEach((img, i) => {
    const type = img.mimeType || 'image/jpeg';
    const ext = type.split('/')[1] || 'jpg';
    form.append('attachments', { uri: img.uri, name: img.fileName || `${prefix}-${i}.${ext}`, type } as unknown as Blob);
  });
}

// `orderId` is the internal order id; the server resolves the display id.
export function createTicket(p: {
  orderId: number | string;
  subject: string;
  description: string;
  name: string;
  phone: string;
  email: string;
  images?: PickedImage[];
}) {
  const form = new FormData();
  form.append('orderId', String(p.orderId));
  form.append('subject', p.subject);
  form.append('description', p.description);
  form.append('name', p.name);
  form.append('phone', p.phone);
  form.append('email', p.email);
  appendImages(form, p.images ?? [], 'ticket');
  return postMultipart('/api/orders/createTicket', form, 'Failed to create ticket');
}

export function sendTicketMessage(ticketId: number, p: { message?: string; images?: PickedImage[] }) {
  const form = new FormData();
  if (p.message) form.append('message', p.message);
  appendImages(form, p.images ?? [], 'reply');
  return postMultipart(`/api/orders/tickets/${ticketId}/messages`, form, 'Failed to send message');
}
