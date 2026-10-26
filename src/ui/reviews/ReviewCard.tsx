import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { reviewImageUrl, type Review } from '@/core/api/reviews';
import { formatRelativeTime } from '@/core/format';
import { tap } from '@/ui/Button';
import { Text } from '@/ui/Text';
import { radius, usePalette } from '@/ui/theme';
import { ImageViewer } from './ImageViewer';
import { StarRating } from './StarRating';

export function ReviewCard({
  review,
  onVote,
  voting,
  divider = true,
}: {
  review: Review;
  onVote: (v: 1 | -1) => void;
  voting?: boolean;
  divider?: boolean;
}) {
  const t = usePalette();
  const [viewer, setViewer] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);
  const images = (review.images ?? []).map(reviewImageUrl).filter(Boolean);
  const name = review.user_name?.trim() || 'Customer';
  const long = (review.body?.length ?? 0) > 220;

  return (
    <View style={[styles.wrap, divider && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.hairline }]}>
      <View style={styles.head}>
        <View style={[styles.avatar, { backgroundColor: `${t.primary}18` }]}>
          <Text variant="label" tone="primary">
            {name.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <Text variant="label">{name}</Text>
            {review.is_verified_purchase && (
              <View style={[styles.verified, { backgroundColor: `${t.success}1A` }]}>
                <Ionicons name="checkmark-circle" size={11} color={t.success} />
                <Text variant="tiny" tone="success">
                  Verified Purchase
                </Text>
              </View>
            )}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <StarRating rating={review.rating} size={13} />
            <Text variant="tiny" tone="faint">
              {formatRelativeTime(review.created_at)}
            </Text>
          </View>
        </View>
      </View>

      {!!review.title && <Text variant="heading" style={{ fontSize: 15 }}>{review.title}</Text>}
      {!!review.body && (
        <>
          <Text tone="muted" numberOfLines={expanded ? undefined : 5} style={{ lineHeight: 21 }}>
            {review.body}
          </Text>
          {long && (
            <Text variant="label" tone="primary" onPress={() => setExpanded((v) => !v)} suppressHighlighting>
              {expanded ? 'Show less' : 'Read more'}
            </Text>
          )}
        </>
      )}

      {images.length > 0 && (
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {images.map((u, i) => (
            <Pressable key={`${u}-${i}`} onPress={() => (tap(), setViewer(i))} accessibilityLabel={`${name} review photo ${i + 1}`}>
              <Image source={{ uri: u }} style={[styles.photo, { borderColor: t.glassBorder }]} contentFit="cover" transition={150} />
            </Pressable>
          ))}
        </View>
      )}

      <View style={styles.helpful}>
        <Text variant="caption" tone="faint">
          Helpful?
        </Text>
        <VoteButton icon="thumbs-up" count={review.helpful_up ?? 0} active={review.my_vote === 1} disabled={voting} onPress={() => onVote(1)} label="Helpful" />
        <VoteButton icon="thumbs-down" count={review.helpful_down ?? 0} active={review.my_vote === -1} disabled={voting} onPress={() => onVote(-1)} label="Not helpful" />
      </View>

      <ImageViewer images={images} index={viewer} onClose={() => setViewer(null)} />
    </View>
  );
}

function VoteButton({
  icon,
  count,
  active,
  disabled,
  onPress,
  label,
}: {
  icon: 'thumbs-up' | 'thumbs-down';
  count: number;
  active: boolean;
  disabled?: boolean;
  onPress: () => void;
  label: string;
}) {
  const t = usePalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active, disabled: !!disabled }}
      disabled={disabled}
      onPress={() => (tap(), onPress())}
      style={[
        styles.vote,
        { borderColor: active ? t.primary : t.hairline, backgroundColor: active ? `${t.primary}14` : 'transparent', opacity: disabled ? 0.5 : 1 },
      ]}>
      <Ionicons name={active ? icon : (`${icon}-outline` as const)} size={14} color={active ? t.primary : t.textMuted} />
      <Text variant="caption" style={{ color: active ? t.primary : t.textMuted }}>
        {count}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingVertical: 14, gap: 8 },
  head: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  verified: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 2, borderRadius: radius.pill },
  photo: { width: 68, height: 68, borderRadius: 12, borderWidth: 1 },
  helpful: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 2 },
  vote: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill, borderWidth: 1 },
});
