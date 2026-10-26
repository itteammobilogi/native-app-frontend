import { isAxiosError } from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

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

// Records a visible turn for the admin transcript. Fire-and-forget.
export function logTurn(sender: 'user' | 'assistant', message: string, products?: { id: number; slug: string; name: string; price: unknown }[]) {
  post('/api/chatbot/log', {
    sender,
    message: message.slice(0, 5000),
    products: products?.slice(0, 10).map((p) => ({ id: p.id, slug: p.slug, title: p.name, price: Number(p.price) || 0 })),
  }).catch(() => {});
}
