import { router, useLocalSearchParams } from 'expo-router';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getPolicy, POLICIES, type PolicyBlock, type PolicySlug } from '@/core/api/support';
import { useAsync } from '@/core/hooks/useAsync';
import { Button } from '@/ui/Button';
import { Glass } from '@/ui/Glass';
import { EmptyState, ErrorState, Header, Screen } from '@/ui/Screen';
import { Skeleton } from '@/ui/Skeleton';
import { Text } from '@/ui/Text';
import { radius, usePalette } from '@/ui/theme';

// Terms, privacy, returns, refunds and shipping, rendered natively from the
// website's page text so the two never drift apart.
export default function PolicyScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const insets = useSafeAreaInsets();
  const t = usePalette();
  const known = slug in POLICIES;
  const title = known ? POLICIES[slug as PolicySlug] : 'Policy';
  const doc = useAsync(() => (known ? getPolicy(slug as PolicySlug) : Promise.resolve([])), [slug]);

  if (!known) {
    return (
      <Screen>
        <Header title={title} />
        <EmptyState icon="document-text-outline" title="Page not found" action="Go to Help & support" onAction={() => router.replace('/support')} />
      </Screen>
    );
  }

  // The page's own <h1> repeats the header title; the line under it is
  // usually "Last updated …", shown as a caption.
  const blocks = (doc.data ?? []).filter((b) => b.type !== 'title');
  const updated = blocks[0]?.type === 'p' && /^last updated/i.test(blocks[0].text) ? blocks.shift()!.text : null;

  return (
    <Screen>
      <Header title={title} />
      {doc.error && !doc.data ? (
        <ErrorState message={doc.error} onRetry={doc.reload} />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 32, gap: 16 }}
          refreshControl={<RefreshControl refreshing={doc.refreshing} onRefresh={doc.refresh} tintColor={t.primary} />}>
          <Glass radius={radius.xl} style={{ padding: 18 }}>
            <Text variant="title">{title}</Text>
            {!!updated && (
              <Text variant="caption" tone="muted" style={{ marginTop: 4 }}>
                {updated}
              </Text>
            )}
            <View style={{ marginTop: 14, gap: 10 }}>
              {doc.loading ? <BodySkeleton /> : blocks.map((b, i) => <Block key={i} block={b} />)}
            </View>
          </Glass>

          <Glass radius={radius.lg} style={{ padding: 16, gap: 10 }}>
            <Text variant="label">Questions about this policy?</Text>
            <Button title="Contact support" variant="glass" size="md" icon="headset-outline" onPress={() => router.push('/support')} />
          </Glass>
        </ScrollView>
      )}
    </Screen>
  );
}

function Block({ block }: { block: PolicyBlock }) {
  const t = usePalette();
  switch (block.type) {
    case 'h2':
      return (
        <Text variant="heading" style={{ marginTop: 10 }}>
          {block.text}
        </Text>
      );
    case 'h3':
      return (
        <Text variant="label" style={{ marginTop: 6, fontSize: 15 }}>
          {block.text}
        </Text>
      );
    case 'li':
      return (
        <View style={styles.li}>
          <View style={[styles.bullet, { backgroundColor: t.primary }]} />
          <Text style={[styles.body, { flex: 1, color: t.textMuted }]}>{block.text}</Text>
        </View>
      );
    default:
      return <Text style={[styles.body, { color: t.textMuted }]}>{block.text}</Text>;
  }
}

function BodySkeleton() {
  return (
    <>
      {Array.from({ length: 4 }).map((_, i) => (
        <View key={i} style={{ gap: 8, marginBottom: 10 }}>
          <Skeleton width="55%" height={16} />
          <Skeleton height={11} />
          <Skeleton height={11} />
          <Skeleton width="80%" height={11} />
        </View>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  body: { fontSize: 14, lineHeight: 21 },
  li: { flexDirection: 'row', gap: 10, paddingLeft: 2 },
  bullet: { width: 6, height: 6, borderRadius: 3, marginTop: 8 },
});
