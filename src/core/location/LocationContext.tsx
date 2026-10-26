import * as SecureStore from 'expo-secure-store';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';

import { lookupPincode, type PincodeLocation } from '@/core/api/address';
import { DEFAULT_PINCODE_ID } from '@/core/config';

// Delivery pincode the shopper picked. The cart's add-product call needs its
// `pincode_id` (website: localStorage p_id / selected_location).
export type Loc = { pincode: string; pincodeId: number; label: string } | null;
type SavedLoc = NonNullable<Loc>;

type LocationState = {
  location: Loc;
  pincodeId: number;
  recent: SavedLoc[];
  setPincode: (pincode: string) => Promise<Loc>;
  selectLocation: (place: PincodeLocation, pincode: string) => Promise<SavedLoc>;
  selectRecent: (loc: SavedLoc) => Promise<void>;
};

const KEY = 'zb_location';
const RECENT_KEY = 'zb_recent_locations';
const MAX_RECENT = 5; // same as the website's recent_locations
const Ctx = createContext<LocationState | null>(null);

const read = async (key: string) =>
  Platform.OS === 'web' ? globalThis.localStorage?.getItem(key) ?? null : SecureStore.getItemAsync(key);
const write = async (key: string, v: string) =>
  Platform.OS === 'web' ? void globalThis.localStorage?.setItem(key, v) : SecureStore.setItemAsync(key, v);

const titleCase = (s: string) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

// "Mumbai Central H.O" -> "Mumbai Central" (post-office type suffixes mean
// nothing to a shopper).
export const placeName = (office: string) => office.replace(/\s+(H\.?O|S\.?O|B\.?O|G\.?P\.?O)\.?$/i, '').trim();

export const placeLabel = (p: PincodeLocation) => `${placeName(p.office_name)}, ${titleCase(p.district)}`;

export function LocationProvider({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useState<Loc>(null);
  const [recent, setRecent] = useState<SavedLoc[]>([]);

  useEffect(() => {
    read(KEY).then((raw) => {
      if (!raw) return;
      try {
        setLocation(JSON.parse(raw));
      } catch {
        /* ignore corrupt value */
      }
    });
    read(RECENT_KEY).then((raw) => {
      if (!raw) return;
      try {
        const list = JSON.parse(raw);
        if (Array.isArray(list)) setRecent(list);
      } catch {
        /* ignore corrupt value */
      }
    });
  }, []);

  const commit = useCallback(
    async (next: SavedLoc) => {
      const updated = [next, ...recent.filter((l) => l.pincodeId !== next.pincodeId)].slice(0, MAX_RECENT);
      setLocation(next);
      setRecent(updated);
      await Promise.all([write(KEY, JSON.stringify(next)), write(RECENT_KEY, JSON.stringify(updated))]);
    },
    [recent],
  );

  // A specific post office / area picked from the pincode's list.
  const selectLocation = useCallback(
    async (place: PincodeLocation, pincode: string) => {
      const next = { pincode: place.pincode || pincode, pincodeId: Number(place.id), label: placeLabel(place) };
      await commit(next);
      return next;
    },
    [commit],
  );

  const selectRecent = useCallback((loc: SavedLoc) => commit(loc), [commit]);

  // Just a pincode: takes its first area.
  const setPincode = useCallback(
    async (pincode: string) => {
      const first = await lookupPincode(pincode);
      if (!first) return null;
      return selectLocation(first, pincode);
    },
    [selectLocation],
  );

  const value = useMemo(
    () => ({
      location,
      pincodeId: location?.pincodeId ?? DEFAULT_PINCODE_ID,
      recent,
      setPincode,
      selectLocation,
      selectRecent,
    }),
    [location, recent, setPincode, selectLocation, selectRecent],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLocation() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useLocation must be used inside <LocationProvider>');
  return ctx;
}
