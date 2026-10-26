import { View } from 'react-native';

import { Text } from './Text';
import { usePalette } from './theme';

// ONDC order states → a colour. Unknown states fall back to neutral.
export function OrderStatus({ state }: { state: string }) {
  const t = usePalette();
  const s = (state || 'Pending').toLowerCase();
  const color = /cancel/.test(s)
    ? t.danger
    : /deliver|complete/.test(s)
      ? t.success
      : /accept|progress|ship|transit|out/.test(s)
        ? t.primary
        : t.warning;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: `${color}1A` }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />
      <Text variant="tiny" style={{ color }}>
        {humanize(state || 'Pending')}
      </Text>
    </View>
  );
}

export const humanize = (s: string) => s.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
