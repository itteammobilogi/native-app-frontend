import { Image } from 'expo-image';
import { Linking, Pressable, View, type ImageStyle, type StyleProp, type ViewStyle } from 'react-native';

import { Text } from './Text';
import { usePalette } from './theme';

// The website's wordmark (website/.../public/assets/zillybuy.png). It's black
// on transparent; on dark backgrounds it's tinted white, as the site does
// with `brightness-0 invert`.
const RATIO = 290 / 110;

export function Logo({ height = 32, style }: { height?: number; style?: StyleProp<ImageStyle> }) {
  const t = usePalette();
  return (
    <Image
      source={require('@/assets/brand/wordmark.png')}
      style={[{ height, width: height * RATIO }, style]}
      tintColor={t.dark ? '#FFFFFF' : undefined}
      contentFit="contain"
      accessibilityLabel="ZillyBuy"
    />
  );
}

// The website's ONDC Network logo (public/assets/ondc-logo.png), linking to
// ondc.org like the site's header. Its "NETWORK" text is near-black, so it's
// tinted white on dark backgrounds too.
const ONDC_RATIO = 115 / 60;

export function OndcLogo({ height = 28, style }: { height?: number; style?: StyleProp<ViewStyle> }) {
  const t = usePalette();
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel="ONDC Network"
      onPress={() => Linking.openURL('https://ondc.org/').catch(() => {})}
      hitSlop={8}
      style={style}>
      <Image
        source={require('@/assets/brand/ondc-logo.png')}
        style={{ height, width: height * ONDC_RATIO }}
        tintColor={t.dark ? '#FFFFFF' : undefined}
        contentFit="contain"
      />
    </Pressable>
  );
}

// ZillyBuy | ONDC, as in the website's header and login page.
export function LogoLockup({ height = 30, style }: { height?: number; style?: StyleProp<ViewStyle> }) {
  const t = usePalette();
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 12 }, style]}>
      <Logo height={height} />
      <View style={{ width: 1, height: height * 0.8, backgroundColor: t.textFaint, opacity: 0.4 }} />
      <OndcLogo height={height} />
    </View>
  );
}

// "Powered by ONDC", from the website's footer.
export function PoweredByOndc({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ alignItems: 'center', gap: 4 }, style]}>
      <Text variant="tiny" tone="muted">
        Powered by
      </Text>
      <OndcLogo height={36} />
    </View>
  );
}
