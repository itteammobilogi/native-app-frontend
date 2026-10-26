import { View } from 'react-native';

import { humanize } from '@/ui/OrderStatus';
import { Text } from '@/ui/Text';
import { usePalette } from '@/ui/theme';

// Same four states as the website's STATUS_STYLES.
export function TicketStatus({ status }: { status?: string | null }) {
  const t = usePalette();
  const s = (status || 'open').toLowerCase();
  const color = s === 'open' ? t.success : s === 'in_progress' ? t.warning : s === 'resolved' ? t.primary : t.textMuted;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: `${color}1A` }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />
      <Text variant="tiny" style={{ color }}>
        {humanize(s)}
      </Text>
    </View>
  );
}
