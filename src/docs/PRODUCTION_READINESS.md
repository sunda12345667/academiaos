# StudentOS — Production Readiness Checklist

**Date:** 2026-05-09  
**Status:** Pre-launch audit  
**Target:** Public beta launch

---

## Launch Checklist (Gate: ALL P0 items must be ✅)

### 🔴 P0 — Blocking (must fix before any users)

#### Security
- [ ] **TD-02** Remove `stream_key` from `LiveSession` entity (client exposure)
- [ ] **TD-15** Add admin role check to `wallet.service.reverseTransaction()`
- [ ] Paystack webhook signature validation tested end-to-end in production
- [ ] No secrets or API keys in any frontend code or entity fields
- [ ] `Content-Security-Policy` header set on index.html (restrict script sources)
- [ ] All file uploads go through `UploadFile` integration (no raw base64 on entities)

#### Financial Integrity
- [ ] **TD-01/18** Wallet optimistic lock implemented (version field + retry)
- [ ] Paystack webhook idempotency tested (duplicate webhook delivery handled)
- [ ] Test: gift send → wallet debit → creator credit (atomic sequence verified)
- [ ] Test: payout request → approval → Paystack transfer → status update
- [ ] Manual payout review queue operational before launch
- [ ] Minimum KYC level enforcement tested for withdrawal

#### Data Integrity
- [ ] Wallet balance audit: sum of all LedgerEntries = Wallet.balance for each user
- [ ] No orphaned PaymentIntent records in `pending` state > 30 min
- [ ] Idempotency keys working correctly on wallet operations (no double-credits)

---

### 🟡 P1 — Required for Stable Launch (fix in week 1)

#### Performance
- [ ] **TD-03** `markAllAsRead` converted to bulk backend function
- [ ] **TD-06** `WatchEvent` retention job deployed (90-day TTL)
- [ ] React Query `staleTime` verified (2 min) — no over-fetching
- [ ] RealtimeBus reconnect on visibility change tested
- [ ] Feed load time < 3s on 4G (tested on Lighthouse mobile simulation)
- [ ] Lazy route code-splitting confirmed (each page its own JS chunk)

#### Moderation
- [ ] AI content moderation pipeline tested on post create
- [ ] Report queue operational with at least 1 admin reviewer
- [ ] Ban/suspend actions tested end-to-end (AccountStatusGuard confirms block)
- [ ] Live session moderation modes tested (open → locked)
- [ ] Admin audit log writing on every moderation action

#### Operational
- [ ] Error boundary catching and displaying user-friendly messages
- [ ] `lib/infra/logger.js` — VITE_LOG_DRAIN_URL configured (or acceptable to skip at beta)
- [ ] `lib/infra/performance.monitor.js` — VITE_METRICS_URL configured (or acceptable to skip)
- [ ] Global unhandled error capture (window.onerror) verified firing
- [ ] App bootstrap (`bootstrapInfrastructure()`) confirmed executing before React render

---

### 🟢 P2 — Pre-Scale (fix in first 2 weeks post-launch)

#### Creator Economy
- [ ] Creator tier upgrade notifications sending correctly
- [ ] Monetization eligibility gating tested (500 followers + trust 60 minimum)
- [ ] Gift coin purchase → coin balance → gift send flow tested
- [ ] Tips flow tested (creator receives, ledger entry created)
- [ ] Payout request → admin review → bank transfer tested

#### Growth
- [ ] Referral code generation tested (new user registration)
- [ ] Referral attribution tested (code in URL → attribution stored)
- [ ] Onboarding completion event firing to analytics
- [ ] Notification caps working (5/day P2 cap tested)
- [ ] Quiet hours enforced (no P2+ notifications 23:00–07:00 WAT)

#### Notifications
- [ ] `Notification` entity creating correctly for all social events
- [ ] `NotificationProvider` realtime subscription updating unread count
- [ ] Deep link routing working (notification → correct page)
- [ ] Mark all read: all notifications marked, count resets to 0

---

## Security Checklist

### Authentication & Authorization
- [ ] All admin backend functions verify `user.role === 'admin'` before execution
- [ ] `paystackWebhook` — signature validation with `PAYSTACK_SECRET_KEY`
- [ ] User cannot escalate role via `updateProfile()` (field whitelist enforced)
- [ ] User cannot access other users' wallet data (filter by `user_id` enforced)
- [ ] Creator profile update — field whitelist enforced (no trust_score override)

### Data Privacy
- [ ] No PII stored in analytics events (emails hashed, names excluded)
- [ ] `FraudSignal` records only readable by admin role
- [ ] `AdminAuditLog` records only readable by admin role
- [ ] Blocked users cannot see each other's content (filter enforced in feed)
- [ ] Private group content hidden from non-members

### API Security
- [ ] Rate limiting on post creation (checkPostRateLimit called before create)
- [ ] Rate limiting on message sending (checkMessageRateLimit called)
- [ ] Gift send — anti-self-gifting check enforced
- [ ] Referral — self-referral guard enforced

