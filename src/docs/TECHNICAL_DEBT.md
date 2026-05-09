# StudentOS — Technical Debt Register

**Date:** 2026-05-09  
**Methodology:** Priority = Impact × Likelihood × Effort-to-fix-later  
**Owners:** Assigned by domain team at first engineering hire

---

## Priority Matrix

| ID | Issue | Severity | Impact | Migration Effort | Priority |
|---|---|---|---|---|---|
| TD-01 | Wallet race condition (no atomic lock) | CRITICAL | Data corruption | HIGH | P0 |
| TD-02 | `stream_key` on client-accessible entity | CRITICAL | Security breach | LOW | P0 |
| TD-03 | `markAllAsRead` N+1 UPDATE | HIGH | Performance at scale | LOW | P1 |
| TD-04 | `UserProfile` entity overload | HIGH | Write contention, coupling | HIGH | P1 |
| TD-05 | `Post.engagement_score` sync recompute | HIGH | DB writes on every interaction | MEDIUM | P1 |
| TD-06 | `WatchEvent` unbounded growth | HIGH | DB storage exhaustion | LOW | P1 |
| TD-07 | Notification dispatch split (2 paths) | MEDIUM | Developer confusion, double-send risk | LOW | P2 |
| TD-08 | `Notification` table no partition index | MEDIUM | Query degradation at 100k+ rows | LOW | P2 |
| TD-09 | Feed service no circuit breaker | MEDIUM | Cascade failures | MEDIUM | P2 |
| TD-10 | Dual view-count writes | MEDIUM | Inaccurate analytics | LOW | P2 |
| TD-11 | Creator analytics scatter | MEDIUM | No single source of truth | MEDIUM | P2 |
| TD-12 | Client-side ranking engine | LOW | Scaling ceiling, ranking inconsistency | HIGH | P3 |
| TD-13 | `Follow` entity overloaded (block/mute) | LOW | Query complexity | MEDIUM | P3 |
| TD-14 | No WatchEvent retention policy | LOW | Storage growth | LOW | P3 |
| TD-15 | `reverseTransaction` unchecked caller | HIGH | Financial integrity | LOW | P1 |
| TD-16 | `onboarding_completed_steps` flat array | LOW | Non-queryable funnel analytics | MEDIUM | P3 |
| TD-17 | Base44 SDK direct calls scattered | MEDIUM | Migration lock-in | HIGH | P2 |
| TD-18 | No optimistic locking on Wallet entity | HIGH | Race condition at concurrent gifts | MEDIUM | P1 |
| TD-19 | `ContentRecommendation` records never pruned | LOW | Storage drift | LOW | P3 |
| TD-20 | Client-side A/B bucketing (not server-authoritative) | MEDIUM | Experiment integrity | MEDIUM | P2 |

---

## P0 — Fix Before Any Public Launch

### TD-01: Wallet Race Condition
**Risk:** Two simultaneous gift receipts both read `balance=500`, both add 100 → final balance 600 instead of 700.  
**Current mitigation:** Idempotency keys (only protect against duplicate calls, not concurrent distinct calls).  
**Fix:**
```
Client-side MVP:
  - Add `wallet_version` field (integer, increments on each mutation)
  - creditWallet/debitWallet reads version, includes it in update condition
  - If version mismatch → retry (up to 3×)

Migration (NestJS + PostgreSQL):
  UPDATE wallets SET balance = balance + ?, version = version + 1
  WHERE id = ? AND version = ?
  -- If 0 rows affected → optimistic lock failure → retry
```

### TD-02: stream_key Client Exposure
**Risk:** Live stream RTMP key readable by any authenticated client querying LiveSession entity.  
**Fix:**
```
1. Remove stream_key from LiveSession entity schema immediately
2. Store in backend function secrets / environment variable per session
3. stream_key only returned to session host via authenticated backend function call
4. Client uses stream_provider + session_id to connect (never raw key)
```

---

## P1 — Fix Within First Sprint Post-Launch

### TD-03: markAllAsRead N+1
Current: `N × UPDATE` calls where N = unread notification count.  
Fix: Backend function `bulkMarkRead(userId)` that does a single filtered update.

### TD-04: UserProfile Overload
**Fields to migrate out:**

| Field Group | Target Entity | Priority |
|---|---|---|
| `onboarding_completed_steps`, `onboarding_complete`, `onboarding_activated` | `OnboardingState` | Sprint 2 |
| `referral_code`, `referred_by`, `referral_count`, `referral_activated` | `ReferralRecord` | Sprint 3 |
| `achievements_earned[]`, `total_xp` | `UserAchievement` | Sprint 3 |

### TD-05: engagement_score Sync Recompute
Current: Every like/comment triggers synchronous re-score of post.  
Fix: Write interaction → queue async job → job recomputes score 30s later (debounced).  
Migration: BullMQ delayed job per post_id, deduped by post_id key.

