import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, View } from 'react-native';

import type { Sort } from '@/core/api/catalog';
import { tap } from './Button';
import { Sheet } from './Sheet';
import { Text } from './Text';
import { usePalette } from './theme';

export const SORT_LABELS: Record<Sort, string> = {
  created_desc: 'Newest',
  price_asc: 'Price: low to high',
  price_desc: 'Price: high to low',
};

export function SortSheet({
  visible,
  value,
  onChange,
  onClose,
}: {
  visible: boolean;
  value: Sort;
  onChange: (s: Sort) => void;
  onClose: () => void;
}) {
  const t = usePalette();
  return (
    <Sheet visible={visible} onClose={onClose} title="Sort by">
      <View style={{ gap: 4 }}>
        {(Object.keys(SORT_LABELS) as Sort[]).map((s) => (
          <Pressable
            key={s}
            onPress={() => {
              tap();
              onChange(s);
              onClose();
            }}
            style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 12 }}>
            <Ionicons
              name={value === s ? 'radio-button-on' : 'radio-button-off'}
              size={22}
              color={value === s ? t.primary : t.textFaint}
            />
            <Text variant="label" style={{ fontSize: 16 }}>
              {SORT_LABELS[s]}
            </Text>
          </Pressable>
        ))}
      </View>
    </Sheet>
  );
}
