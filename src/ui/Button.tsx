import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { Glass } from './Glass';
import { Text } from './Text';
import { radius, usePalette } from './theme';

type Props = {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'glass' | 'ghost' | 'danger';
  icon?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  disabled?: boolean;
  size?: 'md' | 'lg';
  style?: StyleProp<ViewStyle>;
};

export const tap = () => {
  if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
};

export function Button({
  title,
  onPress,
  variant = 'primary',
  icon,
  loading,
  disabled,
  size = 'lg',
  style,
}: Props) {
  const t = usePalette();
  const height = size === 'lg' ? 54 : 44;
  const inactive = disabled || loading;
  const fg = variant === 'primary' || variant === 'danger' ? t.onPrimary : variant === 'ghost' ? t.primary : t.text;

  const content = (
    <View style={[styles.row, { height }]}>
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon && <Ionicons name={icon} size={18} color={fg} />}
          <Text variant="label" style={{ color: fg, fontSize: size === 'lg' ? 16 : 14 }}>
            {title}
          </Text>
        </>
      )}
    </View>
  );

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      onPress={() => {
        tap();
        onPress?.();
      }}
      style={({ pressed }) => [
        { opacity: inactive ? 0.55 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
        style,
      ]}>
      {variant === 'primary' || variant === 'danger' ? (
        <LinearGradient
          colors={variant === 'danger' ? [t.danger, '#FF7A7E'] : t.primaryGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.fill, { borderRadius: radius.md }]}>
          {content}
        </LinearGradient>
      ) : variant === 'glass' ? (
        <Glass radius={radius.md}>{content}</Glass>
      ) : (
        content
      )}
    </Pressable>
  );
}

// Round glass icon button for headers, steppers, favourites.
export function IconButton({
  icon,
  onPress,
  size = 42,
  color,
  badge,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  size?: number;
  color?: string;
  badge?: number;
  label: string;
}) {
  const t = usePalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      onPress={() => {
        tap();
        onPress?.();
      }}
      style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.94 : 1 }] })}>
      <Glass radius={size / 2} style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={size * 0.48} color={color ?? t.text} />
      </Glass>
      {!!badge && badge > 0 && (
        <View style={[styles.badge, { backgroundColor: t.danger }]}>
          <Text variant="tiny" tone="onPrimary">
            {badge > 99 ? '99+' : badge}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 18 },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
