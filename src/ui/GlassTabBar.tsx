import Ionicons from '@expo/vector-icons/Ionicons';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, View } from 'react-native';

import { useCart } from '@/core/cart/CartContext';
import { tap } from './Button';
import { Glass } from './Glass';
import { Text } from './Text';
import { radius, TAB_BAR_HEIGHT, usePalette } from './theme';

const ICONS: Record<string, [keyof typeof Ionicons.glyphMap, keyof typeof Ionicons.glyphMap]> = {
  index: ['home', 'home-outline'],
  categories: ['grid', 'grid-outline'],
  cart: ['bag-handle', 'bag-handle-outline'],
  account: ['person-circle', 'person-circle-outline'],
};

// Floating frosted pill tab bar.
export function GlassTabBar({ state, descriptors, navigation, insets }: BottomTabBarProps) {
  const t = usePalette();
  const { count } = useCart();

  return (
    <View style={[styles.wrap, { bottom: Math.max(insets.bottom, 12) }]} pointerEvents="box-none">
      <Glass strong radius={radius.xl} intensity={70} style={styles.bar}>
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const { options } = descriptors[route.key];
          const label = (options.title ?? route.name) as string;
          const [on, off] = ICONS[route.name] ?? ['ellipse', 'ellipse-outline'];

          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={label}
              // The active tab widens to fit its label pill; the others share
              // what's left, so long labels ("Categories") stay on one line.
              style={[styles.item, { flex: focused ? 2.4 : 1 }]}
              onPress={() => {
                tap();
                const e = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!focused && !e.defaultPrevented) navigation.navigate(route.name, route.params);
              }}>
              {focused ? (
                <LinearGradient
                  colors={t.primaryGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.activePill}>
                  <Ionicons name={on} size={20} color="#fff" />
                  <Text variant="tiny" tone="onPrimary" numberOfLines={1} style={{ fontSize: 12, flexShrink: 1 }}>
                    {label}
                  </Text>
                </LinearGradient>
              ) : (
                <View style={styles.inactive}>
                  <Ionicons name={off} size={22} color={t.textMuted} />
                </View>
              )}
              {route.name === 'cart' && count > 0 && (
                <View style={[styles.badge, { backgroundColor: t.danger, borderColor: t.glassStrong }]}>
                  <Text variant="tiny" tone="onPrimary" style={{ fontSize: 10 }}>
                    {count > 99 ? '99+' : count}
                  </Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </Glass>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16 },
  bar: {
    height: TAB_BAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
  },
  item: { alignItems: 'center', justifyContent: 'center', height: '100%' },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    height: 44,
    maxWidth: '100%',
    borderRadius: radius.pill,
  },
  inactive: { height: 44, width: 44, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: 8,
    right: '22%',
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
