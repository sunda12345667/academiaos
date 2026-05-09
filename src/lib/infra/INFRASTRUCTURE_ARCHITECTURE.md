# StudentOS — Infrastructure, Reliability & Scalability Architecture

## System Map

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        CLIENT INFRASTRUCTURE LAYER                          │
├─────────────────────────────────────────────────────────────────────────────┤
│  app-bootstrap.js    Bootstrap sequence: logger → perf → events → guards    │
│  logger.js           Structured logs: correlation IDs, remote drain, Sentry │
│  retry.js            Retry + CircuitBreaker + Fallback + Deduplicator       │
│  feature-flags.js    URL / env / A/B flag evaluation, canary rollout        │
│  performance.monitor Timing, Web Vitals, Long Tasks, Memory, SLO tracking  │
│  event-queue.js      Batched analytics events, DLQ, offline-resilient       │
├─────────────────────────────────────────────────────────────────────────────┤
│                       REALTIME & CACHE LAYER                                │
├─────────────────────────────────────────────────────────────────────────────┤
│  RealtimeBus         Reference-counted WS subscriptions, stale reconnect   │
│  react-query         2min stale / 10min GC, 4xx skip, no polling           │
│  FeedRealtimeProvider  ONE Post sub → N feed instances                      │
│  MessagingProvider   ONE Message + Conversation sub                         │
│  NotificationProvider ONE Notification sub + unread state                  │
│  WalletProvider      Transaction realtime                                   │
│  LiveSessionProvider LiveSession status + viewer count realtime             │
├─────────────────────────────────────────────────────────────────────────────┤
│                         SERVICES LAYER                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│  feed.service        Algorithmic ranking, fan-out, blend                    │
│  ranking.engine      Multi-signal score + diversity filter                  │
│  recommendation.service Multi-strategy pipeline + personalization          │
│  ai.gateway          Provider-agnostic LLM routing + failover chains       │
│  moderation.service  Rule-based + AI hybrid pipeline                        │
│  wallet.service      Double-entry ledger + risk engine                      │
│  platform.ops.service Admin tooling + health monitoring                    │
│  trust.safety.service Trust scores + appeals + coordinated abuse           │
│  ad.platform.service Campaign lifecycle + fraud detection                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Infrastructure Primitives (`lib/infra/`)

### 1. Structured Logger (`logger.js`)

```js
import logger from '@/lib/infra/logger';

// All logs carry: timestamp, level, event, correlation_id, route, env, userId
logger.info('feed.loaded', { feedType: 'home', postCount: 20, durationMs: 450 });
logger.error('payment.failed', { gateway: 'paystack', reason: 'timeout' }, error);

// Performance wrapper (mark + measure + log)
const data = await logger.measure('recommendation.fetch', () => fetchRecs(userId));

// Rotate correlation ID on route change (automatic in app-bootstrap)
logger.newCorrelationId();
```

**Log Levels:** `debug → info → warn → error → fatal`
**DEV:** all levels to console | **PROD:** info+ to console + remote drain
**Remote drain:** batched JSONL → `VITE_LOG_DRAIN_URL` every 5s or 20 entries
**Sentry hook:** fatal/error in prod → `window.__SENTRY__.hub.captureException()`

---

### 2. Retry & Circuit Breaker (`retry.js`)

```js
import { retry, breakers, withFallback, graceful } from '@/lib/infra/retry';

// Exponential backoff (base 500ms, max 10s, 3 attempts)
const result = await retry(() => fetchData(), { operationId: 'feed.fetch' });

// Circuit breaker — wraps an unreliable service
const data = await breakers.ai.execute(() => aiGateway.invoke(prompt));
// → Opens after 3 failures, resets after 60s

// Fallback: try primary, fall back on any error
const recs = await withFallback(
  () => recommendationService.getRecommendations(userId),
  () => feedService.getTrendingPosts(),
  'recommendations'
);

// Graceful degradation — non-critical paths
const recs = await graceful(() => getPersonalizedRecs(userId), []);
```

