import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, View } from 'react-native';

import { tap } from '@/ui/Button';
import { usePalette } from '@/ui/theme';

const STAR = '#F5A524'; // amber, like the website's amber-400 stars

// Display mode supports decimals (4.3 → 4 full stars + 30% of the fifth).
export function StarRating({ rating, size = 16 }: { rating: number; size?: number }) {
  const t = usePalette();
  const value = Math.max(0, Math.min(5, Number(rating) || 0));
  return (
    <View style={{ flexDirection: 'row', gap: 2 }} accessibilityLabel={`${value.toFixed(1)} out of 5 stars`}>
      {[0, 1, 2, 3, 4].map((i) => {
        const fill = Math.max(0, Math.min(1, value - i));
        return (
          <View key={i} style={{ width: size, height: size }}>
            <Ionicons name="star" size={size} color={t.dark ? 'rgba(255,255,255,0.15)' : '#E3E7EE'} style={{ position: 'absolute' }} />
            <View style={{ position: 'absolute', width: size * fill, height: size, overflow: 'hidden' }}>
              <Ionicons name="star" size={size} color={STAR} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

// Tap-to-set 1–5 picker for writing a review.
export function StarPicker({ value, onChange, size = 34 }: { value: number; onChange: (n: number) => void; size?: number }) {
  const t = usePalette();
  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable
          key={n}
          hitSlop={4}
          accessibilityRole="button"
          accessibilityLabel={`${n} star${n === 1 ? '' : 's'}`}
          accessibilityState={{ selected: n <= value }}
          onPress={() => (tap(), onChange(n))}>
          <Ionicons name={n <= value ? 'star' : 'star-outline'} size={size} color={n <= value ? STAR : t.textFaint} />
        </Pressable>
      ))}
    </View>
  );
}
