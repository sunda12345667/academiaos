# StudentOS — Technical Debt Report & Remediation Roadmap
*v1.0 | 2026-05-09*

---

## Debt Classification

| Code | Category | Description |
|------|----------|-------------|
| 🔴 P0 | Security / Data integrity | Fix before any production traffic |
| 🟠 P1 | Performance / Reliability | Fix before 1k DAU |
| 🟡 P2 | Maintainability / Scalability | Fix before 10k DAU |
| 🟢 P3 | Code quality / DX | Fix before team scaling to 5+ engineers |

---

## P0 — Security & Data Integrity

### DEBT-001: Wallet balance race condition
**File:** `services/wallet/wallet.service.js`
**Issue:** Read-modify-write pattern on `Wallet.balance` with no locking.
Two simultaneous gift sends can both read `balance=5000`, both debit 3000, both write 2000.
Net result: balance = 2000 when it should be -1000 (under-deduction, platform loses money).
**Fix:**
```
1. Add wallet_version field (optimistic concurrency)
2. Create backend function: debitWalletAtomic(walletId, amount, idempotencyKey)
   - Reads current balance + version
   - Writes new balance only if version matches (compare-and-swap pattern)
   - Returns 409 Conflict if version mismatch → caller retries
3. All Wallet.update() calls in wallet.service.js routed through this function
```
**Effort:** 2 days | **Risk if unresolved:** Financial loss, balance corruption

### DEBT-002: AdminAuditLog is mutable
**File:** `services/ops/admin.audit.service.js`
**Issue:** Service allows update() on AdminAuditLog records, violating the immutable audit trail contract.
If an admin's action is modified post-creation, the audit trail is unreliable for compliance.
**Fix:**
```
1. Remove ALL update() calls from admin.audit.service.js
2. Add RLS rule: AdminAuditLog — no update, no delete (platform-level)
3. confirmed_by field: write via new ConfirmationRecord create, not update
```
**Effort:** 1 day | **Risk if unresolved:** Compliance failure, audit manipulation

### DEBT-003: LedgerEntry direct writes bypassed in some flows
**File:** `services/wallet/gifting.service.js`, `payout.service.js`
**Issue:** Some gift and payout flows write Transaction without corresponding LedgerEntry pair.
Double-entry integrity broken → reconciliation impossible.
**Fix:** Audit all Transaction.create() calls; ensure every one is paired with `ledgerService.writeEntry()`.
**Effort:** 1 day | **Risk if unresolved:** Financial reconciliation breaks

---

## P1 — Performance & Reliability

### DEBT-004: markAllAsRead O(n) individual API calls
**File:** `services/notifications/notification.service.js:76`
**Issue:** Fetches all unread → iterates → individual update per notification.
User with 200 unread = 200 API calls. Causes UI hang + server load.
**Fix:**
```js
// Backend function: markAllNotificationsRead(recipientId)
// Uses base44.asServiceRole to bulk update in single query
// Frontend calls: base44.functions.invoke('markAllNotificationsRead', { recipientId })
```
**Effort:** 4 hours | **Risk if unresolved:** UX degradation, server load spike

### DEBT-005: PostInteraction N+1 on feed load
**File:** `services/engagement/engagement.service.js:124`
**Issue:** Each PostCard calls `getUserInteraction(postId, profileId)` — separate DB query per card.
20 feed posts = 20 queries on every feed render.
**Fix:**
```js
// New: batchGetUserInteractions(postIds, profileId) → Map<postId, interactions>
// Single filter({ user_id: profileId }) then group by post_id in JS
// react-query: queryKey: ['interactions', profileId, postIds.join(',')] — 5min cache
```
**Effort:** 4 hours | **Risk if unresolved:** Feed load time 3-5× slower at scale

