import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import type { Banner } from '@/core/api/catalog';
import { openSiteLink } from '@/core/links';
import { tap } from './Button';
import { Glass } from './Glass';
import { Skeleton } from './Skeleton';
import { radius, usePalette } from './theme';

// Auto-advancing banner strip (home, NavBharat). Taps go through openSiteLink,
// so a banner pointing at a website path opens the matching app screen.
export function BannerCarousel({ banners, loading, aspect = 0.5 }: { banners?: Banner[]; loading: boolean; aspect?: number }) {
  const t = usePalette();
  const { width } = useWindowDimensions();
  const w = width - 32;
  const h = Math.round(w * aspect);
  const [index, setIndex] = useState(0);
  const ref = useRef<FlatList<Banner>>(null);
  const count = banners?.length ?? 0;

  useEffect(() => {
    if (count < 2) return;
    const id = setInterval(() => {
      setIndex((i) => {
        const next = (i + 1) % count;
        ref.current?.scrollToOffset({ offset: next * (w + 12), animated: true });
        return next;
      });
    }, 4500);
    return () => clearInterval(id);
  }, [count, w]);

  if (loading) return <Skeleton width={w} height={h} r={radius.xl} style={{ marginHorizontal: 16, marginBottom: 20 }} />;
  if (!count) return null;

  return (
    <View style={{ marginBottom: 18 }}>
      <FlatList
        ref={ref}
        data={banners}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={w + 12}
        decelerationRate="fast"
        contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
        keyExtractor={(b) => String(b.id)}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / (w + 12)))}
        renderItem={({ item }) => (
          <Pressable onPress={() => (tap(), openSiteLink(item.link_url))}>
            <Glass radius={radius.xl} style={{ width: w, height: h, overflow: 'hidden' }}>
              <Image
                source={{ uri: item.image }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                transition={250}
                accessibilityLabel={item.title}
              />
              <LinearGradient colors={['transparent', 'rgba(0,0,0,0.25)']} style={StyleSheet.absoluteFill} />
            </Glass>
          </Pressable>
        )}
      />
      {count > 1 && (
        <View style={styles.dots}>
          {banners!.map((b, i) => (
            <View
              key={b.id}
              style={[styles.dot, { backgroundColor: i === index ? t.primary : t.hairline, width: i === index ? 18 : 6 }]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: 10 },
  dot: { height: 6, borderRadius: 3 },
});
