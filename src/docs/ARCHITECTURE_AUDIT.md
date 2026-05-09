# StudentOS — Full Architecture Audit

**Date:** 2026-05-09  
**Scope:** All service layers, entity schema, hooks, providers, realtime, analytics, fintech, growth  
**Status:** Pre-launch consolidation review

---

## 1. System Inventory

### 1.1 Entity Schema (22 entities)

| Entity | Owner Domain | Risk |
|---|---|---|
| `UserProfile` | Identity | HIGH — 40+ consumers, overloaded with onboarding/referral/achievement state |
| `AcademicIdentity` | Identity | LOW — clean boundary |
| `Post` | Content | MEDIUM — engagement_score denormalized, recalculated on every interaction |
| `Comment` | Content | LOW |
| `PostInteraction` | Engagement | MEDIUM — no TTL, grows unbounded |
| `Follow` | Social Graph | MEDIUM — status enum used for block/mute (overloaded) |
| `Group` | Community | LOW |
| `GroupMembership` | Community | LOW |
| `LiveSession` | Creator/Live | MEDIUM — stream_key stored client-side (security) |
| `Conversation` | Messaging | LOW |
| `Message` | Messaging | HIGH — unread_counts stored as JSON field on Conversation (N+1 risk) |
| `Notification` | Comms | MEDIUM — no partitioning, will bottleneck at 1M+ records |
| `Wallet` | Fintech | HIGH — balance field mutable without atomic lock |
| `Transaction` | Fintech | LOW — immutable, well-structured |
| `LedgerEntry` | Fintech | LOW — append-only |
| `PaymentIntent` | Fintech | LOW |
| `PayoutRequest` | Fintech | LOW |
| `FraudSignal` | Trust & Safety | LOW |
| `Gift` | Creator Economy | LOW |
| `GiftCatalogItem` | Creator Economy | LOW |
| `CreatorProfile` | Creator | MEDIUM — analytics denormalized (stale on large follower counts) |
| `MarketplaceListing` | Marketplace | LOW |
| `ModerationReport` | Moderation | LOW |
| `AdminAuditLog` | Ops | LOW — append-only |
| `AppealRequest` | Ops | LOW |
| `AdCampaign` | Ads | LOW |
| `WatchEvent` | Analytics | HIGH — write-heavy, no retention policy, will grow unbounded |
| `ContentRecommendation` | AI | MEDIUM — served/clicked flags never cleaned up |
| `PlatformAlert` | Ops | LOW |
| `School` | Education | LOW |
| `Course` | Education | LOW |

### 1.2 Service Layer (27 services)

| Service | Domain | Coupling Risk |
|---|---|---|
| `user.service.js` | Identity | HIGH — called from 12+ services |
| `post.service.js` | Content | MEDIUM |
| `engagement.service.js` | Engagement | HIGH — called from feed, creator, ranking |
| `feed.service.js` | Feed | HIGH — coordinates 6+ services |
| `ranking.engine.js` | Feed | MEDIUM — client-side only, correct |
| `recommendation.service.js` | AI | MEDIUM |
| `notification.service.js` | Comms | HIGH — called from everywhere |
| `notification-events.js` | Comms | MEDIUM — fire-and-forget wrapper, good pattern |
| `graph.service.js` | Social | MEDIUM |
| `group.service.js` | Community | LOW |
| `conversation.service.js` | Messaging | LOW |
| `message.service.js` | Messaging | LOW |
| `creator.service.js` | Creator | MEDIUM |
| `live.service.js` | Live | LOW |
| `watch.service.js` | Analytics | MEDIUM — dual write (WatchEvent + Post.view_count) |
| `wallet.service.js` | Fintech | HIGH — no distributed lock |
| `ledger.service.js` | Fintech | LOW |
| `payment.service.js` | Fintech | MEDIUM |
| `payout.service.js` | Fintech | LOW |
| `gifting.service.js` | Fintech | MEDIUM |
| `risk.engine.js` | Trust | LOW |
| `moderation.service.js` | Moderation | MEDIUM |
| `report.service.js` | Moderation | LOW |
| `onboarding.service.js` | Growth | LOW |
| `retention.service.js` | Growth | LOW |
| `viral.service.js` | Growth | LOW |
| `notification.intelligence.js` | Growth | MEDIUM — duplicates some notification.service logic |
| `growth.analytics.js` | Growth | LOW |
| `platform.ops.service.js` | Ops | LOW |
| `trust.safety.service.js` | Ops | LOW |
| `ad.platform.service.js` | Ops | LOW |
| `admin.audit.service.js` | Ops | LOW |
| `media.service.js` | Media | LOW |
| `security-events.service.js` | Auth | LOW |
| `viral.service.js` (growth) | Growth | LOW |

