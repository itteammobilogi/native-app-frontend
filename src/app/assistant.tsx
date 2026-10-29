import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { FlatList, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DOMAIN_META } from '@/core/api/catalog';
import type { Order } from '@/core/api/orders';
import { STARTERS, type Action } from '@/core/assistant/brain';
import { useAssistant, type ChatMessage, type PickedPhoto } from '@/core/assistant/useAssistant';
import { useSpeaker, useVoiceInput, voiceSupported } from '@/core/assistant/useVoice';
import { useAuth } from '@/core/auth/AuthContext';
import { formatINR } from '@/core/pricing';
import { IconButton, tap } from '@/ui/Button';
import { AiOrb, TypingDots } from '@/ui/assistant/AiOrb';
import { AiOrderCardView, FilterChips, LanguageTag, MessageActions, QuickReplies } from '@/ui/assistant/ChatParts';
import { Composer } from '@/ui/assistant/Composer';
import { countWords, firstWords, Markdown } from '@/ui/assistant/Markdown';
import { Glass } from '@/ui/Glass';
import { OrderStatus } from '@/ui/OrderStatus';
import { ProductCard } from '@/ui/ProductCard';
import { Screen } from '@/ui/Screen';
import { useKeyboardHeight } from '@/ui/Sheet';
import { Text } from '@/ui/Text';
import { useToast } from '@/ui/Toast';
import { radius, usePalette } from '@/ui/theme';

// ZillyAI chat (website: the ChatbotWidget bubble). The website's AI answers
// (/api/ai/chat/reply) with live products, order cards, filters, follow-ups
// and ticket hand-off, with the on-device rules as fallback; plus voice in
// (speak a question) and out (read replies aloud), and search by photo.

// Read every reply aloud, not just answers to spoken questions. Kept for the
// app session, like the conversation.
let readAloudPref = false;

