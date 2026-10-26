import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { getMyReview, getProductReviews, reviewImageUrl, type ReviewsPage, type ReviewSummary } from '@/core/api/reviews';
import { useAuth } from '@/core/auth/AuthContext';
import { useAsync } from '@/core/hooks/useAsync';
import { useReviewVotes } from '@/core/hooks/useReviewVotes';
import { Button, tap } from '@/ui/Button';
import { Glass } from '@/ui/Glass';
import { Skeleton } from '@/ui/Skeleton';
import { Text } from '@/ui/Text';
import { radius, usePalette } from '@/ui/theme';
import { useToast } from '@/ui/Toast';
import { ImageViewer } from './ImageViewer';
import { ReviewCard } from './ReviewCard';
import { StarRating } from './StarRating';
import { WriteReviewSheet } from './WriteReviewSheet';

const GALLERY_LIMIT = 24;

// Mirrors the website's components/reviews/ReviewsSection: summary +
// histogram, write/edit, moderation banner, "Customers say", photo strip,
// top reviews and a link to all reviews.
export function ReviewsSection({
  productId,
  productName,
  top,
  loading,
  onChanged,
}: {
  productId: number;
  productName: string;
  top?: ReviewsPage; // first page sorted by "helpful" (loaded by the product screen)
  loading: boolean;
  onChanged?: () => void;
}) {
  const t = usePalette();
  const toast = useToast();
  const { user, isLoggedIn } = useAuth();
  const votes = useReviewVotes();
  const [writeOpen, setWriteOpen] = useState(false);
  const [viewer, setViewer] = useState<number | null>(null);

  const gallery = useAsync(() => getProductReviews(productId, { limit: GALLERY_LIMIT, sort: 'recent' }), [productId]);
  const mine = useAsync(() => (isLoggedIn ? getMyReview(productId) : Promise.resolve(null)), [productId, user?.id]);

  const summary = top?.summary;
  const hasRatings = Number(summary?.total_ratings) > 0;
  const total = Number(top?.pagination.total ?? 0);
  const topReviews = top?.reviews ?? [];
  const photos = (gallery.data?.reviews ?? []).flatMap((r) => r.images.map(reviewImageUrl)).filter(Boolean);
  const myReview = mine.data ?? null;

  const openWrite = () => {
    if (!isLoggedIn) {
      toast('Please log in to write a review.', 'info');
      router.push('/login');
      return;
    }
    setWriteOpen(true);
  };

  const banner = myReview && myReview.status !== 'approved' && (
    <View style={[styles.banner, { backgroundColor: myReview.status === 'rejected' ? `${t.danger}14` : `${t.warning}1A` }]}>
      <Ionicons
        name={myReview.status === 'rejected' ? 'close-circle' : 'time-outline'}
        size={18}
        color={myReview.status === 'rejected' ? t.danger : t.warning}
      />
      <View style={{ flex: 1 }}>
        <Text variant="label" style={{ color: myReview.status === 'rejected' ? t.danger : t.warning }}>
          {myReview.status === 'rejected' ? 'Your review was not approved.' : 'Your review is pending approval.'}
        </Text>
        {myReview.status === 'rejected' && !!myReview.admin_note && (
          <Text variant="caption" tone="muted">
            {myReview.admin_note}
          </Text>
        )}
      </View>
    </View>
  );

  return (
    <Glass radius={radius.lg} style={{ padding: 16, gap: 14 }}>
      <Text variant="heading">Customer reviews</Text>
      {banner}

      {loading ? (
        <View style={{ gap: 10 }}>
          <Skeleton width={120} height={34} />
          <Skeleton height={80} />
        </View>
      ) : !hasRatings ? (
        <View style={{ gap: 12 }}>
          <Text tone="muted">No reviews yet. Be the first to review this product!</Text>
        </View>
      ) : (
        <RatingSummary summary={summary!} />
      )}

      <Button title={myReview ? 'Edit your review' : 'Write a review'} icon="create-outline" variant="glass" size="md" onPress={openWrite} />

      {/* Customers say (rendered only when the API sends tags / a summary) */}
      {(!!summary?.summary_text || !!summary?.tags?.length) && <CustomersSay summary={summary} />}

      {photos.length > 0 && (
        <View style={{ gap: 10 }}>
          <Text variant="label">
            Reviews with images{summary?.reviews_with_images ? ` (${summary.reviews_with_images})` : ''}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {photos.map((u, i) => (
              <Pressable key={`${u}-${i}`} onPress={() => (tap(), setViewer(i))} accessibilityLabel={`Customer photo ${i + 1}`}>
                <Image source={{ uri: u }} style={[styles.photo, { borderColor: t.glassBorder }]} contentFit="cover" transition={150} />
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {topReviews.length > 0 && (
        <View>
          <View style={styles.between}>
            <Text variant="label">Top reviews</Text>
            {total > topReviews.length && (
              <Text
                variant="label"
                tone="primary"
                suppressHighlighting
                onPress={() => router.push({ pathname: '/reviews/[productId]', params: { productId: String(productId), name: productName } })}>
                See all {total} reviews
              </Text>
            )}
          </View>
          {topReviews.map((r, i) => {
            const review = votes.apply(r);
            return <ReviewCard key={r.id} review={review} divider={i > 0} voting={votes.busy === r.id} onVote={(v) => votes.vote(review, v)} />;
          })}
        </View>
      )}

      <ImageViewer images={photos} index={viewer} onClose={() => setViewer(null)} />
      <WriteReviewSheet
        visible={writeOpen}
        onClose={() => setWriteOpen(false)}
        productId={productId}
        existing={myReview}
        onSubmitted={() => {
          mine.reload();
          onChanged?.();
        }}
      />
    </Glass>
  );
}

// Average + stars + 5→1 histogram (website: ReviewSummary.js).
export function RatingSummary({ summary }: { summary: ReviewSummary }) {
  const t = usePalette();
  const average = Number(summary.average_rating) || 0;
  const total = Number(summary.total_ratings) || 0;
  const pct = summary.histogram_percent ?? {};

  return (
    <View style={styles.summary}>
      <View style={{ alignItems: 'center', gap: 4, minWidth: 96 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 3 }}>
          <Text variant="display" style={{ fontSize: 38 }}>
            {average.toFixed(1)}
          </Text>
          <Text variant="caption" tone="muted">
            / 5
          </Text>
        </View>
        <StarRating rating={average} size={15} />
        <Text variant="tiny" tone="faint" style={{ textAlign: 'center' }}>
          {total.toLocaleString('en-IN')} rating{total === 1 ? '' : 's'}
        </Text>
      </View>
      <View style={{ flex: 1, gap: 6 }}>
        {[5, 4, 3, 2, 1].map((star) => {
          const p = Number(pct[star]) || 0;
          return (
            <View key={star} style={styles.barRow}>
              <Text variant="caption" tone="primary" style={{ width: 22 }}>
                {star}★
              </Text>
              <View style={[styles.track, { backgroundColor: t.hairline }]}>
                <View style={[styles.bar, { width: `${p}%` }]} />
              </View>
              <Text variant="tiny" tone="muted" style={{ width: 32, textAlign: 'right' }}>
                {p}%
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function CustomersSay({ summary }: { summary: ReviewSummary }) {
  const t = usePalette();
  const [expanded, setExpanded] = useState(false);
  const tags = summary.tags ?? [];
  const visible = expanded ? tags : tags.slice(0, 5);
  return (
    <View style={{ gap: 8 }}>
      <Text variant="label">Customers say</Text>
      {!!summary.summary_text && <Text tone="muted">{summary.summary_text}</Text>}
      {tags.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {visible.map((tag, i) => (
            <View key={`${tag.name}-${i}`} style={[styles.tag, { backgroundColor: t.inputFill, borderColor: t.glassBorder }]}>
              <Text variant="caption">
                {tag.name}
                {tag.count != null && <Text variant="caption" tone="faint">{` (${tag.count})`}</Text>}
              </Text>
            </View>
          ))}
          {tags.length > 5 && (
            <Pressable
              onPress={() => (tap(), setExpanded((v) => !v))}
              accessibilityLabel={expanded ? 'Show fewer tags' : 'Show more tags'}
              style={[styles.tag, { borderColor: t.hairline }]}>
              <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color={t.textMuted} />
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: radius.sm },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  track: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' },
  bar: { height: '100%', borderRadius: 4, backgroundColor: '#F5A524' },
  photo: { width: 80, height: 80, borderRadius: 14, borderWidth: 1 },
  tag: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill, borderWidth: 1, justifyContent: 'center' },
});
