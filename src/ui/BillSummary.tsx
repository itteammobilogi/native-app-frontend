import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import type { Cart } from '@/core/api/cart';
import { itemCountOf } from '@/core/cartBreakup';
import { formatINR } from '@/core/pricing';
import { Glass } from './Glass';
import { Text } from './Text';
import { radius, usePalette } from './theme';

// Price breakup exactly as the server quoted it (sellers' ONDC quotes).
export function BillSummary({ cart, discount = 0, total }: { cart: Cart; discount?: number; total?: number }) {
  const t = usePalette();
  const b = cart.breakupSummary ?? {};
  const count = itemCountOf(cart);
  const sellerDiscount = Math.abs(Number(b.discount || 0));
  const couponDiscount = Math.abs(Number(discount || 0));
  const saved = sellerDiscount + couponDiscount;
  const grand = total ?? Number(cart.grandTotal || 0);

  // [label, value, hint]; null value = hide the row.
  const rows: [string, number | null, string?][] = [
    [`Item total (${count} item${count === 1 ? '' : 's'})`, Number(b.item_total ?? 0)],
    ['Delivery charges', b.delivery == null ? null : Number(b.delivery)],
    ['Packing & other charges', Number(b.misc || 0) || null],
    ['Taxes', Number(b.tax || 0) || null],
    ['Seller discount', sellerDiscount ? -sellerDiscount : null],
    ['Coupon discount', couponDiscount ? -couponDiscount : null],
  ];

  return (
    <Glass radius={radius.lg} style={{ padding: 16, gap: 10 }}>
      <Text variant="heading">Bill details</Text>
      {rows
        .filter(([, v]) => v !== null)
        .map(([label, v]) => {
          const value = v as number;
          const free = label === 'Delivery charges' && value === 0;
          return (
            <View key={label} style={styles.row}>
              <Text tone="muted">{label}</Text>
              <Text style={value < 0 || free ? { color: t.success } : undefined}>
                {free ? 'Free' : value < 0 ? `− ${formatINR(-value)}` : formatINR(value)}
              </Text>
            </View>
          );
        })}
      <View style={[styles.divider, { backgroundColor: t.hairline }]} />
      <View style={styles.row}>
        <Text variant="heading">To pay</Text>
        <Text variant="heading">{formatINR(grand)}</Text>
      </View>
      {saved > 0 && (
        <View style={[styles.saved, { backgroundColor: `${t.success}18` }]}>
          <Ionicons name="pricetag" size={14} color={t.success} />
          <Text variant="caption" tone="success" style={{ fontWeight: '700' }}>
            You save {formatINR(saved)} on this order
          </Text>
        </View>
      )}
      <Text variant="tiny" tone="faint">
        Prices, delivery and taxes are as quoted by the sellers on ONDC.
      </Text>
    </Glass>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 2 },
  saved: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10 },
});
