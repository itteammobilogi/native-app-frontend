import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { getPushStatus, openNotificationSettings, syncPush, type PushStatus } from '@/core/push';
import { Button } from './Button';
import { Glass } from './Glass';
import { Text } from './Text';
import { radius, usePalette } from './theme';

// "Get order updates" card. Shown only while the user hasn't decided yet, or
// said no (then it links to system settings); hidden once notifications are on.
export function NotifyPrompt() {
  const t = usePalette();
  const [status, setStatus] = useState<PushStatus | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getPushStatus().then(setStatus).catch(() => setStatus('unavailable'));
  }, []);

  if (status !== 'undetermined' && status !== 'denied') return null;

  const enable = async () => {
    if (status === 'denied') return openNotificationSettings();
    setBusy(true);
    setStatus(await syncPush({ prompt: true }));
    setBusy(false);
  };

  return (
    <Glass radius={radius.lg} style={styles.card}>
      <View style={[styles.icon, { backgroundColor: `${t.primary}14` }]}>
        <Ionicons name="notifications" size={20} color={t.primary} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="label">Get order updates</Text>
        <Text variant="caption" tone="muted">
          Know when your order is confirmed, shipped and delivered.
        </Text>
      </View>
      <Button title={status === 'denied' ? 'Settings' : 'Turn on'} size="md" onPress={enable} loading={busy} style={{ minWidth: 92 }} />
    </Glass>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, alignSelf: 'stretch' },
  icon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
