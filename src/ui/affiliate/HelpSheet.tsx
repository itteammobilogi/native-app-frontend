import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { sendAffiliateHelp } from '@/core/api/affiliate';
import { Button } from '@/ui/Button';
import { Chip } from '@/ui/Chip';
import { Input } from '@/ui/Input';
import { Sheet } from '@/ui/Sheet';
import { Text } from '@/ui/Text';
import { useToast } from '@/ui/Toast';

const TOPICS = ['My commission', 'My payout', 'My payment details', 'My link', 'Something else'];

// Website: components/affiliate/HelpDialog.js. The server files it as a
// support ticket.
export function HelpSheet({ visible, onClose, supportEmail }: { visible: boolean; onClose: () => void; supportEmail?: string | null }) {
  const toast = useToast();
  const [topic, setTopic] = useState(TOPICS[0]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const send = async () => {
    if (message.trim().length < 10) return toast('Tell us a little more (at least 10 characters).', 'error');
    setBusy(true);
    try {
      await sendAffiliateHelp(topic, message.trim());
      toast("Sent. You'll find it under Support tickets.", 'success');
      setMessage('');
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Something went wrong.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={() => !busy && onClose()} title="Need help?">
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 14 }}>
        <View style={{ gap: 6 }}>
          <Text variant="caption" tone="muted">
            What is it about?
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {TOPICS.map((x) => (
              <Chip key={x} label={x} active={topic === x} onPress={() => setTopic(x)} />
            ))}
          </View>
        </View>
        <Input label="Your question" value={message} onChangeText={setMessage} multiline maxLength={3000} />
        <Button title="Send" icon="paper-plane" onPress={send} loading={busy} />
        {!!supportEmail && (
          <Text variant="caption" tone="muted" style={{ textAlign: 'center' }} selectable>
            Or email us at {supportEmail}
          </Text>
        )}
      </ScrollView>
    </Sheet>
  );
}
