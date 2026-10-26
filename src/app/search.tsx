import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { search, type SearchResult } from '@/core/api/catalog';
import { usePaged } from '@/core/hooks/useAsync';
import { IconButton, tap } from '@/ui/Button';
import { Chip } from '@/ui/Chip';
import { Glass } from '@/ui/Glass';
import { ProductGrid } from '@/ui/ProductGrid';
import { Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { radius, usePalette } from '@/ui/theme';

const RECENT_KEY = 'zb_recent_searches';
const canStore = Platform.OS !== 'web';

export default function SearchScreen() {
  const t = usePalette();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ q?: string }>();
  const [text, setText] = useState(params.q ?? '');
  const [submitted, setSubmitted] = useState(params.q ?? '');
  // Suggestions remember which query they answer, so stale ones are hidden
  // by comparison instead of being cleared in an effect.
  const [suggestion, setSuggestion] = useState<{ q: string; result: SearchResult } | null>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!canStore) return;
    SecureStore.getItemAsync(RECENT_KEY)
      .then((v) => v && setRecent(JSON.parse(v)))
      .catch(() => {});
  }, []);

  // Debounced autocomplete, like the website navbar (limit 8 + abort).
  const query = text.trim();
  useEffect(() => {
    if (query.length < 2 || query === submitted) return;
    const id = setTimeout(() => {
      abort.current?.abort();
      abort.current = new AbortController();
      search(query, 8, 0, abort.current.signal)
        .then((result) => setSuggestion({ q: query, result }))
        .catch(() => {});
    }, 250);
    return () => clearTimeout(id);
  }, [query, submitted]);

  const suggest = suggestion && suggestion.q === query && query !== submitted ? suggestion.result : null;

  const results = usePaged(
    async (page) => {
      if (!submitted) return { items: [], hasMore: false };
      const r = await search(submitted, 24, (page - 1) * 24);
      return { items: r.products, hasMore: r.nextAfter != null && r.products.length > 0 };
    },
    [submitted],
  );

  const submit = (q: string) => {
    const v = q.trim();
    if (!v) return;
    setText(v);
    setSubmitted(v);
    const next = [v, ...recent.filter((r) => r.toLowerCase() !== v.toLowerCase())].slice(0, 8);
    setRecent(next);
    if (canStore) SecureStore.setItemAsync(RECENT_KEY, JSON.stringify(next)).catch(() => {});
  };

  const clearRecent = () => {
    setRecent([]);
    if (canStore) SecureStore.deleteItemAsync(RECENT_KEY).catch(() => {});
  };

  return (
    <Screen>
      <View style={[styles.bar, { paddingTop: insets.top + 8 }]}>
        <IconButton icon="chevron-back" label="Back" onPress={() => router.back()} />
        <Glass radius={radius.md} style={styles.inputWrap}>
          <Ionicons name="search" size={18} color={t.textMuted} />
          <TextInput
            value={text}
            onChangeText={(v) => {
              setText(v);
              if (!v.trim()) setSubmitted('');
            }}
            onSubmitEditing={() => submit(text)}
            placeholder="Search products, brands…"
            placeholderTextColor={t.textFaint}
            selectionColor={t.primary}
            returnKeyType="search"
            autoFocus={!params.q}
            autoCorrect={false}
            style={[styles.input, { color: t.text }]}
          />
          {!!text && (
            <Pressable hitSlop={8} onPress={() => (setText(''), setSubmitted(''))} accessibilityLabel="Clear search">
              <Ionicons name="close-circle" size={18} color={t.textFaint} />
            </Pressable>
          )}
        </Glass>
      </View>

      {suggest ? (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 8 }}>
          <Glass radius={radius.lg} style={{ paddingVertical: 6 }}>
            {suggest.categories.map((c) => (
              <SuggestRow
                key={`c${c.id}`}
                icon="grid-outline"
                label={c.name}
                hint="Category"
                onPress={() =>
                  router.push({ pathname: '/shop/[domain]', params: { domain: c.domain_slug, subcategory: c.category_slug } })
                }
              />
            ))}
            {suggest.brands.slice(0, 4).map((b) => (
              <SuggestRow key={`b${b.id}`} icon="ribbon-outline" label={b.name} hint="Brand" onPress={() => submit(b.name)} />
            ))}
            {suggest.products.map((p) => (
              <SuggestRow
                key={`p${p.id}-${p.slug}`}
                image={p.image}
                label={p.name}
                onPress={() => router.push({ pathname: '/product/[slug]', params: { slug: p.slug } })}
              />
            ))}
            <SuggestRow icon="search" label={`See all results for "${text.trim()}"`} onPress={() => submit(text)} />
          </Glass>
        </ScrollView>
      ) : submitted ? (
        <ProductGrid
          {...results}
          onEndReached={results.loadMore}
          onRetry={results.reload}
          emptyTitle="No results"
          emptyMessage={`We couldn't find anything for "${submitted}".`}
          header={
            <Text variant="caption" tone="muted" style={{ paddingHorizontal: 6, paddingBottom: 6 }}>
              Results for “{submitted}”
            </Text>
          }
        />
      ) : (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 14 }}>
          {recent.length > 0 && (
            <>
              <View style={styles.row}>
                <Text variant="heading">Recent searches</Text>
                <Text variant="label" tone="primary" onPress={clearRecent} suppressHighlighting>
                  Clear
                </Text>
              </View>
              <View style={styles.wrap}>
                {recent.map((r) => (
                  <Chip key={r} label={r} onPress={() => submit(r)} />
                ))}
              </View>
            </>
          )}
          <Text variant="heading">Popular</Text>
          <View style={styles.wrap}>
            {['Earbuds', 'Smart watch', 'Face wash', 'Kurti', 'Atta', 'Mixer grinder', 'Protein'].map((r) => (
              <Chip key={r} label={r} onPress={() => submit(r)} />
            ))}
          </View>
        </ScrollView>
      )}
    </Screen>
  );
}

function SuggestRow({
  icon,
  image,
  label,
  hint,
  onPress,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  image?: string | null;
  label: string;
  hint?: string;
  onPress: () => void;
}) {
  const t = usePalette();
  return (
    <Pressable
      onPress={() => (tap(), onPress())}
      style={({ pressed }) => [styles.suggest, pressed && { backgroundColor: t.hairline }]}>
      {image !== undefined ? (
        <View style={styles.thumb}>
          {image ? <Image source={{ uri: image }} style={{ width: 34, height: 34 }} contentFit="contain" /> : null}
        </View>
      ) : (
        <Ionicons name={icon!} size={18} color={t.textMuted} style={{ width: 40, textAlign: 'center' }} />
      )}
      <Text numberOfLines={1} style={{ flex: 1 }}>
        {label}
      </Text>
      {hint && (
        <Text variant="caption" tone="faint">
          {hint}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 10 },
  inputWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, height: 48, paddingHorizontal: 14 },
  input: { flex: 1, fontSize: 16, height: '100%' },
  suggest: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 10 },
  thumb: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
