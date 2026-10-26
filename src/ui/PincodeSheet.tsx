import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { searchPincode, type PincodeLocation } from '@/core/api/address';
import { errorMessage } from '@/core/api/client';
import { useCart } from '@/core/cart/CartContext';
import { placeName, useLocation, type Loc } from '@/core/location/LocationContext';
import { tap } from './Button';
import { Input } from './Input';
import { Sheet } from './Sheet';
import { Text } from './Text';
import { radius, usePalette } from './theme';
import { useToast } from './Toast';

const titleCase = (s: string) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

// Website's LocationModal: type a 6-digit pincode, pick the area from its
// post-office list (or a recent location). Items in the cart were quoted for
// the old pincode, so changing it empties the cart after a confirmation.
export function PincodeSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = usePalette();
  const toast = useToast();
  const { location, recent, selectLocation, selectRecent } = useLocation();
  const { cart, clear } = useCart();
  const [pin, setPin] = useState('');
  const [results, setResults] = useState<PincodeLocation[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);

  // Fresh field every time the sheet opens.
  const [wasVisible, setWasVisible] = useState(false);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setPin('');
      setResults([]);
      setError('');
    }
  }

  // Auto-search once 6 digits are typed (website: 500ms debounce).
  useEffect(() => {
    if (!/^\d{6}$/.test(pin)) return;
    let cancelled = false;
    const id = setTimeout(async () => {
      setSearching(true);
      setError('');
      try {
        const list = await searchPincode(pin);
        if (cancelled) return;
        setResults(list);
        if (!list.length) setError('No locations found for this pincode.');
      } catch (e) {
        if (!cancelled) {
          setResults([]);
          setError(errorMessage(e, 'Location not found for this pincode.'));
        }
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [pin]);

  const onChangePin = (v: string) => {
    const digits = v.replace(/\D/g, '').slice(0, 6);
    setPin(digits);
    if (digits.length < 6) {
      setResults([]);
      setError('');
    }
  };

  // Confirm before a pincode change empties the cart.
  const confirmCartReset = (label: string) =>
    new Promise<boolean>((resolve) => {
      const n = cart.products.length;
      Alert.alert(
        'Change delivery location?',
        `Items in your cart were priced for ${location?.pincode ?? 'your current pincode'}. Delivering to ${label} will remove ${n} item${n === 1 ? '' : 's'} from your cart.`,
        [
          { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Change & clear cart', style: 'destructive', onPress: () => resolve(true) },
        ],
        { cancelable: true, onDismiss: () => resolve(false) },
      );
    });

  const apply = async (id: number, label: string, commit: () => Promise<unknown>) => {
    if (id === location?.pincodeId) return onClose();
    if (cart.products.length && !(await confirmCartReset(label))) return;
    setBusyId(id);
    try {
      if (cart.products.length) await clear().catch(() => toast('Some cart items could not be removed. Please check your cart.', 'error'));
      await commit();
      toast(`Delivering to ${label}`, 'success');
      onClose();
    } finally {
      setBusyId(null);
    }
  };

  const showRecent = pin.length < 6 && recent.length > 0;

  return (
    <Sheet visible={visible} onClose={onClose} title="Delivery location">
      <View style={{ gap: 14, flexShrink: 1 }}>
        {location && (
          <View style={[styles.current, { backgroundColor: `${t.primary}12` }]}>
            <Ionicons name="location" size={16} color={t.primary} />
            <Text variant="caption" style={{ flex: 1 }} numberOfLines={1}>
              Delivering to <Text variant="caption" style={{ fontWeight: '700' }}>{location.label} · {location.pincode}</Text>
            </Text>
          </View>
        )}

        <Input
          icon="search"
          placeholder="Enter 6-digit pincode"
          keyboardType="number-pad"
          maxLength={6}
          value={pin}
          onChangeText={onChangePin}
          error={error}
          autoFocus
        />

        {/* Shrinks to the room left above the keyboard (see Sheet). */}
        <ScrollView style={{ maxHeight: 320, flexShrink: 1 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 8 }}>
          {searching && (
            <View style={styles.searching}>
              <ActivityIndicator color={t.primary} />
              <Text variant="caption" tone="muted">
                Finding areas in {pin}…
              </Text>
            </View>
          )}

          {!searching && results.length > 0 && (
            <>
              <Text variant="caption" tone="muted">
                Select your area ({results.length})
              </Text>
              {results.map((r) => (
                <PlaceRow
                  key={r.id}
                  icon="location-outline"
                  title={placeName(r.office_name)}
                  subtitle={`${titleCase(r.district)}, ${titleCase(r.state_name)} · ${r.pincode || pin}`}
                  selected={r.id === location?.pincodeId}
                  busy={busyId === r.id}
                  onPress={() => apply(r.id, `${placeName(r.office_name)}, ${titleCase(r.district)}`, () => selectLocation(r, pin))}
                />
              ))}
            </>
          )}

          {showRecent && (
            <>
              <Text variant="caption" tone="muted">
                Recent locations
              </Text>
              {recent.map((l: NonNullable<Loc>) => (
                <PlaceRow
                  key={l.pincodeId}
                  icon="time-outline"
                  title={l.label}
                  subtitle={l.pincode}
                  selected={l.pincodeId === location?.pincodeId}
                  busy={busyId === l.pincodeId}
                  onPress={() => apply(l.pincodeId, l.label, () => selectRecent(l))}
                />
              ))}
            </>
          )}

          {pin.length < 6 && !showRecent && (
            <Text variant="caption" tone="muted" style={{ textAlign: 'center', paddingVertical: 8 }}>
              Type your pincode to see the areas we deliver to.
            </Text>
          )}
        </ScrollView>
      </View>
    </Sheet>
  );
}

function PlaceRow({
  icon,
  title,
  subtitle,
  selected,
  busy,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  selected: boolean;
  busy: boolean;
  onPress: () => void;
}) {
  const t = usePalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={() => (tap(), onPress())}
      style={({ pressed }) => [
        styles.row,
        { borderColor: selected ? t.primary : t.hairline, backgroundColor: pressed ? t.hairline : selected ? `${t.primary}0D` : 'transparent' },
      ]}>
      <Ionicons name={icon} size={18} color={selected ? t.primary : t.textMuted} />
      <View style={{ flex: 1 }}>
        <Text variant="label" numberOfLines={1}>
          {title}
        </Text>
        <Text variant="caption" tone="muted" numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      {busy ? (
        <ActivityIndicator size="small" color={t.primary} />
      ) : selected ? (
        <Ionicons name="checkmark-circle" size={20} color={t.primary} />
      ) : (
        <Ionicons name="chevron-forward" size={16} color={t.textFaint} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  current: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: radius.md },
  searching: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 11, borderRadius: radius.md, borderWidth: 1 },
});
