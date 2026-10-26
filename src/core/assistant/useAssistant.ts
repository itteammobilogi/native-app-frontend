import { useEffect, useRef, useState } from 'react';

import { logTurn, resetChatSession, type ChatTurn } from '@/core/api/chatbot';
import { useAuth } from '@/core/auth/AuthContext';
import { respond, type BotReply } from './brain';

export type ChatMessage = { id: string; role: 'user' | 'bot'; createdAt: number } & BotReply;

// Kept outside React, per shopper, so the conversation survives closing and
// reopening the chat screen during an app session (the website keeps it in
// sessionStorage). Logging in or out therefore starts a clean chat.
const saved = new Map<string, ChatMessage[]>();

const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
const MAX_KEPT = 40;

export function useAssistant() {
  const { user, isLoggedIn } = useAuth();
  const owner = user ? `user:${user.id}` : 'guest';
  const [messages, setMessages] = useState<ChatMessage[]>(() => saved.get(owner) ?? []);
  const [typing, setTyping] = useState(false);
  const busy = useRef(false);

  useEffect(() => {
    saved.set(owner, messages);
  }, [owner, messages]);

  const update = (fn: (prev: ChatMessage[]) => ChatMessage[]) => setMessages((prev) => fn(prev).slice(-MAX_KEPT));

  const send = async (text: string) => {
    const content = text.trim().slice(0, 500);
    if (!content || busy.current) return;
    busy.current = true;

    const history: ChatTurn[] = messages
      .slice(-8)
      .map((m) => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.text }));

    update((prev) => [...prev, { id: uid(), role: 'user', text: content, createdAt: Date.now() }]);
    logTurn('user', content);
    setTyping(true);

    let reply: BotReply;
    try {
      reply = await respond(content, {
        loggedIn: isLoggedIn,
        firstName: user?.name?.trim().split(/\s+/)[0],
        history,
      });
    } catch {
      reply = { text: "Sorry, I couldn't reach the store just now. Please check your connection and try again." };
    }

    update((prev) => [...prev, { id: uid(), role: 'bot', createdAt: Date.now(), ...reply }]);
    logTurn('assistant', reply.text, reply.products);
    setTyping(false);
    busy.current = false;
  };

  const clear = () => {
    update(() => []);
    resetChatSession();
  };

  return { messages, typing, send, clear };
}
