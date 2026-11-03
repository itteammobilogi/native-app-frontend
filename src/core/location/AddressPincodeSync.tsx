import { useEffect } from 'react';

import { listAddresses } from '@/core/api/address';
import { useAuth } from '@/core/auth/AuthContext';
import { useLocation } from './LocationContext';

// Mounted once in the root layout. A signed-in shopper who never picked a
// delivery location gets their default address's pincode. Items are quoted
// for the pincode they were added under, and checkout re-quotes (a seller
// round trip of 7-20 s, see reselectForAddressPincode on the server) whenever
// the address pincode differs, so without this every such shopper paid that
// wait on each order: the fallback pincode is nobody's address.
export function AddressPincodeSync() {
  const { user } = useAuth();
  const { ready, location, setPincode } = useLocation();
  const userId = user?.id;
  const missing = ready && !location;

  useEffect(() => {
    if (!userId || !missing) return;
    let cancelled = false;
    listAddresses(userId)
      .then((list) => {
        const address = list.find((a) => Number(a.is_default) === 1) ?? list[0];
        const pin = address?.area_code?.trim();
        if (!cancelled && pin) return setPincode(pin);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [userId, missing, setPincode]);

  return null;
}
