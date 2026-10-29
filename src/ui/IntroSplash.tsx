import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { type ComponentProps, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
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
export const INTRO_BG = '#FFFFFF';

const BRAND = '#0066CC';
const BRAND_LIGHT = '#3B9BFF';
const INK = '#0B1530';
const LETTERS = ['Z', 'i', 'l', 'l', 'y', 'B', 'u', 'y'];
const DOT = 28;
const TILE = 112;
const BAR = 120;

type IconName = ComponentProps<typeof Ionicons>['name'];
// Offsets from the logo's centre, laid out so no two chips line up.
const CHIPS: { icon: IconName; x: number; y: number }[] = [
  { icon: 'shirt-outline', x: -118, y: -86 },
  { icon: 'phone-portrait-outline', x: 122, y: -64 },
  { icon: 'watch-outline', x: -132, y: 44 },
  { icon: 'headset-outline', x: 128, y: 70 },
  { icon: 'gift-outline', x: -40, y: -138 },
  { icon: 'pricetag-outline', x: 52, y: 130 },
];

// Launch intro played over the app while it loads, on a white canvas with
// slow blue aurora blobs. A blue dot pops in and morphs into the app tile,
// the ZillyBuy cart lands on it with a ripple and a light sweep, product
// chips float in around it, the wordmark rises letter by letter over a
// filling progress bar, then the chips scatter as the intro fades out.
// `start` flips true once the native splash has been hidden. `onReveal` fires
// once the intro is holding still (wordmark and bar done, only gentle loops
// left): the moment the app underneath can mount its content without a
// visible hitch, before the fade-out shows it.
export function IntroSplash({ start, onReveal, onDone }: { start: boolean; onReveal: () => void; onDone: () => void }) {
  const reduced = useReducedMotion();

  const aurora = useSharedValue(0);
  const drift = useSharedValue(0); // loops, keeps the background alive
  const dot = useSharedValue(0);
  const morph = useSharedValue(0); // dot → rounded tile
  const mark = useSharedValue(0);
  const ripple = useSharedValue(0);
  const shine = useSharedValue(0);
  const chips = useSharedValue(0);
  const bob = useSharedValue(0);
  const letters = useSharedValue(0); // 0 → LETTERS.length, staggered reveal
  const bar = useSharedValue(0);
  const tagline = useSharedValue(0);
  const exit = useSharedValue(0);

  useEffect(() => {
    if (!start) return;
    if (reduced) {
      aurora.value = 1;
      dot.value = 1;
      morph.value = 1;
      mark.value = 1;
      letters.value = LETTERS.length;
      bar.value = 1;
      tagline.value = 1;
      exit.value = withDelay(700, withTiming(1, { duration: 300 }));
      onReveal();
      const id = setTimeout(onDone, 1050);
      return () => clearTimeout(id);
    }
    const ease = Easing.out(Easing.cubic);
    aurora.value = withTiming(1, { duration: 700, easing: ease });
    drift.value = withRepeat(withTiming(1, { duration: 3200, easing: Easing.inOut(Easing.sin) }), -1, true);
    dot.value = withDelay(150, withSpring(1, { damping: 9, stiffness: 220, mass: 0.6 }));
    morph.value = withDelay(520, withTiming(1, { duration: 420, easing: Easing.inOut(Easing.cubic) }));
    mark.value = withDelay(860, withSpring(1, { damping: 10, stiffness: 180, mass: 0.7 }));
    ripple.value = withDelay(900, withTiming(1, { duration: 1100, easing: Easing.out(Easing.quad) }));
    shine.value = withDelay(1250, withTiming(1, { duration: 600, easing: Easing.inOut(Easing.quad) }));
    chips.value = withDelay(700, withTiming(1, { duration: 750, easing: ease }));
    bob.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.linear }), -1, false);
    letters.value = withDelay(1400, withTiming(LETTERS.length, { duration: 520, easing: Easing.linear }));
    bar.value = withDelay(1800, withTiming(1, { duration: 650, easing: Easing.inOut(Easing.quad) }));
    tagline.value = withDelay(2000, withTiming(1, { duration: 400, easing: ease }));
    exit.value = withDelay(2750, withTiming(1, { duration: 420, easing: Easing.in(Easing.cubic) }));
    const reveal = setTimeout(onReveal, 2450);
    const done = setTimeout(onDone, 3200);
    return () => {
      clearTimeout(reveal);
      clearTimeout(done);
    };
  }, [start, reduced, onReveal, onDone, aurora, drift, dot, morph, mark, ripple, shine, chips, bob, letters, bar, tagline, exit]);

  const rootStyle = useAnimatedStyle(() => ({ opacity: 1 - exit.value }));
  const contentStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 + exit.value * 0.05 }] }));
  // The tile is laid out once at full size and only scaled: animating
  // width/height would re-run layout every frame, which stutters while the
  // app is busy loading underneath. The radius grows as the scale does, so
  // the dot stays a circle and lands as a rounded square.
  const tileStyle = useAnimatedStyle(() => {
    const k = DOT / TILE + morph.value * (1 - DOT / TILE);
    return {
      borderRadius: TILE / 2 - morph.value * (TILE / 2 - 32),
      transform: [{ scale: dot.value * k }],
    };
  });
  const markStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, mark.value * 1.4),
    transform: [{ scale: 0.4 + mark.value * 0.6 }, { rotate: `${(1 - mark.value) * -18}deg` }],
  }));
  const shineStyle = useAnimatedStyle(() => ({
    opacity: shine.value > 0 && shine.value < 1 ? 1 : 0,
    transform: [{ translateX: -TILE + shine.value * TILE * 2 }, { rotate: '20deg' }],
  }));
  const barStyle = useAnimatedStyle(() => ({ transform: [{ translateX: -BAR * (1 - bar.value) }] }));
  const taglineStyle = useAnimatedStyle(() => ({
    opacity: tagline.value,
    transform: [{ translateY: (1 - tagline.value) * 8 }],
  }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, rootStyle]} pointerEvents="none">
      <StatusBar style="dark" />
      <Blob aurora={aurora} drift={drift} size={420} top="-12%" left="-30%" dx={30} dy={20} />
      <Blob aurora={aurora} drift={drift} size={360} top="62%" left="40%" dx={-26} dy={-24} />
      <Blob aurora={aurora} drift={drift} size={220} top="30%" left="70%" dx={-14} dy={18} />

      <Animated.View style={[styles.center, contentStyle]}>
        <View style={styles.stage}>
          <Ripple progress={ripple} delay={0} />
          <Ripple progress={ripple} delay={0.25} />
          {CHIPS.map((c, i) => (
            <Chip key={c.icon} index={i} chip={c} chips={chips} bob={bob} exit={exit} />
          ))}
          <Animated.View style={[styles.tile, tileStyle]}>
            <LinearGradient colors={[BRAND_LIGHT, BRAND, '#004C99']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
            <View style={styles.gloss} />
            <Animated.View style={markStyle}>
              <Image source={require('../../assets/brand/intro-mark.png')} style={styles.mark} contentFit="contain" />
            </Animated.View>
            <Animated.View style={[styles.shine, shineStyle]}>
              <LinearGradient
                colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.55)', 'rgba(255,255,255,0)']}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
          </Animated.View>
        </View>

        <View style={styles.text}>
          <View style={styles.wordmark}>
            {LETTERS.map((ch, i) => (
              <Letter key={i} ch={ch} index={i} progress={letters} color={i >= 5 ? BRAND : INK} />
            ))}
          </View>
          <View style={styles.track}>
            <Animated.View style={[StyleSheet.absoluteFill, barStyle]}>
              <LinearGradient colors={[BRAND_LIGHT, BRAND]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} />
            </Animated.View>
          </View>
          <Animated.Text style={[styles.tagline, taglineStyle]}>Shop smart · Powered by ONDC</Animated.Text>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

