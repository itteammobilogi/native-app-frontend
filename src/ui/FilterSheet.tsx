import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';

import { activeFilterCount, PRICE_PRESETS, priceLabel, type Filters, type Option } from '@/core/filters';
import { Button, tap } from './Button';
import { Chip } from './Chip';
import { Glass } from './Glass';
import { Input } from './Input';
import { Sheet } from './Sheet';
import { Text } from './Text';
import { radius, usePalette } from './theme';

type Toggle = 'inStock' | 'onSale';

const TOGGLE_LABELS: Record<Toggle, string> = { inStock: 'In stock only', onSale: 'On sale' };

type Props = {
  visible: boolean;
  onClose: () => void;
  value: Filters;
  onApply: (f: Filters) => void;
  sorts: Option[];
  categories?: Option[];
  toggles?: Toggle[];
};

const toNum = (s: string) => {
  const n = Number(s.replace(/[^\d.]/g, ''));
  return s.trim() && Number.isFinite(n) ? n : undefined;
};

// Filter drawer: edits a draft and only commits on "Apply".
export function FilterSheet({ visible, onClose, value, onApply, sorts, categories, toggles = ['inStock'] }: Props) {
  const [draft, setDraft] = useState(value);
  const [minText, setMinText] = useState('');
  const [maxText, setMaxText] = useState('');
  const [wasVisible, setWasVisible] = useState(visible);

  // Reset the draft from the applied filters each time the drawer opens.
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setDraft(value);
      setMinText(value.min != null ? String(value.min) : '');
      setMaxText(value.max != null ? String(value.max) : '');
    }
  }

  const set = (patch: Partial<Filters>) => setDraft((d) => ({ ...d, ...patch }));
  const setPrice = (min?: number, max?: number) => {
    set({ min, max });
    setMinText(min != null ? String(min) : '');
    setMaxText(max != null ? String(max) : '');
  };

  const apply = () => {
    let { min, max } = draft;
    if (min != null && max != null && min > max) [min, max] = [max, min];
    onApply({ ...draft, min, max });
    onClose();
  };

  const clear = () => {
    setDraft({ sort: sorts[0].value });
    setMinText('');
    setMaxText('');
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Filter & sort">
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 22, paddingBottom: 8 }}>
        <Section title="Sort by">
          <View style={styles.wrap}>
            {sorts.map((s) => (
              <Chip key={s.value} label={s.label} active={draft.sort === s.value} onPress={() => set({ sort: s.value })} />
            ))}
          </View>
        </Section>

        {!!categories?.length && (
          <Section title="Category">
            <View style={styles.wrap}>
              <Chip label="All" active={!draft.category} onPress={() => set({ category: undefined })} />
              {categories.map((c) => (
                <Chip key={c.value} label={c.label} active={draft.category === c.value} onPress={() => set({ category: c.value })} />
              ))}
            </View>
          </Section>
        )}

        <Section title="Price">
          <View style={styles.wrap}>
            {PRICE_PRESETS.map((p) => {
              const active = draft.min === p.min && draft.max === p.max;
              return <Chip key={p.label} label={p.label} active={active} onPress={() => (active ? setPrice() : setPrice(p.min, p.max))} />;
            })}
          </View>
          <View style={styles.range}>
            <View style={{ flex: 1 }}>
              <Input
                prefix="₹"
                placeholder="Min"
                keyboardType="number-pad"
                value={minText}
                onChangeText={(s) => (setMinText(s), set({ min: toNum(s) }))}
              />
            </View>
            <Text tone="muted">to</Text>
            <View style={{ flex: 1 }}>
              <Input
                prefix="₹"
                placeholder="Max"
                keyboardType="number-pad"
                value={maxText}
                onChangeText={(s) => (setMaxText(s), set({ max: toNum(s) }))}
              />
            </View>
          </View>
        </Section>

        {!!toggles.length && (
          <Section title="Availability">
            {toggles.map((k) => (
              <ToggleRow key={k} label={TOGGLE_LABELS[k]} value={!!draft[k]} onChange={(v) => set({ [k]: v || undefined })} />
            ))}
          </Section>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Button title="Clear all" variant="glass" onPress={clear} style={{ flex: 1 }} />
        <Button title="Apply" onPress={apply} style={{ flex: 1.4 }} />
      </View>
    </Sheet>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 10 }}>
      <Text variant="label" tone="muted">
        {title}
      </Text>
      {children}
    </View>
  );
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  const t = usePalette();
  return (
    <Pressable onPress={() => (tap(), onChange(!value))} style={styles.toggle} accessibilityRole="switch" accessibilityState={{ checked: value }}>
      <Text variant="label" style={{ flex: 1, fontSize: 15 }}>
        {label}
      </Text>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: t.primary }} />
    </Pressable>
  );
}

