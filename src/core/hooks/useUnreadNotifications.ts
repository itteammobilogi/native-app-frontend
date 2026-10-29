import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { listNotifications } from '@/core/api/notifications';
import { useAuth } from '@/core/auth/AuthContext';

// Unread count for the bell badge, refreshed whenever the screen regains focus
// (e.g. coming back from the inbox after it marked everything read).
export function useUnreadNotifications() {
  const { isLoggedIn } = useAuth();
  const [count, setCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let live = true;
      if (isLoggedIn) {
        listNotifications()
          .then((r) => live && setCount(r.unread))
          .catch(() => {});
      }
      return () => {
        live = false;
      };
    }, [isLoggedIn]),
  );

  return isLoggedIn ? count : 0;
}