export default function AssistantScreen() {
  const t = usePalette();
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardHeight();
  const toast = useToast();
  const { user, isLoggedIn } = useAuth();
  const speaker = useSpeaker();
  const [readAloud, setReadAloud] = useState(readAloudPref);
  const { messages, busy, status, send, stop, regenerate, rate, raiseTicket, settle, clear } = useAssistant({
    onVoiceReply: (m) => speaker.speak(m.id, m.text, m.language),
  });
  const [draft, setDraft] = useState('');
  const [photo, setPhoto] = useState<PickedPhoto | null>(null);
  const draftRef = useRef(draft);
  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  // A spoken question goes straight out (joined to anything typed first),
  // and its answer is read back.
  const voice = useVoiceInput({
    onText: (spoken) => {
      const text = `${draftRef.current.trim()} ${spoken}`.trim();
      setDraft('');
      send(text, { viaVoice: true });
    },
    onError: (m) => toast(m, 'error'),
  });

  const submit = (text = draft) => {
    if ((!text.trim() && !photo) || busy) return;
    tap();
    speaker.stop();
    setDraft('');
    setPhoto(null);
    send(text, { photo: photo ?? undefined, viaVoice: readAloud });
  };

  const onAction = (a: Action) => {
    tap();
    if (a.kind === 'send') submit(a.value);
    else if (a.kind === 'go') router.push(a.href);
    else if (a.kind === 'ticket') raiseTicket();
    else Linking.openURL(a.url).catch(() => {});
  };

  const toggleReadAloud = () => {
    tap();
    const next = !readAloud;
    readAloudPref = next;
    setReadAloud(next);
    if (!next) speaker.stop();
    toast(next ? 'ZillyAI will read replies aloud' : 'Read aloud is off', 'info');
  };

  const newChat = () => {
    speaker.stop();
    voice.cancel();
    setPhoto(null);
    clear();
  };

  const firstName = user?.name?.trim().split(/\s+/)[0];
  const latestBotId = [...messages].reverse().find((m) => m.role === 'bot')?.id;
  const headerStatus =
    voice.state === 'listening'
      ? 'Listening…'
      : voice.state === 'transcribing'
        ? 'Understanding your voice…'
        : busy
          ? 'Thinking…'
          : speaker.speakingId
            ? 'Speaking…'
            : 'Products, orders & delivery help';

  return (
    <Screen>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <IconButton icon="chevron-back" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
        <View style={styles.headerTitle}>
          <AiOrb size={38} pulse={busy || voice.state !== 'idle' || !!speaker.speakingId} />
          <View style={{ flexShrink: 1 }}>
            <Text variant="heading">ZillyAI</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <View style={[styles.online, { backgroundColor: voice.state === 'listening' ? t.danger : t.success }]} />
              <Text variant="tiny" tone="muted" numberOfLines={1}>
                {headerStatus}
              </Text>
            </View>
          </View>
        </View>
        {voiceSupported && (
          <IconButton icon={readAloud ? 'volume-high' : 'volume-mute-outline'} label={readAloud ? 'Turn off read aloud' : 'Read replies aloud'} onPress={toggleReadAloud} />
        )}
        {messages.length > 0 && <IconButton icon="create-outline" label="New chat" onPress={newChat} />}
      </View>

      {/* Conversation */}
      {messages.length === 0 ? (
        <Welcome firstName={firstName} isLoggedIn={isLoggedIn} onSend={(s) => submit(s)} />
      ) : (
        <FlatList
          inverted
          data={[...messages].reverse()}
          keyExtractor={(m) => m.id}
          renderItem={({ item }) =>
            item.role === 'user' ? (
              <UserBubble message={item} />
            ) : (
              <BotTurn
                message={item}
                latest={item.id === latestBotId}
                status={status}
                busy={busy}
                speaking={speaker.speakingId === item.id}
                onSpeak={voiceSupported ? () => speaker.toggle(item.id, item.text, item.language) : undefined}
                onAction={onAction}
                onSend={(s) => submit(s)}
                onRetry={() => regenerate(item.id)}
                onRegenerate={() => regenerate(item.id)}
                onTranslate={() => regenerate(item.id, 'english')}
                onRate={(r) => rate(item.id, r)}
                onSettled={() => settle(item.id)}
              />
            )
          }
          contentContainerStyle={{ paddingHorizontal: 14, paddingVertical: 12, gap: 14 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Composer */}
      <View style={[styles.composerWrap, { paddingBottom: keyboard ? keyboard + 8 : insets.bottom + 10 }]}>
        <Composer
          draft={draft}
          onChange={setDraft}
          onSend={() => submit()}
          busy={busy}
          onStop={() => (tap(), stop())}
          photo={photo}
          onPhoto={setPhoto}
          voice={voice}
          onError={(m) => toast(m, 'error')}
        />
        <Text variant="tiny" tone="faint" style={{ textAlign: 'center', marginTop: 6 }}>
          ZillyAI can make mistakes · Order help after sign-in
        </Text>
      </View>
    </Screen>
  );
}

/* -------------------------------- Welcome ------------------------------- */

function Welcome({ firstName, isLoggedIn, onSend }: { firstName?: string; isLoggedIn: boolean; onSend: (s: string) => void }) {
  const t = usePalette();
  return (
    <ScrollView contentContainerStyle={styles.welcome} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <Animated.View entering={FadeInDown.duration(400)} style={{ alignItems: 'center', gap: 12 }}>
        <AiOrb size={76} pulse />
        <Text variant="title" style={{ textAlign: 'center' }}>
          {firstName ? `Hi ${firstName}, ` : 'Hi, '}
          <Text variant="title" tone="primary">
            I’m ZillyAI
          </Text>
        </Text>
        <Text tone="muted" style={{ textAlign: 'center', maxWidth: 310 }}>
          Ask in English, Hindi or Hinglish — type, {voiceSupported ? 'tap 🎤 to speak, ' : ''}or 📷 snap a product to find it.
        </Text>
      </Animated.View>

      <View style={{ gap: 10 }}>
        <Text variant="tiny" tone="muted" style={styles.section}>
          SHOP BY CATEGORY
        </Text>
        <View style={styles.grid}>
          {[...Object.entries(DOMAIN_META), ['', { name: 'All products', icon: 'grid-outline' }] as const].map(([slug, m], i) => (
            <Animated.View key={slug || 'all'} entering={FadeInUp.delay(80 + i * 35).duration(320)} style={styles.cell}>
              <Pressable
                onPress={() => (tap(), slug ? router.push({ pathname: '/shop/[domain]', params: { domain: slug } }) : router.push('/products'))}
                style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.97 : 1 }] })}>
                <Glass radius={radius.md} style={styles.tile}>
                  <View style={[styles.tileIcon, { backgroundColor: `${t.primary}16` }]}>
                    <Ionicons name={m.icon as any} size={17} color={t.primary} />
                  </View>
                  <Text variant="label" numberOfLines={1} style={{ flex: 1, fontSize: 13 }}>
                    {m.name}
                  </Text>
                </Glass>
              </Pressable>
            </Animated.View>
          ))}
        </View>
      </View>

      <View style={{ gap: 10 }}>
        <Text variant="tiny" tone="muted" style={styles.section}>
          TRY ASKING
        </Text>
        <View style={styles.starters}>
          {STARTERS.map((s, i) => (
            <Animated.View key={s.label} entering={FadeInUp.delay(300 + i * 40).duration(320)}>
              <Pressable onPress={() => onSend(s.value)} style={({ pressed }) => [styles.starter, { backgroundColor: `${t.primary}12`, borderColor: `${t.primary}2E`, opacity: pressed ? 0.7 : 1 }]}>
                <Ionicons name={s.icon as any} size={14} color={t.primary} />
                <Text variant="caption" tone="primary" style={{ fontWeight: '600' }}>
                  {s.label}
                </Text>
              </Pressable>
            </Animated.View>
          ))}
        </View>
      </View>

      {!isLoggedIn && (
        <Glass radius={radius.lg} style={styles.signIn}>
          <View style={[styles.tileIcon, { backgroundColor: `${t.primary}16` }]}>
            <Ionicons name="lock-closed" size={16} color={t.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="label">Sign in for order help</Text>
            <Text variant="caption" tone="muted">
              Track orders, returns, raise tickets
            </Text>
          </View>
          <Pressable onPress={() => (tap(), router.push('/login'))} style={({ pressed }) => [styles.signInBtn, { backgroundColor: t.primary, opacity: pressed ? 0.85 : 1 }]}>
            <Text variant="caption" tone="onPrimary" style={{ fontWeight: '700' }}>
              Sign in
            </Text>
          </Pressable>
        </Glass>
      )}
    </ScrollView>
  );
}

