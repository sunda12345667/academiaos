# StudentOS — Complete Architecture Audit
*Principal Platform Architect Review | v1.0 | 2026-05-09*

---

## 1. System Inventory

### Entities (23 total)

| Entity | Owner Domain | Risk Level |
|--------|-------------|------------|
| UserProfile | Auth/Identity | 🔴 HIGH — central join target, mutated by 8+ services |
| AcademicIdentity | Identity | 🟡 MEDIUM — under-used, overlaps UserProfile.school_id |
| Post | Feed/Content | 🟡 MEDIUM — denormalized counters drift risk |
| Comment | Feed/Content | 🟢 LOW |
| PostInteraction | Engagement | 🟡 MEDIUM — N+1 query risk in getUserInteraction |
| Follow | Social Graph | 🟡 MEDIUM — no composite index on (follower_id, following_id) |
| Group | Community | 🟢 LOW |
| GroupMembership | Community | 🟢 LOW |
| Conversation | Messaging | 🟢 LOW |
| Message | Messaging | 🔴 HIGH — unbounded growth, no archival strategy |
| LiveSession | Live | 🟢 LOW |
| WatchEvent | Analytics | 🔴 HIGH — write-heavy, unsuitable for relational DB at scale |
| ContentRecommendation | Recommendations | 🟡 MEDIUM — stale records accumulate without TTL |
| CreatorProfile | Creator Economy | 🟡 MEDIUM — analytics fields computed client-side |
| Wallet | Fintech | 🔴 HIGH — balance on entity = race condition risk without DB locks |
| Transaction | Fintech | 🔴 HIGH — append-only violated if update() called directly |
| LedgerEntry | Fintech | 🔴 HIGH — same as Transaction |
| PaymentIntent | Fintech | 🟡 MEDIUM — no cleanup for expired intents |
| PayoutRequest | Fintech | 🟡 MEDIUM |
| Gift | Fintech | 🟡 MEDIUM |
| ModerationReport | Trust & Safety | 🟡 MEDIUM |
| AdminAuditLog | Governance | 🔴 HIGH — must be truly append-only; Base44 update() must never be called |
| AppealRequest | Governance | 🟢 LOW |
| AdCampaign | Ads | 🟢 LOW |
| GiftCatalogItem | Fintech | 🟢 LOW |
| Notification | Notifications | 🟡 MEDIUM — per-user table scan on markAllAsRead() |
| FraudSignal | Trust & Safety | 🟡 MEDIUM |
| PlatformAlert | Ops | 🟢 LOW |
| School | Identity | 🟢 LOW |

### Services (34 files across 9 domains)

```
services/
  auth/          permissions.js, security-events.service.js
  feed/          feed.service.js, ranking.engine.js
  engagement/    engagement.service.js
  social/        graph.service.js, post.service.js, notification-events.js
  community/     group.service.js
  messaging/     conversation.service.js, message.service.js
  live/          live.service.js
  creator/       creator.service.js
  recommendation/ recommendation.service.js
  analytics/     watch.service.js
  moderation/    moderation.service.js, report.service.js
  notifications/ notification.service.js
  wallet/        wallet.service.js, ledger.service.js, payment.service.js,
                 payout.service.js, gifting.service.js, risk.engine.js
  ops/           platform.ops.service.js, admin.audit.service.js,
                 trust.safety.service.js, ad.platform.service.js
  ai/            (personalization, study assistant, etc.)
  growth/        onboarding.service.js, retention.service.js,
                 viral.service.js, notification.intelligence.js,
                 growth.analytics.js
  media/         media.service.js
  user/          user.service.js
```

---

## 2. Architecture Issues Found

### 🔴 CRITICAL

**C1: UserProfile used as a God Object**
- 8+ services write directly to UserProfile with different field sets
- Fields: school_id, preferences, onboarding_completed_steps, achievements_earned, total_xp, referral_code, referred_by, follower_count, last_seen_at, referral_count, referral_activated
- Risk: Concurrent writes cause lost updates (no optimistic locking)
- Fix: Segment into domain-owned sub-entities (IdentityProfile, GrowthProfile) or use versioned partial updates with server-side merge