**Pre-built breakers:** `breakers.ai`, `breakers.payment`, `breakers.media`, `breakers.realtime`, `breakers.moderation`

**Circuit States:** `CLOSED` (normal) → `OPEN` (failing, reject all) → `HALF_OPEN` (probe) → `CLOSED`

---

### 3. Feature Flags (`feature-flags.js`)

```js
import flags from '@/lib/infra/feature-flags';

// Simple on/off check
if (flags.isEnabled('AI_SMART_FEED', userId)) { ... }

// Canary rollout: enable for 10% of users (deterministic by userId hash)
if (flags.rollout('AI_RECOMMENDATION_V2', userId, 0.10)) { ... }

// URL override for QA/dev: ?flag_AI_SMART_FEED=true
// Environment override: VITE_FEATURE_AI_SMART_FEED=true

// Get all flags for debugging/analytics
const allFlags = flags.getAll(userId);
```

**Namespaces:** `FEED_*` | `AI_*` | `CREATOR_*` | `PAYMENT_*` | `LIVE_*` | `MOD_*` | `INFRA_*`

**Flag sources (priority order):**
1. URL param override (`?flag_NAME=true`) — QA/dev only
2. Env var (`VITE_FEATURE_NAME=true`) — CI/CD controlled
3. Registry default (`FLAG_REGISTRY[name].default`)

---

### 4. Performance Monitor (`performance.monitor.js`)

```js
import perf, { SLO } from '@/lib/infra/performance.monitor';

// Mark/measure a user journey
perf.mark('feed.home.load');
// ... async work
const ms = perf.measure('feed.home.load', { feedType: 'home' }, SLO.FEED_LOAD);
// → logs warn if ms > 2000ms (SLO breach)

// Async trace wrapper
const posts = await perf.trace('feed.fetch', () => feedService.getHomeFeed(userId), {}, SLO.FEED_LOAD);

// Get percentile stats
const p95 = perf.getPercentile('feed.home.load', 95); // → durationMs

// Memory snapshot
const mem = perf.snapshotMemory(); // → { usedJsHeapMB, utilizationPct, ... }
```

**SLO Thresholds:**

| Metric              | SLO Target |
|---------------------|-----------|
| Feed load (TTI)     | < 2000ms  |
| Route change        | < 500ms   |
| API call (p95)      | < 1000ms  |
| Search results      | < 800ms   |
| Payment init        | < 3000ms  |
| AI response         | < 4000ms  |
| Realtime lag        | < 500ms   |

**Web Vitals tracked:** LCP, CLS, Long Tasks (> 50ms)
**Flush:** 30s interval via `navigator.sendBeacon` to `VITE_METRICS_URL`

---

### 5. Event Queue (`event-queue.js`)

```js
import { eventQueue } from '@/lib/infra/event-queue';

// Typed helpers (fire-and-forget)
eventQueue.contentView(postId, 'post', 'feed_home');
eventQueue.videoWatch(postId, 45, 0.87, 'feed_video');
eventQueue.searchQuery('javascript tutorial', 12, 'search_bar');
eventQueue.paymentInitiated(500000, 'wallet_topup', 'paystack');
eventQueue.recommendationClicked(recId, contentId, 3);

// Raw tracking
eventQueue.track('custom_category', 'custom_action', { custom: 'data' });
```

**Event flow:**
```
UI action → eventQueue.track()
  → _inMemoryQueue (non-blocking)
  → batch worker (every 5s or 20 events)
    → base44.entities.BehavioralEvent.create (MVP)
    → NestJS: POST /api/events/batch → Kafka → ClickHouse
  → on failure: localStorage DLQ
  → retry from DLQ on next flush
```

**Offline resilience:** Failed batches written to `localStorage` DLQ, retried on next cycle.
**Unload safety:** `beforeunload` + `pagehide` trigger final flush.

---

## App Bootstrap Sequence

```js
// main.jsx
import { bootstrapInfrastructure } from '@/lib/infra/app-bootstrap';
bootstrapInfrastructure(); // synchronous init, < 5ms
ReactDOM.createRoot(root).render(<App />);

// After auth resolves (in UserProvider):
import { setInfraUserContext } from '@/lib/infra/app-bootstrap';
setInfraUserContext(profile.id, profile.role, profile.school_id);
```

