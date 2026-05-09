# StudentOS Frontend Architecture

## Provider Tree (outermost → innermost)

```
<ErrorBoundary>           — top-level crash catcher
  <AuthProvider>          — base44 auth state, app public settings
    <QueryClientProvider> — react-query cache
      <Router>
        <UserProvider>    — authenticated user + UserProfile entity
          <AppShell>
            <FeedRealtimeProvider>   — ONE Post subscription for ALL feeds
              <NotificationProvider> — ONE Notification subscription + state
                <ErrorBoundary>      — route-level crash isolation
                  <Suspense>
                    <Outlet />       — lazy-loaded page
```

## Realtime Architecture

**RealtimeBus** (`lib/realtime/RealtimeBus.js`)
- Singleton event bus with reference-counted entity subscriptions
- ONE base44 subscription per entity type, regardless of consumer count
- Automatic teardown when zero consumers remain
- Event routing: `subscribe(entity, eventType, callback)`

**FeedRealtimeProvider** (`providers/FeedRealtimeProvider.jsx`)
- Owns the single Post subscription via RealtimeBus
- Distributes events to registered feed listeners (home, group, profile feeds)
- Feed instances register/deregister a listener key — no per-feed subscriptions

**NotificationProvider** (`providers/NotificationProvider.jsx`)
- Single source of truth for notification list + unread count
- ONE Notification subscription via RealtimeBus
- Stable useMemo value — no cascade rerenders
- `useNotificationStore()` returns safe fallback outside provider

## Context Safety Rules

- `useCurrentUser()` — SAFE hook, returns null defaults if outside provider
- `useCurrentUserStrict()` — throws only in components guaranteed inside UserProvider
- `useNotificationStore()` — SAFE hook, returns zero-state outside NotificationProvider
- All providers expose safe fallbacks to prevent crash during Suspense/lazy-load

## Error Boundary Layers

1. **App-level** (`App.jsx`) — catches auth/router/query catastrophic failures
2. **Route-level** (`AppShell`) — isolates page crashes, retry resets the route
3. **Post-level** (`FeedContainer`) — one bad post card can't kill the feed
4. **Widget-level** (`RightPanel`, `DesktopSidebar`) — sidebar widgets isolated

## Performance Rules

- All context values wrapped in `useMemo` — consumers only rerender on data change
- All event handlers in hooks wrapped in `useCallback`
- `PostCard` is `memo()`-wrapped with stable `useCallback` handlers
- No raw `base44.entities.X.subscribe()` calls in components — use RealtimeBus
- No `useNotifications()` hooks in individual components — use `useNotificationStore()`

## Adding New Realtime Features

```js
// In any component or hook — no provider setup needed:
import RealtimeBus from '@/lib/realtime/RealtimeBus';

useEffect(() => {
  return RealtimeBus.subscribe('Comment', 'create', (event) => {
    if (event.data.post_id === postId) addComment(event.data);
  });
}, [postId]);
``