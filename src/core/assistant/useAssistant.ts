import { useEffect, useRef, useState } from 'react';

import {
  logTurn,
  requestAiReply,
  resetChatSession,
  sendReplyFeedback,
  type AiLanguage,
  type AiTicketOffer,
  type ChatTurn,
} from '@/core/api/chatbot';
import { createTicket } from '@/core/api/tickets';
import { useAuth } from '@/core/auth/AuthContext';
import { fromAiReply, imageReply, respond, type BotReply } from './brain';

export type ChatMessage = {
  id: string;
  role: 'user' | 'bot';
  createdAt: number;
  // User turns: the photo they searched with (shown as a thumbnail).
  imageUri?: string;
  // Bot turns: the question it answers (for Retry / Regenerate / Translate).
  prompt?: string;
  fromImage?: boolean;
  pending?: boolean;
  error?: string;
  feedback?: 'up' | 'down' | null;
  // Just arrived: the screen plays the word-by-word reveal once.
  fresh?: boolean;
} & BotReply;

export type PickedPhoto = { uri: string; base64: string; mimeType: string };

// Kept outside React, per shopper, so the conversation survives closing and
// reopening the chat screen during an app session (the website keeps it in
// sessionStorage). Logging in or out therefore starts a clean chat.
const saved = new Map<string, ChatMessage[]>();

const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
const MAX_KEPT = 40;
const SLOW_AFTER_MS = 8000;
const SLOW_STATUS = 'Taking a bit longer… still checking';

// What the bot is doing while it thinks: a guess from the message's words,
// since which tool the AI calls isn't known until it answers (as the widget).
function thinkingStatus(text: string, hasImage: boolean): string[] {
  if (hasImage) return ['Looking at your photo…', 'Searching the store…'];
  const s = text.toLowerCase();
  if (/order|track|deliver|parcel|shipment|kab aa|kahan hai|ऑर्डर|डिलीवरी|\bzb-/i.test(s)) return ['Fetching your order…'];
  if (/return|refund|cancel|replace|exchange|policy|wapas|waapas|रिटर्न|रिफंड/i.test(s)) return ['Checking return policy…'];
  if (/\bcart\b|कार्ट/i.test(s)) return ['Checking your cart…'];
  if (/^(hi|hello|hey|thanks?|thank you|ok|okay|namaste)\b/i.test(s.trim())) return ['Thinking…'];
  return ['Searching catalog…', 'Comparing prices…'];
}

// Answers to "Shall I raise a ticket?" (the widget's regexes).
const TICKET_YES = /^(yes|yeah|yep|yup|sure|ok|okay|haan|haa|han|haanji|ji haan|bilkul|kar do)\b|raise a ticket|human agent|connect.*(agent|support)/i;
const TICKET_NO = /^(no|nah|nope|not now|no thanks?|nahi|nahin|mat karo|rehne do)\b/i;
const PHONE = /(?:\+?91[\s-]?)?([6-9]\d{9})\b/;

const toHistory = (list: ChatMessage[]): ChatTurn[] =>
  list
    .filter((m) => !m.pending && !m.error && m.text)
    .slice(-10)
    .map((m) => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text }));

