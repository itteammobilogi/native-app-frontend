import { useEffect } from 'react';

import { useAuth } from '@/core/auth/AuthContext';
import { openSiteLink } from '@/core/links';
import { syncPush, watchNotifications } from '@/core/push';
import { readJson, writeJson } from '@/core/storage/jsonStore';

const PROMPTED_KEY = 'push-prompted';

// Mounted once in the root layout. Keeps the backend's token row pointed at
// whoever is signed in, and opens a tapped notification's `url` on the
// matching native screen (same mapping as banners: core/links.ts).
// `canPrompt` flips true once the launch intro has finished, so the system
// dialog never lands on top of the animation.
export function PushSync({ canPrompt }: { canPrompt: boolean }) {
  const { ready, user } = useAuth();
  const userId = user?.id ?? null;

  // Re-sync on start and on every login/logout.
  useEffect(() => {
    if (ready) syncPush();
  }, [ready, userId]);

  // The very first launch after install also asks for permission (so offers
  // reach users who never order). After that the ask lives on order success
  // and Account > Notifications, so a dismissed dialog doesn't come back on
  // every launch.
  useEffect(() => {
    if (!canPrompt) return;
    readJson(PROMPTED_KEY, false).then((prompted) => {
      if (prompted) return;
      writeJson(PROMPTED_KEY, true);
      syncPush({ prompt: true });
    });
  }, [canPrompt]);

  useEffect(() => {
    if (!ready) return;
    return watchNotifications(openSiteLink);
  }, [ready]);

  return null;
}
