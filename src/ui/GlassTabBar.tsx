import Ionicons from '@expo/vector-icons/Ionicons';
import { router, type Href } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets, type EdgeInsets } from 'react-native-safe-area-context';

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

const PAD = 6;
const PILL_W = 56;
const PILL_H = 32;
const GAP = 3;
const LABEL_H = 14;
const ITEM_H = PILL_H + GAP + LABEL_H;
const DOCKED_H = 60;

// Android's 3-button navigation bar is 48dp tall; the gesture handle is about
// half that. With buttons, a floating pill would hover awkwardly above them,
// so the bar docks full width and its solid fill runs down behind the system
// buttons, the way Instagram's does.
const usesButtonNav = (bottomInset: number) => Platform.OS === 'android' && bottomInset >= 40;

// Height the bar covers above the bottom safe-area inset, so pages can pad
// their content clear of it.
export function tabBarSpace(bottomInset: number) {
  return usesButtonNav(bottomInset) ? DOCKED_H : Math.max(bottomInset, 12) - bottomInset + TAB_BAR_HEIGHT;
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

// Floating frosted tab bar (docked full width on 3-button Android phones).
// Every tab gets the same width (icon over label), so nothing shifts when the
// selection changes; a gradient pill slides under the active icon.
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
  const [bar, setBar] = useState({ width: 0, height: 0 });
  const itemWidth = bar.width ? (bar.width - PAD * 2) / tabs.length : 0;
  const docked = usesButtonNav(insets.bottom);
  const dockedFill = t.dark ? '#0B1230' : '#FFFFFF';

  // The pill jumps into place on first layout and slides on later changes.
  const x = useSharedValue(0);
  const placed = useRef(false);
  useEffect(() => {
    if (!itemWidth) return;
    const to = PAD + activeIndex * itemWidth + (itemWidth - PILL_W) / 2;
    x.value = placed.current ? withSpring(to, { damping: 18, stiffness: 220 }) : to;
    placed.current = true;
  }, [activeIndex, itemWidth, x]);
  const pillStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  const row = (
    <View style={styles.row} onLayout={(e) => setBar(e.nativeEvent.layout)}>
      {!!itemWidth && activeIndex >= 0 && (
        // Same vertical spot as each item's icon box in its centred icon-over-label column.
        <Animated.View style={[styles.pill, { top: (bar.height - ITEM_H) / 2 }, pillStyle]}>
          <LinearGradient colors={t.primaryGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        </Animated.View>
      )}
      {tabs.map((tab, index) => {
        const focused = activeIndex === index;
        const [on, off] = ICONS[tab.name] ?? ['ellipse', 'ellipse-outline'];

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
            <View style={styles.icon}>
              <Ionicons name={focused ? on : off} size={22} color={focused ? '#fff' : t.textMuted} />
              {tab.name === 'cart' && count > 0 && (
                <View style={[styles.badge, { backgroundColor: t.danger, borderColor: docked ? dockedFill : t.glassStrong }]}>
                  <Text variant="tiny" tone="onPrimary" style={{ fontSize: 10 }}>
                    {count > 99 ? '99+' : count}
                  </Text>
                </View>
              )}
            </View>
            <Text
              variant="tiny"
              numberOfLines={1}
              style={[styles.label, { color: focused ? t.primary : t.textMuted, fontWeight: focused ? '700' : '500' }]}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  if (docked) {
    return (
      <View style={[styles.docked, { paddingBottom: insets.bottom, backgroundColor: dockedFill, borderTopColor: t.hairline }]}>
        <View style={{ height: DOCKED_H }}>{row}</View>
      </View>
    );
  }

  return (
    <View style={[styles.wrap, { bottom: Math.max(insets.bottom, 12) }]} pointerEvents="box-none">
      <Glass strong radius={radius.xl} intensity={70} style={styles.bar}>
        {row}
      </Glass>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16 },
  bar: { height: TAB_BAR_HEIGHT },
  // Pinned to the screen bottom; the padding fills in behind the system buttons.
  docked: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopWidth: StyleSheet.hairlineWidth },
  row: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: PAD },
  item: { flex: 1, height: '100%', alignItems: 'center', justifyContent: 'center', gap: GAP },
  icon: { width: PILL_W, height: PILL_H, alignItems: 'center', justifyContent: 'center' },
  pill: {
    position: 'absolute',
    left: 0,
    width: PILL_W,
    height: PILL_H,
    borderRadius: PILL_H / 2,
    overflow: 'hidden',
  },
  label: { fontSize: 11, lineHeight: LABEL_H },
  badge: {
    position: 'absolute',
    top: -4,
    right: 6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
