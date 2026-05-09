/**
 * useFeed — Infinite-scroll feed with centralized realtime sync
 *
 * Architecture:
 * - Realtime sync via FeedRealtimeProvider (ONE Post subscription for all feeds)
 * - Each useFeed instance registers a unique listener — no duplicate subscriptions
 * - Reset/refetch triggered by config changes via a single stable effect
 * - fetchPosts ref pattern prevents stale-closure double-fetches
 * - Optimistic update methods isolated per feed instance
 *
 * Feed types: 'home' | 'discover' | 'following' | 'video' | 'group' | 'profile'
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import feedService from '@/services/feed/feed.service';
import { useFeedRealtime } from '@/providers/FeedRealtimeProvider';

let feedInstanceCounter = 0;

export function useFeed(feedType = 'home', { userId, groupId } = {}) {
  const [posts, setPosts] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState(null);

  // Stable refs — realtime callbacks read these without stale closure risk
  const configRef = useRef({ feedType, userId, groupId });
  useEffect(() => { configRef.current = { feedType, userId, groupId }; });

  // Unique key for this feed instance in the realtime listener map
  const feedKey = useRef(`feed-${++feedInstanceCounter}`).current;
  const { registerFeedListener, unregisterFeedListener } = useFeedRealtime();

  // ─── Data Fetching ─────────────────────────────────────────────────────────
  // Uses configRef so it never needs feedType/userId/groupId in its dep array,
  // which prevents the double-fetch that occurred when both the reset effect
  // and the callback dep both triggered together.

  const fetchPosts = useCallback(async (pageNum = 1, reset = false) => {
    const { feedType: ft, userId: uid, groupId: gid } = configRef.current;
    setLoading(true);
    setError(null);
    try {
      let result;
      if (ft === 'video') {
        result = await feedService.getVideoFeed(uid, { limit: 15 });
      } else if (ft === 'group' && gid) {
        result = await feedService.getGroupFeed(gid, uid, { limit: 20 });
      } else if (ft === 'profile' && uid) {
        result = await feedService.getUserFeed(uid, { limit: 20 });
      } else if (ft === 'following') {
        result = await feedService.getFollowingFeed(uid, { limit: 20 });
      } else if (ft === 'discover') {
        result = await feedService.getDiscoverFeed(uid, { limit: 20 });
      } else if (ft === 'saved') {
        result = await feedService.getSavedFeed(uid, { limit: 20 });
      } else {
        result = await feedService.getHomeFeed(uid, { limit: 20 });
      }

      setPosts(prev => reset ? result.posts : [...prev, ...result.posts]);
      setHasMore(result.hasMore);
      setPage(pageNum);
    } catch (err) {
      setError(err?.message ?? 'Failed to load feed');
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  }, []); // intentionally empty — reads config via ref

  // ─── Reset on Config Change ────────────────────────────────────────────────
  // Separate from fetchPosts so the dep array is purely the config values.
  // This is the ONLY place fetchPosts(1, true) is called on config change.

  useEffect(() => {
    setPosts([]);
    setPage(1);
    setHasMore(true);
    setInitialLoading(true);
    fetchPosts(1, true);
  }, [feedType, userId, groupId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Realtime Sync ─────────────────────────────────────────────────────────
  // ONE listener registered per feed instance — FeedRealtimeProvider owns the
  // actual base44 subscription. This callback runs per incoming event.

  useEffect(() => {
    registerFeedListener(feedKey, (event) => {
      const { feedType: ft, groupId: gid } = configRef.current;

      if (event.type === 'create') {
        // Group feeds: only accept posts from this group
        if (ft === 'group') {
          if (event.post?.group_id !== gid) return;
        }
        // Profile feeds: skip — user's own posts appear on publish, realtime not needed
        if (ft === 'profile') return;

        setPosts(prev => {
          if (prev.some(p => p.id === event.post.id)) return prev;
          return [event.post, ...prev];
        });
      } else if (event.type === 'update') {
        // Always apply updates — like/comment counts, etc.
        setPosts(prev => prev.map(p => p.id === event.id ? { ...p, ...event.data } : p));
      } else if (event.type === 'delete') {
        setPosts(prev => prev.filter(p => p.id !== event.id));
      }
    });

    return () => unregisterFeedListener(feedKey);
  }, [feedKey, registerFeedListener, unregisterFeedListener]);

  // ─── Pagination ────────────────────────────────────────────────────────────

  const loadMore = useCallback(() => {
    if (!loading && hasMore) fetchPosts(page + 1);
  }, [loading, hasMore, page, fetchPosts]);

  // ─── Optimistic Updates ────────────────────────────────────────────────────
  // For immediate UI response before server confirms. Realtime bus will
  // reconcile the authoritative version when the update event arrives.

  const addPostOptimistic = useCallback((newPost) => {
    setPosts(prev => {
      if (prev.some(p => p.id === newPost.id)) return prev;
      return [newPost, ...prev];
    });
  }, []);

  const updatePostOptimistic = useCallback((postId, updates) => {
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, ...updates } : p));
  }, []);

  const removePostOptimistic = useCallback((postId) => {
    setPosts(prev => prev.filter(p => p.id !== postId));
  }, []);

  return {
    posts,
    loading,
    initialLoading,
    error,
    hasMore,
    loadMore,
    refresh: useCallback(() => fetchPosts(1, true), [fetchPosts]),
    addPostOptimistic,
    updatePostOptimistic,
    removePostOptimistic,
  };
}

export default useFeed;