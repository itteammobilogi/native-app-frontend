import { router } from 'expo-router';
import { useCallback, useState } from 'react';

import { errorMessage } from '@/core/api/client';
import { voteReview, type Review } from '@/core/api/reviews';
import { useAuth } from '@/core/auth/AuthContext';
import { useToast } from '@/ui/Toast';

type Counts = Pick<Review, 'helpful_up' | 'helpful_down' | 'my_vote'>;

// Helpful 👍/👎 votes. Server counts are kept as overrides so they apply to
// whichever list (top reviews, all reviews) is showing the review.
export function useReviewVotes() {
  const { isLoggedIn } = useAuth();
  const toast = useToast();
  const [overrides, setOverrides] = useState<Record<number, Counts>>({});
  const [busy, setBusy] = useState<number | null>(null);

  const apply = useCallback((r: Review): Review => (overrides[r.id] ? { ...r, ...overrides[r.id] } : r), [overrides]);

  const vote = useCallback(
    async (r: Review, v: 1 | -1) => {
      if (!isLoggedIn) {
        toast('Please log in to vote.', 'info');
        router.push('/login');
        return;
      }
      if (busy) return;
      setBusy(r.id);
      try {
        const res = await voteReview(r.id, v);
        setOverrides((o) => ({ ...o, [r.id]: { helpful_up: res.helpful_up, helpful_down: res.helpful_down, my_vote: res.my_vote } }));
      } catch (e) {
        toast(errorMessage(e, 'Failed to record vote.'), 'error');
      } finally {
        setBusy(null);
      }
    },
    [isLoggedIn, busy, toast],
  );

  return { apply, vote, busy };
}
