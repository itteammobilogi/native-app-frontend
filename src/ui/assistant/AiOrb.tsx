import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { usePalette } from '../theme';

// ZillyAI's avatar: a blue→violet orb with a sparkle, optionally breathing
// with a soft halo (header, launcher, welcome).
export function AiOrb({ size = 36, pulse = false }: { size?: number; pulse?: boolean }) {
  const t = usePalette();
  const halo = useSharedValue(0);

  useEffect(() => {
    if (pulse) halo.value = withRepeat(withTiming(1, { duration: 1800, easing: Easing.out(Easing.quad) }), -1, false);
  }, [pulse, halo]);

  const haloStyle = useAnimatedStyle(() => ({
    opacity: 0.45 * (1 - halo.value),
    transform: [{ scale: 1 + halo.value * 0.55 }],
  }));

  return (
    <View style={{ width: size, height: size }}>
      {pulse && (
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { borderRadius: size / 2, backgroundColor: t.accent }, haloStyle]}
        />
      )}
      <LinearGradient
        colors={[t.primary, t.accent, '#FF7AB6']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.orb, { width: size, height: size, borderRadius: size / 2 }]}>
        <View style={[styles.gloss, { width: size * 0.5, height: size * 0.28, borderRadius: size, top: size * 0.1, left: size * 0.18 }]} />
        <Ionicons name="sparkles" size={size * 0.48} color="#fff" />
      </LinearGradient>
    </View>
  );
}

// Three dots bouncing in turn while ZillyAI "thinks".
export function TypingDots() {
  const t = usePalette();
  return (
    <View style={styles.dots} accessibilityLabel="ZillyAI is typing">
      {[0, 1, 2].map((i) => (
        <Dot key={i} delay={i * 160} color={t.primary} />
      ))}
    </View>
  );
}

function Dot({ delay, color }: { delay: number; color: string }) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withDelay(
      delay,
      withRepeat(withSequence(withTiming(1, { duration: 320 }), withTiming(0, { duration: 320 }), withTiming(0, { duration: 160 })), -1),
    );
  }, [delay, v]);
  const style = useAnimatedStyle(() => ({ opacity: 0.35 + v.value * 0.65, transform: [{ translateY: -4 * v.value }] }));
  return <Animated.View style={[styles.dot, { backgroundColor: color }, style]} />;
}

const styles = StyleSheet.create({
  orb: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  gloss: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.35)' },
  dots: { flexDirection: 'row', gap: 5, paddingVertical: 6, paddingHorizontal: 2 },
  dot: { width: 7, height: 7, borderRadius: 4 },
});
