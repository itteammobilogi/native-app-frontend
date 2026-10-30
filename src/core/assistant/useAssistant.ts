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
import type { PickedImage } from '@/core/api/reviews';
import { createTicket } from '@/core/api/tickets';
import { useAuth } from '@/core/auth/AuthContext';
import { fromAiReply, imageReply, respond, type BotReply } from './brain';
import { TICKET_AGENT, TICKET_EMAIL, TICKET_NO, TICKET_YES, ticketText } from './ticketText';

export type ChatMessage = {
  id: string;
  role: 'user' | 'bot';
  createdAt: number;
  // User turns: the photo they searched with (shown as a thumbnail).
  imageUri?: string;
  // User turns: photos sent with a support ticket.
  photos?: string[];
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

// A ticket the AI offered, waiting on yes / no, then on a phone number or
// email when the account has none (the backend requires both).
type TicketDraft = AiTicketOffer & { language: AiLanguage; phone?: string; email?: string };
type PendingTicket = { draft: TicketDraft; stage: 'offer' | 'phone' | 'email'; messageId: string };

// A short reply to the offer that isn't yes / no ("hmm", "what?") gets the
// question again; anything that reads like a new request goes to the AI.
const NEW_REQUEST = /order|track|return|refund|cancel|replace|deliver|policy|price|\bzb|\?/i;
const isNewRequest = (s: string) => NEW_REQUEST.test(s) || s.split(/\s+/).length > 3;

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
  const pendingTicket = useRef<PendingTicket | null>(null);
  // The bot turn whose ticket card is showing, and the photos picked on it.
  const [ticketOfferId, setTicketOfferId] = useState<string | null>(null);
  const [ticketPhotos, setTicketPhotoState] = useState<PickedImage[]>([]);
  const photos = useRef<PickedImage[]>([]);
  // Phone / email typed for a ticket, reused for the next one this session.
  const contact = useRef<{ phone?: string; email?: string }>({});
  const raising = useRef(false);
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
    if (viaVoice) voiceReply.current?.({ id, role: 'bot', createdAt: Date.now(), ...reply });
  };

  const setTicketPhotos = (next: PickedImage[]) => {
    photos.current = next;
    setTicketPhotoState(next);
  };

  const closeTicket = () => {
    pendingTicket.current = null;
    setTicketOfferId(null);
    setTicketPhotos([]);
  };

  // Any prompt the ticket flow left open is stale once the AI has answered;
  // a ticket offer opens a new one.
  const openTicket = (id: string, reply: BotReply) => {
    closeTicket();
    if (!reply.ticket) return;
    pendingTicket.current = { draft: { ...reply.ticket, language: reply.language || 'english' }, stage: 'offer', messageId: id };
    setTicketOfferId(id);
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
    openTicket(botId, reply);
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

  // Sends the ticket once the backend has everything it requires: a missing
  // phone or email is asked for first, one at a time. Photos picked on the
  // card go with it; if the upload is what fails, the ticket goes again
  // without them so the complaint isn't lost (as the widget).
  const raiseTicket = async (prompt: string, pending: PendingTicket, typed: { phone?: string; email?: string } = {}) => {
    const t = ticketText(pending.draft.language);
    if (!isLoggedIn) {
      closeTicket();
      say(prompt, { text: t.signIn, actions: [{ kind: 'go', label: 'Sign in', href: '/login', icon: 'log-in-outline' }] });
      return;
    }
    const phone = (typed.phone || pending.draft.phone || contact.current.phone || user?.mobile || '').trim();
    const email = (typed.email || pending.draft.email || contact.current.email || user?.email || '').trim();
    if (typed.phone || typed.email) contact.current = { phone, email };
    const draft = { ...pending.draft, phone, email };

    if (!phone || !email) {
      pendingTicket.current = { ...pending, draft, stage: phone ? 'email' : 'phone' };
      setTicketOfferId(null);
      say(prompt, { text: phone ? t.askEmail : t.askPhone });
      return;
    }

    const images = photos.current;
    pendingTicket.current = null;
    setTicketOfferId(null);
    raising.current = true;
    const botId = uid();
    const now = Date.now();
    update((prev) => [
      ...prev,
      { id: uid(), role: 'user', text: prompt, photos: images.length ? images.map((p) => p.uri) : undefined, createdAt: now },
      { id: botId, role: 'bot', text: '', createdAt: now + 1, prompt, pending: true },
    ]);
    logTurn('user', prompt);
    setStatus('Raising your ticket…');
    const fields = {
      orderId: draft.orderId,
      subject: draft.subject,
      description: draft.description,
      name: user?.name || 'ZillyBuy customer',
      phone,
      email,
    };
    const openTickets = { kind: 'go', label: t.openTicket, href: '/tickets', icon: 'chatbubbles-outline' } as const;
    try {
      let photosLost = false;
      try {
        await createTicket({ ...fields, images });
      } catch (e) {
        if (!images.length) throw e;
        await createTicket(fields);
        photosLost = true;
      }
      setTicketPhotos([]);
      finishBot(
        botId,
        { text: photosLost ? t.photoFailed(draft.orderLabel) : t.raised(draft.orderLabel, images.length), actions: [openTickets] },
        false,
      );
    } catch {
      // Keep the draft (and photos) so "Try again" sends the same ticket.
      pendingTicket.current = { ...pending, draft, stage: 'offer' };
      finishBot(
        botId,
        { text: t.failed, actions: [{ kind: 'send', label: t.retry, value: t.sendRaise, icon: 'refresh' }, openTickets] },
        false,
      );
    } finally {
      raising.current = false;
      setStatus(null);
    }
  };

  // A typed (or tapped) answer while a ticket is open; false when the
  // message is a new request for the AI.
  const answerTicket = (content: string, pending: PendingTicket): boolean => {
    const t = ticketText(pending.draft.language);
    const decline = () => {
      closeTicket();
      say(content, { text: t.declined, suggestions: ['Track my order', 'Return policy'] });
    };

    if (pending.stage === 'phone') {
      const phone = content.replace(/[^\d+]/g, '');
      if (phone.length >= 7) void raiseTicket(content, pending, { phone });
      else if (TICKET_NO.test(content)) decline();
      else say(content, { text: t.badPhone });
      return true;
    }
    if (pending.stage === 'email') {
      const email = content.match(TICKET_EMAIL)?.[0];
      if (email) void raiseTicket(content, pending, { email: email.toLowerCase() });
      else if (TICKET_NO.test(content)) decline();
      else say(content, { text: t.badEmail });
      return true;
    }

    if (TICKET_AGENT.test(content)) {
      const { draft } = pending;
      const description = `${draft.description || ''} The user asked to be connected with a human agent.`.trim();
      void raiseTicket(content, { ...pending, draft: { ...draft, subject: 'Human agent requested via chatbot', description } });
      return true;
    }
    if (TICKET_YES.test(content)) {
      void raiseTicket(content, pending);
      return true;
    }
    if (TICKET_NO.test(content)) {
      decline();
      return true;
    }
    if (!isNewRequest(content)) {
      say(content, { text: t.reAsk, actions: [{ kind: 'send', label: t.raise, value: t.sendRaise, icon: 'headset-outline' }] });
      return true;
    }
    return false;
  };

  const send = (text: string, { photo, viaVoice = false }: { photo?: PickedPhoto; viaVoice?: boolean } = {}) => {
    const content = text.trim().slice(0, 500);
    if ((!content && !photo) || turn.current || raising.current) return;

    // Answers to the ticket offer are finished by the ticket flow; anything
    // else (or a photo search) is a new request for the AI.
    const pending = pendingTicket.current;
    if (pending) {
      if (!photo && answerTicket(content, pending)) return;
      closeTicket();
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
    closeTicket();
    update(() => []);
    resetChatSession();
  };

  const busy = messages.some((m) => m.pending);

  return { messages, busy, status, send, stop, regenerate, rate, settle, clear, ticketOfferId, ticketPhotos, setTicketPhotos };
}
