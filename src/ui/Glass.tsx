import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { radius as R, usePalette } from './theme';

type Props = {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  radius?: number;
  intensity?: number;
  strong?: boolean; // denser fill for overlays: sheets, sticky bars, tab bar
};

// A frosted-glass surface. iOS gets a live BlurView. Android's blur in expo-blur
// needs a BlurTargetView per screen and is expensive in long lists, so there
// the glass is a translucent fill + top sheen + light border, which reads as
// glass over the gradient background at a fraction of the cost.
export function Glass({ children, style, radius = R.lg, intensity = 45, strong }: Props) {
  const t = usePalette();
  const ios = Platform.OS === 'ios';

  return (
    <View
      style={[
        styles.base,
        { borderRadius: radius, borderColor: t.glassBorder, shadowColor: t.shadow },
        style,
      ]}>
      <View style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: 'hidden' }]}>
        {ios && (
          <BlurView intensity={intensity} tint={t.dark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
        )}
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: strong ? t.glassStrong : ios ? t.glassFillBlur : t.glassFill },
          ]}
        />
        <LinearGradient
          colors={[t.sheen, 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.5, y: 0.9 }}
          style={StyleSheet.absoluteFill}
        />
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 1,
    // Soft lift on iOS only; Android elevation draws a hard grey edge under
    // translucent views.
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
  },
});
