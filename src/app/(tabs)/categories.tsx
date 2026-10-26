import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { absUrl, DOMAIN_META, domainName, getDomains } from '@/core/api/catalog';
import { useAsync } from '@/core/hooks/useAsync';
import { tap } from '@/ui/Button';
import { Glass } from '@/ui/Glass';
import { Screen } from '@/ui/Screen';
import { Skeleton } from '@/ui/Skeleton';
import { Text } from '@/ui/Text';
import { radius, TAB_BAR_HEIGHT, usePalette } from '@/ui/theme';

export default function CategoriesScreen() {
  const t = usePalette();
  const insets = useSafeAreaInsets();
  const domains = useAsync(getDomains, []);

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: 16, paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 32, gap: 12 }}
        refreshControl={<RefreshControl refreshing={domains.refreshing} onRefresh={domains.refresh} tintColor={t.primary} />}>
        <Text variant="display">Categories</Text>
        <Text tone="muted" style={{ marginBottom: 8 }}>
          Browse everything sold by sellers on ZillyBuy.
        </Text>

        {domains.loading &&
          Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} height={96} r={radius.lg} />)}

        {domains.data?.map((d) => {
          const meta = DOMAIN_META[d.slug];
          return (
            <Pressable
              key={d.slug}
              onPress={() => (tap(), router.push({ pathname: '/shop/[domain]', params: { domain: d.slug } }))}
              style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.98 : 1 }] })}>
              <Glass radius={radius.lg} style={styles.row}>
                <View style={[styles.thumb, { backgroundColor: t.inputFill }]}>
                  {meta ? (
                    <Image source={{ uri: absUrl(meta.image)! }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
                  ) : (
                    <Ionicons name="pricetags-outline" size={28} color={t.primary} />
                  )}
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text variant="heading">{domainName(d)}</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name={(meta?.icon as any) ?? 'pricetag-outline'} size={14} color={t.textMuted} />
                    <Text variant="caption" tone="muted">
                      Explore {domainName(d).toLowerCase()}
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={20} color={t.textFaint} />
              </Glass>
            </Pressable>
          );
        })}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 12 },
  thumb: { width: 72, height: 72, borderRadius: radius.md, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
});
