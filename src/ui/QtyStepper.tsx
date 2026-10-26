import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { tap } from './Button';
import { Glass } from './Glass';
import { Text } from './Text';
import { radius, usePalette } from './theme';

export function QtyStepper({
  value,
  min = 1,
  max = 99,
  onChange,
  small,
  disabled,
  removable,
}: {
  value: number;
  min?: number;
  max?: number;
  onChange: (v: number) => void;
  small?: boolean;
  disabled?: boolean;
  removable?: boolean; // at the minimum, "−" becomes a trash button that emits 0
}) {
  const t = usePalette();
  const size = small ? 30 : 38;
  const btn = (icon: 'remove' | 'add' | 'trash-outline', next: number, enabled: boolean, label: string) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={!enabled || disabled}
      hitSlop={6}
      onPress={() => (tap(), onChange(next))}
      style={[styles.btn, { width: size, height: size, opacity: enabled && !disabled ? 1 : 0.35 }]}>
      <Ionicons name={icon} size={small ? 15 : 18} color={icon === 'trash-outline' ? t.danger : t.text} />
    </Pressable>
  );
  return (
    <Glass radius={radius.pill} style={styles.wrap}>
      {removable && value <= min
        ? btn('trash-outline', 0, true, 'Remove')
        : btn('remove', value - 1, value > min, 'Decrease quantity')}
      <View style={{ minWidth: small ? 22 : 30, alignItems: 'center' }}>
        <Text variant="label">{value}</Text>
      </View>
      {btn('add', value + 1, value < max, 'Increase quantity')}
    </Glass>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', padding: 3 },
  btn: { alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill },
});