/* -------------------------------- Messages ------------------------------ */

function UserBubble({ message }: { message: ChatMessage }) {
  const t = usePalette();
  return (
    <Animated.View entering={FadeInUp.duration(220)} style={{ alignItems: 'flex-end', gap: 6 }}>
      {!!message.imageUri && (
        <Image source={{ uri: message.imageUri }} style={[styles.userPhoto, { borderColor: t.glassBorder }]} contentFit="cover" />
      )}
      <LinearGradient colors={t.primaryGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.userBubble}>
        <Text tone="onPrimary" style={{ fontSize: 15, lineHeight: 21 }}>
          {message.text}
        </Text>
      </LinearGradient>
    </Animated.View>
  );
}

const WORD_INTERVAL_MS = 30;
// Long replies reveal several words per tick so none takes over ~2.3s.
const MAX_REVEAL_TICKS = 75;

// A fresh reply types itself out word by word, then its cards and chips fade in.
function useReveal(text: string, fresh: boolean | undefined, onDone: () => void) {
  const total = countWords(text);
  const [shown, setShown] = useState(fresh ? 0 : total);
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });
  useEffect(() => {
    if (!fresh) return;
    const step = Math.max(1, Math.ceil(total / MAX_REVEAL_TICKS));
    let n = 0;
    const timer = setInterval(() => {
      n = Math.min(total, n + step);
      setShown(n);
      if (n >= total) {
        clearInterval(timer);
        done.current();
      }
    }, WORD_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [fresh, text, total]);
  const revealing = !!fresh && shown < total;
  return { text: revealing ? firstWords(text, shown) : text, revealing };
}

type BotTurnProps = {
  message: ChatMessage;
  latest: boolean;
  status: string | null;
  busy: boolean;
  speaking: boolean;
  onSpeak?: () => void;
  onAction: (a: Action) => void;
  onSend: (s: string) => void;
  onRetry: () => void;
  onRegenerate: () => void;
  onTranslate: () => void;
  onRate: (r: 'up' | 'down') => void;
  onSettled: () => void;
};

function BotTurn(p: BotTurnProps) {
  const { message: m } = p;
  const t = usePalette();
  const reveal = useReveal(m.text, m.fresh, p.onSettled);

  if (m.pending) {
    return (
      <Animated.View entering={FadeIn.duration(200)} style={styles.botRow} accessibilityLiveRegion="polite">
        <AiOrb size={28} pulse />
        <Glass radius={20} style={[styles.botBubble, { paddingVertical: 10 }]}>
          <TypingDots />
        </Glass>
        {!!p.status && (
          <Text variant="caption" tone="muted" style={{ flexShrink: 1, paddingBottom: 10 }}>
            {p.status}
          </Text>
        )}
      </Animated.View>
    );
  }

  if (m.error) {
    const canRetry = !m.fromImage && !!m.prompt;
    return (
      <Animated.View entering={FadeIn.duration(200)} style={styles.botRow}>
        <AiOrb size={28} />
        <Glass radius={20} style={[styles.botBubble, { borderColor: t.warning, borderWidth: 1, gap: 8 }]}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Ionicons name="alert-circle-outline" size={18} color={t.warning} />
            <Text style={{ flexShrink: 1, fontSize: 15, lineHeight: 21 }}>{m.error}</Text>
          </View>
          {canRetry && (
            <Pressable onPress={() => (tap(), p.onRetry())} disabled={p.busy} style={({ pressed }) => [styles.retry, { backgroundColor: t.primary, opacity: p.busy ? 0.5 : pressed ? 0.85 : 1 }]}>
              <Ionicons name="refresh" size={14} color="#fff" />
              <Text variant="caption" tone="onPrimary" style={{ fontWeight: '700' }}>
                Retry
              </Text>
            </Pressable>
          )}
        </Glass>
      </Animated.View>
    );
  }

  const showRich = !reveal.revealing;
  const canRegenerate = p.latest && !m.fromImage && !!m.prompt;

  return (
    <View style={{ gap: 10 }}>
      <View style={styles.botRow}>
        <AiOrb size={28} />
        <Glass radius={20} style={styles.botBubble}>
          <Markdown text={reveal.text || ' '} />
        </Glass>
      </View>

      {showRich && (
        <Animated.View entering={m.fresh ? FadeInUp.duration(260) : undefined} style={{ gap: 10 }}>
          {!!m.note && (
            <View style={[styles.note, { marginLeft: 38 }]}>
              <Ionicons name="lock-closed" size={12} color={t.textMuted} />
              <Text variant="caption" tone="muted">
                {m.note}
              </Text>
            </View>
          )}

          {!!m.filters?.length && (
            <View style={{ paddingLeft: 38 }}>
              <FilterChips filters={m.filters} onPick={p.onSend} disabled={p.busy} />
            </View>
          )}

          {!!m.products?.length && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingLeft: 38, paddingRight: 8 }} style={{ marginHorizontal: -14 }}>
              {m.products.map((prod) => (
                <ProductCard key={`${prod.id}-${prod.slug}`} product={prod} width={150} />
              ))}
              {!!m.productQuery && (
                <Pressable
                  onPress={() => (tap(), router.push({ pathname: '/search', params: { q: m.productQuery! } }))}
                  style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
                  <Glass radius={radius.lg} style={styles.seeAll}>
                    <View style={[styles.seeAllIcon, { backgroundColor: `${t.primary}18` }]}>
                      <Ionicons name="arrow-forward" size={20} color={t.primary} />
                    </View>
                    <Text variant="label" tone="primary" style={{ textAlign: 'center' }}>
                      See all results
                    </Text>
                  </Glass>
                </Pressable>
              )}
            </ScrollView>
          )}

          {!!m.order && (
            <View style={{ paddingLeft: 38 }}>
              <AiOrderCardView order={m.order} onHelp={() => p.onSend(`I need help with order #${m.order!.orderId}`)} />
            </View>
          )}

          {m.orders?.map((o) => <OrderChip key={o.id} order={o} />)}

          {!!m.actions?.length && (
            <View style={[styles.actions, { opacity: p.latest ? 1 : 0.7 }]}>
              {m.actions.map((a) => (
                <Pressable key={`${a.kind}-${a.label}`} onPress={() => p.onAction(a)} disabled={p.busy && a.kind !== 'go'} accessibilityRole="button">
                  <View
                    style={[
                      styles.action,
                      a.kind === 'ticket'
                        ? { borderColor: t.warning, backgroundColor: `${t.warning}1A` }
                        : { borderColor: `${t.primary}55`, backgroundColor: `${t.primary}10` },
                    ]}>
                    {!!a.icon && <Ionicons name={a.icon as any} size={14} color={a.kind === 'ticket' ? t.warning : t.primary} />}
                    <Text variant="caption" style={{ fontWeight: '700', color: a.kind === 'ticket' ? t.warning : t.primary }}>
                      {a.label}
                    </Text>
                    {a.kind === 'go' && <Ionicons name="chevron-forward" size={12} color={t.primary} />}
                  </View>
                </Pressable>
              ))}
            </View>
          )}

          {p.latest && !!m.suggestions?.length && (
            <View style={{ paddingLeft: 38 }}>
              <QuickReplies items={m.suggestions} onPick={p.onSend} disabled={p.busy} />
            </View>
          )}

          <LanguageTag language={m.language} onTranslate={canRegenerate ? p.onTranslate : undefined} disabled={p.busy} />

          {!!m.text && (
            <MessageActions
              text={m.text}
              feedback={m.feedback}
              onRate={p.onRate}
              speaking={p.speaking}
              onSpeak={p.onSpeak}
              onRegenerate={canRegenerate ? p.onRegenerate : undefined}
              disabled={p.busy}
            />
          )}
        </Animated.View>
      )}
    </View>
  );
}

