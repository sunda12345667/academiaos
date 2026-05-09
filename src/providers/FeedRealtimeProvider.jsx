/**
 * FeedRealtimeProvider — Centralized feed synchronization
 *
 * Architecture:
 * - ONE Post subscription for the entire app via RealtimeBus
 * - Distributes events to registered feed listeners
 * - Listeners register/deregister per feed instance (home, group, profile, etc.)
 * - Prevents N-subscriptions for N feeds open simultaneously
 *
 * Usage in useFeed:
 *   const { registerFeedListener, unregisterFeedListener } = useFeedRealtime();
 */
import { createContext, useContext, useEffect, useRef, useMemo } from 'react';
import RealtimeBus from '@/lib/realtime/RealtimeBus';

const FeedRealtimeContext = createContext(null);

export function FeedRealtimeProvider({ children }) {
  // Map<feedKey, callback>
  const listeners = useRef(new Map());

  // ONE subscription for Post entity — routes to all registered feed listeners
  useEffect(() => {
    const unsubCreate = RealtimeBus.subscribe('Post', 'create', (event) => {
      if (event.data?.status !== 'published') return;
      listeners.current.forEach(cb => cb({ type: 'create', post: event.data }));
    });

    const unsubUpdate = RealtimeBus.subscribe('Post', 'update', (event) => {
      listeners.current.forEach(cb => cb({ type: 'update', id: event.id, data: event.data }));
    });

    const unsubDelete = RealtimeBus.subscribe('Post', 'delete', (event) => {
      listeners.current.forEach(cb => cb({ type: 'delete', id: event.id }));
    });

    return () => {
      unsubCreate();
      unsubUpdate();
      unsubDelete();
    };
  }, []);

  const value = useMemo(() => ({
    registerFeedListener: (key, cb) => {
      listeners.current.set(key, cb);
    },
    unregisterFeedListener: (key) => {
      listeners.current.delete(key);
    },
  }), []);

  return (
    <FeedRealtimeContext.Provider value={value}>
      {children}
    </FeedRealtimeContext.Provider>
  );
}

export function useFeedRealtime() {
  const ctx = useContext(FeedRealtimeContext);
  if (!ctx) return { registerFeedListener: () => {}, unregisterFeedListener: () => {} };
  return ctx;
}