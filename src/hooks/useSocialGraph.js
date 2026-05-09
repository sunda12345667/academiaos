/**
 * useSocialGraph Hook
 *
 * Reactive hook for social graph operations.
 * Provides optimistic follow/unfollow with rollback,
 * relationship status caching, and block/mute management.
 *
 * Usage:
 *   const { relationship, follow, unfollow, block, mute, loading } = useSocialGraph(targetProfileId);
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import graphService from '@/services/social/graph.service';
import { useCurrentUser } from '@/hooks/useCurrentUser';

export function useSocialGraph(targetProfileId) {
  const { profile } = useCurrentUser();
  const viewerProfileId = profile?.id;

  const [relationship, setRelationship] = useState(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Cache ref to avoid re-fetching on every render
  const cacheRef = useRef({});

  useEffect(() => {
    if (!viewerProfileId || !targetProfileId) return;
    if (viewerProfileId === targetProfileId) {
      setRelationship({ isSelf: true });
      return;
    }

    const cacheKey = `${viewerProfileId}:${targetProfileId}`;
    if (cacheRef.current[cacheKey]) {
      setRelationship(cacheRef.current[cacheKey]);
      return;
    }

    let cancelled = false;
    setLoading(true);

    graphService.getRelationship(viewerProfileId, targetProfileId)
      .then(rel => {
        if (cancelled) return;
        cacheRef.current[cacheKey] = rel;
        setRelationship(rel);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [viewerProfileId, targetProfileId]);

  const _invalidateCache = () => {
    const cacheKey = `${viewerProfileId}:${targetProfileId}`;
    delete cacheRef.current[cacheKey];
  };

  const follow = useCallback(async () => {
    if (!viewerProfileId || !targetProfileId || actionLoading) return;
    setActionLoading(true);

    // Optimistic
    const prev = relationship;
    setRelationship(r => ({ ...r, isFollowing: true }));

    try {
      await graphService.followUser(viewerProfileId, targetProfileId);
      _invalidateCache();
      const updated = await graphService.getRelationship(viewerProfileId, targetProfileId);
      setRelationship(updated);
    } catch {
      setRelationship(prev); // Rollback
    } finally {
      setActionLoading(false);
    }
  }, [viewerProfileId, targetProfileId, actionLoading, relationship]); // eslint-disable-line

  const unfollow = useCallback(async () => {
    if (!viewerProfileId || !targetProfileId || actionLoading) return;
    setActionLoading(true);

    const prev = relationship;
    setRelationship(r => ({ ...r, isFollowing: false, isMutual: false }));

    try {
      await graphService.unfollowUser(viewerProfileId, targetProfileId);
      _invalidateCache();
      const updated = await graphService.getRelationship(viewerProfileId, targetProfileId);
      setRelationship(updated);
    } catch {
      setRelationship(prev);
    } finally {
      setActionLoading(false);
    }
  }, [viewerProfileId, targetProfileId, actionLoading, relationship]); // eslint-disable-line

  const block = useCallback(async () => {
    if (!viewerProfileId || !targetProfileId || actionLoading) return;
    setActionLoading(true);
    try {
      await graphService.blockUser(viewerProfileId, targetProfileId);
      _invalidateCache();
      setRelationship(r => ({ ...r, isFollowing: false, isMutual: false, isBlocked: true }));
    } finally {
      setActionLoading(false);
    }
  }, [viewerProfileId, targetProfileId, actionLoading]); // eslint-disable-line

  const unblock = useCallback(async () => {
    if (!viewerProfileId || !targetProfileId || actionLoading) return;
    setActionLoading(true);
    try {
      await graphService.unblockUser(viewerProfileId, targetProfileId);
      _invalidateCache();
      setRelationship(r => ({ ...r, isBlocked: false }));
    } finally {
      setActionLoading(false);
    }
  }, [viewerProfileId, targetProfileId, actionLoading]); // eslint-disable-line

  const mute = useCallback(async () => {
    if (!viewerProfileId || !targetProfileId) return;
    await graphService.muteUser(viewerProfileId, targetProfileId);
    _invalidateCache();
    setRelationship(r => ({ ...r, isMuted: true }));
  }, [viewerProfileId, targetProfileId]); // eslint-disable-line

  const unmute = useCallback(async () => {
    if (!viewerProfileId || !targetProfileId) return;
    await graphService.unmuteUser(viewerProfileId, targetProfileId);
    _invalidateCache();
    setRelationship(r => ({ ...r, isMuted: false }));
  }, [viewerProfileId, targetProfileId]); // eslint-disable-line

  return {
    relationship,
    loading,
    actionLoading,
    follow,
    unfollow,
    block,
    unblock,
    mute,
    unmute,
    isFollowing: relationship?.isFollowing ?? false,
    isFollowedBy: relationship?.isFollowedBy ?? false,
    isMutual: relationship?.isMutual ?? false,
    isBlocked: relationship?.isBlocked ?? false,
    isMuted: relationship?.isMuted ?? false,
    isSelf: relationship?.isSelf ?? false,
  };
}

export default useSocialGraph;