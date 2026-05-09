/**
 * useEngagement Hook
 *
 * Reactive hook for post interaction state.
 * Provides optimistic like/save/vote with rollback,
 * interaction status caching, and engagement score display.
 *
 * Usage:
 *   const { liked, saved, like, unlike, save, unsave, vote } = useEngagement(postId);
 */

import { useState, useEffect, useCallback } from 'react';
import engagementService from '@/services/engagement/engagement.service';
import { useCurrentUser } from '@/hooks/useCurrentUser';

export function useEngagement(postId, initialPost = null) {
  const { profile } = useCurrentUser();
  const profileId = profile?.id;

  const [interaction, setInteraction] = useState({
    liked: false,
    saved: false,
    voted: false,
    shared: false,
    pollChoice: null,
  });
  const [counts, setCounts] = useState({
    like_count: initialPost?.like_count || 0,
    comment_count: initialPost?.comment_count || 0,
    share_count: initialPost?.share_count || 0,
    save_count: initialPost?.save_count || 0,
    view_count: initialPost?.view_count || 0,
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!postId || !profileId) return;
    let cancelled = false;

    engagementService.getUserInteraction(postId, profileId)
      .then(i => { if (!cancelled) setInteraction(i); })
      .catch(() => {});

    return () => { cancelled = true; };
  }, [postId, profileId]);

  // Sync counts from parent when post updates
  useEffect(() => {
    if (!initialPost) return;
    setCounts({
      like_count: initialPost.like_count || 0,
      comment_count: initialPost.comment_count || 0,
      share_count: initialPost.share_count || 0,
      save_count: initialPost.save_count || 0,
      view_count: initialPost.view_count || 0,
    });
  }, [initialPost?.like_count, initialPost?.comment_count, initialPost?.share_count]);

  const like = useCallback(async () => {
    if (!profileId || interaction.liked) return;
    setInteraction(i => ({ ...i, liked: true }));
    setCounts(c => ({ ...c, like_count: c.like_count + 1 }));
    try {
      await engagementService.recordInteraction(postId, profileId, 'like');
    } catch {
      setInteraction(i => ({ ...i, liked: false }));
      setCounts(c => ({ ...c, like_count: Math.max(0, c.like_count - 1) }));
    }
  }, [postId, profileId, interaction.liked]);

  const unlike = useCallback(async () => {
    if (!profileId || !interaction.liked) return;
    setInteraction(i => ({ ...i, liked: false }));
    setCounts(c => ({ ...c, like_count: Math.max(0, c.like_count - 1) }));
    try {
      await engagementService.removeInteraction(postId, profileId, 'like');
    } catch {
      setInteraction(i => ({ ...i, liked: true }));
      setCounts(c => ({ ...c, like_count: c.like_count + 1 }));
    }
  }, [postId, profileId, interaction.liked]);

  const save = useCallback(async () => {
    if (!profileId || interaction.saved) return;
    setInteraction(i => ({ ...i, saved: true }));
    setCounts(c => ({ ...c, save_count: c.save_count + 1 }));
    try {
      await engagementService.recordInteraction(postId, profileId, 'save');
    } catch {
      setInteraction(i => ({ ...i, saved: false }));
      setCounts(c => ({ ...c, save_count: Math.max(0, c.save_count - 1) }));
    }
  }, [postId, profileId, interaction.saved]);

  const unsave = useCallback(async () => {
    if (!profileId || !interaction.saved) return;
    setInteraction(i => ({ ...i, saved: false }));
    setCounts(c => ({ ...c, save_count: Math.max(0, c.save_count - 1) }));
    try {
      await engagementService.removeInteraction(postId, profileId, 'save');
    } catch {
      setInteraction(i => ({ ...i, saved: true }));
      setCounts(c => ({ ...c, save_count: c.save_count + 1 }));
    }
  }, [postId, profileId, interaction.saved]);

  const vote = useCallback(async (pollChoice) => {
    if (!profileId || interaction.voted) return;
    setInteraction(i => ({ ...i, voted: true, pollChoice }));
    try {
      await engagementService.recordInteraction(postId, profileId, 'poll_vote', { pollChoice });
    } catch {
      setInteraction(i => ({ ...i, voted: false, pollChoice: null }));
    }
  }, [postId, profileId, interaction.voted]);

  const share = useCallback(async (destination = 'feed') => {
    if (!profileId) return;
    setInteraction(i => ({ ...i, shared: true }));
    setCounts(c => ({ ...c, share_count: c.share_count + 1 }));
    try {
      await engagementService.recordInteraction(postId, profileId, 'share', { shareDestination: destination });
    } catch {
      setInteraction(i => ({ ...i, shared: false }));
      setCounts(c => ({ ...c, share_count: Math.max(0, c.share_count - 1) }));
    }
  }, [postId, profileId]);

  const recordView = useCallback(async () => {
    if (!profileId) return;
    engagementService.recordInteraction(postId, profileId, 'view').catch(() => {});
  }, [postId, profileId]);

  return {
    ...interaction,
    counts,
    loading,
    like,
    unlike,
    save,
    unsave,
    vote,
    share,
    recordView,
    toggleLike: interaction.liked ? unlike : like,
    toggleSave: interaction.saved ? unsave : save,
  };
}

export default useEngagement;