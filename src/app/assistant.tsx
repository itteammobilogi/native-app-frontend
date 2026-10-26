import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Linking, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Order } from '@/core/api/orders';
import { STARTERS, type Action } from '@/core/assistant/brain';
import { useAssistant, type ChatMessage } from '@/core/assistant/useAssistant';
import { useAuth } from '@/core/auth/AuthContext';
import { formatINR } from '@/core/pricing';
import { IconButton, tap } from '@/ui/Button';
import { AiOrb, TypingDots } from '@/ui/assistant/AiOrb';
import { Glass } from '@/ui/Glass';
import { OrderStatus } from '@/ui/OrderStatus';
import { ProductCard } from '@/ui/ProductCard';
import { Screen } from '@/ui/Screen';
import { useKeyboardHeight } from '@/ui/Sheet';
import { Text } from '@/ui/Text';
import { radius, usePalette } from '@/ui/theme';

// ZillyAI chat (website: the ChatbotWidget bubble). Product picks, order
// status and policy help, answered from the live catalog and your account.
export default function AssistantScreen() {
  const t = usePalette();
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardHeight();
  const { user } = useAuth();
  const { messages, typing, send, clear } = useAssistant();
  const [draft, setDraft] = useState('');

  const submit = (text = draft) => {
    if (!text.trim() || typing) return;
    tap();
    setDraft('');
    send(text);
  };

  const onAction = (a: Action) => {
    tap();
    if (a.kind === 'send') submit(a.value);
    else if (a.kind === 'go') router.push(a.href);
    else Linking.openURL(a.url).catch(() => {});
  };

  const firstName = user?.name?.trim().split(/\s+/)[0];
  const latestBotId = [...messages].reverse().find((m) => m.role === 'bot')?.id;

  return (
    <Screen>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <IconButton icon="chevron-back" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
        <View style={styles.headerTitle}>
          <AiOrb size={38} pulse />
          <View style={{ flexShrink: 1 }}>
            <Text variant="heading">ZillyAI</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <View style={[styles.online, { backgroundColor: t.success }]} />
              <Text variant="tiny" tone="muted" numberOfLines={1}>
                {typing ? 'Thinking…' : 'Shopping & order help'}
              </Text>
            </View>
          </View>
        </View>
        {messages.length > 0 ? (
          <IconButton icon="refresh" label="New chat" onPress={clear} />
        ) : (
          <View style={{ width: 42 }} />
        )}
      </View>

      {/* Conversation */}
      {messages.length === 0 ? (
        <ScrollView contentContainerStyle={styles.welcome} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Animated.View entering={FadeInDown.duration(400)} style={{ alignItems: 'center', gap: 14 }}>
            <AiOrb size={84} pulse />
            <Text variant="display" style={{ textAlign: 'center' }}>
              {firstName ? `Hi ${firstName}, ` : 'Hi, '}
              <Text variant="display" tone="primary">
                I’m ZillyAI
              </Text>
            </Text>
            <Text tone="muted" style={{ textAlign: 'center', maxWidth: 300 }}>
              Your shopping buddy. Ask in English or Hinglish — I’ll find products in your budget, track orders and sort out returns.
            </Text>
          </Animated.View>
          <View style={styles.starters}>
            {STARTERS.map((s, i) => (
              <Animated.View key={s.label} entering={FadeInUp.delay(120 + i * 60).duration(350)} style={styles.starterCell}>
                <Pressable onPress={() => submit(s.value)} style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.97 : 1 }] })}>
                  <Glass radius={radius.lg} style={styles.starter}>
                    <View style={[styles.starterIcon, { backgroundColor: `${t.primary}18` }]}>
                      <Ionicons name={s.icon as any} size={18} color={t.primary} />
                    </View>
                    <Text variant="label" numberOfLines={2} style={{ flex: 1, fontSize: 13 }}>
                      {s.label}
                    </Text>
                  </Glass>
                </Pressable>
              </Animated.View>
            ))}
          </View>
        </ScrollView>
      ) : (
        <FlatList
          inverted
          data={[...messages].reverse()}
          keyExtractor={(m) => m.id}
          renderItem={({ item }) => <Bubble message={item} latest={item.id === latestBotId} onAction={onAction} />}
          ListHeaderComponent={typing ? <TypingBubble /> : null}
          contentContainerStyle={{ paddingHorizontal: 14, paddingVertical: 12, gap: 14 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Composer */}
      <View style={[styles.composerWrap, { paddingBottom: keyboard ? keyboard + 8 : insets.bottom + 10 }]}>
        <Glass strong radius={26} style={styles.composer}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Ask about products, orders, returns…"
            placeholderTextColor={t.textFaint}
            selectionColor={t.primary}
            style={[styles.input, { color: t.text }]}
            multiline
            maxLength={500}
            onSubmitEditing={() => submit()}
            submitBehavior="submit"
            returnKeyType="send"
          />
          <Pressable onPress={() => submit()} disabled={!draft.trim() || typing} accessibilityRole="button" accessibilityLabel="Send">
            <LinearGradient
              colors={draft.trim() && !typing ? [t.primary, t.accent] : [t.hairline, t.hairline]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.send}>
              <Ionicons name="arrow-up" size={20} color={draft.trim() && !typing ? '#fff' : t.textFaint} />
            </LinearGradient>
          </Pressable>
        </Glass>
        <Text variant="tiny" tone="faint" style={{ textAlign: 'center', marginTop: 6 }}>
          ZillyAI can make mistakes. Prices and stock are live from the store.
        </Text>
      </View>
    </Screen>
  );
}

