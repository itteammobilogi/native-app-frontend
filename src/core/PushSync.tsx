import { useEffect } from 'react';

import { useAuth } from '@/core/auth/AuthContext';
import { openSiteLink } from '@/core/links';
import { syncPush, watchNotifications } from '@/core/push';

// Mounted once in the root layout. Keeps the backend's token row pointed at
// whoever is signed in, and opens a tapped notification's `url` on the
// matching native screen (same mapping as banners: core/links.ts).
export function PushSync() {
  const { ready, user } = useAuth();
  const userId = user?.id ?? null;

  // Re-sync on start and on every login/logout. Never prompts here: the
  // permission ask happens after an order or from Account > Notifications.
  useEffect(() => {
    if (ready) syncPush();
  }, [ready, userId]);

  useEffect(() => {
    if (!ready) return;
    return watchNotifications(openSiteLink);
  }, [ready]);

  return null;
}
