/**
 * FeedContainer — Infinite scroll feed engine
 * Virtualization-ready, optimistic-update aware
 * Decoupled from data source — accepts any post array
 */
import { useEffect, useRef, useCallback } from 'react';
import PostCard from './PostCard';
import PostCardSkeleton from './PostCardSkeleton';
import FeedEmptyState from './FeedEmptyState';
import ErrorBoundary from '@/lib/errors/ErrorBoundary';

export default function FeedContainer({
  posts,
  loading,
  initialLoading,
  hasMore,
  onLoadMore,
  onPostUpdate,
  emptyMessage,
}) {
  const sentinelRef = useRef(null);

  // IntersectionObserver for infinite scroll
  const handleIntersect = useCallback(
    (entries) => {
      if (entries[0].isIntersecting && hasMore && !loading) {
        onLoadMore?.();
      }
    },
    [hasMore, loading, onLoadMore]
  );

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(handleIntersect, { threshold: 0.1, rootMargin: '200px' });
    observer.observe(el);
    return () => observer.disconnect();
  }, [handleIntersect]);

  if (initialLoading) {
    return (
      <div className="space-y-3 p-4">
        {Array(4).fill(0).map((_, i) => <PostCardSkeleton key={i} />)}
      </div>
    );
  }

  if (!posts.length && !loading) {
    return <FeedEmptyState message={emptyMessage} />;
  }

  return (
    <div className="space-y-0">
      {posts.map((post) => (
        <ErrorBoundary key={post.id} inline>
          <PostCard post={post} onUpdate={onPostUpdate} />
        </ErrorBoundary>
      ))}

      {/* Infinite scroll sentinel */}
      <div ref={sentinelRef} className="h-4" />

      {/* Loading more indicator */}
      {loading && !initialLoading && (
        <div className="space-y-3 px-4 pb-4">
          {Array(2).fill(0).map((_, i) => <PostCardSkeleton key={i} />)}
        </div>
      )}

      {!hasMore && posts.length > 0 && (
        <p className="text-center text-xs text-muted-foreground py-8">
          You're all caught up ✓
        </p>
      )}
    </div>
  );
}