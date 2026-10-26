import { ActivityIndicator, FlatList, RefreshControl, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { listBlogs } from '@/core/api/blogs';
import { usePaged } from '@/core/hooks/useAsync';
import { BlogCard } from '@/ui/BlogCard';
import { EmptyState, ErrorState, Header, Screen } from '@/ui/Screen';
import { Skeleton } from '@/ui/Skeleton';
import { Text } from '@/ui/Text';
import { radius, usePalette } from '@/ui/theme';

// Website: /blogs.
export default function BlogsScreen() {
  const t = usePalette();
  const insets = useSafeAreaInsets();
  const list = usePaged((page) => listBlogs(page), []);

  return (
    <Screen>
      <Header title="ZillyBuy blog" />
      <FlatList
        data={list.items}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => <BlogCard post={item} />}
        contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: insets.bottom + 24, flexGrow: 1 }}
        onEndReached={list.loadMore}
        onEndReachedThreshold={0.6}
        refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={list.refresh} tintColor={t.primary} />}
        ListHeaderComponent={
          <View style={{ gap: 4, marginBottom: 2 }}>
            <Text variant="title">Guides & stories</Text>
            <Text tone="muted">Shopping guides, ONDC explained, and tips from the ZillyBuy team.</Text>
          </View>
        }
        ListEmptyComponent={
          list.loading ? (
            <View style={{ gap: 14 }}>
              {[0, 1].map((i) => (
                <Skeleton key={i} height={280} r={radius.lg} />
              ))}
            </View>
          ) : list.error ? (
            <ErrorState message={list.error} onRetry={list.reload} />
          ) : (
            <EmptyState icon="newspaper-outline" title="No posts yet" />
          )
        }
        ListFooterComponent={list.loadingMore ? <ActivityIndicator style={{ margin: 20 }} color={t.primary} /> : null}
      />
    </Screen>
  );
}
