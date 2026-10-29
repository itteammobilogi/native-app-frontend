import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import type { PickedPhoto } from '@/core/assistant/useAssistant';
import { voiceSupported, type useVoiceInput } from '@/core/assistant/useVoice';
import { tap } from '../Button';
import { Glass } from '../Glass';
import { Sheet } from '../Sheet';
import { Text } from '../Text';
import { radius, usePalette } from '../theme';

// ZillyAI's input bar (the widget's ui/Composer.jsx): photo search, the text
// box, voice, and Send — which becomes Stop while a reply is on its way. With
// an empty box the send button is the mic, as in most chat apps.

type Voice = ReturnType<typeof useVoiceInput>;

// The vision route takes up to 4 MB of base64; 1024px JPEG is ~150-300 KB and
// plenty to name a product.
async function shrink(uri: string): Promise<PickedPhoto> {
  const image = await ImageManipulator.manipulate(uri).resize({ width: 1024, height: null }).renderAsync();
  const out = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.7, base64: true });
  return { uri: out.uri, base64: out.base64 ?? '', mimeType: 'image/jpeg' };
}

export function Composer({
  draft,
  onChange,
  onSend,
  busy,
  onStop,
  photo,
  onPhoto,
  voice,
  onError,
}: {
  draft: string;
  onChange: (s: string) => void;
  onSend: () => void;
  busy: boolean;
  onStop: () => void;
  photo: PickedPhoto | null;
  onPhoto: (p: PickedPhoto | null) => void;
  voice: Voice;
  onError: (message: string) => void;
}) {
  const t = usePalette();
  const [sourceOpen, setSourceOpen] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const canSend = !busy && (!!draft.trim() || !!photo);

  const pick = async (from: 'camera' | 'library') => {
    setSourceOpen(false);
    try {
      if (from === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) return onError('Camera permission is needed to search with a photo.');
      }
      const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1 };
      const res = from === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
      if (res.canceled || !res.assets[0]) return;
      setPreparing(true);
      onPhoto(await shrink(res.assets[0].uri));
    } catch {
      onError("Couldn't open that photo. Please try another.");
    } finally {
      setPreparing(false);
    }
  };

  const listening = voice.state === 'listening';
  const transcribing = voice.state === 'transcribing';

  return (
    <>
      {(!!photo || preparing) && (
        <View style={styles.photoRow}>
          <View style={[styles.photo, { backgroundColor: t.skeleton }]}>
            {photo ? <Image source={{ uri: photo.uri }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <ActivityIndicator color={t.primary} />}
            {!!photo && (
              <Pressable onPress={() => (tap(), onPhoto(null))} style={[styles.photoX, { backgroundColor: t.glassStrong }]} hitSlop={8} accessibilityLabel="Remove photo">
                <Ionicons name="close" size={13} color={t.text} />
              </Pressable>
            )}
          </View>
          <Text variant="caption" tone="muted" style={{ flex: 1 }}>
            {photo ? 'Photo ready — add a note (optional) and send to find it.' : 'Preparing photo…'}
          </Text>
        </View>
      )}

      <Glass strong radius={26} style={styles.bar}>
        {listening || transcribing ? (
          <>
            <Pressable onPress={() => (tap(), voice.cancel())} style={styles.side} accessibilityRole="button" accessibilityLabel="Cancel voice input" disabled={transcribing}>
              <Ionicons name="close" size={22} color={transcribing ? t.textFaint : t.textMuted} />
            </Pressable>
            <View style={styles.listening}>
              {listening ? <LevelBars level={voice.level} /> : <ActivityIndicator size="small" color={t.primary} />}
              <Text variant="label" tone={listening ? 'default' : 'muted'}>
                {listening ? `Listening… 0:${String(voice.seconds).padStart(2, '0')}` : 'Understanding…'}
              </Text>
            </View>
            <RoundButton icon="checkmark" label="Done speaking" onPress={voice.stop} active={listening} disabled={transcribing} pulse={listening} />
          </>
        ) : (
          <>
            <Pressable
              onPress={() => (tap(), setSourceOpen(true))}
              style={styles.side}
              accessibilityRole="button"
              accessibilityLabel="Search with a photo"
              disabled={busy}>
              <Ionicons name="camera-outline" size={23} color={t.textMuted} />
            </Pressable>
            <TextInput
              value={draft}
              onChangeText={onChange}
              placeholder={photo ? 'Add a note (optional)…' : 'Ask about products, orders…'}
              placeholderTextColor={t.textFaint}
              selectionColor={t.primary}
              style={[styles.input, { color: t.text }]}
              multiline
              maxLength={500}
              accessibilityLabel="Message ZillyAI"
              onSubmitEditing={() => canSend && onSend()}
              submitBehavior="submit"
              returnKeyType="send"
            />
            {busy ? (
              <RoundButton icon="stop" label="Stop response" onPress={onStop} active solid />
            ) : canSend || !voiceSupported ? (
              <RoundButton icon="arrow-up" label="Send" onPress={onSend} active={canSend} disabled={!canSend} />
            ) : (
              <RoundButton icon="mic" label="Speak your question" onPress={voice.start} active />
            )}
          </>
        )}
      </Glass>

      <Sheet visible={sourceOpen} onClose={() => setSourceOpen(false)} title="Search with a photo">
        <View style={{ gap: 10 }}>
          <Text tone="muted" style={{ marginBottom: 4 }}>
            Snap or pick a product photo and ZillyAI will find it, or something like it, in the store.
          </Text>
          <SourceRow icon="camera" label="Take a photo" onPress={() => pick('camera')} />
          <SourceRow icon="images" label="Choose from gallery" onPress={() => pick('library')} />
        </View>
      </Sheet>
    </>
  );
}

