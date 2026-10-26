import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Background } from './Background';
import { Button, IconButton } from './Button';
import { Glass } from './Glass';
import { Text } from './Text';
import { usePalette } from './theme';

// Gradient backdrop + status bar for every screen.
export function Screen({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const t = usePalette();
  return (
    <View style={[{ flex: 1 }, style]}>
      <StatusBar style={t.dark ? 'light' : 'dark'} />
      <Background />
      {children}
    </View>
  );
}

// Floating header for stack screens: glass back button, title, optional right slot.
export function Header({ title, right, back = true }: { title?: string; right?: React.ReactNode; back?: boolean }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      {back ? (
        <IconButton
          icon="chevron-back"
          label="Back"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        />
      ) : (
        <View style={{ width: 42 }} />
      )}
      <Text variant="heading" numberOfLines={1} style={{ flex: 1, textAlign: 'center' }}>
        {title}
      </Text>
      <View style={{ minWidth: 42, alignItems: 'flex-end' }}>{right}</View>
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  message,
  action,
  onAction,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  message?: string;
  action?: string;
  onAction?: () => void;
}) {
  const t = usePalette();
  return (
    <View style={styles.empty}>
      <Glass radius={48} style={styles.emptyIcon}>
        <Ionicons name={icon} size={40} color={t.primary} />
      </Glass>
      <Text variant="title" style={{ textAlign: 'center' }}>
        {title}
      </Text>
      {message && (
        <Text tone="muted" style={{ textAlign: 'center' }}>
          {message}
        </Text>
      )}
      {action && <Button title={action} onPress={onAction} style={{ marginTop: 8, alignSelf: 'stretch' }} />}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <EmptyState icon="cloud-offline-outline" title="Couldn't load" message={message} action="Try again" onAction={onRetry} />;
}

// Section title row with optional "See all".
export function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.section}>
      <Text variant="heading">{title}</Text>
      {action && (
        <Text variant="label" tone="primary" onPress={onAction} suppressHighlighting>
          {action}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 10 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 32 },
  emptyIcon: { width: 96, height: 96, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  section: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 12 },
});