// Soft blue glow: stacked translucent circles read as a blur on any platform.
function Blob({
  aurora,
  drift,
  size,
  top,
  left,
  dx,
  dy,
}: {
  aurora: SharedValue<number>;
  drift: SharedValue<number>;
  size: number;
  top: `${number}%`;
  left: `${number}%`;
  dx: number;
  dy: number;
}) {
  const style = useAnimatedStyle(() => ({
    opacity: aurora.value,
    transform: [{ translateX: drift.value * dx }, { translateY: drift.value * dy }, { scale: 0.85 + aurora.value * 0.15 }],
  }));
  return (
    <Animated.View style={[styles.blob, { width: size, height: size, top, left }, style]}>
      {[1, 0.72, 0.46].map((k) => (
        <View key={k} style={[styles.blobLayer, { width: size * k, height: size * k, borderRadius: (size * k) / 2 }]} />
      ))}
    </Animated.View>
  );
}

function Ripple({ progress, delay }: { progress: SharedValue<number>; delay: number }) {
  const style = useAnimatedStyle(() => {
    const p = Math.min(1, Math.max(0, (progress.value - delay) / (1 - delay)));
    return { opacity: p > 0 ? (1 - p) * 0.55 : 0, transform: [{ scale: 0.9 + p * 1.5 }] };
  });
  return <Animated.View style={[styles.ripple, style]} />;
}