// Row above a product grid: "Filters" button with a count badge, removable
// chips for what's applied, and an optional item count.
export function FilterBar({
  value,
  onChange,
  onOpen,
  sorts,
  categories,
  count,
}: {
  value: Filters;
  onChange: (f: Filters) => void;
  onOpen: () => void;
  sorts: Option[];
  categories?: Option[];
  count?: string | null;
}) {
  const t = usePalette();
  const n = activeFilterCount(value);
  const price = priceLabel(value.min, value.max);
  const sortLabel = sorts.find((s) => s.value === value.sort)?.label;
  const category = categories?.find((c) => c.value === value.category)?.label;

  const applied: { key: string; label: string; clear: Partial<Filters> }[] = [
    ...(category ? [{ key: 'cat', label: category, clear: { category: undefined } }] : []),
    ...(price ? [{ key: 'price', label: price, clear: { min: undefined, max: undefined } }] : []),
    ...(value.inStock ? [{ key: 'stock', label: 'In stock', clear: { inStock: undefined } }] : []),
    ...(value.onSale ? [{ key: 'sale', label: 'On sale', clear: { onSale: undefined } }] : []),
  ];

  return (
    <View style={{ gap: 8 }}>
      <View style={styles.bar}>
        <Pressable onPress={() => (tap(), onOpen())} accessibilityRole="button" accessibilityLabel="Open filters">
          <Glass radius={radius.pill} style={styles.filterBtn}>
            <Ionicons name="options-outline" size={16} color={t.primary} />
            <Text variant="label" style={{ fontSize: 13 }}>
              Filters
            </Text>
            {n > 0 && (
              <View style={[styles.badge, { backgroundColor: t.primary }]}>
                <Text variant="tiny" tone="onPrimary">
                  {n}
                </Text>
              </View>
            )}
          </Glass>
        </Pressable>
        {!!sortLabel && <Chip label={`Sort: ${sortLabel}`} onPress={onOpen} />}
        <View style={{ flex: 1 }} />
        {!!count && (
          <Text variant="caption" tone="muted">
            {count}
          </Text>
        )}
      </View>
      {!!applied.length && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {applied.map((a) => (
            <Pressable
              key={a.key}
              onPress={() => (tap(), onChange({ ...value, ...a.clear }))}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${a.label}`}>
              <View style={[styles.applied, { borderColor: t.primary }]}>
                <Text variant="caption" tone="primary">
                  {a.label}
                </Text>
                <Ionicons name="close" size={14} color={t.primary} />
              </View>
            </Pressable>
          ))}
          <Pressable onPress={() => (tap(), onChange({ sort: value.sort }))} accessibilityRole="button">
            <View style={styles.applied}>
              <Text variant="caption" tone="muted">
                Clear all
              </Text>
            </View>
          </Pressable>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  range: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  toggle: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  footer: { flexDirection: 'row', gap: 10, paddingTop: 14 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  filterBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, height: 36 },
  badge: { minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center' },
  applied: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    height: 30,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: 'transparent',
  },
});
