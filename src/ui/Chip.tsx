import { Pressable, StyleSheet } from 'react-native';

import { tap } from './Button';
import { Text } from './Text';
import { radius, usePalette } from './theme';

// Filter / suggestion pill. Selected: dark fill (white in dark mode), as the
// home shelf chips.
export function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress: () => void }) {
  const t = usePalette();
  const on = t.dark ? '#FFFFFF' : '#0B1B33';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      onPress={() => (tap(), onPress())}
      style={[
        styles.chip,
        active ? { backgroundColor: on, borderColor: on } : { backgroundColor: t.glassFill, borderColor: t.glassBorder },
      ]}>
      <Text variant="caption" style={{ fontWeight: '700', fontSize: 13, color: active ? (t.dark ? '#0B1B33' : '#FFFFFF') : t.text }}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: { paddingHorizontal: 14, height: 36, justifyContent: 'center', borderRadius: radius.pill, borderWidth: 1 },
});
