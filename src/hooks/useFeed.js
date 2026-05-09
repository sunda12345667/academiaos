/**
 * useFeed Hook — Infinite-scroll feed with centralized realtime sync
 *
 * Architecture changes:
 * - Realtime sync now goes through FeedRealtimeProvider (ONE subscription total)
 * - Each feed instance registers a listener key — no duplicate subscriptions
 * - Stable fetchPosts ref prevents stale-closure loops
 * - Optimistic updates isolated per feed instance
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

  // Stable ref to avoid stale closure in realtime callbacks
  const feedTypeRef = useRef(feedType);
  const groupIdRef = useRef(groupId);
  useEffect(() => { feedTypeRef.current = feedType; }, [feedType]);
  useEffect(() => { groupIdRef.current = groupId; }, [groupId]);

  // Unique key for this feed instance in the realtime bus
  const feedKey = useRef(`feed-${++feedInstanceCounter}`).current;
  const { registerFeedListener, unregisterFeedListener } = useFeedRealtime();

  const fetchPosts = useCallback(async (pageNum = 1, reset = false) => {
    setLoading(true);
    setError(null);
    try {
      let result;
      const ft = feedTypeRef.current;
      const gid = groupIdRef.current;

      if (ft === 'video') {
        result = await feedService.getVideoFeed({ page: pageNum });
      } else if (ft === 'group' && gid) {
        result = await feedService.getGroupFeed(gid, { page: pageNum });
      } else if (ft === 'profile' && userId) {
        result = await feedService.getUserFeed(userId, { page: pageNum });
      } else {
        result = await feedService.getPersonalizedFeed(userId, { page: pageNum, feedType: ft });
      }

      setPosts(prev => reset ? result.posts : [...prev, ...result.posts]);
      setHasMore(result.hasMore);
      setPage(pageNum);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  }, [userId]); // userId is the only external dep that affects the query

  // Reset and refetch on feed type / context change
  useEffect(() => {
    setPosts([]);
    setPage(1);
    setHasMore(true);
    setInitialLoading(true);
    fetchPosts(1, true);
  }, [feedType, userId, groupId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Register realtime listener — uses shared bus, no raw subscribe calls here
  useEffect(() => {
    registerFeedListener(feedKey, (event) => {
      if (event.type === 'create') {
        // Only prepend to home/discover feeds, not profile/group feeds
        if (feedTypeRef.current === 'home' || feedTypeRef.current === 'discover') {
          setPosts(prev => {
            if (prev.some(p => p.id === event.post.id)) return prev;
            return [event.post, ...prev];
          });
        }
      } else if (event.type === 'update') {
        setPosts(prev => prev.map(p => p.id === event.id ? { ...p, ...event.data } : p));
      } else if (event.type === 'delete') {
        setPosts(prev => prev.filter(p => p.id !== event.id));
      }
    });

    return () => unregisterFeedListener(feedKey);
  }, [feedKey, registerFeedListener, unregisterFeedListener]);

  const loadMore = useCallback(() => {
    if (!loading && hasMore) fetchPosts(page + 1);
  }, [loading, hasMore, page, fetchPosts]);

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
    refresh: () => fetchPosts(1, true),
    addPostOptimistic,
    updatePostOptimistic,
    removePostOptimistic,
  };
}

export default useFeed;