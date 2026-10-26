import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { brandLogoUrl, type Brand } from '@/core/api/brands';
import { tap } from './Button';
import { Glass } from './Glass';
import { Text } from './Text';
import { radius, usePalette } from './theme';

// Logo tile linking to a brand page. Fills a third of a row in the brand grid,
// or takes a fixed `width` in the home strip.
export function BrandTile({ brand, width }: { brand: Brand; width?: number }) {
  const t = usePalette();
  const logo = brandLogoUrl(brand.logo);
  const [failed, setFailed] = useState(false);
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={brand.name}
      onPress={() => (tap(), router.push({ pathname: '/brand/[slug]', params: { slug: brand.slug } }))}
      style={({ pressed }) => [
        width ? { width } : { flex: 1 / 3, maxWidth: '31.5%' },
        { transform: [{ scale: pressed ? 0.96 : 1 }] },
      ]}>
      <Glass radius={radius.lg} style={styles.tile}>
        <View style={styles.logoWrap}>
          {logo && !failed ? (
            <Image source={{ uri: logo }} style={styles.logo} contentFit="contain" transition={200} onError={() => setFailed(true)} />
          ) : (
            <Text variant="title" tone="primary">
              {brand.name.trim()[0]?.toUpperCase()}
            </Text>
          )}
        </View>
        <Text variant="caption" numberOfLines={1} style={{ textAlign: 'center', color: t.text }}>
          {brand.name}
        </Text>
      </Glass>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: { padding: 8, gap: 8, alignItems: 'center' },
  logoWrap: { width: '100%', aspectRatio: 1.25, borderRadius: 14, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  logo: { width: '82%', height: '82%' },
});
