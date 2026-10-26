import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import type { Order } from '@/core/api/orders';
import type { PickedImage } from '@/core/api/reviews';
import { createTicket } from '@/core/api/tickets';
import { useAuth } from '@/core/auth/AuthContext';
import { Button } from '@/ui/Button';
import { Chip } from '@/ui/Chip';
import { Input } from '@/ui/Input';
import { Sheet } from '@/ui/Sheet';
import { Text } from '@/ui/Text';
import { useToast } from '@/ui/Toast';

import { AttachmentThumbs, MAX_ATTACHMENTS } from './AttachmentPicker';

const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

// Website: the "Raise a Ticket" modal on /tickets. Every ticket is tied to an
// order; `initialOrderId` (internal id) preselects one when opened from an order.
export function RaiseTicketSheet({
  visible,
  onClose,
  orders,
  initialOrderId,
  onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  orders: Order[];
  initialOrderId?: string;
  onCreated: () => void;
}) {
  const toast = useToast();
  const { user } = useAuth();
  const [orderId, setOrderId] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [images, setImages] = useState<PickedImage[]>([]);
  const [busy, setBusy] = useState(false);

  // Reset from the user's profile each time the sheet opens.
  const [wasVisible, setWasVisible] = useState(false);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setOrderId(initialOrderId ?? '');
      setSubject('');
      setDescription('');
      setName(user?.name ?? '');
      setPhone(user?.mobile ?? '');
      setEmail(user?.email ?? '');
      setImages([]);
    }
  }

  const submit = async () => {
    if (!orderId) return toast('Please select an order', 'error');
    if (!subject.trim()) return toast('Please enter a subject', 'error');
    if (!description.trim()) return toast('Please describe your issue', 'error');
    if (!name.trim()) return toast('Please enter your name', 'error');
    if (!phone.trim()) return toast('Please enter your phone number', 'error');
    if (!isEmail(email)) return toast('Please enter a valid email address', 'error');
    setBusy(true);
    try {
      await createTicket({
        orderId,
        subject: subject.trim(),
        description: description.trim(),
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim(),
        images,
      });
      toast('Ticket raised. Our team will get back to you soon.', 'success');
      onCreated();
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to create ticket', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={() => !busy && onClose()} title="Raise a ticket">
      <ScrollView keyboardShouldPersistTaps="handled" style={{ flexShrink: 1 }} contentContainerStyle={{ gap: 14 }}>
        <View style={{ gap: 6 }}>
          <Text variant="caption" tone="muted">
            Order
          </Text>
          {orders.length === 0 ? (
            <Text tone="muted">You need an order to raise a ticket. For anything else, use Help & support.</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {orders.map((o) => (
                <Chip key={o.id} label={o.order_id} active={orderId === String(o.id)} onPress={() => setOrderId(String(o.id))} />
              ))}
            </ScrollView>
          )}
        </View>
        <Input label="Subject" placeholder="Brief subject" value={subject} onChangeText={setSubject} maxLength={150} />
        <Input
          label="Description"
          placeholder="Describe your issue in detail"
          multiline
          value={description}
          onChangeText={setDescription}
          maxLength={2000}
        />
        <Input label="Name" value={name} onChangeText={setName} autoComplete="name" />
        <Input label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" maxLength={13} />
        <Input
          label="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
        />
        <View style={{ gap: 8 }}>
          <Text variant="caption" tone="muted">
            Photos (optional, {images.length}/{MAX_ATTACHMENTS})
          </Text>
          <AttachmentThumbs images={images} onChange={setImages} />
        </View>
        <Button title="Submit ticket" icon="paper-plane" onPress={submit} loading={busy} disabled={orders.length === 0} />
      </ScrollView>
    </Sheet>
  );
}
