import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { Cart, CartLine } from '@/core/api/cart';
import { cartPackages, formatDeliveryDate, itemCountOf, type CartPackage } from '@/core/cartBreakup';
import { formatINR } from '@/core/pricing';
import { tap } from './Button';
import { Glass } from './Glass';
import { Text } from './Text';
import { radius, usePalette } from './theme';

const COLLAPSED_LINES = 3;

// Checkout's "what you're buying": every item with quantity and line total,
// grouped by seller package when the order ships from more than one seller,
// each package with its own delivery/tax/charges from that seller's quote.
export function OrderSummary({ cart }: { cart: Cart }) {
  const t = usePalette();
  const packages = cartPackages(cart);
  const multi = packages.filter((p) => p.lines.length).length > 1;
  const totalLines = packages.reduce((s, p) => s + p.lines.length, 0);
  const [expanded, setExpanded] = useState(totalLines <= COLLAPSED_LINES + 1);
  const unavailable = packages.reduce((s, p) => s + p.unavailable.length, 0);
  const count = itemCountOf(cart);

  // Collapsed: only the first few products across all packages.
  const visibleByTid = new Map<number, CartLine[]>();
  packages.reduce((shown, pkg) => {
    const visible = expanded ? pkg.lines : pkg.lines.slice(0, Math.max(0, COLLAPSED_LINES - shown));
    visibleByTid.set(pkg.tid, visible);
    return shown + visible.length;
  }, 0);

  return (
    <Glass radius={radius.lg} style={{ padding: 16, gap: 14 }}>
      <View style={styles.between}>
        <Text variant="heading">Order summary</Text>
        <Text variant="caption" tone="muted">
          {count} item{count === 1 ? '' : 's'}
          {multi ? ` · ${packages.length} sellers` : ''}
        </Text>
      </View>

      {packages.map((pkg, i) => {
        const visible = visibleByTid.get(pkg.tid) ?? [];
        if (!visible.length) return null;
        return (
          <View key={pkg.tid} style={{ gap: 10 }}>
            {(multi || pkg.deliveryDate) && <PackageHead pkg={pkg} index={i} multi={multi} total={packages.length} />}
            {visible.map((line) => (
              <LineRow key={line.id} line={line} />
            ))}
            {multi && expanded && <PackageCharges pkg={pkg} />}
          </View>
        );
      })}

      {totalLines > COLLAPSED_LINES + 1 && (
        <Pressable
          accessibilityRole="button"
          onPress={() => (tap(), setExpanded((v) => !v))}
          style={[styles.more, { borderColor: t.hairline }]}>
          <Text variant="label" tone="primary">
            {expanded ? 'Show less' : `Show all ${totalLines} products`}
          </Text>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={t.primary} />
        </Pressable>
      )}

      {unavailable > 0 && (
        <View style={[styles.note, { backgroundColor: `${t.warning}14` }]}>
          <Ionicons name="alert-circle-outline" size={16} color={t.warning} />
          <Text variant="caption" style={{ flex: 1, color: t.warning }}>
            {unavailable} unavailable item{unavailable === 1 ? '' : 's'} in your cart won’t be ordered or charged.
          </Text>
        </View>
      )}
    </Glass>
  );
}

function PackageHead({ pkg, index, multi, total }: { pkg: CartPackage; index: number; multi: boolean; total: number }) {
  const t = usePalette();
  const date = formatDeliveryDate(pkg.deliveryDate);
  return (
    <View style={styles.pkgHead}>
      {multi && (
        <View style={[styles.pkgBadge, { backgroundColor: `${t.primary}14` }]}>
          <Ionicons name="cube-outline" size={13} color={t.primary} />
          <Text variant="tiny" tone="primary">
            Package {index + 1} of {total}
          </Text>
        </View>
      )}
      {!!date && (
        <View style={styles.date}>
          <Ionicons name="time-outline" size={13} color={t.success} />
          <Text variant="tiny" tone="success">
            Delivery by {date}
          </Text>
        </View>
      )}
    </View>
  );
}

function LineRow({ line }: { line: CartLine }) {
  const t = usePalette();
  const unit = Number(line.unit_price || 0);
  const total = unit * Number(line.quantity || 0);
  const variant = line.variant_attributes?.map((a) => a.value).filter(Boolean).join(' · ');
  return (
    <View style={styles.line}>
      <View style={styles.thumb}>
        {line.image ? (
          <Image source={{ uri: line.image }} style={{ width: '86%', height: '86%' }} contentFit="contain" transition={150} />
        ) : (
          <Ionicons name="image-outline" size={20} color="#C7CED9" />
        )}
        <View style={[styles.qty, { backgroundColor: t.primary }]}>
          <Text variant="tiny" tone="onPrimary">
            {line.quantity}
          </Text>
        </View>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="label" numberOfLines={2} style={{ fontSize: 13 }}>
          {line.title}
        </Text>
        {!!variant && (
          <Text variant="tiny" tone="muted" numberOfLines={1}>
            {variant}
          </Text>
        )}
        <Text variant="caption" tone="muted">
          {line.quantity} × {formatINR(unit)}
        </Text>
      </View>
      <Text variant="label">{formatINR(total)}</Text>
    </View>
  );
}

function PackageCharges({ pkg }: { pkg: CartPackage }) {
  const t = usePalette();
  const rows: [string, number][] = [
    [`Items (${pkg.itemCount})`, pkg.itemTotal],
    ['Delivery', pkg.delivery],
    ['Taxes', pkg.tax],
    ['Other charges', pkg.misc],
    ['Seller discount', -pkg.discount],
  ];
  return (
    <View style={[styles.charges, { backgroundColor: t.hairline }]}>
      {rows
        .filter(([label, v]) => v !== 0 || label === 'Delivery')
        .map(([label, v]) => (
          <View key={label} style={styles.between}>
            <Text variant="caption" tone="muted">
              {label}
            </Text>
            <Text variant="caption" style={v < 0 || (label === 'Delivery' && v === 0) ? { color: t.success } : undefined}>
              {label === 'Delivery' && v === 0 ? 'Free' : v < 0 ? `− ${formatINR(-v)}` : formatINR(v)}
            </Text>
          </View>
        ))}
      <View style={styles.between}>
        <Text variant="caption" style={{ fontWeight: '700' }}>
          Package total
        </Text>
        <Text variant="caption" style={{ fontWeight: '700' }}>
          {formatINR(pkg.total)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  pkgHead: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  pkgBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  date: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  thumb: { width: 56, height: 56, borderRadius: 12, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  qty: { position: 'absolute', top: -6, right: -6, minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center' },
  charges: { borderRadius: 12, padding: 12, gap: 6 },
  more: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  note: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 12 },
});
