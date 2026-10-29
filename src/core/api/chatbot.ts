import { isAxiosError } from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { getGuestId, getToken } from '@/core/auth/storage';
import { APP_SOURCE, WEBSITE_URL } from '@/core/config';
import type { ProductSummary } from './catalog';
import { api } from './client';

// ZillyAI on the same backend as the website widget (/api/chatbot/*). The
// backend only accepts website / android / ios as the session source.
const SOURCE = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'website';
const SESSION_KEY = 'zb_chat_session';

const web = Platform.OS === 'web';
const store = {
  get: () => (web ? (globalThis.localStorage?.getItem(SESSION_KEY) ?? null) : SecureStore.getItemAsync(SESSION_KEY)),
  set: (v: string) => (web ? void globalThis.localStorage?.setItem(SESSION_KEY, v) : SecureStore.setItemAsync(SESSION_KEY, v)),
  clear: () => (web ? void globalThis.localStorage?.removeItem(SESSION_KEY) : SecureStore.deleteItemAsync(SESSION_KEY)),
};

let sessionId: string | null | undefined;
let pending: Promise<string> | null = null;

async function ensureSession() {
  if (sessionId === undefined) sessionId = await store.get();
  if (sessionId) return sessionId;
  // One in-flight create shared by concurrent callers.
  pending ??= api
    .post('/api/chatbot/session', { session_id: null, source: SOURCE })
    .then(async ({ data }) => {
      sessionId = data?.data?.session_id as string;
      await store.set(sessionId);
      return sessionId;
    })
    .finally(() => (pending = null));
  return pending;
}

// Every call carries the session; the server hands back the id it used. A 403
// means the session belongs to someone else (e.g. after logout), so start a
// fresh one and retry once.
async function post(path: string, body: object, retried = false): Promise<any> {
  const session_id = await ensureSession();
  try {
    const { data } = await api.post(path, { ...body, session_id, source: SOURCE });
    const next = data?.data?.session_id;
    if (next && next !== sessionId) {
      sessionId = next;
      store.set(next);
    }
    return data;
  } catch (e) {
    if (!retried && isAxiosError(e) && e.response?.status === 403) {
      await resetChatSession();
      return post(path, body, true);
    }
    throw e;
  }
}

export async function resetChatSession() {
  sessionId = null;
  await store.clear();
}

export type ChatTurn = { role: 'user' | 'assistant'; content: string };

// Helper LLM call (flagged internal, like the website's classifiers): the
// shopper-visible transcript is recorded separately through logTurn().
export async function askAssistant(p: {
  message: string;
  systemPrompt?: string;
  history?: ChatTurn[];
  temperature?: number;
  maxOutputTokens?: number;
}): Promise<string> {
  const data = await post('/api/chatbot/chat', { ...p, internal: true });
  return String(data?.data?.assistant_message?.message ?? '');
}

/* ------------------------- Website AI routes (Next.js) ------------------------ */

// The website's ZillyAI replies, voice transcription and image analysis run as
// Next.js API routes on zillybuy.com (not the Node backend), so they're called
// on WEBSITE_URL with the same Bearer token and guest id the widget sends.

export type AiLanguage = 'english' | 'hinglish' | 'hindi';

export type AiOrderCard = {
  orderId: string;
  placedOn: string | null;
  step: number; // 0 Ordered, 1 Packed, 2 Shipped, 3 Delivered, -1 cancelled/returned
  statusLabel: string;
  expectedDeliveryDate: string | null;
  total: number;
  items: { title: string; quantity: number; image: string | null }[];
};

export type AiTicketOffer = { orderId: number | string; orderLabel: string; subject: string; description: string };

export type AiReply = {
  type: 'products' | 'order' | 'handoff' | 'text';
  kind: string;
  reply: string;
  language?: AiLanguage;
  products: ProductSummary[];
  productQuery: string | null;
  filters: { label: string; selected: boolean }[];
  order: AiOrderCard | null;
  buttons: string[];
  suggestions: string[];
  ticket: AiTicketOffer | null;
};

// Server budget is 15s; a little more for the network, like the widget's 17s.
const REPLY_TIMEOUT_MS = 17000;

async function postWebsite(path: string, body: object, { signal, timeoutMs = 20000 }: { signal?: AbortSignal; timeoutMs?: number } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort);
  try {
    const [token, guestId] = await Promise.all([getToken(), getGuestId()]);
    const res = await fetch(`${WEBSITE_URL}${path}`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'x-utm-source': APP_SOURCE,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ guestId: guestId || undefined, ...body }),
      signal: controller.signal,
    });
    return await res.json().catch(() => ({}));
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

// The AI's answer, or null on failure/timeout so the caller can fall back to
// the on-device replies. Aborting `signal` (Stop) rejects with AbortError.
export async function requestAiReply(
  message: string,
  history: ChatTurn[],
  { language, signal }: { language?: AiLanguage; signal?: AbortSignal } = {},
): Promise<AiReply | null> {
  try {
    const data = await postWebsite(
      '/api/ai/chat/reply',
      { message, history, ...(language ? { language } : {}) },
      { signal, timeoutMs: REPLY_TIMEOUT_MS },
    );
    return data?.success && data?.reply ? (data as AiReply) : null;
  } catch (e) {
    if (signal?.aborted) throw e;
    return null;
  }
}

export async function transcribeAudio(audioBase64: string, mimeType: string): Promise<string> {
  const data = await postWebsite('/api/ai/transcribe', { audioBase64, mimeType }, { timeoutMs: 30000 });
  if (!data?.success) throw new Error(data?.error || 'Transcription failed');
  return String(data.text || '').trim();
}

export type ImageAnalysis = {
  searchQuery?: string;
  exactModel?: string;
  keywords?: string;
  category?: string;
  color?: string;
  brand?: string;
  description?: string;
};

export async function analyzeImage(imageBase64: string, mimeType: string): Promise<ImageAnalysis> {
  const data = await postWebsite('/api/ai/vision', { imageBase64, mimeType }, { timeoutMs: 25000 });
  if (!data?.success) throw new Error(data?.error || 'Image analysis failed');
  return data as ImageAnalysis;
}

// 👍/👎 on a reply (same payload as the widget). Fire-and-forget.
export function sendReplyFeedback(p: { messageId: string; rating: 'up' | 'down'; query: string; reply: string }) {
  Promise.all([ensureSession().catch(() => null), getGuestId()])
    .then(([sid, guestId]) =>
      api.post('/api/ai/chat/feedback', { sessionId: sid, guestId, type: 'reply_rating', ...p, reply: p.reply.slice(0, 1000) }),
    )
    .catch(() => {});
}

// Records a visible turn for the admin transcript. Fire-and-forget.
export function logTurn(sender: 'user' | 'assistant', message: string, products?: { id: number; slug: string; name: string; price: unknown }[]) {
  post('/api/chatbot/log', {
    sender,
    message: message.slice(0, 5000),
    products: products?.slice(0, 10).map((p) => ({ id: p.id, slug: p.slug, title: p.name, price: Number(p.price) || 0 })),
  }).catch(() => {});
}