export function useAssistant({ onVoiceReply }: { onVoiceReply?: (m: ChatMessage) => void } = {}) {
  const { user, isLoggedIn } = useAuth();
  const owner = user ? `user:${user.id}` : 'guest';
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    (saved.get(owner) ?? []).filter((m) => !m.pending).map((m) => ({ ...m, fresh: false })),
  );
  const [status, setStatus] = useState<string | null>(null);
  const list = useRef(messages);
  const turn = useRef<{ id: string; controller: AbortController; timers: ReturnType<typeof setTimeout>[] } | null>(null);
  // A ticket the AI offered and is waiting on a yes / no (or a phone number).
  const pendingTicket = useRef<{ ticket: AiTicketOffer; needsPhone: boolean } | null>(null);
  const voiceReply = useRef(onVoiceReply);

  useEffect(() => {
    voiceReply.current = onVoiceReply;
  });

  useEffect(() => {
    list.current = messages;
    saved.set(owner, messages);
  }, [owner, messages]);

  useEffect(() => () => turn.current?.controller.abort(), []);

  const update = (fn: (prev: ChatMessage[]) => ChatMessage[]) => setMessages((prev) => fn(prev).slice(-MAX_KEPT));
  const patch = (id: string, p: Partial<ChatMessage>) => update((prev) => prev.map((m) => (m.id === id ? { ...m, ...p } : m)));

  const endTurn = (id: string) => {
    if (turn.current?.id !== id) return;
    turn.current.timers.forEach(clearTimeout);
    turn.current = null;
    setStatus(null);
  };

  const finishBot = (id: string, reply: BotReply, viaVoice: boolean) => {
    const done: Partial<ChatMessage> = { ...reply, pending: false, error: undefined, fresh: true, feedback: null };
    patch(id, done);
    logTurn('assistant', reply.text, reply.products);
    pendingTicket.current = reply.ticket ? { ticket: reply.ticket, needsPhone: false } : null;
    if (viaVoice) voiceReply.current?.({ id, role: 'bot', createdAt: Date.now(), ...reply });
  };

  // One bot turn: AI first, rule-based replies if it fails (never after Stop).
  const run = async (
    botId: string,
    prompt: string,
    opts: { history: ChatTurn[]; language?: AiLanguage; photo?: PickedPhoto; viaVoice?: boolean },
  ) => {
    turn.current?.controller.abort();
    const controller = new AbortController();
    const [first, second] = thinkingStatus(prompt, !!opts.photo);
    setStatus(first);
    const timers = [
      ...(second ? [setTimeout(() => setStatus(second), 2000)] : []),
      setTimeout(() => setStatus(SLOW_STATUS), SLOW_AFTER_MS),
    ];
    turn.current = { id: botId, controller, timers };

    let reply: BotReply;
    try {
      if (opts.photo) {
        reply = await imageReply(opts.photo.base64, opts.photo.mimeType, prompt || undefined);
      } else {
        const ai = await requestAiReply(prompt, opts.history, { language: opts.language, signal: controller.signal });
        reply = ai
          ? fromAiReply(ai)
          : await respond(prompt, { loggedIn: isLoggedIn, firstName: user?.name?.trim().split(/\s+/)[0], history: opts.history });
      }
    } catch {
      if (controller.signal.aborted) return;
      patch(botId, { pending: false, error: opts.photo ? "Couldn't search with that photo. Check your connection and retry." : "Couldn't load a reply. Check your connection and retry." });
      endTurn(botId);
      return;
    }
    if (controller.signal.aborted) return;
    finishBot(botId, reply, !!opts.viaVoice);
    endTurn(botId);
  };

  // Replies the hook writes itself (ticket flow), shown like any bot turn.
  const say = (prompt: string, reply: BotReply) => {
    const now = Date.now();
    update((prev) => [
      ...prev,
      { id: uid(), role: 'user', text: prompt, createdAt: now },
      { id: uid(), role: 'bot', createdAt: now + 1, prompt, fresh: true, ...reply },
    ]);
    logTurn('user', prompt);
    logTurn('assistant', reply.text);
  };

  const raiseTicket = async (prompt = 'Yes, raise a ticket', phoneOverride?: string) => {
    const pending = pendingTicket.current;
    if (!pending) return;
    const phone = phoneOverride || user?.mobile || '';
    if (!isLoggedIn) {
      say(prompt, { text: 'Please sign in so I can raise a ticket for your order.', actions: [{ kind: 'go', label: 'Sign in', href: '/login', icon: 'log-in-outline' }] });
      return;
    }
    if (!phone) {
      pendingTicket.current = { ...pending, needsPhone: true };
      say(prompt, { text: "What's the best phone number to reach you on for this ticket?" });
      return;
    }
    pendingTicket.current = null;
    const botId = uid();
    const now = Date.now();
    update((prev) => [
      ...prev,
      { id: uid(), role: 'user', text: phoneOverride ? phone : prompt, createdAt: now },
      { id: botId, role: 'bot', text: '', createdAt: now + 1, prompt, pending: true },
    ]);
    setStatus('Raising your ticket…');
    const { ticket } = pending;
    try {
      await createTicket({
        orderId: ticket.orderId,
        subject: ticket.subject,
        description: ticket.description,
        name: user?.name || 'ZillyBuy customer',
        phone,
        email: user?.email || '',
      });
      finishBot(
        botId,
        {
          text: `Done — I've raised a support ticket for Order #${ticket.orderLabel}. Our team will reach out to you by email or phone soon.`,
          actions: [{ kind: 'go', label: 'View my tickets', href: '/tickets', icon: 'chatbubbles-outline' }],
        },
        false,
      );
    } catch {
      finishBot(
        botId,
        {
          text: "Sorry, I couldn't raise the ticket automatically. Please try from the Tickets page.",
          actions: [{ kind: 'go', label: 'Open tickets', href: '/tickets', icon: 'chatbubbles-outline' }],
        },
        false,
      );
    }
    setStatus(null);
  };

  const send = (text: string, { photo, viaVoice = false }: { photo?: PickedPhoto; viaVoice?: boolean } = {}) => {
    const content = text.trim().slice(0, 500);
    if ((!content && !photo) || turn.current) return;

    // A typed answer to the ticket offer is finished by the ticket flow;
    // anything else is a new request for the AI.
    const pending = pendingTicket.current;
    if (pending && !photo) {
      const phone = content.match(PHONE)?.[1];
      if (pending.needsPhone && phone) return void raiseTicket(content, phone);
      if (!pending.needsPhone && TICKET_YES.test(content)) return void raiseTicket(content);
      if (TICKET_NO.test(content)) {
        pendingTicket.current = null;
        return say(content, { text: 'No problem. Anything else I can help you with?', suggestions: ['Track my order', 'Return policy'] });
      }
      pendingTicket.current = null;
    }

    const history = toHistory(list.current);
    const botId = uid();
    const now = Date.now();
    const prompt = content;
    update((prev) => [
      ...prev,
      { id: uid(), role: 'user', text: content || 'Search with this photo', imageUri: photo?.uri, createdAt: now },
      { id: botId, role: 'bot', text: '', createdAt: now + 1, prompt, fromImage: !!photo, pending: true },
    ]);
    logTurn('user', content || '[image search]');
    run(botId, prompt, { history, photo, viaVoice });
  };

  // Stop: abort, keep the question, leave a reply they can Retry.
  const stop = () => {
    const current = turn.current;
    if (!current) return;
    current.controller.abort();
    patch(current.id, { pending: false, error: 'You stopped this reply.' });
    endTurn(current.id);
  };

  // Re-answer a bot reply in place: the AI sees the chat only up to the
  // question. `language` forces the reply language (Translate).
  const regenerate = (id: string, language?: AiLanguage) => {
    const all = list.current;
    const index = all.findIndex((m) => m.id === id);
    const msg = all[index];
    if (!msg || msg.fromImage || !msg.prompt || turn.current) return;
    const history = toHistory(all.slice(0, Math.max(0, index - 1)));
    update((prev) =>
      prev.map((m) =>
        m.id === id ? { id, role: 'bot', text: '', createdAt: m.createdAt, prompt: m.prompt, pending: true } : m,
      ),
    );
    run(id, msg.prompt, { history, language });
  };

  const rate = (id: string, rating: 'up' | 'down') => {
    const msg = list.current.find((m) => m.id === id);
    if (!msg) return;
    const next = msg.feedback === rating ? null : rating;
    patch(id, { feedback: next });
    if (next) sendReplyFeedback({ messageId: id, rating: next, query: msg.prompt || '', reply: msg.text });
  };

  const settle = (id: string) => patch(id, { fresh: false });

  const clear = () => {
    stop();
    pendingTicket.current = null;
    update(() => []);
    resetChatSession();
  };

  const busy = messages.some((m) => m.pending);

  return { messages, busy, status, send, stop, regenerate, rate, raiseTicket: () => raiseTicket(), settle, clear };
}
