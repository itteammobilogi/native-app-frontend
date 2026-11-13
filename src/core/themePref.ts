import { useEffect, useState } from 'react';
import { Appearance } from 'react-native';

import { readJson, writeJson } from '@/core/storage/jsonStore';

// The shopper's light/dark choice. "system" follows the phone; light or dark
// override it app-wide through Appearance, which useColorScheme (and so
// usePalette) reads.
export type ThemeMode = 'system' | 'light' | 'dark';

let mode: ThemeMode = 'system';
const listeners = new Set<(m: ThemeMode) => void>();

const apply = (m: ThemeMode) => Appearance.setColorScheme(m === 'system' ? 'unspecified' : m);

// Called once at launch, before the first screen shows.
export async function loadThemeMode() {
  const saved = await readJson<ThemeMode>('theme', 'system');
  mode = saved === 'light' || saved === 'dark' ? saved : 'system';
  apply(mode);
  listeners.forEach((l) => l(mode));
}

export function setThemeMode(next: ThemeMode) {
  mode = next;
  apply(next);
  writeJson('theme', next);
  listeners.forEach((l) => l(next));
}

export function useThemeMode() {
  const [value, setValue] = useState(mode);
  useEffect(() => {
    listeners.add(setValue);
    return () => void listeners.delete(setValue);
  }, []);
  return value;
}
