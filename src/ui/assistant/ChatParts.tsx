import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { AiLanguage, AiOrderCard } from '@/core/api/chatbot';
import { formatINR } from '@/core/pricing';
import { tap } from '../Button';
import { Glass } from '../Glass';
import { Text } from '../Text';
import { radius, usePalette } from '../theme';

// The rich parts of a ZillyAI reply, after the website widget's ui/
// components (OrderCard, SmallCards, Messages' actions and language tag).

/* ------------------------------- Order card ------------------------------ */

const STEPS = ['Ordered', 'Packed', 'Shipped', 'Delivered'];

// "Thu, 30 Oct" from an ISO date or "dd-mm-yyyy"; null when unreadable.
function formatArrival(value: string | null) {
  if (!value) return null;
  const dmy = value.trim().match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  const date = dmy ? new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1])) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function AiOrderCardView({ order, onHelp }: { order: AiOrderCard; onHelp: () => void }) {
  const t = usePalette();
  const items = order.items || [];
  const first = items[0] || { title: 'Your order', quantity: 1, image: null };
  const qty = items.reduce((s, i) => s + Number(i.quantity || 1), 0) || 1;
  const cancelled = order.step < 0;
  const arrival = !cancelled && order.step < 3 ? formatArrival(order.expectedDeliveryDate) : null;

  return (
    <Glass radius={radius.lg} style={styles.card}>
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
        <View style={[styles.thumb, { backgroundColor: `${t.primary}12` }]}>
          {first.image ? (
            <Image source={{ uri: first.image }} style={StyleSheet.absoluteFill} contentFit="cover" />
          ) : (
            <Ionicons name="cube-outline" size={22} color={t.primary} />
          )}
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="label" numberOfLines={2}>
            {first.title}
            {items.length > 1 && (
              <Text variant="label" tone="muted" style={{ fontWeight: '400' }}>
                {` + ${items.length - 1} more`}
              </Text>
            )}
          </Text>
          <Text variant="caption" tone="muted" numberOfLines={1}>
            #{order.orderId} · Qty {qty}
            {order.total > 0 ? ` · ${formatINR(order.total)}` : ''}
          </Text>
        </View>
        <View style={[styles.badge, { backgroundColor: cancelled ? `${t.danger}1F` : `${t.primary}18` }]}>
          <Text variant="tiny" style={{ color: cancelled ? t.danger : t.primary }}>
            {order.statusLabel}
          </Text>
        </View>
      </View>

      {!cancelled && (
        <View style={{ marginTop: 14 }} accessibilityLabel={`Order progress: ${STEPS[order.step] ?? STEPS[0]}`}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {STEPS.map((label, i) => (
              <View key={label} style={{ flexDirection: 'row', alignItems: 'center', flex: i < STEPS.length - 1 ? 1 : 0 }}>
                <View style={[styles.stepDot, { backgroundColor: i <= order.step ? t.primary : t.hairline }]} />
                {i < STEPS.length - 1 && <View style={[styles.stepBar, { backgroundColor: i < order.step ? t.primary : t.hairline }]} />}
              </View>
            ))}
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
            {STEPS.map((label, i) => (
              <Text key={label} variant="tiny" tone={i <= order.step ? 'default' : 'faint'} style={{ fontSize: 10 }}>
                {label}
              </Text>
            ))}
          </View>
        </View>
      )}

      {!!arrival && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 }}>
          <Ionicons name="car-outline" size={16} color={t.textMuted} />
          <Text variant="caption">
            Arriving <Text variant="caption" style={{ fontWeight: '700' }}>{arrival}</Text>
          </Text>
        </View>
      )}

      <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
        <Pressable
          onPress={() => (tap(), router.push('/orders'))}
          style={({ pressed }) => [styles.cardBtn, { backgroundColor: t.primary, opacity: pressed ? 0.85 : 1 }]}>
          <Text variant="caption" tone="onPrimary" style={{ fontWeight: '700' }}>
            Track package
          </Text>
        </Pressable>
        <Pressable
          onPress={() => (tap(), onHelp())}
          style={({ pressed }) => [styles.cardBtn, { borderWidth: 1, borderColor: t.hairline, opacity: pressed ? 0.7 : 1 }]}>
          <Text variant="caption" style={{ fontWeight: '700' }}>
            Get help
          </Text>
        </Pressable>
      </View>
    </Glass>
  );
}

/* --------------------------------- Chips -------------------------------- */

