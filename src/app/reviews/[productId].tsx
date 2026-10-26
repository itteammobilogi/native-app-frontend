import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getProductReviews, type ReviewSort, type ReviewSummary } from '@/core/api/reviews';
import { usePaged } from '@/core/hooks/useAsync';
import { useReviewVotes } from '@/core/hooks/useReviewVotes';
import { Chip } from '@/ui/Chip';
import { Glass } from '@/ui/Glass';
import { ReviewCard } from '@/ui/reviews/ReviewCard';
import { RatingSummary } from '@/ui/reviews/ReviewsSection';
import { EmptyState, ErrorState, Header, Screen } from '@/ui/Screen';
import { Skeleton } from '@/ui/Skeleton';
import { Text } from '@/ui/Text';
import { radius, usePalette } from '@/ui/theme';

const SORTS: { value: ReviewSort; label: string }[] = [
  { value: 'recent', label: 'Most recent' },
  { value: 'helpful', label: 'Most helpful' },
  { value: 'highest', label: 'Highest rated' },
  { value: 'lowest', label: 'Lowest rated' },
];

// All reviews (website: the "See all reviews" panel with sort + pages; the app
// uses infinite scroll instead of page buttons).
export default function AllReviewsScreen() {
  const { productId, name } = useLocalSearchParams<{ productId: string; name?: string }>();
  const t = usePalette();
  const insets = useSafeAreaInsets();
  const votes = useReviewVotes();
  const [sort, setSort] = useState<ReviewSort>('recent');
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const [total, setTotal] = useState(0);

  const list = usePaged(async (page) => {
    const res = await getProductReviews(Number(productId), { page, limit: 10, sort });
    if (page === 1) {
      setSummary(res.summary);
      setTotal(res.pagination.total);
    }
    return { items: res.reviews, hasMore: page < res.pagination.total_pages };
  }, [productId, sort]);

  return (
    <Screen>
      <Header title="Reviews" />
      <FlatList
        data={list.items}
        keyExtractor={(r) => String(r.id)}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24, gap: 12, flexGrow: 1 }}
        onEndReached={list.loadMore}
        onEndReachedThreshold={0.5}
        refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={list.refresh} tintColor={t.primary} />}
        ListHeaderComponent={
          <View style={{ gap: 12 }}>
            {!!name && (
              <Text variant="caption" tone="muted" numberOfLines={2}>
                {name}
              </Text>
            )}
            {summary && Number(summary.total_ratings) > 0 && (
              <Glass radius={radius.lg} style={{ padding: 16 }}>
                <RatingSummary summary={summary} />
              </Glass>
            )}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {SORTS.map((s) => (
                <Chip key={s.value} label={s.label} active={sort === s.value} onPress={() => setSort(s.value)} />
              ))}
            </ScrollView>
            {!list.loading && total > 0 && (
              <Text variant="label">All reviews ({total.toLocaleString('en-IN')})</Text>
            )}
          </View>
        }
        renderItem={({ item }) => {
          const review = votes.apply(item);
          return (
            <Glass radius={radius.lg} style={{ paddingHorizontal: 14 }}>
              <ReviewCard review={review} divider={false} voting={votes.busy === item.id} onVote={(v) => votes.vote(review, v)} />
            </Glass>
          );
        }}
        ListEmptyComponent={
          list.loading ? (
            <View style={{ gap: 12 }}>
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} height={130} r={radius.lg} />
              ))}
            </View>
          ) : list.error ? (
            <ErrorState message={list.error} onRetry={list.reload} />
          ) : (
            <EmptyState icon="chatbubbles-outline" title="No reviews yet" message="Be the first to review this product." />
          )
        }
        ListFooterComponent={list.loadingMore ? <ActivityIndicator color={t.primary} style={{ margin: 16 }} /> : null}
      />
    </Screen>
  );
}