### DEBT-006: RealtimeBus subscription timing race
**File:** `lib/realtime/RealtimeBus.js`
**Issue:** If component mounts → subscribe() → unmounts before subscribe resolves → cleanup fn is lost.
On fast navigation between feed tabs: orphaned handlers accumulate → duplicate event delivery.
**Fix:** Synchronous subscription ID allocation (before async subscribe starts); cleanup by ID.
**Effort:** 3 hours | **Risk if unresolved:** Ghost notifications, duplicate state updates

### DEBT-007: usePersonalization cache survives logout
**File:** `hooks/usePersonalization.js:15`
**Issue:** `_profileCache` is module-level — persists across logout.
If user A logs out and user B logs in on same browser tab, B gets A's taste profile briefly.
**Fix:**
```js
// Listen to auth state change in UserProvider
// Call personalizationEngine.clearCache(prevProfileId) on logout
// Or: move cache to sessionStorage with profile_id prefix key
```
**Effort:** 2 hours | **Risk if unresolved:** Privacy violation (cross-user data leak)

### DEBT-008: Follow fan-out — sequential queries
**File:** `services/feed/feed.service.js` — `_fetchFollowingPosts()`
**Issue:** For each followed creator, a separate Post query. Even capped at 5 = 5 sequential queries.
**Fix:**
```js
// Single: base44.entities.Post.filter({ author_id: { $in: followingIds.slice(0,20) } })
// Base44 may not support $in — if not: Promise.all() to parallelize (not sequential)
// Move to: Promise.all(followingIds.slice(0,8).map(id => Post.filter({author_id: id})))
```
**Effort:** 2 hours | **Risk if unresolved:** Home feed P95 load time > 2s

---

## P2 — Maintainability & Scalability

### DEBT-009: WatchEvent writes are unbounded
**File:** `services/analytics/watch.service.js`
**Issue:** Every impression + video watch = 1 WatchEvent record. At 10k DAU → ~500k records/day.
Base44 relational DB not designed for this write volume.
**Fix:**
```
Short term: Batch client-side in event-queue (20 events → single bulkCreate)
Medium term: Separate analytics sink (BigQuery / ClickHouse)
Long term: Remove WatchEvent entity; replace with external analytics
```
**Effort:** 1 day | **Risk if unresolved:** DB performance degradation at scale

### DEBT-010: ContentRecommendation records never expire
**File:** `services/recommendation/recommendation.service.js`
**Issue:** `expires_at` field exists but no cleanup. Old recommendations stay forever.
Fix: Scheduled backend function: `ContentRecommendation.filter({ expires_at: { $lt: now } })` → delete.
**Effort:** 2 hours | **Risk if unresolved:** DB bloat, stale recommendations served

### DEBT-011: Notification dispatch fragmented across 3 paths
**Files:** `notification-events.js`, `notification.intelligence.js`, `notification.service.js`
**Issue:** Feature code calls all three inconsistently. Fatigue prevention only works via intelligence layer.
Direct calls to `notificationService.createNotification()` bypass all priority/cap logic.
**Fix:** Single dispatch contract — all feature code calls `notificationIntelligence.sendIntelligentNotification()`.
`notificationService.createNotification()` becomes private (internal only).
**Effort:** 1 day | **Risk if unresolved:** Notification spam, user churn

### DEBT-012: GraphService.getSuggestedUsers() duplicates OnboardingService logic
**Files:** `graph.service.js`, `onboarding.service.js`
**Fix:** `onboarding.getOnboardingSuggestions()` delegates to `graphService.getSuggestedUsers()`.
**Effort:** 1 hour

### DEBT-013: CreatorProfile analytics write amplification
**File:** `services/creator/creator.service.js:refreshCreatorAnalytics()`
**Issue:** Called on every new follower + post + live session end. Fetches 3 entities per call.
High-engagement creator with 10k followers: triggered hundreds of times/day.
**Fix:** Debounce at call site (5-min cooldown per profile); move to scheduled job at scale.
**Effort:** 2 hours | **Risk if unresolved:** Server load, Base44 credit burn