**Bootstrap order:**
1. `logger.setContext()` — env/version context attached to all logs
2. `perf.observeWebVitals()` — LCP/CLS/LongTask observers (if flag enabled)
3. `window.onerror` + `unhandledrejection` — global error capture
4. `online/offline` events — network status monitoring
5. `eventQueue.appOpened()` — session start event
6. Route mutation observer — correlation ID rotation + route tracking
7. `pagehide` handler — session end event + final flush

---

## Scalability Architecture

### Feed Scaling

| Layer         | MVP (current)              | Scale Target (NestJS)          |
|---------------|----------------------------|-------------------------------|
| Fan-out       | Client-side (cap 8 authors)| PostgreSQL materialized views  |
| Ranking       | Client-side JS             | Async job (BullMQ worker)      |
| Trending      | Client score decay         | Flink/Spark streaming          |
| Caching       | react-query (2min)         | Redis sorted sets per feed     |
| Delivery      | DB query per request       | Redis pre-computed user feed   |

**Pre-computed feed strategy (scale):**
```
Write path: Post created → Kafka → FeedFanoutWorker
  → For each follower: ZADD feed:{userId} score postId (Redis sorted set)
  → Capped at 1000 items per user
Read path: ZREVRANGE feed:{userId} 0 19 (sub-millisecond)
```

### Realtime Scaling

| System              | MVP                   | Scale Target                     |
|---------------------|-----------------------|----------------------------------|
| WS connections      | base44 subscriptions  | Dedicated WS gateway (Socket.io cluster) |
| Presence            | PresenceBus heartbeat | Redis TTL + pub/sub              |
| Typing indicators   | Provider ref (ephemeral) | Redis pub/sub (never DB)      |
| Notification fanout | 1 WS sub per entity   | FCM/APNs + Redis pub/sub         |
| Live chat           | Message entity sub    | Dedicated chat service (Ably/Pusher) |

### Livestream Scaling

```
Session starts → stream.provider assigns room
  → Agora/Livekit: WebRTC SFU (selective forwarding unit)
  → For 1000+ concurrent viewers: switch to HLS adaptive bitrate
  → CDN edge servers: 50+ PoPs for <100ms latency globally
  → Gift animations: separate Redis pub/sub channel per session
  → Viewer count: Redis HyperLogLog (approximate, < 1% error)
  → Comments: rate-limited at SFU level, deduplicated by session_id
```

**Viewer threshold handling:**
- < 100 viewers: WebRTC (low latency, 200ms)
- 100–10,000: HLS with 2s segments (CDN push)
- 10,000+: Adaptive multi-CDN with load balancing

### AI Workload Scaling

```
AI Gateway routing:
  Fast (gpt_5_mini)     — pre-publish moderation, search
  Quality (gpt_5_4)     — quiz gen, study plans
  Search (gemini_flash)  — web-augmented queries
  Vision                — media moderation

Scale strategy:
  Request queue → BullMQ priority queue
  High priority:  moderation (blocks publish)
  Normal:         recommendations, search, study tools
  Background:     analytics, batch content scoring
  Circuit breaker: opens at 3 failures → fallback provider
  Budget control: per-user monthly token limits (Redis counter)
```

### Notification Fanout

```
MVP:
  notificationService.createNotification() → DB insert → RealtimeBus

Scale (> 100k users):
  Event → Kafka → FanoutService
    → Online users: WS push (Redis pub/sub)
    → Offline users: FCM (mobile) / browser push
    → Email digest: SendGrid (hourly batch for muted users)
    → Inbox: PostgreSQL append-only + Redis unread counter
```

---

## Queue & Event Infrastructure

### Event Taxonomy

```
behavioral.*     → ClickHouse OLAP (analytics queries)
audit.*          → PostgreSQL append-only (compliance)
moderation.*     → PostgreSQL + moderation queue service
financial.*      → PostgreSQL (double-entry ledger, immutable)
system.*         → OpenTelemetry → Grafana
```

