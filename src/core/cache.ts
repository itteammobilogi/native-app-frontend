import { readJson, writeJson } from '@/core/storage/jsonStore';

// Response cache behind useAsync/usePaged. The API answers in ~1–2 s even for
// tiny payloads (the website hides this with server rendering and caches), so
// screens show the last answer straight away and refresh it in the background
// (stale-while-revalidate). Entries live in memory for the session; `persist`
// ones (the home page) are also written to disk so a cold start isn't blank.
// Only public catalogue data goes in here: nothing per-user.

export type CacheEntry<T = unknown> = { data: T; at: number };

// Product details carry long HTML descriptions (50-100 kB each), so keep the
// cache small: a big one meant long GC pauses on low-end Android phones.
const MAX_ENTRIES = 40;
const mem = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<unknown>>();

// Newest last, so the first key is the one to evict.
function remember(key: string, entry: CacheEntry) {
  mem.delete(key);
  mem.set(key, entry);
  if (mem.size > MAX_ENTRIES) mem.delete(mem.keys().next().value!);
}

export function peek<T>(key: string): CacheEntry<T> | undefined {
  return mem.get(key) as CacheEntry<T> | undefined;
}

export function isFresh(entry: CacheEntry, staleTime: number) {
  return Date.now() - entry.at < staleTime;
}

export function put<T>(key: string, data: T, persist = false) {
  const entry = { data, at: Date.now() };
  remember(key, entry);
  if (persist) writeJson(fileName(key), { key, ...entry });
}

// Drops an entry (memory and disk), e.g. a product the server says is gone.
export function forget(key: string) {
  mem.delete(key);
  writeJson(fileName(key), null);
}

// One request per key at a time: two screens (or a re-render) asking for the
// same thing share the answer. The result is cached on success.
export function fetchShared<T>(key: string, load: () => Promise<T>, persist = false): Promise<T> {
  const running = inflight.get(key);
  if (running) return running as Promise<T>;
  const p = load()
    .then((data) => {
      put(key, data, persist);
      return data;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

// The disk copy of a `persist` entry, loaded into memory on the way.
export async function readPersisted<T>(key: string): Promise<CacheEntry<T> | undefined> {
  const saved = await readJson<(CacheEntry<T> & { key: string }) | null>(fileName(key), null);
  if (!saved || saved.key !== key) return undefined;
  const entry = { data: saved.data, at: saved.at };
  if (!mem.has(key)) remember(key, entry);
  return entry;
}

// Short stable file name for a key (keys can hold slugs and JSON).
function fileName(key: string) {
  let h = 5381;
  for (let i = 0; i < key.length; i++) h = ((h << 5) + h + key.charCodeAt(i)) | 0;
  return `q-${(h >>> 0).toString(36)}`;
}
