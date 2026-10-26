import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { comboPricing, listCombos, type Combo } from '@/core/api/combos';
import { useAsync } from '@/core/hooks/useAsync';
import { formatINR } from '@/core/pricing';
import { tap } from '@/ui/Button';
import { Glass } from '@/ui/Glass';
import { EmptyState, ErrorState, Header, Screen } from '@/ui/Screen';
import { Skeleton } from '@/ui/Skeleton';
import { Text } from '@/ui/Text';
import { radius, usePalette } from '@/ui/theme';

// Website: /zillycart ("Zilly Kart Combos").
export default function CombosScreen() {
  const t = usePalette();
  const insets = useSafeAreaInsets();
  const combos = useAsync(listCombos, []);

  return (
    <Screen>
      <Header title="ZillyCart combos" />
      {combos.loading ? (
        <View style={{ padding: 16, gap: 14 }}>
          {[0, 1].map((i) => (
            <Skeleton key={i} height={260} r={radius.lg} />
          ))}
        </View>
      ) : combos.error ? (
        <ErrorState message={combos.error} onRetry={combos.reload} />
      ) : (
        <FlatList
          data={combos.data ?? []}
          keyExtractor={(c) => String(c.zc_id)}
          contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: insets.bottom + 24, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={combos.refreshing} onRefresh={combos.refresh} tintColor={t.primary} />}
          ListHeaderComponent={
            <View style={{ gap: 4, marginBottom: 2 }}>
              <Text variant="title">Premium bundles</Text>
              <Text tone="muted">Curated product combos with better value. Pick the items you want and add them in one go.</Text>
            </View>
          }
          ListEmptyComponent={<EmptyState icon="gift-outline" title="No combos right now" message="Check back soon for new bundles." />}
          renderItem={({ item }) => <ComboCard combo={item} />}
        />
      )}
    </Screen>
  );
}

function ComboCard({ combo }: { combo: Combo }) {
  const t = usePalette();
  const { actual, price, discount } = comboPricing(combo);
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => (tap(), router.push({ pathname: '/combo/[slug]', params: { slug: combo.zc_slug } }))}
      style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.98 : 1 }] })}>
      <Glass radius={radius.lg} style={{ overflow: 'hidden' }}>
        <View style={styles.imageWrap}>
          {combo.zc_image ? <Image source={{ uri: combo.zc_image }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} /> : null}
          <LinearGradient colors={['transparent', 'rgba(5,11,26,0.75)']} style={StyleSheet.absoluteFill} />
          <View style={[styles.tag, { backgroundColor: t.accent }]}>
            <Text variant="tiny" tone="onPrimary" style={{ textTransform: 'uppercase', letterSpacing: 0.6 }}>
              {combo.zc_type || 'Combo'}
            </Text>
          </View>
          <Text variant="heading" tone="onPrimary" numberOfLines={2} style={styles.name}>
            {combo.zc_name}
          </Text>
        </View>
        <View style={{ padding: 14, gap: 8 }}>
          {!!combo.zc_description && (
            <Text variant="caption" tone="muted" numberOfLines={2}>
              {combo.zc_description}
            </Text>
          )}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            {price > 0 ? (
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
                <Text variant="heading">{formatINR(price)}</Text>
                {actual > price && (
                  <Text variant="caption" tone="faint" style={{ textDecorationLine: 'line-through' }}>
                    {formatINR(actual)}
                  </Text>
                )}
                {discount > 0 && (
                  <Text variant="caption" tone="success">
                    {discount}% off
                  </Text>
                )}
              </View>
            ) : (
              <Text variant="label" tone="muted">
                Pick your items
              </Text>
            )}
            <Text variant="label" tone="primary">
              View combo →
            </Text>
          </View>
        </View>
      </Glass>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  imageWrap: { aspectRatio: 16 / 10, backgroundColor: '#0B1230', justifyContent: 'flex-end' },
  tag: { position: 'absolute', top: 12, left: 12, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  name: { padding: 14 },
});
