import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { radius as R, usePalette } from './theme';

type Props = {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  radius?: number;
  intensity?: number; // unused; kept so existing callers compile
  strong?: boolean; // unused; kept so existing callers compile
};

// A solid card surface: white fill and a light border. It used to be frosted
// glass; the name stays so the many screens using it pick up the flat look.
export function Glass({ children, style, radius = R.lg }: Props) {
  const t = usePalette();
  return (
    <View style={[styles.base, { borderRadius: radius, borderColor: t.glassBorder, backgroundColor: t.glassFill }, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { borderWidth: StyleSheet.hairlineWidth * 2 },
});
