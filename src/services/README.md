# StudentOS — Frontend Architecture Reference

## Provider Tree (outermost → innermost)

```
<ErrorBoundary>                    — catastrophic crash catcher (App.jsx)
  <AuthProvider>                   — base44 auth session + public settings
    <QueryClientProvider>          — react-query cache (stale 2m, gc 10m)
      <Router>
        <UserProvider>             — authenticated user + UserProfile entity
          <AppShell>
            <FeedRealtimeProvider> — ONE Post subscription → all feed listeners
              <NotificationProvider> — ONE Notification subscription + unread state
                <ErrorBoundary resetKey={pathname}>  — auto-resets on route change
                  <Suspense>
                    <Outlet />     — lazy-loaded page chunk
```

---

## Realtime Architecture

### RealtimeBus (`lib/realtime/RealtimeBus.js`)

The **only** place that calls `base44.entities.X.subscribe()`.

- **Reference-counted**: subscription opens on first consumer, auto-tears down on last
- **Wildcard routing**: `subscribe('Post', '*', cb)` receives create+update+delete
- **Reconnect on visibility**: `visibilitychange` listener restarts subscriptions stale > 30s
- **Handler isolation**: each callback error is caught independently — one bad handler can't kill the bus

```js
// Any hook or component — no provider setup needed
const unsub = RealtimeBus.subscribe('Comment', 'create', (event) => {
  if (event.data.post_id === postId) addComment(event.data);
});
return unsub; // cleanup in useEffect return
```

### FeedRealtimeProvider (`providers/FeedRealtimeProvider.jsx`)

- Owns the single Post subscription via RealtimeBus
- Distributes create/update/delete events to registered `useFeed` instances
- Group feed listeners filter by `group_id` — no cross-contamination
- Profile feeds ignore `create` events (own posts appear optimistically)

### NotificationProvider (`providers/NotificationProvider.jsx`)

- Single source of truth: `notifications[]`, `unreadCount`, `loading`, `initialized`
- ONE Notification subscription via RealtimeBus — deduplicates by ID
- `markAllRead` uses functional state setters to avoid stale closure (prev snapshot pattern)
- `useNotificationStore()` — safe hook, returns zero-state when used outside provider

---

## useFeed Hook (`hooks/useFeed.js`)

**Double-fetch prevention**: `fetchPosts` reads config via `configRef` (zero deps in `useCallback`).
Only the reset `useEffect([feedType, userId, groupId])` triggers refetches on config change.

**Realtime reconciliation order**:
1. User action → optimistic update (instant)
2. Server write succeeds → realtime bus fires `update` event
3. Feed listener applies authoritative data → reconciles optimistic state

---

## QueryClient Cache Strategy (`lib/query-client.js`)

| Setting | Value | Rationale |
|---|---|---|
| `staleTime` | 2 min | Fresh data — no background refetch during navigation |
| `gcTime` | 10 min | Keep cache alive for fast back-navigation |
| `refetchOnWindowFocus` | false | RealtimeBus handles updates, not polling |
| `refetchOnReconnect` | true | Re-sync after network recovery |
| Mutation retry | 0 | Caller decides — no silent double-submits |
| Query retry | 2× | Skip on 4xx (client errors won't resolve on retry) |

---

## Error Boundary Layers

| Layer | Location | Resets on |
|---|---|---|
| App-level | `App.jsx` | Manual refresh |
| Route-level | `AppShell` (`resetKey={pathname}`) | Every navigation |
| Post-level | `FeedContainer` (per card) | Manual retry |
| Widget-level | `RightPanel`, `DesktopSidebar` | Manual retry |

**Production hook**: Pass `onError` prop to forward to Sentry/Datadog:
```jsx
<ErrorBoundary onError={(err, info) => Sentry.captureException(err)}>
```

**Dev mode**: Stack trace rendered inline in error UI automatically.

---

## Optimistic Update Pattern

```
User action (e.g. like)
  → optimistic state update (instant, local)
  → service call (async)
    ✓ success → realtime bus reconciles with authoritative data
    ✗ failure → rollback to pre-action snapshot
```

`PostCard` handles this for like/save. `NotificationProvider` applies it for mark-read.
All rollbacks are synchronous snapshot-restores — no re-fetch needed.

---

## Rules: What Goes Where

| Concern | Location | Rule |
|---|---|---|
| Raw `base44.entities.X.subscribe()` | `RealtimeBus` ONLY | Never call in components or hooks |
| Notification realtime | `NotificationProvider` only | Never call `subscribeToNotifications` from the service |
| Feed realtime | `FeedRealtimeProvider` → `useFeed` | No per-component Post subscriptions |
| Auth user | `UserProvider` → `useCurrentUser()` | Always use safe hook (returns null defaults) |
| Notification state | `NotificationProvider` → `useNotificationStore()` | Never store unread count in local state |
| Server data cache | `react-query` via `queryClientInstance` | Prefer for non-realtime fetched data |
| Realtime state | Provider `useState` | Prefer for realtime-mutated data |

---

## Extending for New Realtime Entities

**Adding Message realtime (DMs)**:
1. Create `providers/MessagingProvider.jsx` — owns Message subscription via RealtimeBus
2. Add to provider tree in `AppShell` (below `NotificationProvider`)
3. Create `useConversation(conversationId)` hook — registers listener, filters by `conversation_id`
4. Never subscribe to Message entity outside this provider

**Adding Live Session events**:
1. `RealtimeBus.subscribe('LiveSession', 'update', cb)` in a `useLiveSession` hook
2. Fires when session status changes to `live` — trigger toast/banner
3. No provider needed if state is local to the live session page

---

## Scalability Notes

- Feed scoring (`computeEngagementScore`) is client-side MVP only — moves server-side on NestJS migration
- Following feed fan-out is capped at 5 authors client-side — becomes a PostgreSQL materialized view
- `markAllAsRead` does N individual updates — becomes a bulk UPDATE in NestJS
- Push notifications: `is_pushed` flag on Notification entity — FCM integration point
- Wallet events: add `WalletProvider` with `RealtimeBus.subscribe('Transaction', ...)` when needed