import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

import { usePalette } from './theme';

// The colourful layer that every Glass surface frosts over. Rendered once
// behind each screen.
export function Background() {
  const t = usePalette();
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient
        colors={t.background}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Blob color={t.blobs[0]} size={340} top={-120} left={-110} opacity={t.dark ? 0.45 : 0.4} />
      <Blob color={t.blobs[1]} size={300} top={260} right={-140} opacity={t.dark ? 0.35 : 0.32} />
      <Blob color={t.blobs[2]} size={280} bottom={-90} left={-60} opacity={t.dark ? 0.3 : 0.28} />
    </View>
  );
}

type BlobProps = {
  color: string;
  size: number;
  opacity: number;
  top?: number;
  left?: number;
  right?: number;
  bottom?: number;
};

// A soft orb: radial falloff faked with a gradient to transparent, since RN
// has no radial gradients or CSS filter blur.
function Blob({ color, size, opacity, ...pos }: BlobProps) {
  return (
    <LinearGradient
      colors={[color, `${color}00`]}
      start={{ x: 0.3, y: 0.3 }}
      end={{ x: 1, y: 1 }}
      style={{ position: 'absolute', width: size, height: size, borderRadius: size / 2, opacity, ...pos }}
    />
  );
}