---

## Scalability Checklist

### Database
- [ ] `WatchEvent` retention policy in place (90-day job scheduled)
- [ ] `ContentRecommendation` pruning in place (14-day job scheduled)
- [ ] `Notification` records — plan for archival after 90 days
- [ ] `Post.engagement_score` — plan for async recompute (not blocking)

### Realtime
- [ ] RealtimeBus tested under 50 concurrent subscriptions (manual test)
- [ ] RealtimeBus reconnect on network offline → online verified
- [ ] MessagingProvider — tested with 100+ messages in a conversation
- [ ] NotificationProvider — tested with 200+ unread notifications

### Feed
- [ ] Feed tested with 1000+ posts in the DB (ensure ranking still fast)
- [ ] Following feed fan-out capped at 8 authors (confirmed in feed.service)
- [ ] Video feed tested with 50+ short_video posts

---

## Moderation Readiness Checklist

- [ ] At least 1 admin user created before public launch
- [ ] Admin can access moderation report queue
- [ ] Admin can suspend/ban users (AccountStatusGuard tested)
- [ ] Admin can remove posts/comments
- [ ] Content moderation AI pipeline active (or fallback: manual review queue)
- [ ] Appeal request flow functional (user can submit, admin can review)
- [ ] Live session termination by admin functional
- [ ] Spam rate limiter tested (blocks >5 posts/hour)
- [ ] Trust score computation running on creator analytics refresh

---

## Payment Readiness Checklist

- [ ] Paystack secret key set in production environment
- [ ] Paystack webhook URL registered in Paystack dashboard
- [ ] `paystackWebhook` function deployed and accessible
- [ ] Test deposit: ₦1,000 → wallet credited ₦1,000 (kobo: 100,000)
- [ ] Test withdrawal: ₦1,000 min enforced, ₦100 fee deducted, bank transfer sent
- [ ] Failed payment → `PaymentIntent.status = 'failed'` → no wallet credit
- [ ] Duplicate webhook delivery → idempotent (no double credit)
- [ ] Platform fee split tested (10% platform, 90% creator on sales)
- [ ] Gift flow: coin deduct → naira value → 70% creator credit → 30% platform

---

## Creator Onboarding Checklist

- [ ] Creator profile auto-created on first creator role assignment
- [ ] Trust score baseline (30) set on creation
- [ ] Creator dashboard accessible and showing correct data
- [ ] First post → view count, engagement score computing
- [ ] Followers: `Follow` entity created, `follower_count` updated
- [ ] Tier upgrade from `none` → `basic` at 50 followers (tested)
- [ ] Tips toggle available at trust ≥ 40
- [ ] Monetization toggle available at trust ≥ 60 + 500 followers
- [ ] Live session create → start → end → duration recorded
- [ ] Gift received during live → wallet credited → notification sent

---

## Operational Checklist

### Monitoring (configure before launch)
- [ ] Error rate monitoring (target: < 1% of requests)
- [ ] Paystack webhook failure alerting (zero tolerance)
- [ ] Wallet balance audit job (daily, auto-alert on mismatch)
- [ ] Platform alert entity monitored by admin (open alerts resolved within 4h SLA)

### On-Call Procedures
- [ ] Runbook for: wallet frozen → how to unfreeze
- [ ] Runbook for: Paystack webhook failure → manual reconciliation steps
- [ ] Runbook for: creator live stream stuck in `live` status → admin force-end
- [ ] Runbook for: moderation emergency (CSAM/violence) → immediate content removal + escalation

### Backup & Recovery
- [ ] Base44 data backup confirmed (platform-level)
- [ ] Critical entity snapshots: Wallet, Transaction, LedgerEntry (verify backup frequency)
- [ ] Recovery test: restore Wallet state from LedgerEntry sum (validate reconciler logic)

---

## Long-Term Platform Evolution Strategy

### 6-Month Horizon
1. NestJS API layer behind Base44 (gradual migration, service by service)
2. PostgreSQL for financial data (Wallet, Transaction, LedgerEntry)
3. Redis for session management, rate limiting, streak state
4. BullMQ for async jobs (score recompute, notifications, cleanup)
5. FCM push notifications (Android + iOS)

### 12-Month Horizon
1. Kafka event bus replacing direct service→service calls
2. ClickHouse for analytics (replace client-side approximations)
3. ML-powered feed ranking (replace heuristic ranking engine)
4. ML-powered content moderation (reduce manual review load)
5. Multi-region deployment (Lagos primary, CDN edge for media)

### 24-Month Horizon
1. Microservice extraction (Wallet Service, Notification Service as independent APIs)
2. Real-time presence infrastructure (Redis pub/sub, dedicated WS gateway)
3. Video transcoding pipeline (Mux or AWS MediaConvert)
4. Creator monetization expansion (subscriptions, NFT certificates, live tickets)
5. School ERP integration (LASU, UNILAG, etc. — timetables, results)