### Queue Architecture (NestJS target)

```
BullMQ Queues:
  high_priority:    moderation.check, payment.verify, payout.process
  normal:           feed.fanout, notification.fanout, analytics.flush
  background:       recommendation.compute, trust_score.refresh, ad.spend.track
  scheduled:        trending.compute (5min), creator_analytics.refresh (hourly)

Dead Letter Queues:
  Each queue has a corresponding DLQ
  DLQ items: max 3 retries → alert + human review
  Retention: 7 days in DLQ before archival
```

---

## Reliability Systems

### Circuit Breaker Configuration

```js
breakers.ai         — failThreshold: 3, reset: 60s (AI calls expensive)
breakers.payment    — failThreshold: 3, reset: 30s (financial critical)
breakers.media      — failThreshold: 5, reset: 20s (CDN may recover fast)
breakers.realtime   — failThreshold: 3, reset: 15s (WS reconnects needed)
breakers.moderation — failThreshold: 5, reset: 45s (graceful degrade: allow post)
```

**Moderation degradation:** If AI moderation circuit opens, posts are allowed through with status `pending_review` (human queue). Platform does NOT block publishing — safety net, not gatekeeper.

### Retry Strategy

| Operation            | Max Retries | Base Delay | Max Delay |
|----------------------|-------------|-----------|-----------|
| DB read              | 3           | 500ms     | 10s       |
| DB write             | 2           | 200ms     | 5s        |
| External API         | 3           | 1s        | 30s       |
| Payment verify       | 5           | 2s        | 60s       |
| AI call              | 2           | 1s        | 10s       |
| File upload          | 3           | 500ms     | 15s       |

### Graceful Degradation Modes

| Feature               | Degraded Behavior                          |
|-----------------------|--------------------------------------------|
| AI feed ranking       | Fallback to chronological                  |
| Recommendations       | Fallback to trending posts                 |
| AI moderation         | Fallback to rule-based only, queue for human |
| Payment gateway       | Show error, retry prompt — NEVER silent fail |
| RealtimeBus           | Fallback to polling (5s interval)          |
| Search                | Fallback to basic text match               |
| Creator analytics     | Show cached data with staleness indicator  |

---

## Deployment Architecture

### Environment Strategy

```
local       — developer machines, hot reload, debug flags on
dev/staging — mirrors prod schema, test data, feature flags unlocked
production  — real users, strict flags, monitoring enabled, no debug logs
```

**Environment variables:**
```env
VITE_APP_VERSION=1.0.0
VITE_BUILD_SHA=abc123
VITE_LOG_DRAIN_URL=https://logs.datadoghq.com/api/v2/logs
VITE_METRICS_URL=https://metrics.your-infra.com/ingest
VITE_FEATURE_AI_SMART_FEED=false
VITE_FEATURE_PAYMENT_FLUTTERWAVE=false
```

### CI/CD Pipeline

```
PR → lint + typecheck + unit tests → preview deployment (per-branch)
Main branch → staging deploy → smoke tests → prod deploy (canary 5%)
Prod canary → monitor error rate + p99 latency (15min) → full rollout
Rollback trigger: error rate > 1% or p99 latency > 3s → auto-revert
```

### Canary Rollout

```js
// Flag-controlled canary: 5% → 25% → 50% → 100%
if (flags.rollout('AI_RECOMMENDATION_V2', userId, 0.05)) {
  return recommendationServiceV2.get(userId);
}
return recommendationService.get(userId);
```

Rollout gated on:
- Error rate delta < 0.5%
- P95 latency delta < 20%
- No new Sentry error classes
- Manual approval checkpoint at 25%

---

## Observability Stack

### Metrics → Dashboards

```
Client perf → VITE_METRICS_URL → ClickHouse → Grafana
Error logs  → VITE_LOG_DRAIN_URL → Datadog/Logtail → Alert rules
Traces      → OpenTelemetry → Jaeger (NestJS spans)
Uptime      → Pingdom / BetterUptime (external)
```

