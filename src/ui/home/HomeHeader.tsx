import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useLocation } from '@/core/location/LocationContext';
import { tap } from '../Button';
import { Logo } from '../Logo';
import { Text } from '../Text';
import { radius, usePalette } from '../theme';

// How far the blue block runs on below the search bar; the banner under it is
// pulled up by this much so it sits half on the blue.
export const HEADER_OVERLAP = 44;

// The home page's solid blue top: logo, alerts and cart, delivery pincode and
// the search bar.
export function HomeHeader({ unread, cartCount, onPincode }: { unread: number; cartCount: number; onPincode: () => void }) {
  const t = usePalette();
  const insets = useSafeAreaInsets();
  const { location } = useLocation();
  const blue = t.dark ? '#0B4A99' : t.primary;

  return (
    <View style={[styles.wrap, { backgroundColor: blue, paddingTop: insets.top + 10 }]}>
      {/* Decorative rings, top right */}
      <View pointerEvents="none" style={[styles.ring, { width: 220, height: 220, top: -70, right: -60 }]} />
      <View pointerEvents="none" style={[styles.ring, { width: 140, height: 140, top: -30, right: -20 }]} />

      <View style={styles.top}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Logo height={26} tint="#FFFFFF" />
          <View style={styles.ondc}>
            <Text variant="tiny" tone="onPrimary" style={{ fontSize: 9, letterSpacing: 0.6 }}>
              ON ONDC
            </Text>
          </View>
        </View>
        <HeaderIcon icon="notifications-outline" label="Notifications" dot={unread > 0} onPress={() => router.push('/notifications')} />
        <HeaderIcon icon="bag-handle-outline" label="Cart" badge={cartCount} onPress={() => router.push('/cart')} />
      </View>

      <Pressable accessibilityRole="button" onPress={onPincode} style={styles.location}>
        <Ionicons name="location-outline" size={15} color="#FFFFFF" />
        <Text variant="caption" tone="onPrimary" numberOfLines={1} style={{ flex: 1 }}>
          {location ? (
            <>
              Delivering to <Text variant="caption" tone="onPrimary" style={{ fontWeight: '800' }}>{`${location.label}, ${location.pincode}`}</Text>
            </>
          ) : (
            'Set your delivery pincode'
          )}
        </Text>
        <Ionicons name="chevron-down" size={14} color="#FFFFFF" />
      </Pressable>

      <Pressable accessibilityRole="search" onPress={() => (tap(), router.push('/search'))} style={[styles.search, { backgroundColor: t.glassFill }]}>
        <Ionicons name="search" size={18} color={t.textFaint} />
        <Text variant="caption" style={{ flex: 1, color: t.textFaint, fontSize: 13 }} numberOfLines={1}>
          Search for products, brands…
        </Text>
        <View style={[styles.go, { backgroundColor: t.primary }]}>
          <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
        </View>
      </Pressable>
    </View>
  );
}

function HeaderIcon({
  icon,
  label,
  badge,
  dot,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  badge?: number;
  dot?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} hitSlop={6} onPress={() => (tap(), onPress())} style={styles.icon}>
      <Ionicons name={icon} size={22} color="#FFFFFF" />
      {!!badge && badge > 0 ? (
        <View style={styles.badge}>
          <Text variant="tiny" style={{ fontSize: 9, lineHeight: 11, color: '#0066CC', fontWeight: '800' }}>
            {badge > 99 ? '99+' : badge}
          </Text>
        </View>
      ) : (
        dot && <View style={styles.dot} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingBottom: HEADER_OVERLAP + 14, overflow: 'hidden' },
  ring: { position: 'absolute', borderRadius: 999, borderWidth: 22, borderColor: 'rgba(255,255,255,0.06)' },
  top: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  ondc: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)', borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1 },
  icon: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: 2,
    right: 0,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: { position: 'absolute', top: 8, right: 9, width: 8, height: 8, borderRadius: 4, backgroundColor: '#FBBF24' },
  location: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 48,
    paddingLeft: 14,
    paddingRight: 5,
    borderRadius: radius.md,
  },
  go: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
});
