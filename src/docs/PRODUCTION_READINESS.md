# StudentOS — Production Readiness Checklist
*v1.0 | 2026-05-09*

---

## How to Use This Checklist

Status codes:
- ✅ DONE — implemented and verified
- 🔄 IN PROGRESS — partially implemented
- ⚠️ NEEDS WORK — identified, not started
- ❌ BLOCKER — must complete before launch

---

## 1. Security Checklist

### Authentication & Authorization
- ✅ Auth handled by Base44 platform (token issuance, sessions)
- ✅ RBAC system with 7 roles and 40+ permission constants (`services/auth/permissions.js`)
- ✅ `RequirePermission` + `RequireRole` declarative UI guards
- ✅ `AccountStatusGuard` blocks suspended/banned users from entire platform
- ✅ `SensitiveActionGuard` requires confirmation for financial operations
- ✅ `user.service.js` enforces field allowlist — client cannot escalate role/verification_status
- ⚠️ Backend functions must validate `user.role` before admin operations (done in `paystackWebhook`, template exists)
- ⚠️ All new backend functions must call `base44.auth.me()` and check permissions

### Financial Security
- ✅ Wallet idempotency keys on all mutations
- ✅ Transaction + LedgerEntry written before Wallet balance mutation
- ✅ Risk engine evaluates all payout and large-gift requests
- ✅ KYC level enforced on withdrawal limits
- ❌ BLOCKER: Wallet race condition (DEBT-001) — atomic debit backend function required
- ⚠️ Paystack webhook signature validation — verify `paystackWebhook` function validates `x-paystack-signature` header
- ⚠️ Payout to bank: human review required for amounts > ₦3,000 (LIMITS.REVIEW_THRESHOLD_KOBO) — review queue UI needed

### Data Privacy
- ⚠️ User PII (email, phone) never stored in WatchEvent or analytics events — audit all eventQueue.track() calls
- ❌ BLOCKER: `usePersonalization` module cache — cross-user data leak on shared browser (DEBT-007)
- ⚠️ Creator payout bank details (account_number, bank_code) — ensure not logged anywhere
- ⚠️ Message content — ensure never logged in logger.js output

### Content Security
- ✅ Moderation pipeline with AI + rule-based content scoring
- ✅ FraudSignal entity for abuse detection
- ✅ ModerationReport → human review queue
- ⚠️ Rate limiting on post creation (`report.service.checkPostRateLimit`) — ensure called before every Post.create()
- ⚠️ Rate limiting on messages — `checkMessageRateLimit` — wire into MessagingProvider.sendMessage()

---

## 2. Operational Checklist

### Monitoring
- ✅ Structured logger with correlation IDs (`lib/infra/logger.js`)
- ✅ Performance monitor with SLO thresholds (`lib/infra/performance.monitor.js`)
- ✅ Global error capture (unhandledrejection + error events) in `app-bootstrap.js`
- ✅ Circuit breakers for AI, payment, media, realtime, moderation (`lib/infra/retry.js`)
- ⚠️ Set `VITE_LOG_DRAIN_URL` environment variable pointing to logging service (Datadog/Axiom)
- ⚠️ Set `VITE_METRICS_URL` environment variable for performance metrics drain
- ⚠️ Sentry DSN: add `VITE_SENTRY_DSN` and wire `logger.setFatalHandler(Sentry.captureException)`
- ⚠️ PlatformAlert entity → connect to PagerDuty/Slack webhook for critical alerts

### Uptime & Reliability
- ✅ ErrorBoundary on App level + route level + widget level (3 layers)
- ✅ Circuit breakers prevent cascade failure from AI/payment provider outages
- ✅ RealtimeBus reconnects on visibilitychange (stale > 30s)
- ✅ event-queue DLQ for offline resilience
- ⚠️ Paystack webhook: verify retry idempotency (webhook may fire multiple times — confirm idempotency key guards work)
- ⚠️ Define SLOs formally: Feed P95 < 1.5s, Payment init < 3s, Auth < 500ms

### Scaling
- ⚠️ Base44 entity list() calls — add explicit sort + limit on ALL filter calls (prevent full table scans)
- ⚠️ Audit all `filter({}, '-created_date', 2000)` calls — unbounded limits at scale
- ⚠️ Identify top 5 most-read entities → add to react-query cache with appropriate staleTime

---

## 3. Payment Readiness Checklist