function OrderChip({ order }: { order: Order }) {
  const t = usePalette();
  const total = Number(order.netAmount || order.amount) || 0;
  const first = order.items[0];
  return (
    <Pressable
      onPress={() => (tap(), router.push({ pathname: '/order/[id]', params: { id: String(order.id) } }))}
      style={({ pressed }) => [{ marginLeft: 38, transform: [{ scale: pressed ? 0.98 : 1 }] }]}>
      <Glass radius={radius.lg} style={styles.order}>
        <View style={[styles.orderIcon, { backgroundColor: `${t.primary}18` }]}>
          <Ionicons name="cube" size={20} color={t.primary} />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text variant="label" numberOfLines={1}>
            #{order.order_id}
          </Text>
          {!!first && (
            <Text variant="caption" tone="muted" numberOfLines={1}>
              {first.title}
              {order.items.length > 1 ? ` +${order.items.length - 1} more` : ''}
            </Text>
          )}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <OrderStatus state={order.order_state} />
            {total > 0 && (
              <Text variant="caption" style={{ fontWeight: '700' }}>
                {formatINR(total)}
              </Text>
            )}
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color={t.textFaint} />
      </Glass>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingBottom: 10 },
  headerTitle: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, marginLeft: 4 },
  online: { width: 7, height: 7, borderRadius: 4 },
  welcome: { flexGrow: 1, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 20, gap: 22 },
  section: { letterSpacing: 0.8, paddingHorizontal: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 },
  cell: { width: '50%', padding: 4 },
  tile: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, minHeight: 54 },
  tileIcon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  starters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  starter: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36, paddingHorizontal: 13, borderRadius: radius.pill, borderWidth: 1 },
  signIn: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  signInBtn: { height: 38, paddingHorizontal: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  botRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingRight: 36 },
  botBubble: { flexShrink: 1, paddingHorizontal: 14, paddingVertical: 11, borderBottomLeftRadius: 6 },
  userBubble: { maxWidth: '82%', paddingHorizontal: 14, paddingVertical: 11, borderRadius: 20, borderBottomRightRadius: 6 },
  userPhoto: { width: 150, height: 150, borderRadius: 18, borderWidth: 1 },
  retry: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', height: 34, paddingHorizontal: 14, borderRadius: 10 },
  note: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  seeAll: { width: 120, flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 12 },
  seeAllIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingLeft: 38 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, height: 32, borderRadius: radius.pill, borderWidth: 1 },
  order: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  orderIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  composerWrap: { paddingHorizontal: 14, paddingTop: 6 },
});