**C2: Wallet Balance Race Condition**
- `wallet.balance` is read-modify-write in JS (getOrCreateWallet → update balance)
- No SELECT FOR UPDATE equivalent in Base44 client SDK
- Concurrent gift sends or purchases can corrupt balance
- Fix: All Wallet mutations must go through a single backend function with distributed lock. Add `wallet_version` field for optimistic concurrency detection on client.

**C3: AdminAuditLog mutability**
- `admin.audit.service.js` calls `base44.entities.AdminAuditLog.update()` in some flows
- AdminAuditLog is spec'd as append-only immutable
- Fix: Remove ALL update() calls. Add confirmed_by via create() of a new ConfirmationLog record, or a separate confirmation field set only once via a guarded backend function.

**C4: WatchEvent write volume**
- WatchEvent created on every scroll impression + video watch event
- Impression debounce lives only in hook — if hook unmounts mid-debounce, impressions fire anyway
- On 10k DAU: ~500k WatchEvent records/day in relational DB
- Fix: Client-side batching in event-queue (buffer 20 events → flush as bulk insert). Medium-term: separate OLAP sink.

**C5: Notification.markAllAsRead() — O(n) individual updates**
- Fetches ALL unread → loops → individual update per notification
- On users with 500 unread: 500 sequential API calls
- Fix: Backend function with `UPDATE ... WHERE recipient_id = X AND is_read = false`

### 🟡 HIGH

**H1: PostInteraction N+1 in getUserInteraction()**
- `getUserInteraction(postId, profileId)` fetches all interactions then filters client-side
- FeedContainer renders 20 posts — each calls getUserInteraction = 20 separate queries
- Fix: Batch interaction lookup by postId array; cache per-session in react-query

**H2: Feed ranking computed client-side on every render**
- `ranking.engine.js` runs full sort + decay computation in JavaScript on each feed refresh
- On large post sets: main thread blocking
- Fix: Move `computeEngagementScore()` to a `useMemo` with stable dependency. Cache ranked result for 30s.

**H3: ContentRecommendation records accumulate without TTL**
- `expires_at` field exists but no cleanup job removes expired records
- Risk: Entity table grows unbounded
- Fix: Scheduled cleanup backend function (weekly) deleting `expires_at < now`

**H4: Duplicate notification dispatch paths**
- `notification-events.js` calls `notificationService.createNotification()`
- `notification.intelligence.js` also calls `notificationService.createNotification()`
- Callers sometimes use both, sometimes one directly
- Risk: Duplicate notifications, inconsistent fatigue prevention
- Fix: ALL notification dispatch must go through `notification.intelligence.sendIntelligentNotification()`. Remove direct calls to `notificationService.createNotification()` from feature code.

**H5: RealtimeBus subscription leak on fast remount**
- If component unmounts before subscribe() resolves, cleanup fn may not run correctly
- Risk: Orphaned subscription handlers accumulate over navigation cycles
- Fix: Add subscription ID registry to RealtimeBus; `cleanup()` clears by ID regardless of timing.

**H6: Follow graph fan-out unbounded**
- `feed.service._fetchFollowingPosts()` fetches following list, then 1 query per followed user
- Capped at 5 currently but still 6 sequential queries on home feed load
- Fix: Single query with `author_id IN [followingIds]` filter; move cap to server-side

**H7: CreatorProfile analytics computed on demand**
- `refreshCreatorAnalytics()` fetches posts, profile, interactions each time
- Called after every new follower, post, live session end
- Risk: Write amplification — popular creators trigger expensive re-computations constantly
- Fix: Debounce with 5-min cooldown; move to scheduled background job (5-min interval)

**H8: Module-level cache in usePersonalization**
- `_profileCache` is a module-level Map — shared across all component instances
- Never cleared on logout — stale profile bleeds to next user on same browser session
- Fix: Clear on auth context change (logout event). Move cache to AuthContext or sessionStorage.

### 🟢 MEDIUM

**M1: AcademicIdentity entity under-utilized**
- Created but `school_id`, `department`, `level` also stored on UserProfile
- Causes duplication and sync risk
- Recommendation: AcademicIdentity is the canonical source; remove fields from UserProfile