### Paystack Integration
- ✅ `paystackWebhook` backend function exists
- ✅ PaymentIntent entity tracks all inbound payments
- ✅ Transaction + LedgerEntry written on confirmation
- ❌ BLOCKER: Verify `x-paystack-signature` validation is implemented in `paystackWebhook`
- ⚠️ Paystack test → live key migration: ensure `PAYSTACK_SECRET_KEY` is set in production secrets
- ⚠️ Test webhook with Paystack CLI: `paystack events trigger charge.success`
- ⚠️ Failed payment retry: PaymentIntent.verification_attempts tracked — add retry UI

### Payout Flow
- ✅ PayoutRequest entity with risk scoring
- ✅ Bank account verification fields
- ⚠️ Manual review queue UI for PayoutRequests flagged for review
- ⚠️ Payout gateway integration (Paystack Transfer API) — backend function needed
- ⚠️ Test with sandbox account: minimum ₦100 withdrawal → verify LedgerEntry pair

### Gift Economy
- ✅ GiftCatalogItem with creator_share_percent
- ✅ Gift entity with platform fee split
- ✅ Gifting service credits creator wallet after platform cut
- ⚠️ Test gift → creator wallet credit → payout flow end-to-end in sandbox
- ⚠️ Self-gifting detection wired in risk.engine

---

## 4. Moderation Readiness Checklist

- ✅ AI moderation pipeline (rule-based fast-pass + LLM for borderline content)
- ✅ ModerationReport entity with action pipeline
- ✅ AdminAuditLog for all moderation actions
- ✅ AppealRequest entity and reviewer flow
- ✅ Trust score computed per user (basis for content weighting)
- ⚠️ Moderation queue UI for admin/moderator role — not yet built (see pages/)
- ⚠️ Content removals must set `Post.moderation_status = 'removed'` AND `Post.status = 'removed'`
- ⚠️ Live session abuse: `terminate live session` action wired in admin ops
- ⚠️ Report rate limiting: user cannot file > 5 reports/hour

---

## 5. Creator Onboarding Readiness Checklist

- ✅ CreatorProfile entity + tier progression system
- ✅ Trust score formula implemented
- ✅ Badge system (6 badges)
- ✅ Creator analytics dashboard data structure
- ✅ Monetization eligibility gates (trust + follower thresholds)
- ⚠️ Creator onboarding UI flow — not yet built
- ⚠️ Payout bank account setup UI — required before monetization
- ⚠️ Creator verification request UI + admin review flow
- ⚠️ Tips UI: gift button on creator posts + live sessions

---

## 6. Scalability Checklist

| Threshold | Requirement | Status |
|-----------|-------------|--------|
| 1k DAU | All P0 debts resolved | ❌ DEBT-001,002,007 open |
| 1k DAU | Feed load < 1.5s P95 | ⚠️ DEBT-005,008 open |
| 5k DAU | WatchEvent batching | ⚠️ DEBT-009 open |
| 5k DAU | Notification dedup/cap working | ✅ |
| 10k DAU | Repository layer for migration | ⚠️ DEBT-017 open |
| 10k DAU | ClickHouse analytics sink | ⚠️ Not started |
| 50k DAU | NestJS migration started | ⚠️ Not started |
| 100k DAU | Kafka + Redis + PostgreSQL | ⚠️ Not started |

---

## 7. Pre-Launch Final Gate

### Must be ✅ before first real user:
- [ ] DEBT-001 resolved (wallet atomic debit)
- [ ] DEBT-002 resolved (audit log immutability)
- [ ] DEBT-007 resolved (personalization cache privacy)
- [ ] Paystack webhook signature verification confirmed
- [ ] PAYSTACK_SECRET_KEY set in production
- [ ] ErrorBoundary tested with intentional crash
- [ ] Moderation pipeline tested with flagged content
- [ ] Admin role tested: cannot access admin functions without role=admin
- [ ] Payout flow tested end-to-end in Paystack sandbox
- [ ] Gift → creator wallet credit → creator sees balance update (realtime)
- [ ] markAllAsRead fixed (DEBT-004)

### Recommended before 100 users:
- [ ] DEBT-004 (markAllAsRead backend function)
- [ ] DEBT-005 (PostInteraction batch)
- [ ] DEBT-009 (WatchEvent batching)
- [ ] DEBT-011 (notification dispatch unified)
- [ ] Sentry DSN connected
- [ ] Log drain URL configured
- [ ] At least 1 moderator role user created