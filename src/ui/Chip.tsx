import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet } from 'react-native';

import { tap } from './Button';
import { Glass } from './Glass';
import { Text } from './Text';
import { radius, usePalette } from './theme';

export function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress: () => void }) {
  const t = usePalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      onPress={() => (tap(), onPress())}>
      {active ? (
        <LinearGradient colors={t.primaryGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.chip}>
          <Text variant="label" tone="onPrimary" style={{ fontSize: 13 }}>
            {label}
          </Text>
        </LinearGradient>
      ) : (
        <Glass radius={radius.pill} style={styles.chip}>
          <Text variant="label" style={{ fontSize: 13 }}>
            {label}
          </Text>
        </Glass>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: { paddingHorizontal: 14, height: 36, justifyContent: 'center', borderRadius: radius.pill },
});
