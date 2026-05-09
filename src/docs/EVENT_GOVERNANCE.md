# StudentOS — Event & State Governance Architecture

**Version:** 1.0  
**Scope:** All event emission, state management, realtime subscriptions, and analytics tracking

---

## 1. Event Taxonomy

All events emitted via `eventQueue.track()` follow a strict taxonomy.

### Schema

```typescript
interface PlatformEvent {
  domain:    string;    // Top-level system (content, social, creator, fintech, growth, session)
  action:    string;    // What happened (past tense verb: created, liked, followed)
  version:   number;    // Schema version (increment on breaking field changes)
  timestamp: string;    // ISO 8601 UTC
  userId:    string;    // Subject of the event
  sessionId: string;    // Browser session ID
  properties: Record<string, string | number | boolean | null>;
}
```

### Canonical Event Registry

#### Content Domain
| Event | Properties | Version |
|---|---|---|
| `content.post_created` | `postId, type, mediaCount, wordCount, hasAI` | 1 |
| `content.post_liked` | `postId, authorId, likeType` | 1 |
| `content.post_shared` | `postId, destination, authorId` | 1 |
| `content.post_saved` | `postId, authorId` | 1 |
| `content.post_viewed` | `postId, source, durationMs` | 1 |
| `content.video_watched` | `postId, watchSec, completionRate, source` | 1 |
| `content.comment_created` | `postId, commentId, hasMedia` | 1 |

#### Social Domain
| Event | Properties | Version |
|---|---|---|
| `social.user_followed` | `targetProfileId, source` | 1 |
| `social.user_unfollowed` | `targetProfileId` | 1 |
| `social.user_blocked` | `targetProfileId` | 1 |
| `social.group_joined` | `groupId, method` | 1 |
| `social.group_left` | `groupId` | 1 |

#### Creator Domain
| Event | Properties | Version |
|---|---|---|
| `creator.live_started` | `sessionId, type, scheduledDuration` | 1 |
| `creator.live_ended` | `sessionId, durationSec, peakViewers` | 1 |
| `creator.gift_received` | `giftId, coinCost, senderId, context` | 1 |
| `creator.course_created` | `courseId, lessonCount` | 1 |
| `creator.tier_upgraded` | `fromTier, toTier, followCount` | 1 |
| `creator.monetization_enabled` | `tier, trustScore` | 1 |

#### Fintech Domain
| Event | Properties | Version |
|---|---|---|
| `fintech.payment_initiated` | `amount, currency, purpose, gateway` | 1 |
| `fintech.payment_completed` | `amount, reference, gateway` | 1 |
| `fintech.payment_failed` | `amount, reason, gateway` | 1 |
| `fintech.withdrawal_requested` | `amount, bankCode` | 1 |
| `fintech.gift_sent` | `giftId, coinCost, recipientId` | 1 |

#### Growth Domain
| Event | Properties | Version |
|---|---|---|
| `growth.onboarding_step_complete` | `stepId, role, progressPercent` | 1 |
| `growth.onboarding_activated` | `role, stepsCompleted` | 1 |
| `growth.referral_attributed` | `referrerId, code` | 1 |
| `growth.referral_activated` | `referrerId` | 1 |
| `growth.achievement_unlocked` | `achievementId, category, xp` | 1 |
| `growth.content_shared` | `contentType, contentId, destination` | 1 |

#### Session Domain
| Event | Properties | Version |
|---|---|---|
| `session.app_opened` | `referrer, utm_source` | 1 |
| `session.route_changed` | `from, to` | 1 |
| `session.ended` | `durationMin, pagesViewed` | 1 |
| `session.network_online` | — | 1 |
| `session.network_offline` | — | 1 |

#### Notification Domain
| Event | Properties | Version |
|---|---|---|
| `notification.sent` | `type, priority` | 1 |
| `notification.dropped_cap` | `type, priority, todayCount` | 1 |
| `notification.deferred_quiet_hours` | `type, priority` | 1 |

#### Experiment Domain
| Event | Properties | Version |
|---|---|---|
| `experiment.exposed` | `experimentId, variant` | 1 |
| `experiment.converted` | `experimentId, variant, metric` | 1 |

---

## 2. Event Schema Versioning Rules

When an event property is added, removed, or renamed:

```
BACKWARD COMPATIBLE (no version bump):
  - Adding an optional new property
  - Adding a new event type

BREAKING (must increment version):
  - Renaming an existing property
  - Removing an existing property
  - Changing property type (string → number)
  - Changing event name/domain

On version bump:
  1. Update the registry above
  2. Update eventQueue helper method signature
  3. Add migration note in ADR-NNN
  4. ClickHouse table gets new column (old data null for new field)
```

---

## 3. Realtime Subscription Governance

### Rule: ONE subscription per entity type, per provider

```
Entity          Owner Provider            Consumers (via callback registration)
──────────────────────────────────────────────────────────────────────────────
Post            FeedRealtimeProvider      useFeed (all instances)
Notification    NotificationProvider      useNotificationStore (all instances)
Message         MessagingProvider         useConversation (filtered by conv_id)
Conversation    MessagingProvider         ConversationList
LiveSession     LiveSessionProvider       useLiveSessionStore
Transaction     WalletProvider            useWallet
```