### Alert Rules

| Alert                         | Threshold          | Severity | Action          |
|-------------------------------|-------------------|----------|-----------------|
| Feed p99 load > 3s            | 5min sustained    | warning  | Page on-call    |
| Error rate > 1%               | 3min window       | critical | PagerDuty       |
| Payment failure rate > 5%     | 10min window      | critical | PagerDuty + CEO |
| RealtimeBus reconnects > 10/min | continuous      | warning  | Slack alert     |
| Moderation queue > 100 items  | immediate         | warning  | Slack alert     |
| AI circuit breaker opened     | immediate         | warning  | Slack alert     |
| Memory utilization > 80%      | 5min sustained    | warning  | Auto-scale      |

---

## Data & Backup Strategy

### Retention Policies

| Data Type         | Retention      | Storage Tier         |
|-------------------|---------------|---------------------|
| User data         | Until deletion | Primary DB          |
| Audit logs        | 7 years        | Archive (S3 Glacier)|
| Financial records | 7 years        | Encrypted S3        |
| Analytics events  | 2 years        | ClickHouse + S3     |
| Media files       | User lifetime  | CDN + S3 Standard   |
| Moderation logs   | 3 years        | S3 Standard         |
| Session logs      | 90 days        | S3 IA               |

### Disaster Recovery

```
Recovery objectives:
  RTO (Recovery Time Objective):  < 4 hours for full platform
  RPO (Recovery Point Objective): < 1 hour for transactional data

Backup strategy:
  DB: Daily full + hourly incremental → S3 cross-region
  Financial ledger: Real-time replication to standby DB (< 5s lag)
  Media: CDN origin + S3 cross-region replication
  Feature flags: Versioned config in Git (instant rollback)

Failover:
  Primary region fails → DNS failover (30s TTL) → standby region
  CDN: Multi-CDN (Cloudflare primary, Fastly fallback)
  DB: Read replicas promote automatically on primary failure
```

---

## Security Operations

### API Abuse Detection

```
Client-side rate limiter (token bucket):
  createRateLimiter({ capacity: 10, refillPerSecond: 2 })
  
Server-side rate limits (NestJS target):
  POST /api/posts:        5/min per user
  POST /api/messages:     20/min per user
  POST /api/payments:     3/min per user
  GET /api/feed:          30/min per user (CDN cached)
  POST /api/events/batch: 10/min per user
  
Admin endpoints: IP allowlist + JWT + 2FA required
```

### Infrastructure Security Events

Tracked via `AdminAuditLog`:
- Admin login from new IP
- Role escalation
- Bulk data export
- Rate limit breach (velocity)
- Payout force-complete

---

## Performance Engineering Roadmap

### Phase 1 — Current
- react-query cache (2min stale)
- Route-level code splitting (lazy imports)
- Fire-and-forget analytics (non-blocking)
- Optimistic UI updates
- RealtimeBus (shared subscriptions)

### Phase 2 — Immediate Wins
- [ ] Feed virtualization (react-window, only render visible items)
- [ ] Image lazy loading (IntersectionObserver, next-gen formats)
- [ ] Media CDN with WebP/AVIF auto-conversion
- [ ] Service worker: cache app shell + static assets
- [ ] Prefetch next feed page on scroll threshold (80% depth)

### Phase 3 — Infrastructure Scale
- [ ] Redis feed cache (pre-computed per user)
- [ ] CDN edge caching for public feeds (Cloudflare Workers)
- [ ] Image optimization pipeline (Sharp, thumbnail generation)
- [ ] WebSocket gateway (Socket.io cluster behind nginx)
- [ ] BullMQ for all async jobs (moderation, notifications, analytics)

### Phase 4 — Enterprise Scale
- [ ] ClickHouse for analytics queries (OLAP)
- [ ] Kafka for event streaming (analytics + fanout + audit)
- [ ] Multi-region deployment (Lagos primary, secondary EU/US for diaspora)
- [ ] Edge functions for personalized feed headers (Cloudflare Workers)
- [ ] Machine learning feature store (feast) for ranking model