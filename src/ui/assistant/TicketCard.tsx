import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import type { AiLanguage, AiTicketOffer } from '@/core/api/chatbot';
import type { PickedImage } from '@/core/api/reviews';
import { MAX_TICKET_PHOTOS, ticketText } from '@/core/assistant/ticketText';
import { tap } from '../Button';
import { Glass } from '../Glass';
import { Text } from '../Text';
import { radius, usePalette } from '../theme';
import { AttachmentThumbs, pickAttachments } from '../tickets/AttachmentPicker';

// Under the reply that offers a ticket (website: ui/TicketCard.jsx): the order
// it is for and, when the problem is with a delivered item, a photo step
// (1-3 photos, or "No photo"). Every button sends its text as the shopper's
// message, so tapping and typing "yes" / "rehne do" go through the same flow.
export function TicketOfferCard({
  offer,
  language,
  photos,
  onPhotos,
  onSend,
  disabled,
}: {
  offer: AiTicketOffer;
  language?: AiLanguage | null;
  photos: PickedImage[];
  onPhotos: (next: PickedImage[]) => void;
  onSend: (text: string) => void;
  disabled?: boolean;
}) {
  const t = usePalette();
  const copy = ticketText(language);
  const canAddMore = photos.length < MAX_TICKET_PHOTOS;
  const addPhotos = async () => {
    tap();
    onPhotos(await pickAttachments(photos, MAX_TICKET_PHOTOS));
  };

  const button = (label: string, onPress: () => void, primary = false, icon?: 'camera-outline') => (
    <Pressable
      key={label}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.btn,
        primary ? { backgroundColor: t.primary } : { borderWidth: 1, borderColor: t.hairline },
        { opacity: disabled ? 0.5 : pressed ? 0.8 : 1 },
      ]}>
      {!!icon && <Ionicons name={icon} size={15} color={primary ? '#fff' : t.text} />}
      <Text variant="caption" tone={primary ? 'onPrimary' : 'default'} style={{ fontWeight: '700' }}>
        {label}
      </Text>
    </Pressable>
  );

  return (
    <Glass radius={radius.lg} style={styles.card}>
      <View style={styles.head}>
        <View style={[styles.icon, { backgroundColor: `${t.warning}1F` }]}>
          <Ionicons name="headset-outline" size={17} color={t.warning} />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="label">{copy.title}</Text>
          <Text variant="caption" tone="muted" numberOfLines={1}>
            Order #{offer.orderLabel}
            {offer.itemTitle ? ` · ${offer.itemTitle}` : ''}
          </Text>
        </View>
      </View>

      {offer.needsPhoto && (
        <>
          <Text variant="caption" tone="muted">
            {copy.photoAsk}
          </Text>
          {photos.length > 0 && <AttachmentThumbs images={photos} onChange={onPhotos} showAdd={false} />}
        </>
      )}

      <View style={styles.row}>
        {offer.needsPhoto && !photos.length ? (
          <>
            {button(copy.addPhoto, addPhotos, true, 'camera-outline')}
            {button(copy.noPhoto, () => (tap(), onSend(copy.sendNoPhoto)))}
          </>
        ) : (
          <>
            {button(copy.raise, () => (tap(), onSend(copy.sendRaise)), true)}
            {offer.needsPhoto && canAddMore && button(copy.addAnother, addPhotos, false, 'camera-outline')}
          </>
        )}
        {button(copy.notNow, () => (tap(), onSend(copy.sendNotNow)))}
      </View>
    </Glass>
  );
}

const styles = StyleSheet.create({
  card: { padding: 12, gap: 10 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 40, paddingHorizontal: 14, borderRadius: 12 },
});