### Forbidden Patterns
```js
// ❌ NEVER — component-level raw subscription
useEffect(() => {
  const unsub = base44.entities.Post.subscribe(handler);
  return unsub;
}, []);

// ❌ NEVER — service-level raw subscription
notificationService.subscribeToNotifications = () => {
  return base44.entities.Notification.subscribe(...);
};

// ✅ CORRECT — always via RealtimeBus
const unsub = RealtimeBus.subscribe('Post', 'create', handler);
return unsub;
```

### RealtimeBus Contract
```js
// Public API — stable, never changes internally
RealtimeBus.subscribe(entity, eventType, handler)  → returns unsubscribeFn
RealtimeBus.unsubscribe(entity, eventType, handler)
RealtimeBus.getActiveEntities()
```

---

## 4. Provider State Governance

### Provider Hierarchy (authoritative order, App.jsx)

```
ErrorBoundary (catastrophic)
  AuthProvider (base44 session)
    QueryClientProvider (react-query cache)
      Router
        UserProvider (profile + RBAC)
          AppShell
            FeedRealtimeProvider
              NotificationProvider
                AccountStatusGuard
                  MessagingProvider
                    WalletProvider
                      LiveSessionProvider
                        ErrorBoundary (route-level)
                          Suspense
                            <Outlet /> (lazy page)
```

### State Ownership Rules

| State | Owner | Access Pattern |
|---|---|---|
| Auth user | `AuthProvider` | `useAuth()` |
| Current user profile | `UserProvider` | `useCurrentUser()` |
| Notifications + unread count | `NotificationProvider` | `useNotificationStore()` |
| Feed posts | `FeedRealtimeProvider` → `useFeed()` | Hook per feed instance |
| Conversations | `MessagingProvider` | `useMessagingStore()` |
| Active conversation messages | `MessagingProvider` | `useConversation(id)` |
| Wallet balance | `WalletProvider` | `useWallet()` |
| Live sessions | `LiveSessionProvider` | `useLiveSessionStore()` |
| Personalization | Module-level cache | `usePersonalization()` |
| Onboarding state | No provider — hook-level | `useOnboarding()` |
| Creator profile | No provider — hook-level | `useCreator()` |

### Cache Invalidation Rules

```
When user follows someone:
  → Invalidate react-query key: ['feed', 'following', userId]
  → Invalidate react-query key: ['suggestions', userId]
  → FeedRealtimeProvider: add new author to following set

When post is liked:
  → Optimistic update in useFeed local state
  → No cache invalidation needed (realtime bus reconciles)
  → If realtime not connected: invalidate ['feed', feedType, userId]

When wallet credited:
  → WalletProvider state updated via realtime Transaction subscription
  → No manual invalidation needed

When notification read:
  → NotificationProvider: remove from unread set (optimistic)
  → If fails: restore (snapshot rollback)
```

---

## 5. Optimistic Update Conflict Prevention

### Rule: All optimistic updates must carry a snapshot for rollback

```js
// Pattern: snapshot → optimistic apply → async call → rollback on failure
const snapshot = [...posts];
setPostsOptimistic(posts.map(p => p.id === postId ? {...p, liked: true} : p));

try {
  await engagementService.recordInteraction(postId, profileId, 'like');
} catch {
  setPosts(snapshot);  // always rollback to snapshot, not "undo"
  toast.error('Could not like post');
}
```

### Conflict Detection (realtime reconciliation)

When a realtime event arrives for an entity that has a pending optimistic update:
1. Compare optimistic state fields to incoming event data
2. If event data matches optimistic → merge (no visual change)
3. If event data differs → authoritative data wins, apply it

This is handled automatically in `useFeed` realtime listener — no component-level conflict management needed.

---

## 6. Analytics Deduplication

### Problem: Same event tracked in multiple layers

Example — a post like currently fires:
1. `eventQueue.track()` in `PostCardActions` (UI layer)
2. `engagementService.recordInteraction()` writes `PostInteraction` entity
3. `notification-events.onPostLiked()` creates `Notification`

This is **correct and expected** — these are three different systems (analytics, database, comms). They are NOT duplicates.

### What IS a duplicate (fix required)
- `watch.service.recordImpression()` + `engagementService.recordInteraction('view')` both firing for the same view
- `growth.analytics.trackExperimentExposure()` + `eventQueue.track('experiment', 'exposed')` for the same event

**Fix:** One canonical path per event. See Event Taxonomy above — each event has exactly one emitter.

---

## 7. Contract-Safe API Design (future microservice readiness)

### Service Interface Pattern
Every service already follows this implicitly. To make it explicit and swappable:

```js
// services/wallet/wallet.interface.js (add when migrating)
/**
 * @typedef {Object} WalletService
 * @property {function(string): Promise<Balance>} getBalance
 * @property {function(string, CreditOpts): Promise<CreditResult>} creditWallet
 * @property {function(string, DebitOpts): Promise<DebitResult>} debitWallet
 */

// Implementation can be swapped without consumers knowing:
// import walletService from './wallet.service';         ← Base44 impl
// import walletService from './wallet.postgres.service'; ← PostgreSQL impl
```

### API Shape Stability Rules
1. Never remove a property from a service return value without a version bump
2. Never rename a parameter without backward compat alias
3. Additions are always safe (optional new return properties)
4. Consumer code should destructure only what it needs (`const { balance } = await getBalance()`)