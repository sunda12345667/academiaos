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

---

## Identity & Trust Architecture

### RBAC Roles (ordered by privilege)

| Role | Key Capabilities |
|---|---|
| `student` | Post, comment, group, marketplace, wallet view |
| `educator` | + courses, withdraw, group ban |
| `creator` | + live stream, paid content, tips, verification request |
| `advertiser` | + ads create/manage, analytics |
| `school_admin` | + delete any, manage any group, suspend users, school manage |
| `moderator` | + delete any, content remove, verification review, trust score view |
| `admin` | All permissions |

### Permission Helpers

```js
import { usePermission } from '@/hooks/usePermission';
const { can, canAny, isAtLeastRole, trustTier, accountAccess } = usePermission();

// UI gating
{can(PERMISSIONS.COURSE_CREATE) && <CreateCourseButton />}

// Ownership-aware
{canOnResource(PERMISSIONS.POST_DELETE_ANY, post.author_id) && <DeleteButton />}
```

### Identity Hook

```js
import useIdentity from '@/hooks/useIdentity';
const { isVerifiedEducator, isCreator, trustTier, schoolId, kycLevel } = useIdentity();
```

### Declarative Guards

```jsx
// Permission gate (UI element)
<RequirePermission permission={PERMISSIONS.ADMIN_DASHBOARD}>
  <AdminLink />
</RequirePermission>

// Role gate (UI element)
<RequireRole role={ROLES.MODERATOR} atLeast>
  <ModerationPanel />
</RequireRole>

// Route guard (in App.jsx)
<Route element={<RequireRole role={ROLES.ADMIN} atLeast asRoute />}>
  <Route path="/admin" element={<AdminPage />} />
</Route>
```

### Account Status Enforcement

`AccountStatusGuard` (in AppShell) hard-blocks `suspended` and `banned` users with a dedicated UI — they never reach any page.

### Sensitive Action Confirmation

```jsx
<SensitiveActionGuard
  trigger={<Button>Withdraw Funds</Button>}
  title="Confirm withdrawal"
  description="₦5,000 will be sent to your linked bank account."
  onConfirm={handleWithdraw}
/>
```

### Security Events

All security-relevant events write `Notification` records and are delivered via RealtimeBus:

```js
import securityEvents from '@/services/auth/security-events.service';

await securityEvents.loginAlert(profileId, { device: 'Chrome/Mac', location: 'Lagos' });
await securityEvents.accountSuspended(profileId, 'Spam violation');
await securityEvents.verificationApproved(profileId, 'educator');
await securityEvents.contentRemoved(profileId, 'post', 'Hate speech');
```

### Trust Tiers

Computed client-side from `verification_status` (future: server `trust_score`):

| Tier | Requirements | UI Signal |
|---|---|---|
| `basic` | No verification | No badge |
| `standard` | Email verified | Email badge |
| `verified` | ID verified | Verified badge |
| `verified_educator` | Educator verified | Educator badge |
| `restricted` | Suspended/banned | Restricted badge |

### updateProfile Field Whitelist

`user.service.js` enforces a server-side-style allowlist — clients can NEVER escalate `role`, `verification_status`, or `account_status` through `updateProfile`. Blocked fields are silently dropped.

---

## Social Graph Architecture

### Relationship Types

| Type | Entity | Direction | Notes |
|---|---|---|---|
| Follow | `Follow` | Directed | `active / pending / blocked / muted / left` |
| Classmate | `AcademicIdentity` | Implicit | Same school + department + level |
| Schoolmate | `UserProfile.school_id` | Implicit | Same institution |
| Group member | `GroupMembership` | Bidirectional | role + status per group |
| Course student | `AcademicIdentity.courses[]` | Implicit | Enrolled in same course |

### graph.service.js Surface

```js
import graphService from '@/services/social/graph.service';

// Edge CRUD
await graphService.followUser(viewerProfileId, targetProfileId);
await graphService.unfollowUser(viewerProfileId, targetProfileId);
await graphService.blockUser(viewerProfileId, targetProfileId);
await graphService.muteUser(viewerProfileId, targetProfileId);

// Edge queries
const rel = await graphService.getRelationship(viewerProfileId, targetProfileId);
// rel → { isFollowing, isFollowedBy, isMutual, isBlocked, isMuted, isSelf }

const ids = await graphService.getFollowing(profileId);         // [profileId, ...]
const ids = await graphService.getBlockedIds(profileId);        // Set<profileId>
const map = await graphService.batchCheckFollowing(viewer, ids); // { profileId: bool }
const sugg = await graphService.getSuggestedUsers(profileId);   // profile[]
```

### useSocialGraph Hook (per-profile reactive)

```jsx
const { isFollowing, follow, unfollow, isMutual, isBlocked, block, mute } = useSocialGraph(targetProfileId);
```

---

## Messaging Architecture

### Provider Hierarchy

```
AppShell
  └── MessagingProvider          (ONE Message + Conversation subscription)
       └── ConversationList      → useMessagingStore()
       └── ConversationView      → useConversation(conversationId)
```

### Conversation Types

| Type | Use Case |
|---|---|
| `direct` | DM between two users |
| `group` | Group chat (linked to Group via group_id) |

### Delivery State Machine

```
optimistic (client) → sent (DB) → delivered (recipient opens) → read (conv opened)
```

### useConversation Hook