---

## 2. Critical Duplication Findings

### 2.1 Notification Dispatch — CRITICAL OVERLAP

**Problem:** Two paths for sending notifications:
- `notification.service.js → createNotification()`
- `notification.intelligence.js → sendIntelligentNotification()`

Both call `base44.entities.Notification.create()`. Intelligence layer wraps the service layer, but callers inconsistently choose between them.

**Rule to enforce:**
- Financial/security notifications → `notification.service.createNotification()` directly (no caps, no quiet hours)
- All social/growth notifications → `notification.intelligence.sendIntelligentNotification()`
- Never call `base44.entities.Notification.create()` directly outside these two services

### 2.2 Watch Events — Dual Write

**Problem:** `watch.service.recordWatchEvent()` also updates `Post.view_count` directly. This creates two write paths for view counts: watch service AND engagement service.

**Fix:** Remove `Post.view_count` update from `watch.service.js`. Engagement service owns view count. Watch service owns raw WatchEvent records only.

### 2.3 Streak Computation — Two Locations

**Problem:** Posting streak computed in `engagement.service.getPostingStreak()` AND referenced/estimated in `retention.service.detectStreakRisk()`. No shared primitive.

**Fix:** Streak computation lives in `engagement.service` only. `retention.service` imports and calls it — does not reimplement.

### 2.4 Creator Analytics Scatter

**Problem:** Creator analytics data spread across:
- `creator.service.getCreatorDashboard()`
- `engagement.service.getCreatorSummary()`
- `watch.service.getCreatorWatchAnalytics()`
- `growth.analytics.getCreatorRetention()`

No single "creator analytics" contract. Four callers, four different shapes.

**Fix:** Define `CreatorAnalyticsSnapshot` type in `creator.service.js`. Other services feed into it. Dashboard always reads from this one shape.

### 2.5 UserProfile Overload

**Problem:** `UserProfile` entity carries:
- Core identity (name, email, role)
- Academic identity (overlaps with `AcademicIdentity` entity)
- Onboarding state (completed_steps, activated flag)
- Referral tracking (referral_code, referred_by, referral_count)
- Achievement state (achievements_earned[], total_xp)
- Growth flags (onboarding_complete, last_seen_at)
- Wallet reference (implicit via user_id)

This entity will become a write-contention bottleneck at scale. Multiple concurrent updates from social graph, onboarding, and analytics pipelines all targeting the same record.

**Remediation:** Migrate onboarding state → `OnboardingState` entity. Migrate referral state → `ReferralRecord` entity. Keep `UserProfile` for identity + display only.

---

## 3. Coupling Risks

### 3.1 Feed Service — Fan-Out Coordinator

`feed.service.js` orchestrates 6+ downstream services: UserProfile, Follow, Post, CreatorProfile, AcademicIdentity, ranking.engine. Any one failure cascades. No circuit breaker applied.

**Fix:** Wrap feed service calls with `breakers.ai.execute()` from `lib/infra/retry.js` for non-critical enrichments.

### 3.2 Notification Everywhere Anti-Pattern

`notification-events.js` is called from: engagement, social graph, messaging, wallet, live, moderation, growth, security events. It is the most-imported file in the codebase.

At scale this becomes a single point of failure for all user-facing communications.

**Fix:** Event-queue pattern — services emit domain events, a notification fanout worker subscribes and dispatches. Never call notification service from within another service synchronously.

### 3.3 Wallet Service — Race Condition Window

`wallet.service.creditWallet()` and `debitWallet()` perform a read-then-write without atomic lock:
```
read wallet.balance → compute new balance → write wallet.balance
```
Two concurrent gift receipts would both read the same balance and produce incorrect final state.

