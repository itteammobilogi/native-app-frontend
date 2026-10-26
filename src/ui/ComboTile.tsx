import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { comboPricing, type Combo } from '@/core/api/combos';
import { formatINR } from '@/core/pricing';

import { tap } from './Button';
import { Text } from './Text';
import { radius } from './theme';

// Compact combo card for the home strip; the full card lives on /combos.
export function ComboTile({ combo, width }: { combo: Combo; width: number }) {
  const { price, discount } = comboPricing(combo);
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => (tap(), router.push({ pathname: '/combo/[slug]', params: { slug: combo.zc_slug } }))}
      style={({ pressed }) => [styles.tile, { width, transform: [{ scale: pressed ? 0.97 : 1 }] }]}>
      {combo.zc_image ? <Image source={{ uri: combo.zc_image }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} /> : null}
      <LinearGradient colors={['transparent', 'rgba(5,11,26,0.85)']} style={StyleSheet.absoluteFill} />
      <View style={{ padding: 12, gap: 2 }}>
        <Text variant="label" tone="onPrimary" numberOfLines={2}>
          {combo.zc_name}
        </Text>
        <Text variant="caption" tone="onPrimary" style={{ opacity: 0.85 }}>
          {price > 0 ? `${formatINR(price)}${discount > 0 ? ` · ${discount}% off` : ''}` : 'View combo'}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: { aspectRatio: 16 / 10, borderRadius: radius.lg, overflow: 'hidden', justifyContent: 'flex-end', backgroundColor: '#0B1230' },
});