```js
const {
  messages,     // chronological array
  isLoading,
  hasMore,
  sending,
  sendMessage,  // { type, content, mediaUrl, ... }
  toggleReaction, // (messageId, emoji)
  onTyping,     // call on keydown
  loadMore,     // infinite scroll trigger
} = useConversation(conversationId);
```

### Typing Indicators (ephemeral)

Typing state lives ONLY in `MessagingProvider` ref — never persisted to DB.

```js
const { setTyping, getTypingUsers } = useMessagingStore();
const typingUserIds = getTypingUsers(conversationId); // stale after 3s TTL
```

### Presence (PresenceBus)

```js
import PresenceBus from '@/lib/realtime/PresenceBus';

PresenceBus.startHeartbeat(profileId);        // on login
PresenceBus.isOnline(profileId);              // → boolean
PresenceBus.getPresence(profileId);           // → { online, status, lastSeen }
PresenceBus.setConversationActive(convId);    // when viewing a conversation
PresenceBus.setInCall(roomId);               // future: WebRTC
```

---

## Community / Group System

### Group Roles (descending privilege)

`owner → admin → moderator → member → guest`

### group.service.js Surface

```js
import groupService from '@/services/community/group.service';

await groupService.createGroup({ name, type, privacy, ownerProfileId });
await groupService.joinGroup(groupId, profileId);         // auto-approve or pending
await groupService.leaveGroup(groupId, profileId);
await groupService.inviteToGroup(groupId, inviterProfileId, targetProfileId);
await groupService.approveJoinRequest(groupId, modProfileId, targetProfileId);
await groupService.banMember(groupId, modProfileId, targetProfileId);
await groupService.promoteMember(groupId, adminProfileId, targetProfileId, newRole);
await groupService.joinByInviteCode(inviteCode, profileId);
```

### useGroup Hook

```jsx
const {
  group, membership, isMember, isAdmin, canModerate, canPost,
  join, leave, approveRequest, banMember, promoteMember, loadMembers,
} = useGroup(groupId);
```

---

## Engagement Engine

### useEngagement Hook (per-post reactive)

```jsx
const {
  liked, saved, voted, counts,
  like, unlike, save, unsave, vote, share, recordView,
  toggleLike, toggleSave,      // convenience wrappers
} = useEngagement(postId, initialPost);
```

### Scoring Algorithm

`score = Σ(weight × count) × 0.5^(ageHours / 6)`

Weights: view=1, like=3, love=4, insightful=5, comment=6, share=8, save=4

### Trending

```js
const posts  = await engagementService.getTrendingPosts({ schoolId });
const topics = await engagementService.getTrendingTopics();
const streak = await engagementService.getPostingStreak(profileId);
const summary = await engagementService.getCreatorSummary(profileId);
```

---

## Notification / Event Propagation

### Dispatch Pattern

All social events use `notification-events.js`:

```js
import notificationEvents from '@/services/social/notification-events';

// Fire-and-forget — never await in hot paths
notificationEvents.onPostLiked(actorProfile, postAuthorId, postId).catch(() => {});
notificationEvents.onPostCommented(actorProfile, postAuthorId, postId, preview).catch(() => {});
notificationEvents.onUserFollowed(actorProfile, recipientId).catch(() => {});
notificationEvents.onNewMessage(actorProfile, recipientId, conversationId, preview).catch(() => {});
notificationEvents.dispatchMentionNotifications(actorProfile, content, postId, mentionedIds).catch(() => {});
```

Delivery chain: `notification-events → notification.service.createNotification → RealtimeBus → NotificationProvider`

---

## Moderation-Aware Communication

### report.service.js Surface

```js
import reportService from '@/services/moderation/report.service';

await reportService.submitReport({ reporterProfileId, entityType, entityId, reason });
await reportService.resolveReport({ reportId, reviewerProfileId, action, targetProfileId });
await reportService.flagPost(postId, reason);
await reportService.removePost(postId, moderatorNote);
const rateCheck = await reportService.checkPostRateLimit(profileId);
const msgRate   = await reportService.checkMessageRateLimit(profileId, conversationId);
```

### Action Pipeline

`submitReport → pending → [moderator review] → action_taken | no_action | dismissed`

Actions: `warning | content_removed | account_suspended | account_banned`

---

## Realtime Scaling Strategy

| Layer | MVP (now) | Scale (future) |
|---|---|---|
| Feed subscriptions | RealtimeBus (shared per entity) | Kafka consumer groups |
| Message delivery | RealtimeBus (Message entity) | Dedicated WS gateway |
| Presence | PresenceBus (client-side heartbeat) | Redis TTL + WS push |
| Typing indicators | MessagingProvider ref (ephemeral) | Redis pub/sub (never DB) |
| Notifications | Realtime entity subscription | FCM/APNs + inbox model |
| Follow graph | PostgreSQL + denormalized counts | Neo4j / graph service |
| Trending | Client-side score decay | Flink/Spark streaming |

## Future: Voice / Video Collaboration

Readiness hooks are in place:
- `PresenceBus.setInCall(roomId)` — tracks call status
- `PresenceBus.getPresence(profileId).status === 'in_call'` — gates call UI
- `Conversation.type` can be extended with `audio_room | video_room | live_session`
- WebRTC signaling (offer/answer/ICE) would be sent via the WS gateway as ephemeral events
- Recording/replay would store media via `UploadFile` and link to a `Post` record

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