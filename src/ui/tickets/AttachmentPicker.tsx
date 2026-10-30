import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Pressable, StyleSheet, View } from 'react-native';

import type { PickedImage } from '@/core/api/reviews';
import { tap } from '@/ui/Button';
import { usePalette } from '@/ui/theme';

export const MAX_ATTACHMENTS = 5;

// Lets the shopper pick up to 5 photos (the server's ticket limit, 5 MB each).
export async function pickAttachments(current: PickedImage[], max = MAX_ATTACHMENTS): Promise<PickedImage[]> {
  const room = max - current.length;
  if (room <= 0) return current;
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: true,
    selectionLimit: room,
    quality: 0.7,
  });
  if (res.canceled) return current;
  return [...current, ...res.assets.map((a) => ({ uri: a.uri, fileName: a.fileName, mimeType: a.mimeType }))].slice(0, max);
}

export function AttachmentThumbs({
  images,
  onChange,
  showAdd = true,
}: {
  images: PickedImage[];
  onChange: (next: PickedImage[]) => void;
  showAdd?: boolean;
}) {
  const t = usePalette();
  return (
    <View style={styles.row}>
      {images.map((img, i) => (
        <View key={img.uri} style={styles.thumbWrap}>
          <Image source={{ uri: img.uri }} style={styles.thumb} contentFit="cover" />
          <Pressable
            hitSlop={6}
            accessibilityLabel="Remove photo"
            onPress={() => (tap(), onChange(images.filter((_, j) => j !== i)))}
            style={styles.remove}>
            <Ionicons name="close" size={12} color="#fff" />
          </Pressable>
        </View>
      ))}
      {showAdd && images.length < MAX_ATTACHMENTS && (
        <Pressable
          onPress={async () => (tap(), onChange(await pickAttachments(images)))}
          accessibilityLabel="Add photos"
          style={[styles.add, { borderColor: t.textFaint }]}>
          <Ionicons name="camera-outline" size={22} color={t.textMuted} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  thumbWrap: { width: 60, height: 60 },
  thumb: { width: 60, height: 60, borderRadius: 12 },
  remove: { position: 'absolute', top: 3, right: 3, width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  add: { width: 60, height: 60, borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
});
