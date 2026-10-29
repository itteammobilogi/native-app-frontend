import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet } from 'react-native';

import type { ProductSummary } from '@/core/api/catalog';
import { useSaved } from '@/core/saved/SavedContext';

import { tap } from './Button';
import { usePalette } from './theme';
import { useToast } from './Toast';

// Heart toggle for the wishlist; sits on a product card's image.
export function SaveButton({ product, size = 30 }: { product: ProductSummary; size?: number }) {
  const t = usePalette();
  const toast = useToast();
  const { isSaved, toggleSaved } = useSaved();
  const saved = isSaved(product.id);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={saved ? 'Remove from wishlist' : 'Save to wishlist'}
      accessibilityState={{ selected: saved }}
      hitSlop={8}
      onPress={() => {
        tap();
        const nowSaved = toggleSaved(product);
        toast(nowSaved ? 'Saved to your wishlist' : 'Removed from wishlist', nowSaved ? 'success' : 'info');
      }}
      style={[styles.btn, { width: size, height: size, borderRadius: size / 2 }]}>
      <Ionicons name={saved ? 'heart' : 'heart-outline'} size={size * 0.55} color={saved ? t.danger : '#5B6B82'} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
});
