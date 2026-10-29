import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { File } from 'expo-file-system';
import * as Speech from 'expo-speech';
import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { transcribeAudio, type AiLanguage } from '@/core/api/chatbot';

// Voice for ZillyAI. Input works like the website widget's MediaRecorder
// path: record a clip, send it to /api/ai/transcribe (Whisper handles
// English, Hindi and Hinglish), use the text. Output reads replies aloud with
// the phone's own text-to-speech.

// Mono, 64 kbps AAC: speech doesn't need the stereo 128k of HIGH_QUALITY, and
// a smaller clip uploads faster (30s ≈ 240 KB). Saved as .m4a (MPEG-4).
// Metering drives the listening bars.
const VOICE_PRESET = { ...RecordingPresets.HIGH_QUALITY, numberOfChannels: 1, bitRate: 64000, isMeteringEnabled: true };
const MAX_SECONDS = 30;

export const voiceSupported = Platform.OS !== 'web';

export type VoiceState = 'idle' | 'listening' | 'transcribing';

export function useVoiceInput({ onText, onError }: { onText: (text: string) => void; onError: (message: string) => void }) {
  const recorder = useAudioRecorder(VOICE_PRESET);
  const status = useAudioRecorderState(recorder, 250);
  const [state, setState] = useState<VoiceState>('idle');
  const cancelled = useRef(false);
  const autoStop = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (autoStop.current) clearTimeout(autoStop.current);
    },
    [],
  );

  const start = async () => {
    if (state !== 'idle') return;
    try {
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) {
        onError(perm.canAskAgain ? 'Microphone permission is needed to talk to ZillyAI.' : 'Allow microphone access for ZillyBuy in Settings to use voice.');
        return;
      }
      Speech.stop();
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      cancelled.current = false;
      setState('listening');
      autoStop.current = setTimeout(() => finish(), MAX_SECONDS * 1000);
    } catch {
      setState('idle');
      onError("Couldn't start the microphone. Please try again.");
    }
  };

  // Stop and transcribe (or, with `discard`, just throw the clip away).
  const finish = async (discard = false) => {
    if (autoStop.current) clearTimeout(autoStop.current);
    autoStop.current = null;
    cancelled.current = discard;
    try {
      await recorder.stop();
    } catch {}
    // Back to playback mode so read-aloud uses the loudspeaker on iOS.
    setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true }).catch(() => {});

    const uri = recorder.uri;
    if (discard || !uri) {
      setState('idle');
      return;
    }
    setState('transcribing');
    const file = new File(uri);
    try {
      const base64 = await file.base64();
      const text = await transcribeAudio(base64, 'audio/mp4');
      if (cancelled.current) return;
      if (text) onText(text);
      else onError("I didn't catch that. Please try again.");
    } catch {
      if (!cancelled.current) onError("Couldn't understand the recording. Check your connection and try again.");
    } finally {
      try {
        file.delete();
      } catch {}
      setState('idle');
    }
  };

  return {
    state,
    seconds: Math.floor((status.durationMillis || 0) / 1000),
    // Normalised mic level 0-1 for the listening animation (iOS/Android
    // report dBFS, roughly -60 silent to 0 loud).
    level: status.metering != null ? Math.min(1, Math.max(0, (status.metering + 60) / 60)) : 0,
    start,
    stop: () => finish(false),
    cancel: () => finish(true),
  };
}

// Strip what shouldn't be read out: markdown, emoji, the ₹ sign (read as "rupees").
function speakable(text: string) {
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_`#>]/g, '')
    .replace(/^\s*[-•]\s+/gm, '')
    .replace(/₹\s?([\d,]+)/g, '$1 rupees')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Read-aloud: one reply at a time; `speakingId` says which one is playing.
export function useSpeaker() {
  const [speakingId, setSpeakingId] = useState<string | null>(null);

  useEffect(() => () => void Speech.stop(), []);

  const speak = (id: string, text: string, language?: AiLanguage | null) => {
    Speech.stop();
    const clean = speakable(text).slice(0, Speech.maxSpeechInputLength || 4000);
    if (!clean) return;
    setSpeakingId(id);
    const done = () => setSpeakingId((cur) => (cur === id ? null : cur));
    Speech.speak(clean, {
      // Hinglish is Latin script, which an Indian-English voice reads best.
      language: language === 'hindi' ? 'hi-IN' : 'en-IN',
      rate: Platform.OS === 'ios' ? 0.52 : 1,
      onDone: done,
      onStopped: done,
      onError: done,
    });
  };

  const stop = () => {
    Speech.stop();
    setSpeakingId(null);
  };

  return { speakingId, speak, stop, toggle: (id: string, text: string, language?: AiLanguage | null) => (speakingId === id ? stop() : speak(id, text, language)) };
}
