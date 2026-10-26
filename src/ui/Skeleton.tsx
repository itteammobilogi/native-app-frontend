import { useEffect, useState } from 'react';
import { Animated, View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';

import { Glass } from './Glass';
import { radius, usePalette } from './theme';

export function Skeleton({
  width = '100%',
  height = 14,
  r = 8,
  style,
}: {
  width?: DimensionValue;
  height?: DimensionValue;
  r?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const t = usePalette();
  const [pulse] = useState(() => new Animated.Value(0.5));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return <Animated.View style={[{ width, height, borderRadius: r, backgroundColor: t.skeleton, opacity: pulse }, style]} />;
}

export function ProductCardSkeleton({ width }: { width?: number }) {
  return (
    <Glass radius={radius.lg} style={{ width, padding: 10, gap: 10, flex: width ? undefined : 1 }}>
      <Skeleton height={140} r={radius.md} />
      <Skeleton width="85%" />
      <Skeleton width="50%" />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Skeleton width={60} height={18} />
        <Skeleton width={40} height={18} />
      </View>
    </Glass>
  );
}
