import Ionicons from '@expo/vector-icons/Ionicons';
import { router, type Href } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets, type EdgeInsets } from 'react-native-safe-area-context';

import { useCart } from '@/core/cart/CartContext';
import { tap } from './Button';
import { Text } from './Text';
import { TAB_BAR_HEIGHT, usePalette } from './theme';

// Same icons as the website's mobile bottom nav (lucide Home, LayoutGrid,
// ShoppingCart, User).
const ICONS: Record<string, [keyof typeof Ionicons.glyphMap, keyof typeof Ionicons.glyphMap]> = {
  index: ['home', 'home-outline'],
  categories: ['grid', 'grid-outline'],
  cart: ['cart', 'cart-outline'],
  account: ['person', 'person-outline'],
};

// The bar is docked to the screen bottom and its fill runs down behind the
// system navigation, so it covers TAB_BAR_HEIGHT above the bottom inset.
export function tabBarSpace(_bottomInset: number) {
  return TAB_BAR_HEIGHT;
}

// Safe-area insets for a page that shows PageTabBar (via Screen's `tabBar`):
// the bottom includes the bar, so `insets.bottom + n` padding and bottom
// action bars sit clear of it.
export function usePageInsets() {
  const insets = useSafeAreaInsets();
  return { ...insets, bottom: insets.bottom + tabBarSpace(insets.bottom) };
}

export type TabName = 'index' | 'categories' | 'cart' | 'account';

const TABS: { name: TabName; label: string; href: Href }[] = [
  { name: 'index', label: 'Home', href: '/' },
  { name: 'categories', label: 'Categories', href: '/categories' },
  { name: 'cart', label: 'Cart', href: '/cart' },
  { name: 'account', label: 'Account', href: '/account' },
];

// The tabs navigator's bar.
export function GlassTabBar({ state, descriptors, navigation, insets }: BottomTabBarProps) {
  return (
    <TabBar
      tabs={state.routes.map((route) => ({ key: route.key, name: route.name, label: (descriptors[route.key].options.title ?? route.name) as string }))}
      index={state.index}
      insets={insets}
      onSelect={(i) => {
        const route = state.routes[i];
        const e = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
        if (i !== state.index && !e.defaultPrevented) navigation.navigate(route.name, route.params);
      }}
    />
  );
}

// The same bar on pages pushed over the tabs (category, collection, brand…),
// with the section the page belongs to highlighted. A tap unwinds back to the
// tabs and switches to that tab, so pages don't pile up.
export function PageTabBar({ active }: { active: TabName }) {
  const insets = useSafeAreaInsets();
  return (
    <TabBar
      tabs={TABS.map((tab) => ({ key: tab.name, name: tab.name, label: tab.label }))}
      index={TABS.findIndex((tab) => tab.name === active)}
      insets={insets}
      onSelect={(i) => {
        if (router.canDismiss()) router.dismissAll();
        router.navigate(TABS[i].href);
      }}
    />
  );
}

// Matches the website's mobile bottom nav: a solid bar docked full width with
// a soft upward shadow; the active tab turns brand blue with a filled icon.
function TabBar({
  tabs,
  index: activeIndex,
  insets,
  onSelect,
}: {
  tabs: { key: string; name: string; label: string }[];
  index: number;
  insets: EdgeInsets;
  onSelect: (index: number) => void;
}) {
  const t = usePalette();
  const { count } = useCart();
  const fill = t.dark ? '#0B1230' : '#FFFFFF';
  const inactive = t.dark ? t.textMuted : '#9CA3AF'; // website: text-gray-400

  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom, backgroundColor: fill, borderTopColor: t.hairline }]}>
      <View style={styles.row}>
        {tabs.map((tab, index) => {
          const focused = activeIndex === index;
          const [on, off] = ICONS[tab.name] ?? ['ellipse', 'ellipse-outline'];
          const color = focused ? t.primary : inactive;

          return (
            <Pressable
              key={tab.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={tab.label}
              style={styles.item}
              onPress={() => {
                tap();
                onSelect(index);
              }}>
              {focused && <View style={[styles.indicator, { backgroundColor: t.primary }]} />}
              <View>
                <Ionicons name={focused ? on : off} size={24} color={color} />
                {tab.name === 'cart' && count > 0 && (
                  <View style={[styles.badge, { borderColor: fill }]}>
                    <Text variant="tiny" tone="onPrimary" style={{ fontSize: 10, lineHeight: 12 }}>
                      {count > 99 ? '99+' : count}
                    </Text>
                  </View>
                )}
              </View>
              <Text variant="tiny" numberOfLines={1} style={[styles.label, { color, fontWeight: focused ? '700' : '500' }]}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Pinned to the screen bottom; the padding fills in behind the system buttons.
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    // The website's soft upward shadow. Not a blurred boxShadow: the bar sits
    // over scrolling content, and Android redraws that blur every frame,
    // which made scrolling stutter. Elevation is drawn by the system for free.
    elevation: 12,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -4 },
  },
  row: { height: TAB_BAR_HEIGHT, flexDirection: 'row', alignItems: 'stretch', paddingHorizontal: 8 },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
  indicator: { position: 'absolute', top: 0, width: 28, height: 3, borderBottomLeftRadius: 3, borderBottomRightRadius: 3 },
  label: { fontSize: 11, lineHeight: 14 },
  badge: {
    position: 'absolute',
    top: -5,
    right: -10,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    borderWidth: 2,
    backgroundColor: '#DB2777', // website: bg-pink-600
    alignItems: 'center',
    justifyContent: 'center',
  },
});
