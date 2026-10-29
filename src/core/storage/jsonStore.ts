import { File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

// Small JSON documents kept on the device (wishlist, recently viewed).
// SecureStore is meant for secrets and warns past ~2 KB, so lists live in a
// file in the app's document directory instead; web uses localStorage.
const web = Platform.OS === 'web';
const fileFor = (name: string) => new File(Paths.document, `zb-${name}.json`);

export async function readJson<T>(name: string, fallback: T): Promise<T> {
  try {
    const raw = web ? globalThis.localStorage?.getItem(`zb-${name}`) : fileFor(name).exists ? await fileFor(name).text() : null;
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJson(name: string, value: unknown) {
  try {
    const raw = JSON.stringify(value);
    if (web) return void globalThis.localStorage?.setItem(`zb-${name}`, raw);
    fileFor(name).write(raw);
  } catch {
    // Losing a wishlist write is not worth crashing over.
  }
}
