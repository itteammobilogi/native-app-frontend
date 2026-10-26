import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { FlatList, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { authorPhoto, getAuthorPosts } from '@/core/api/blogs';
import { useAsync } from '@/core/hooks/useAsync';
import { BlogCard } from '@/ui/BlogCard';
import { Glass } from '@/ui/Glass';
import { EmptyState, ErrorState, Header, Screen } from '@/ui/Screen';
import { Skeleton } from '@/ui/Skeleton';
import { Text } from '@/ui/Text';
import { radius, usePalette } from '@/ui/theme';

// Website: /authors/[slug]. Author details come from their posts, since the
// posts carry the author fields.
export default function BlogAuthorScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const t = usePalette();
  const insets = useSafeAreaInsets();
  const posts = useAsync(() => getAuthorPosts(slug), [slug]);
  const a = posts.data?.[0];
  const photo = authorPhoto(a?.author_profile_photo);

  return (
    <Screen>
      <Header title={a?.author_name ?? 'Author'} />
      {posts.loading ? (
        <View style={{ padding: 16, gap: 12 }}>
          <Skeleton height={120} r={radius.lg} />
          <Skeleton height={80} r={radius.lg} />
          <Skeleton height={80} r={radius.lg} />
        </View>
      ) : posts.error ? (
        <ErrorState message={posts.error} onRetry={posts.reload} />
      ) : (
        <FlatList
          data={posts.data ?? []}
          keyExtractor={(p) => p.id}
          renderItem={({ item }) => <BlogCard post={item} compact />}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: insets.bottom + 24, flexGrow: 1 }}
          ListHeaderComponent={
            a ? (
              <Glass radius={radius.lg} style={styles.card}>
                {photo ? (
                  <Image source={{ uri: photo }} style={styles.avatar} contentFit="cover" />
                ) : (
                  <View style={[styles.avatar, { backgroundColor: t.primary, alignItems: 'center', justifyContent: 'center' }]}>
                    <Text variant="title" tone="onPrimary">
                      {a.author_name?.slice(0, 1)}
                    </Text>
                  </View>
                )}
                <Text variant="title" style={{ textAlign: 'center' }}>
                  {a.author_name}
                </Text>
                {!!a.author_bio && (
                  <Text tone="muted" style={{ textAlign: 'center' }}>
                    {a.author_bio}
                  </Text>
                )}
                <Text variant="caption" tone="faint">
                  {posts.data!.length} {posts.data!.length === 1 ? 'post' : 'posts'}
                </Text>
              </Glass>
            ) : null
          }
          ListEmptyComponent={<EmptyState icon="person-outline" title="No posts from this author" />}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { padding: 20, gap: 8, alignItems: 'center', marginBottom: 6 },
  avatar: { width: 84, height: 84, borderRadius: 42 },
});
