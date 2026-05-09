/**
 * useFeed Hook
 * 
 * Infinite scroll feed with optimistic updates.
 * 
 * Migration note: On NestJS, this points to /api/v1/feed endpoint.
 * The cursor-based pagination contract is preserved.
 */

import { useState, useEffect, useCallback } from 'react';
import feedService from '@/services/feed/feed.service';
import { base44 } from '@/api/base44Client';

export function useFeed(feedType = 'home', { userId, groupId } = {}) {
  const [posts, setPosts] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchPosts = useCallback(async (pageNum = 1, reset = false) => {
    if (loading) return;
    setLoading(true);
    setError(null);

    try {
      let result;

      if (feedType === 'video') {
        result = await feedService.getVideoFeed({ page: pageNum });
      } else if (feedType === 'group' && groupId) {
        result = await feedService.getGroupFeed(groupId, { page: pageNum });
      } else if (feedType === 'profile' && userId) {
        result = await feedService.getUserFeed(userId, { page: pageNum });
      } else {
        result = await feedService.getPersonalizedFeed(userId, { page: pageNum, feedType });
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
  }, [feedType, userId, groupId]);

  useEffect(() => {
    setPosts([]);
    setPage(1);
    setHasMore(true);
    setInitialLoading(true);
    fetchPosts(1, true);
  }, [feedType, userId, groupId]);

  // Real-time: subscribe to new posts
  useEffect(() => {
    const unsubscribe = base44.entities.Post.subscribe((event) => {
      if (event.type === 'create' && event.data?.status === 'published') {
        // Prepend new post to feed
        setPosts(prev => [event.data, ...prev]);
      }
      if (event.type === 'update') {
        setPosts(prev => prev.map(p => p.id === event.id ? { ...p, ...event.data } : p));
      }
      if (event.type === 'delete') {
        setPosts(prev => prev.filter(p => p.id !== event.id));
      }
    });
    return unsubscribe;
  }, []);

  function loadMore() {
    if (!loading && hasMore) {
      fetchPosts(page + 1);
    }
  }

  // Optimistic post creation
  function addPostOptimistic(newPost) {
    setPosts(prev => [newPost, ...prev]);
  }

  // Optimistic like update
  function updatePostOptimistic(postId, updates) {
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, ...updates } : p));
  }

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
  };
}

export default useFeed;