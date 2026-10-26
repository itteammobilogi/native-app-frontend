import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { submitReview, type MyReview, type PickedImage } from '@/core/api/reviews';
import { Button, tap } from '@/ui/Button';
import { Input } from '@/ui/Input';
import { Sheet } from '@/ui/Sheet';
import { Text } from '@/ui/Text';
import { radius, usePalette } from '@/ui/theme';
import { useToast } from '@/ui/Toast';
import { StarPicker } from './StarRating';

const MAX_IMAGES = 5;
const LABELS = ['', 'Terrible', 'Bad', 'Okay', 'Good', 'Excellent'];

// Same fields and limits as the website's WriteReviewModal.
export function WriteReviewSheet({
  visible,
  onClose,
  productId,
  existing,
  onSubmitted,
}: {
  visible: boolean;
  onClose: () => void;
  productId: number;
  existing: MyReview | null;
  onSubmitted: () => void;
}) {
  const t = usePalette();
  const toast = useToast();
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [images, setImages] = useState<PickedImage[]>([]);
  const [busy, setBusy] = useState(false);

  // Prefill from the existing review each time the sheet opens (state
  // adjusted during render on the visible change, per the React docs pattern).
  const [wasVisible, setWasVisible] = useState(false);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setRating(existing?.rating ?? 0);
      setTitle(existing?.title ?? '');
      setBody(existing?.body ?? '');
      setImages([]);
    }
  }

  const pick = async () => {
    const room = MAX_IMAGES - images.length;
    if (room <= 0) return toast(`You can upload up to ${MAX_IMAGES} photos.`, 'info');
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: room,
      quality: 0.7, // server caps each photo at 5 MB
    });
    if (res.canceled) return;
    setImages((prev) =>
      [...prev, ...res.assets.map((a) => ({ uri: a.uri, fileName: a.fileName, mimeType: a.mimeType }))].slice(0, MAX_IMAGES),
    );
  };

  const submit = async () => {
    if (!rating) return toast('Please select a star rating.', 'error');
    setBusy(true);
    try {
      await submitReview({ product_id: productId, rating, title: title.trim(), body: body.trim(), images });
      toast('Thanks! Your review will appear after approval.', 'success');
      onSubmitted();
      onClose();
    } catch (e: any) {
      toast(e?.message ?? 'Failed to submit review.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={() => !busy && onClose()} title={existing ? 'Edit your review' : 'Write a review'}>
      <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 560, flexShrink: 1 }} contentContainerStyle={{ gap: 16 }}>
        {existing && (
          <View style={[styles.note, { backgroundColor: `${t.warning}1A` }]}>
            <Ionicons name="information-circle" size={16} color={t.warning} />
            <Text variant="caption" style={{ flex: 1, color: t.warning }}>
              Submitting will replace your previous review.
            </Text>
          </View>
        )}

        <View style={{ gap: 8, alignItems: 'center' }}>
          <StarPicker value={rating} onChange={setRating} />
          <Text variant="label" tone={rating ? 'default' : 'faint'}>
            {rating ? LABELS[rating] : 'Tap to rate'}
          </Text>
        </View>

        <Input label="Title (optional)" value={title} onChangeText={setTitle} maxLength={120} placeholder="Summarize your experience" />
        <Input
          label="Your review (optional)"
          value={body}
          onChangeText={setBody}
          maxLength={2000}
          multiline
          placeholder="What did you like or dislike?"
        />

        <View style={{ gap: 8 }}>
          <Text variant="caption" tone="muted">
            Add photos ({images.length}/{MAX_IMAGES})
          </Text>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {images.map((img, i) => (
              <View key={img.uri} style={styles.thumbWrap}>
                <Image source={{ uri: img.uri }} style={styles.thumb} contentFit="cover" />
                <Pressable
                  hitSlop={6}
                  accessibilityLabel="Remove photo"
                  onPress={() => (tap(), setImages((prev) => prev.filter((_, j) => j !== i)))}
                  style={styles.remove}>
                  <Ionicons name="close" size={12} color="#fff" />
                </Pressable>
              </View>
            ))}
            {images.length < MAX_IMAGES && (
              <Pressable onPress={() => (tap(), pick())} accessibilityLabel="Add photos" style={[styles.add, { borderColor: t.textFaint }]}>
                <Ionicons name="camera-outline" size={22} color={t.textMuted} />
              </Pressable>
            )}
          </View>
        </View>

        <Button title="Submit review" onPress={submit} loading={busy} />
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  note: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: radius.sm },
  thumbWrap: { width: 68, height: 68 },
  thumb: { width: 68, height: 68, borderRadius: 12 },
  remove: { position: 'absolute', top: 3, right: 3, width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  add: { width: 68, height: 68, borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
});
