import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { formatAddress, type Address } from '@/core/api/address';
import { tap } from './Button';
import { Glass } from './Glass';
import { Text } from './Text';
import { radius, usePalette } from './theme';

export function AddressCard({
  address,
  selected,
  onPress,
  actions,
}: {
  address: Address;
  selected?: boolean;
  onPress?: () => void;
  actions?: React.ReactNode;
}) {
  const t = usePalette();
  return (
    <Pressable disabled={!onPress} onPress={() => (tap(), onPress?.())}>
      <Glass radius={radius.lg} style={[styles.card, selected && { borderColor: t.primary, borderWidth: 2 }]}>
        <View style={styles.top}>
          {onPress && (
            <Ionicons
              name={selected ? 'radio-button-on' : 'radio-button-off'}
              size={22}
              color={selected ? t.primary : t.textFaint}
            />
          )}
          <Text variant="heading" style={{ flex: 1 }} numberOfLines={1}>
            {address.name}
          </Text>
          {Number(address.is_default) === 1 && (
            <View style={[styles.tag, { backgroundColor: `${t.primary}18` }]}>
              <Text variant="tiny" tone="primary">
                DEFAULT
              </Text>
            </View>
          )}
        </View>
        <Text tone="muted" style={{ lineHeight: 21 }}>
          {formatAddress(address)}
        </Text>
        <View style={styles.phone}>
          <Ionicons name="call-outline" size={13} color={t.textMuted} />
          <Text variant="caption" tone="muted">
            {address.phone}
          </Text>
        </View>
        {actions && <View style={[styles.actions, { borderTopColor: t.hairline }]}>{actions}</View>}
      </Glass>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { padding: 14, gap: 6 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  phone: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  actions: { flexDirection: 'row', gap: 20, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, marginTop: 4 },
});
