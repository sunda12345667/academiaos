/**
 * QueryClient — Global cache configuration
 *
 * staleTime:   How long cached data is considered fresh (no background refetch).
 * gcTime:      How long unused cache entries survive before GC (was cacheTime).
 * retry:       Only retry true network/server errors, not 4xx.
 * throwOnError: Let ErrorBoundaries catch query failures instead of silent null.
 */
import { QueryClient } from '@tanstack/react-query';

function isRetryable(failureCount, error) {
  // Never retry 4xx client errors — they won't resolve on retry
  if (error?.status >= 400 && error?.status < 500) return false;
  return failureCount < 2;
}

export const queryClientInstance = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,       // 2 min — data is fresh, no background refetch
      gcTime: 1000 * 60 * 10,          // 10 min — keep unused cache alive for back-nav
      refetchOnWindowFocus: false,      // realtime bus handles updates, not polling
      refetchOnReconnect: true,         // re-sync after network recovery
      retry: isRetryable,
    },
    mutations: {
      retry: 0, // Never auto-retry mutations — caller decides
    },
  },
});