### DEBT-014: PaymentIntent expired intents accumulate
**File:** `services/wallet/payment.service.js`
**Issue:** Intents > 30min old in `created` status never cleaned up. Pollutes webhook matching.
**Fix:** Scheduled backend function: mark expired intents as `expired` every 5 minutes.
**Effort:** 3 hours

### DEBT-015: AcademicIdentity vs UserProfile field duplication
**Entities:** `AcademicIdentity.json`, `UserProfile.json`
**Issue:** school_id, department, level exist on both. Sync risk.
**Fix:** Remove duplicates from UserProfile; all academic data owned by AcademicIdentity.
**Effort:** 1 day | Requires: data migration for existing records

### DEBT-016: FraudSignal.auto_action_taken is free-text string
**Entity:** `FraudSignal.json`
**Fix:** Add enum: `["wallet_frozen", "payout_blocked", "flagged_for_review", "account_suspended", null]`
**Effort:** 30 min

---

## P3 — Developer Experience & Code Quality

### DEBT-017: No repository abstraction over base44.entities
**Issue:** 34 service files import and call `base44.entities.X` directly.
Any migration to NestJS/PostgreSQL requires touching all 34 files.
**Fix:** Introduce `repositories/` layer. Services import repos, not base44 client.
**Effort:** 3 days | **Blocks:** NestJS migration

### DEBT-018: No centralized error type system
**Issue:** Errors thrown as raw `new Error('message')` strings throughout services.
No typed errors, no error codes, no structured API error responses.
**Fix:**
```js
// lib/errors/AppError.js
export class AppError extends Error {
  constructor(code, message, statusCode = 400, metadata = {}) {
    super(message);
    this.code = code; this.statusCode = statusCode; this.metadata = metadata;
  }
}
export const ErrorCodes = {
  INSUFFICIENT_BALANCE: 'WALLET_001',
  WALLET_FROZEN: 'WALLET_002',
  DUPLICATE_INTERACTION: 'ENG_001',
  ...
};
```
**Effort:** 1 day

### DEBT-019: No service-level unit tests
**Issue:** Zero test files. All logic untested.
**Fix:** See TESTING_STRATEGY.md for phased plan.
**Effort:** Ongoing

### DEBT-020: Inline magic numbers throughout wallet constants
**File:** `wallet.service.js` — LIMITS, FEE already extracted ✅
**Issue:** Other services still use inline numbers (e.g., `trust_score < 40`, `followers >= 500`)
**Fix:** Centralize all business constants in `lib/constants/platform.constants.js`
**Effort:** 4 hours

---

## Remediation Roadmap

### Sprint 1 — Security First (Week 1-2)
- [ ] DEBT-001: Wallet atomic debit backend function
- [ ] DEBT-002: AdminAuditLog immutability enforcement
- [ ] DEBT-003: LedgerEntry audit of all Transaction.create() calls
- [ ] DEBT-007: usePersonalization cache cleared on logout

### Sprint 2 — Performance (Week 3-4)
- [ ] DEBT-004: markAllAsRead backend function
- [ ] DEBT-005: PostInteraction batch lookup
- [ ] DEBT-006: RealtimeBus subscription ID fix
- [ ] DEBT-008: Follow fan-out parallelization
- [ ] DEBT-009: WatchEvent client-side batching

### Sprint 3 — Maintainability (Week 5-6)
- [ ] DEBT-011: Unify notification dispatch to intelligence layer
- [ ] DEBT-012: Deduplicate suggestion logic
- [ ] DEBT-013: Creator analytics debounce
- [ ] DEBT-014: PaymentIntent expiry job
- [ ] DEBT-017: Repository layer (start with Wallet, Post, Notification)
- [ ] DEBT-018: AppError typed error system

### Sprint 4 — DX & Long-term (Week 7-8)
- [ ] DEBT-015: AcademicIdentity consolidation
- [ ] DEBT-019: Test coverage (critical paths first)
- [ ] DEBT-020: Platform constants centralization
- [ ] Documentation: JSDoc on all public service methods