**M2: graphService.getSuggestedUsers() overlaps onboarding.getOnboardingSuggestions()**
- Both do subject + school scoring of user suggestions
- Fix: onboarding service delegates to graphService for suggestions

**M3: Growth analytics duplicates creator analytics**
- `getCreatorRetention()` in growth.analytics.js overlaps `getCreatorDashboard()` in creator.service.js
- Fix: growth.analytics.js should aggregate from creator.service — no raw entity queries

**M4: event-queue tracks overlap with notification.intelligence tracks**
- Both fire analytics events for notification sends
- Fix: notification.intelligence is the single source; event-queue.track in that module only

**M5: PaymentIntent.expires_at not enforced**
- Expired intents remain in `created` status forever — pollutes webhook matching
- Fix: Backend function to expire stale intents (>30min in `created` status)

**M6: FraudSignal.auto_action_taken is a string, not enum**
- Inconsistent values: 'wallet_frozen', 'payout_blocked', undefined
- Fix: Add enum to entity schema; enforce in risk.engine.js

---

## 3. Service Ownership Map

| Domain | Owns | Must NOT touch |
|--------|------|----------------|
| `feed/` | Post reads, ranking | PostInteraction writes |
| `engagement/` | PostInteraction, Post counters | Feed ranking |
| `social/` | Follow, notification dispatch | UserProfile fields beyond follower_count |
| `community/` | Group, GroupMembership | Post content |
| `messaging/` | Conversation, Message | Feed |
| `creator/` | CreatorProfile, tier, trust | Wallet balances |
| `wallet/` | Wallet, Transaction, LedgerEntry | UserProfile |
| `notifications/` | Notification entity | Delivery timing/priority (→ notification.intelligence) |
| `growth/` | Onboarding state, achievements, referrals | CreatorProfile analytics (→ creator.service) |
| `ops/` | AdminAuditLog, PlatformAlert | User financial data |
| `moderation/` | ModerationReport | Wallet operations |

---

## 4. Scaling Bottlenecks Priority Matrix

| Bottleneck | Impact | Effort | Priority |
|------------|--------|--------|----------|
| Wallet race condition (C2) | 🔴 Data corruption | High | P0 |
| markAllAsRead O(n) (C5) | 🔴 UX + server | Low | P0 |
| WatchEvent volume (C4) | 🔴 DB growth | Medium | P0 |
| PostInteraction N+1 (H1) | 🟡 Performance | Medium | P1 |
| Client-side feed ranking (H2) | 🟡 UX | Low | P1 |
| Realtime subscription leak (H5) | 🟡 Memory | Medium | P1 |
| ContentRecommendation TTL (H3) | 🟢 DB bloat | Low | P2 |
| Creator analytics write amp (H7) | 🟢 Server load | Medium | P2 |
| Personalization cache (H8) | 🟢 Privacy | Low | P2 |

---

## 5. Base44 Lock-in Risks

| Risk | Severity | Migration Path |
|------|----------|---------------|
| `base44.entities.X.filter()` used directly in 34 service files | Medium | Extract to repository pattern (`repositories/` layer) — all entity access via typed repo |
| `base44.integrations.Core.InvokeLLM()` scattered in 5+ services | Medium | Centralize in `services/ai/ai.gateway.js` — single integration point |
| `base44.auth.me()` called in multiple hooks | Low | Already gated through `useCurrentUser` — acceptable |
| Realtime via `base44.entities.X.subscribe()` gated behind RealtimeBus | ✅ GOOD | Migration-safe |
| Analytics via `base44.analytics.track()` + `event-queue` | ✅ GOOD | Swappable drain URL |

**Recommended: Repository Layer**
```js
// repositories/post.repository.js (example pattern)
export const PostRepository = {
  findById: (id) => base44.entities.Post.filter({ id }).then(r => r[0]),
  findByAuthor: (authorId, limit) => base44.entities.Post.filter({ author_id: authorId }, '-created_date', limit),
  findPublished: (filter, limit) => base44.entities.Post.filter({ ...filter, status: 'published', moderation_status: 'clean' }, '-engagement_score', limit),
  create: (data) => base44.entities.Post.create(data),
  update: (id, data) => base44.entities.Post.update(id, data),
};
```
This creates a migration boundary — NestJS migration only touches repositories, not services.