function TypingBubble() {
  return (
    <Animated.View entering={FadeInUp.duration(200)} style={styles.botRow}>
      <AiOrb size={28} />
      <Glass radius={20} style={[styles.botBubble, { paddingVertical: 10 }]}>
        <TypingDots />
      </Glass>
    </Animated.View>
  );
}

function Bubble({ message, latest, onAction }: { message: ChatMessage; latest: boolean; onAction: (a: Action) => void }) {
  const t = usePalette();

  if (message.role === 'user') {
    return (
      <Animated.View entering={FadeInUp.duration(220)} style={{ alignItems: 'flex-end' }}>
        <LinearGradient colors={t.primaryGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.userBubble}>
          <Text tone="onPrimary" style={{ fontSize: 15, lineHeight: 21 }}>
            {message.text}
          </Text>
        </LinearGradient>
      </Animated.View>
    );
  }

  return (
    <Animated.View entering={FadeInUp.duration(260)} style={{ gap: 10 }}>
      <View style={styles.botRow}>
        <AiOrb size={28} />
        <Glass radius={20} style={styles.botBubble}>
          <Text style={{ fontSize: 15, lineHeight: 21 }}>{message.text}</Text>
        </Glass>
      </View>

      {!!message.note && (
        <View style={[styles.note, { marginLeft: 38 }]}>
          <Ionicons name="lock-closed" size={12} color={t.textMuted} />
          <Text variant="caption" tone="muted">
            {message.note}
          </Text>
        </View>
      )}

      {!!message.products?.length && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingLeft: 38, paddingRight: 8 }} style={{ marginHorizontal: -14 }}>
          {message.products.map((p) => (
            <ProductCard key={`${p.id}-${p.slug}`} product={p} width={150} />
          ))}
        </ScrollView>
      )}

      {message.orders?.map((o) => <OrderChip key={o.id} order={o} />)}

      {!!message.actions?.length && (
        <View style={[styles.actions, { opacity: latest ? 1 : 0.7 }]}>
          {message.actions.map((a) => (
            <Pressable key={`${a.kind}-${a.label}`} onPress={() => onAction(a)} accessibilityRole="button">
              <View style={[styles.action, { borderColor: `${t.primary}55`, backgroundColor: `${t.primary}10` }]}>
                {!!a.icon && <Ionicons name={a.icon as any} size={14} color={t.primary} />}
                <Text variant="caption" tone="primary" style={{ fontWeight: '600' }}>
                  {a.label}
                </Text>
                {a.kind === 'go' && <Ionicons name="chevron-forward" size={12} color={t.primary} />}
              </View>
            </Pressable>
          ))}
        </View>
      )}
    </Animated.View>
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
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 10 },
  headerTitle: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  online: { width: 7, height: 7, borderRadius: 4 },
  welcome: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 18, paddingVertical: 24, gap: 28 },
  starters: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -5 },
  starterCell: { width: '50%', padding: 5 },
  starter: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, minHeight: 64 },
  starterIcon: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  botRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingRight: 36 },
  botBubble: { flexShrink: 1, paddingHorizontal: 14, paddingVertical: 11, borderBottomLeftRadius: 6 },
  userBubble: { maxWidth: '82%', paddingHorizontal: 14, paddingVertical: 11, borderRadius: 20, borderBottomRightRadius: 6 },
  note: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingLeft: 38 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, height: 32, borderRadius: radius.pill, borderWidth: 1 },
  order: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  orderIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  composerWrap: { paddingHorizontal: 14, paddingTop: 6 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingLeft: 16, paddingRight: 6, paddingVertical: 6 },
  input: { flex: 1, fontSize: 15, maxHeight: 110, paddingTop: 10, paddingBottom: 10 },
  send: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
