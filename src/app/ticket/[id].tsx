import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { errorMessage } from '@/core/api/client';
import type { PickedImage } from '@/core/api/reviews';
import {
  attachmentUrl,
  getTicketMessages,
  isTicketClosed,
  markTicketRead,
  sendTicketMessage,
  type TicketMessage,
} from '@/core/api/tickets';
import { formatRelativeTime } from '@/core/format';
import { tap } from '@/ui/Button';
import { Glass } from '@/ui/Glass';
import { EmptyState, ErrorState, Header, Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { radius, usePalette } from '@/ui/theme';
import { AttachmentThumbs, pickAttachments } from '@/ui/tickets/AttachmentPicker';
import { useToast } from '@/ui/Toast';

// Same cadence as the website's ticket chat.
const POLL_MS = 10_000;

// Website: /tickets/[id]. Support replies arrive by polling while the screen
// is focused and the app is in the foreground.
export default function TicketChatScreen() {
  const { id, status, subject } = useLocalSearchParams<{ id: string; status?: string; subject?: string }>();
  const ticketId = Number(id);
  const readOnly = isTicketClosed(status);
  const t = usePalette();
  const insets = useSafeAreaInsets();
  const toast = useToast();

  const [messages, setMessages] = useState<TicketMessage[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [images, setImages] = useState<PickedImage[]>([]);
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList<TicketMessage>>(null);

  const load = useCallback(async () => {
    try {
      setMessages(await getTicketMessages(ticketId));
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [ticketId]);

  // On every focus: catch up, mark support replies read, then poll.
  useFocusEffect(
    useCallback(() => {
      load().then(() => markTicketRead(ticketId));
      let timer: ReturnType<typeof setInterval> | null = null;
      const start = () => {
        if (!timer) timer = setInterval(load, POLL_MS);
      };
      const stop = () => {
        if (timer) clearInterval(timer);
        timer = null;
      };
      start();
      const sub = AppState.addEventListener('change', (s) => {
        if (s === 'active') {
          load();
          start();
        } else stop();
      });
      return () => {
        stop();
        sub.remove();
      };
    }, [load, ticketId]),
  );

  const send = async () => {
    const message = text.trim();
    if (!message && images.length === 0) return;
    setSending(true);
    try {
      await sendTicketMessage(ticketId, { message, images });
      setText('');
      setImages([]);
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to send message', 'error');
    } finally {
      setSending(false);
    }
  };

  const canSend = (text.trim().length > 0 || images.length > 0) && !sending;

  return (
    <Screen>
      <Header title={subject || 'Support chat'} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {messages === null && !error ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={t.primary} />
          </View>
        ) : messages === null ? (
          <ErrorState message={error ?? ''} onRetry={load} />
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => String(m.id)}
            contentContainerStyle={{ padding: 16, gap: 10, flexGrow: 1 }}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={
              <EmptyState
                icon="chatbubbles-outline"
                title="No messages yet"
                message="Our support team will reply here. You can add more details below."
              />
            }
            renderItem={({ item }) => <Bubble msg={item} />}
          />
        )}

        {readOnly ? (
          <View style={{ padding: 16, paddingBottom: insets.bottom + 16 }}>
            <Glass radius={radius.md} style={{ padding: 12 }}>
              <Text variant="caption" tone="muted" style={{ textAlign: 'center' }}>
                This ticket is {status?.toLowerCase().replace('_', ' ')}. The chat is view only.
              </Text>
            </Glass>
          </View>
        ) : (
          <View style={{ paddingHorizontal: 12, paddingTop: 8, paddingBottom: insets.bottom + 8, gap: 8 }}>
            {images.length > 0 && <AttachmentThumbs images={images} onChange={setImages} showAdd={false} />}
            <Glass radius={radius.xl} style={styles.composer}>
              <Pressable
                hitSlop={8}
                accessibilityLabel="Attach photos"
                onPress={async () => (tap(), setImages(await pickAttachments(images)))}>
                <Ionicons name="attach" size={22} color={t.textMuted} />
              </Pressable>
              <TextInput
                value={text}
                onChangeText={setText}
                placeholder="Type a message"
                placeholderTextColor={t.textFaint}
                selectionColor={t.primary}
                multiline
                maxLength={2000}
                style={[styles.input, { color: t.text }]}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Send"
                disabled={!canSend}
                onPress={() => (tap(), send())}
                style={[styles.send, { backgroundColor: canSend ? t.primary : t.hairline }]}>
                {sending ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="send" size={16} color="#fff" />}
              </Pressable>
            </Glass>
          </View>
        )}
      </KeyboardAvoidingView>
    </Screen>
  );
}

function Bubble({ msg }: { msg: TicketMessage }) {
  const t = usePalette();
  const mine = msg.sender_type !== 'support';
  return (
    <View style={{ alignItems: mine ? 'flex-end' : 'flex-start', gap: 3 }}>
      <Text variant="tiny" tone="faint">
        {mine ? 'You' : 'ZillyBuy Support'} · {formatRelativeTime(msg.created_at)}
      </Text>
      <View style={[styles.bubble, mine ? { backgroundColor: t.primary, borderBottomRightRadius: 4 } : { backgroundColor: t.glassStrong, borderBottomLeftRadius: 4 }]}>
        {!!msg.message && (
          <Text style={{ color: mine ? t.onPrimary : t.text }} selectable>
            {msg.message}
          </Text>
        )}
        {msg.attachments.map((path, i) => (
          <Pressable
            key={`${path}-${i}`}
            onPress={() => WebBrowser.openBrowserAsync(attachmentUrl(path)).catch(() => {})}
            style={styles.attachment}>
            <Ionicons name="document-attach-outline" size={14} color={mine ? t.onPrimary : t.primary} />
            <Text variant="caption" numberOfLines={1} style={{ flexShrink: 1, color: mine ? t.onPrimary : t.primary, textDecorationLine: 'underline' }}>
              {path.split('/').pop()}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: { maxWidth: '82%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10, gap: 6 },
  attachment: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingLeft: 14, paddingRight: 6, paddingVertical: 6 },
  input: { flex: 1, fontSize: 15, maxHeight: 120, paddingVertical: 8 },
  send: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
});
