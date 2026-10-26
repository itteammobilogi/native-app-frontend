import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

// Must match the native splash backgroundColor in app.json, so the hand-off
// from the (logo-less) native splash to this intro is invisible.
export const INTRO_BG = '#060A1C';

const LETTERS = ['Z', 'i', 'l', 'l', 'y', 'B', 'u', 'y'];
const BLUE = '#5AA2FF';

// Launch intro played over the app while it loads: glowing blobs drift in, the
// bag orb pops with ripples, "ZillyBuy" rises letter by letter, a light sweep
// crosses the wordmark, then everything zooms softly away.
// `start` flips true once the native splash has been hidden.
export function IntroSplash({ start, onDone }: { start: boolean; onDone: () => void }) {
  const { width, height } = useWindowDimensions();
  const reduced = useReducedMotion();

  const bg = useSharedValue(0); // blobs + gradient
  const orb = useSharedValue(0);
  const ripple = useSharedValue(0);
  const letters = useSharedValue(0); // 0 → LETTERS.length, staggered reveal
  const sweep = useSharedValue(0);
  const tagline = useSharedValue(0);
  const exit = useSharedValue(0);
  const drift = useSharedValue(0);

  useEffect(() => {
    if (!start) return;
    if (reduced) {
      bg.value = 1;
      orb.value = 1;
      letters.value = LETTERS.length;
      tagline.value = 1;
      exit.value = withDelay(700, withTiming(1, { duration: 300 }));
      const id = setTimeout(onDone, 1050);
      return () => clearTimeout(id);
    }
    const ease = Easing.out(Easing.cubic);
    bg.value = withTiming(1, { duration: 700, easing: ease });
    drift.value = withRepeat(withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.sin) }), -1, true);
    orb.value = withDelay(150, withSpring(1, { damping: 9, stiffness: 140, mass: 0.8 }));
    ripple.value = withDelay(350, withRepeat(withTiming(1, { duration: 1100, easing: Easing.out(Easing.quad) }), 2, false));
    letters.value = withDelay(550, withTiming(LETTERS.length, { duration: 650, easing: Easing.linear }));
    sweep.value = withDelay(1250, withTiming(1, { duration: 650, easing: Easing.inOut(Easing.quad) }));
    tagline.value = withDelay(1350, withTiming(1, { duration: 500, easing: ease }));
    exit.value = withDelay(2350, withTiming(1, { duration: 450, easing: Easing.in(Easing.cubic) }));
    const id = setTimeout(onDone, 2850);
    return () => clearTimeout(id);
  }, [start, reduced, onDone, bg, orb, ripple, letters, sweep, tagline, exit, drift]);

  const rootStyle = useAnimatedStyle(() => ({
    opacity: 1 - exit.value,
    transform: [{ scale: 1 + exit.value * 0.12 }],
  }));
  const bgStyle = useAnimatedStyle(() => ({ opacity: bg.value }));
  const orbStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, orb.value * 1.5),
    transform: [{ scale: orb.value }, { rotate: `${(1 - orb.value) * -30}deg` }],
  }));
  const rippleStyle = useAnimatedStyle(() => {
    const r = ripple.value;
    return { opacity: r > 0 && r < 1 ? 0.55 * (1 - r) : 0, transform: [{ scale: 1 + r * 1.4 }] };
  });
  const sweepStyle = useAnimatedStyle(() => ({
    opacity: sweep.value > 0 && sweep.value < 1 ? 1 : 0,
    transform: [{ translateX: -120 + sweep.value * 360 }, { skewX: '-20deg' }],
  }));
  const taglineStyle = useAnimatedStyle(() => ({
    opacity: tagline.value,
    transform: [{ translateY: (1 - tagline.value) * 10 }],
  }));

  const blob = Math.max(width, height) * 0.55;

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, rootStyle]} pointerEvents="none">
      <StatusBar style="light" />
      <Animated.View style={[StyleSheet.absoluteFill, bgStyle]}>
        <LinearGradient colors={[INTRO_BG, '#0D1440', '#1E0F3A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <Blob drift={drift} size={blob} color="#1D6BFF" x={-blob * 0.35} y={height * 0.08} dx={30} dy={20} />
        <Blob drift={drift} size={blob} color="#7C5CFF" x={width - blob * 0.6} y={height * 0.42} dx={-25} dy={-30} />
        <Blob drift={drift} size={blob * 0.8} color="#FF5FA8" x={width * 0.1} y={height * 0.72} dx={20} dy={-15} />
      </Animated.View>

      <View style={styles.center}>
        <View style={styles.orbWrap}>
          <Animated.View style={[styles.ripple, rippleStyle]} />
          <Animated.View style={orbStyle}>
            <LinearGradient colors={['#0066CC', '#7C5CFF', '#FF7AB6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.orb}>
              <View style={styles.gloss} />
              <Ionicons name="bag-handle" size={44} color="#fff" />
            </LinearGradient>
          </Animated.View>
        </View>

        <View style={styles.wordmark}>
          {LETTERS.map((ch, i) => (
            <Letter key={i} ch={ch} index={i} progress={letters} color={i >= 5 ? BLUE : '#FFFFFF'} />
          ))}
          <Animated.View style={[styles.sweep, sweepStyle]} />
        </View>

        <Animated.Text style={[styles.tagline, taglineStyle]}>Shop smart · Powered by ONDC</Animated.Text>
      </View>
    </Animated.View>
  );
}

function Letter({ ch, index, progress, color }: { ch: string; index: number; progress: SharedValue<number>; color: string }) {
  const style = useAnimatedStyle(() => {
    const p = Math.min(1, Math.max(0, progress.value - index));
    return { opacity: p, transform: [{ translateY: (1 - p) * 26 }, { scale: 0.7 + p * 0.3 }] };
  });
  return <Animated.Text style={[styles.letter, { color }, style]}>{ch}</Animated.Text>;
}

function Blob({
  drift,
  size,
  color,
  x,
  y,
  dx,
  dy,
}: {
  drift: SharedValue<number>;
  size: number;
  color: string;
  x: number;
  y: number;
  dx: number;
  dy: number;
}) {
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: x + drift.value * dx }, { translateY: y + drift.value * dy }, { scale: 1 + drift.value * 0.08 }],
  }));
  return (
    <Animated.View style={[{ position: 'absolute', width: size, height: size, borderRadius: size / 2, backgroundColor: color, opacity: 0.28 }, style]} />
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: INTRO_BG, zIndex: 1000, elevation: 1000 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 22 },
  orbWrap: { width: 104, height: 104, alignItems: 'center', justifyContent: 'center' },
  ripple: { position: 'absolute', width: 104, height: 104, borderRadius: 52, borderWidth: 2, borderColor: '#9B87FF' },
  orb: {
    width: 104,
    height: 104,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  gloss: { position: 'absolute', top: 8, left: 14, width: 56, height: 26, borderRadius: 30, backgroundColor: 'rgba(255,255,255,0.28)' },
  wordmark: { flexDirection: 'row', overflow: 'hidden', paddingHorizontal: 6 },
  letter: { fontSize: 46, fontWeight: '800', letterSpacing: -1 },
  sweep: { position: 'absolute', top: 0, bottom: 0, width: 36, backgroundColor: 'rgba(255,255,255,0.35)' },
  tagline: { color: 'rgba(226,232,255,0.75)', fontSize: 14, fontWeight: '600', letterSpacing: 1.2 },
});