**Fix (client-side):** Add `deduplicateKey` guard using idempotencyKey (already in place). Add optimistic locking: store `version` field on Wallet, reject updates where `version !== expected_version`.

**Fix (migration):** PostgreSQL `SELECT FOR UPDATE` in stored procedure. Redis distributed lock (`SET wallet:{id}:lock NX PX 5000`).

### 3.4 RealtimeBus — Single-Point Subscription

All realtime events route through one RealtimeBus instance. A misconfigured handler that throws repeatedly will exhaust memory via event accumulation if the try/catch boundary fails.

**Fix:** Already has per-handler isolation. Add max-retry eviction: if a handler throws 5 consecutive times, auto-unsubscribe and log alert.

---

## 4. Scaling Bottlenecks

| Bottleneck | Current State | Scale Risk | Mitigation |
|---|---|---|---|
| `Post.engagement_score` recompute | On every interaction | HIGH at 1k+ concurrent users | Move to async background job |
| `Notification` table full scan for unread | Filter by recipient_id + is_read | HIGH at 100k+ notifications | Add composite index (recipient_id, is_read, created_date) |
| `WatchEvent` unbounded growth | No TTL, no archival | HIGH — will hit DB limits | 90-day retention policy, archive to cold storage |
| `markAllAsRead` N+1 | N individual UPDATE calls | HIGH | Single bulk UPDATE WHERE |
| Feed fan-out | Client-side, capped at 8 follows | MEDIUM | Acceptable at MVP, needs server fan-out at 10k+ follows |
| `getCreatorSummary` | 50-post scan per call | MEDIUM | Cache result 5 min (react-query stale time) |
| `RealtimeBus` subscription per entity | 1 WS connection per entity type | LOW at MVP | Multiplexed at scale |

---

## 5. Security Risks

| Risk | Severity | Location | Fix |
|---|---|---|---|
| `stream_key` stored on `LiveSession` entity (client-accessible) | CRITICAL | `LiveSession.stream_key` | Move to server-only secret store |
| No rate limiting on `Post.create` client-side | HIGH | `post.service.js` | Enforce `report.service.checkPostRateLimit()` before every create |
| Client-side privilege escalation blocked by field whitelist | MEDIUM | `user.service.updateProfile()` | Good — maintain whitelist strictly |
| `reverseTransaction()` available to any caller | HIGH | `wallet.service.js` | Add `adminUserId` role check before execution |
| `base64` assets stored directly on entity fields | MEDIUM | Potential misuse | `field_size_limits` rule already documented — enforce at API layer |
| No CSRF protection on `paystackWebhook` beyond signature | LOW | `functions/paystackWebhook` | Signature validation exists — acceptable |

---

## 6. Unclear Ownership

| Area | Problem | Resolution |
|---|---|---|
| `notification.intelligence.js` vs `notification.service.js` | Both dispatch notifications | Intelligence layer owns dispatch, service layer owns CRUD |
| `viral.service.js` vs `growth.analytics.js` | Both have referral stats functions | `viral.service` owns referral ops, `growth.analytics` owns aggregate metrics |
| `engagement.service` vs `watch.service` | Both update view counts | `engagement.service` owns Post counters, `watch.service` owns WatchEvent records |
| `moderation.service` vs `trust.safety.service` | Both compute risk scores | `trust.safety.service` owns risk scoring, `moderation.service` owns content pipeline |

---

## 7. State Fragmentation

| State | Locations | Problem |
|---|---|---|
| Unread notification count | `NotificationProvider` (runtime) + `Notification.is_read` (DB) | Source of truth: DB. Provider caches. Drift possible on concurrent mark-read. |
| User follower count | `UserProfile.follower_count` (denorm) + `Follow` records (source) | Denorm can drift on concurrent follows. Needs eventual-consistency reconciler. |
| Creator post count | `CreatorProfile.total_posts` + actual `Post` count | Recalculated in `refreshCreatorAnalytics()` — fine if called consistently |
| Wallet balance | `Wallet.balance` (denorm) + `LedgerEntry` sum (source) | Wallet balance must always equal sum of LedgerEntries. Auditor job needed. |
| Onboarding progress | `UserProfile.onboarding_completed_steps[]` (flat array) | Non-queryable. Cannot find "all users who skipped step X" without full scan. |