function Chip({
  index,
  chip,
  chips,
  bob,
  exit,
}: {
  index: number;
  chip: (typeof CHIPS)[number];
  chips: SharedValue<number>;
  bob: SharedValue<number>;
  exit: SharedValue<number>;
}) {
  const style = useAnimatedStyle(() => {
    const p = Math.min(1, Math.max(0, chips.value * 1.6 - index * 0.12));
    const eased = 1 - (1 - p) * (1 - p);
    const spread = eased * (1 + exit.value * 0.7);
    const float = Math.sin((bob.value + index / CHIPS.length) * Math.PI * 2) * 4;
    return {
      opacity: Math.min(1, p * 1.5) * (1 - exit.value),
      transform: [{ translateX: chip.x * spread }, { translateY: chip.y * spread + float }, { scale: 0.5 + eased * 0.5 }],
    };
  });
  return (
    <Animated.View style={[styles.chip, style]}>
      <Ionicons name={chip.icon} size={19} color={BRAND} />
    </Animated.View>
  );
}

function Letter({ ch, index, progress, color }: { ch: string; index: number; progress: SharedValue<number>; color: string }) {
  const style = useAnimatedStyle(() => {
    const p = Math.min(1, Math.max(0, progress.value - index));
    return { opacity: p, transform: [{ translateY: (1 - p) * 16 }, { scale: 0.85 + p * 0.15 }] };
  });
  return <Animated.Text style={[styles.letter, { color }, style]}>{ch}</Animated.Text>;
}

const styles = StyleSheet.create({
  root: { backgroundColor: INTRO_BG, zIndex: 1000, elevation: 1000, overflow: 'hidden' },
  center: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', gap: 26 },
  stage: { width: 300, height: 300, alignItems: 'center', justifyContent: 'center' },
  blob: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  blobLayer: { position: 'absolute', backgroundColor: 'rgba(0,102,204,0.05)' },
  ripple: { position: 'absolute', width: TILE, height: TILE, borderRadius: 36, borderWidth: 2, borderColor: BRAND_LIGHT },
  tile: {
    width: TILE,
    height: TILE,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: BRAND,
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  gloss: { position: 'absolute', top: 6, left: 14, width: 60, height: 26, borderRadius: 30, backgroundColor: 'rgba(255,255,255,0.22)' },
  mark: { width: 58, height: 58 },
  shine: { position: 'absolute', top: -TILE / 2, width: 34, height: TILE * 2 },
  chip: {
    position: 'absolute',
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(0,102,204,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0B1530',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  text: { alignItems: 'center', gap: 12 },
  wordmark: { flexDirection: 'row', paddingHorizontal: 6 },
  letter: { fontSize: 44, fontWeight: '800', letterSpacing: -1.2 },
  track: { width: BAR, height: 4, borderRadius: 2, overflow: 'hidden', backgroundColor: 'rgba(0,102,204,0.12)' },
  tagline: { color: '#5B6478', fontSize: 14, fontWeight: '600', letterSpacing: 1.1 },
});