export function Chip({ label, onPress, disabled, selected }: { label: string; onPress?: () => void; disabled?: boolean; selected?: boolean }) {
  const t = usePalette();
  return (
    <Pressable
      onPress={onPress ? () => (tap(), onPress()) : undefined}
      disabled={disabled || !onPress}
      accessibilityRole={onPress ? 'button' : 'text'}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: `${t.primary}${selected ? '22' : '12'}`,
          borderColor: selected ? t.primary : `${t.primary}30`,
          opacity: disabled ? 0.5 : pressed ? 0.7 : 1,
        },
      ]}>
      {selected && <Ionicons name="checkmark" size={13} color={t.primary} />}
      <Text variant="caption" tone="primary" style={{ fontWeight: selected ? '700' : '600' }}>
        {label}
      </Text>
    </Pressable>
  );
}

// Applied filters show ✓ and aren't buttons; the rest send their label.
export function FilterChips({ filters, onPick, disabled }: { filters: { label: string; selected: boolean }[]; onPick: (s: string) => void; disabled?: boolean }) {
  if (!filters.length) return null;
  return (
    <View style={styles.chips}>
      {filters.map((f) => (
        <Chip key={f.label} label={f.label} selected={f.selected} onPress={f.selected ? undefined : () => onPick(f.label)} disabled={disabled} />
      ))}
    </View>
  );
}

export function QuickReplies({ items, onPick, disabled }: { items: string[]; onPick: (s: string) => void; disabled?: boolean }) {
  if (!items.length) return null;
  return (
    <View style={styles.chips}>
      {items.map((s) => (
        <Chip key={s} label={s} onPress={() => onPick(s)} disabled={disabled} />
      ))}
    </View>
  );
}

/* ---------------------------- Message actions --------------------------- */

function ActionIcon({ icon, label, onPress, active, disabled }: { icon: string; label: string; onPress: () => void; active?: boolean; disabled?: boolean }) {
  const t = usePalette();
  return (
    <Pressable
      onPress={() => (tap(), onPress())}
      disabled={disabled}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active, disabled }}
      style={({ pressed }) => [styles.actionIcon, { opacity: disabled ? 0.35 : pressed ? 0.6 : 1 }]}>
      <Ionicons name={icon as any} size={17} color={active ? t.primary : t.textMuted} />
    </Pressable>
  );
}

// 👍 👎 Copy Read-aloud Regenerate under a finished reply.
export function MessageActions({
  text,
  feedback,
  onRate,
  speaking,
  onSpeak,
  onRegenerate,
  disabled,
}: {
  text: string;
  feedback?: 'up' | 'down' | null;
  onRate: (r: 'up' | 'down') => void;
  speaking: boolean;
  onSpeak?: () => void;
  onRegenerate?: () => void;
  disabled?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const copy = async () => {
    await Clipboard.setStringAsync(text.replace(/\*\*/g, '')).catch(() => {});
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1500);
  };

  return (
    <View style={styles.actions}>
      <ActionIcon icon={feedback === 'up' ? 'thumbs-up' : 'thumbs-up-outline'} label="Helpful" active={feedback === 'up'} onPress={() => onRate('up')} />
      <ActionIcon icon={feedback === 'down' ? 'thumbs-down' : 'thumbs-down-outline'} label="Not helpful" active={feedback === 'down'} onPress={() => onRate('down')} />
      <ActionIcon icon={copied ? 'checkmark' : 'copy-outline'} label={copied ? 'Copied' : 'Copy reply'} active={copied} onPress={copy} />
      {onSpeak && <ActionIcon icon={speaking ? 'stop-circle-outline' : 'volume-high-outline'} label={speaking ? 'Stop reading' : 'Read aloud'} active={speaking} onPress={onSpeak} />}
      {onRegenerate && <ActionIcon icon="refresh-outline" label="Regenerate reply" onPress={onRegenerate} disabled={disabled} />}
    </View>
  );
}

const LANGUAGE_NAMES: Partial<Record<AiLanguage, string>> = { hinglish: 'Hinglish', hindi: 'Hindi' };

// "Replying in Hinglish · Translate" under a Hindi/Hinglish reply.
export function LanguageTag({ language, onTranslate, disabled }: { language?: AiLanguage | null; onTranslate?: () => void; disabled?: boolean }) {
  const name = language ? LANGUAGE_NAMES[language] : undefined;
  if (!name) return null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 38 }}>
      <Text variant="caption" tone="muted">
        Replying in {name}
      </Text>
      {onTranslate && (
        <Pressable onPress={() => (tap(), onTranslate())} disabled={disabled} hitSlop={10} accessibilityRole="button">
          <Text variant="caption" tone="primary" style={{ fontWeight: '700', textDecorationLine: 'underline', opacity: disabled ? 0.5 : 1 }}>
            {' · '}Translate to English
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 12 },
  thumb: { width: 52, height: 52, borderRadius: 14, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  badge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: radius.pill },
  stepDot: { width: 12, height: 12, borderRadius: 6 },
  stepBar: { flex: 1, height: 3 },
  cardBtn: { flex: 1, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 34, paddingHorizontal: 13, borderRadius: radius.pill, borderWidth: 1 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingLeft: 32 },
  actionIcon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
});