### TD-15: reverseTransaction Unchecked
Fix: Add to `wallet.service.reverseTransaction()`:
```js
const adminProfiles = await base44.entities.UserProfile.filter({ id: adminUserId });
if (!adminProfiles[0] || !['admin', 'moderator'].includes(adminProfiles[0].role)) {
  throw new Error('Unauthorized: reverseTransaction requires admin role');
}
```

### TD-18: Wallet Optimistic Lock
See TD-01. Same fix, same migration path.

---

## P2 — Address in First 30 Days

### TD-07: Notification Dispatch Split
**Rule (enforce via code review):**
```
ALLOWED dispatch paths:
  notificationIntelligence.sendIntelligentNotification()  ← social/growth notifications
  notificationService.createNotification()                ← financial/security only

FORBIDDEN:
  base44.entities.Notification.create() called directly from feature services
```

### TD-08: Notification Table Index
When migrating to PostgreSQL:
```sql
CREATE INDEX CONCURRENTLY idx_notifications_recipient_unread
ON notifications (recipient_id, is_read, created_date DESC)
WHERE is_read = false;
```

### TD-10: Dual View Count Writes
Remove from `watch.service.js`:
```js
// DELETE these lines from recordWatchEvent():
if (contentType === 'post' && completionRate >= 0.3) {
  // ... Post.view_count update
}
```
Engagement service owns Post counters exclusively.

### TD-17: Base44 Lock-In
**Highest long-term risk.** Every `base44.entities.X.method()` call is a migration dependency.  
**Mitigation (implemented progressively):**
```
Phase 1 (now): All entity calls go through service layer — NEVER from components directly
Phase 2: Service layer accepts injected "repository" interface — swap Base44 for Postgres driver
Phase 3: Generate TypeScript types from entity schemas — detect breaking changes at compile time
```
**Current violations to fix:** Verify no component directly imports `base44.entities.*` — all access must be through services.

---

## P3 — Technical Housekeeping

### TD-06: WatchEvent Retention Policy
Add scheduled backend function:
```
Function: pruneOldWatchEvents
Schedule: Weekly (Sunday 02:00 WAT)
Logic: Delete WatchEvent records older than 90 days
```

### TD-12: Client-Side Ranking
Acceptable at MVP. Move server-side when:
- Feed load time > 3s consistently
- Post corpus > 100k records
- Personalization requires privacy-sensitive signals not safe in client

### TD-14: ContentRecommendation Pruning
Add to same pruner job: delete ContentRecommendation records older than 14 days or where `served=true AND clicked=false AND dismissed=true`.

---

## Base44 Lock-In Risk Assessment

| Component | Lock-In Level | Migration Path |
|---|---|---|
| Entity CRUD | HIGH | Service layer abstraction (in place) → swap to Prisma/Drizzle ORM |
| Realtime subscriptions | HIGH | Abstract into RealtimeBus (in place) → swap to Socket.IO or Ably |
| Auth (`base44.auth.me()`) | HIGH | Wrap in `AuthProvider` (in place) → swap to Clerk/Auth0 |
| File upload (`UploadFile`) | MEDIUM | Abstract into `media.service.js` (in place) → swap to S3 |
| `InvokeLLM` | MEDIUM | Wrap in AI gateway service → swap to OpenAI/Anthropic direct |
| `SendEmail` | LOW | Abstract into notification service → swap to SendGrid/Resend |
| Backend functions | MEDIUM | Migrate to NestJS controllers → same HTTP interface, no frontend change |

**Key finding:** All Base44 dependencies are correctly abstracted behind service/provider layers. No component imports SDK directly for data access. Migration risk is **MEDIUM overall, LOW for frontend** — all swap points are server-side.

---

## Migration Sequencing Strategy

```
Phase 1 — Security Hardening (Pre-launch, 1 week)
  1. Remove stream_key from entity schema
  2. Add reverseTransaction role check
  3. Add wallet version field (optimistic lock MVP)
  4. Enforce notification dispatch rule

Phase 2 — Performance (First 2 weeks post-launch)
  1. Add WatchEvent retention job
  2. Fix markAllAsRead to bulk operation (backend function)
  3. Add composite index on Notification table
  4. Move engagement_score recompute to async

Phase 3 — Schema Cleanup (Month 1–2)
  1. Extract OnboardingState entity from UserProfile
  2. Extract ReferralRecord entity
  3. Fix dual view-count write
  4. Define CreatorAnalyticsSnapshot type

Phase 4 — Infrastructure Migration (Month 3–6)
  1. NestJS API layer (entity service adapters first)
  2. PostgreSQL with SELECT FOR UPDATE for wallet
  3. Redis for session, cache, rate limiting
  4. BullMQ for async jobs (score recompute, notifications, streak rescue)
  5. ClickHouse for analytics (WatchEvent, Notification CTR, retention cohorts)

Phase 5 — Scale (Month 6–12)
  1. Kafka event bus replaces direct service calls
  2. Feed ranking moves server-side
  3. FCM push notifications
  4. ML recommendation model (replace client-side heuristics)
``