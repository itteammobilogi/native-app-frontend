import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Animated, Platform, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Glass } from './Glass';
import { Text } from './Text';
import { usePalette } from './theme';

type Kind = 'success' | 'error' | 'info';
type ToastFn = (message: string, kind?: Kind) => void;

const ToastContext = createContext<ToastFn>(() => {});
export const useToast = () => useContext(ToastContext);

// One app-wide toast, like the website's single <Toaster>.
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const t = usePalette();
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<{ message: string; kind: Kind } | null>(null);
  const [anim] = useState(() => new Animated.Value(0));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback<ToastFn>(
    (message, kind = 'info') => {
      if (timer.current) clearTimeout(timer.current);
      setToast({ message, kind });
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(
          kind === 'error' ? Haptics.NotificationFeedbackType.Error : Haptics.NotificationFeedbackType.Success,
        ).catch(() => {});
      }
      Animated.spring(anim, { toValue: 1, useNativeDriver: true, friction: 8 }).start();
      timer.current = setTimeout(() => {
        Animated.timing(anim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setToast(null));
      }, 2600);
    },
    [anim],
  );

  const icon = toast?.kind === 'success' ? 'checkmark-circle' : toast?.kind === 'error' ? 'alert-circle' : 'information-circle';
  const color = toast?.kind === 'success' ? t.success : toast?.kind === 'error' ? t.danger : t.primary;

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.wrap,
            {
              top: insets.top + 8,
              opacity: anim,
              transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-30, 0] }) }],
            },
          ]}>
          <Glass strong radius={18} style={styles.toast}>
            <Ionicons name={icon} size={20} color={color} />
            <Text variant="label" style={{ flex: 1 }}>
              {toast.message}
            </Text>
          </Glass>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, zIndex: 1000 },
  toast: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 14 },
});
