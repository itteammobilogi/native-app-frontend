import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { blogAsset, blogDate, type BlogPost } from '@/core/api/blogs';

import { tap } from './Button';
import { Glass } from './Glass';
import { Text } from './Text';
import { radius } from './theme';

// Blog post card for /blogs and author pages. `compact` is the image-left row.
export function BlogCard({ post, compact }: { post: BlogPost; compact?: boolean }) {
  const image = blogAsset(post.featured_image);
  const open = () => (tap(), router.push({ pathname: '/blog/[slug]', params: { slug: post.slug } }));
  const meta = [post.category_name, blogDate(post)].filter(Boolean).join(' · ');

  if (compact) {
    return (
      <Pressable onPress={open} accessibilityRole="button" style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}>
        <Glass radius={radius.lg} style={styles.row}>
          <View style={styles.thumb}>{image ? <Image source={{ uri: image }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}</View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text variant="label" numberOfLines={3}>
              {post.title}
            </Text>
            {!!meta && (
              <Text variant="tiny" tone="faint">
                {meta}
              </Text>
            )}
          </View>
        </Glass>
      </Pressable>
    );
  }

  return (
    <Pressable onPress={open} accessibilityRole="button" style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.98 : 1 }] })}>
      <Glass radius={radius.lg} style={{ overflow: 'hidden' }}>
        <View style={styles.hero}>
          {image ? (
            <Image source={{ uri: image }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} accessibilityLabel={post.featured_image_alt ?? undefined} />
          ) : null}
        </View>
        <View style={{ padding: 14, gap: 6 }}>
          {!!meta && (
            <Text variant="tiny" tone="primary" style={{ textTransform: 'uppercase', letterSpacing: 0.6 }}>
              {meta}
            </Text>
          )}
          <Text variant="heading" numberOfLines={2}>
            {post.title}
          </Text>
          {!!(post.short_description || post.meta_description) && (
            <Text variant="caption" tone="muted" numberOfLines={2}>
              {post.short_description || post.meta_description}
            </Text>
          )}
          {!!post.author_name && (
            <Text variant="caption" tone="faint">
              By {post.author_name}
            </Text>
          )}
        </View>
      </Glass>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hero: { aspectRatio: 16 / 9, backgroundColor: '#E8EEF8' },
  row: { flexDirection: 'row', gap: 12, padding: 10, alignItems: 'center' },
  thumb: { width: 84, height: 64, borderRadius: radius.sm, overflow: 'hidden', backgroundColor: '#E8EEF8' },
});