function SourceRow({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  const t = usePalette();
  return (
    <Pressable onPress={() => (tap(), onPress())} style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.98 : 1 }] })}>
      <Glass radius={radius.lg} style={styles.sourceRow}>
        <View style={[styles.sourceIcon, { backgroundColor: `${t.primary}18` }]}>
          <Ionicons name={icon as any} size={20} color={t.primary} />
        </View>
        <Text variant="label" style={{ flex: 1 }}>
          {label}
        </Text>
        <Ionicons name="chevron-forward" size={18} color={t.textFaint} />
      </Glass>
    </Pressable>
  );
}

function RoundButton({
  icon,
  label,
  onPress,
  active,
  disabled,
  solid,
  pulse,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  active?: boolean;
  disabled?: boolean;
  solid?: boolean;
  pulse?: boolean;
}) {
  const t = usePalette();
  const ring = useSharedValue(0);
  useEffect(() => {
    ring.value = pulse ? withRepeat(withTiming(1, { duration: 1100 }), -1, false) : 0;
  }, [pulse, ring]);
  const ringStyle = useAnimatedStyle(() => ({ opacity: 0.5 * (1 - ring.value), transform: [{ scale: 1 + ring.value * 0.6 }] }));

  const colors: readonly [string, string] = solid ? [t.text, t.text] : active ? [t.primary, t.accent] : [t.hairline, t.hairline];
  return (
    <Pressable onPress={() => (tap(), onPress())} disabled={disabled} accessibilityRole="button" accessibilityLabel={label}>
      <View>
        {pulse && <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: 20, backgroundColor: t.accent }, ringStyle]} />}
        <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.send}>
          <Ionicons name={icon as any} size={icon === 'stop' ? 15 : 20} color={solid ? t.dark ? '#000' : '#fff' : active ? '#fff' : t.textFaint} />
        </LinearGradient>
      </View>
    </Pressable>
  );
}

// Five bars that follow the mic level while listening.
function LevelBars({ level }: { level: number }) {
  const t = usePalette();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, height: 22 }}>
      {[0.5, 0.8, 1, 0.8, 0.5].map((k, i) => (
        <View key={i} style={{ width: 3, borderRadius: 2, backgroundColor: t.danger, height: 5 + 17 * Math.max(0.15, level * k) }} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, paddingLeft: 4, paddingRight: 6, paddingVertical: 6 },
  side: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20 },
  input: { flex: 1, fontSize: 15, maxHeight: 110, paddingTop: 10, paddingBottom: 10 },
  listening: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, height: 40 },
  send: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 4, marginBottom: 8 },
  photo: { width: 60, height: 60, borderRadius: 14, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  photoX: { position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  sourceRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  sourceIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
