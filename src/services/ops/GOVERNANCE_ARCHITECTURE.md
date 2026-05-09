# StudentOS — Platform Governance & Operations Architecture

## System Overview

```
┌────────────────────────────────────────────────────────────────────┐
│                   GOVERNANCE INFRASTRUCTURE                        │
├────────────────────────────────────────────────────────────────────┤
│  Admin UI Layer    usePlatformOps hook → permission-gated actions  │
│  Operations        platform.ops.service — user/creator/school mgmt │
│  Ad Platform       ad.platform.service — campaign lifecycle        │
│  Trust & Safety    trust.safety.service — scores, appeals, abuse   │
│  Audit Trail       admin.audit.service — immutable action log      │
│  Moderation        moderation.service + report.service             │
│  Risk Engine       risk.engine.js (wallet) + fraud signal tracking │
└────────────────────────────────────────────────────────────────────┘
```

---

## Reviewer Role Hierarchy

```
student / creator / educator / advertiser
        ↓
  moderator              — content queue, suspend, report review
        ↓
  senior_moderator       — + ban, appeal resolve, creator demonetize
        ↓
  trust_safety           — + trust score override, coordinated abuse
        ↓
  finance_reviewer       — payout approve/reject/force-complete
        ↓
  advertiser_manager     — ad campaign review, ad fraud
        ↓
  school_operator        — school verify, school-scoped content
        ↓
  admin                  — all actions, platform settings
```

---

## Audit Trail (admin.audit.service.js)

### Principles
- EVERY admin action MUST go through `logAndExecute()`
- Append-only — `AdminAuditLog` records are NEVER deleted
- `before_state` + `after_state` captured for every mutation
- Sensitive actions (ban, role change, payout force) require `confirmedBy` field

### Usage Pattern
```js
import adminAudit from '@/services/ops/admin.audit.service';

await adminAudit.logAndExecute({
  actorId, actorRole,
  action: 'user_suspend',
  entityType: 'user',
  entityId: targetProfileId,
  beforeState: { account_status: 'active' },
  reason: 'Spam violation',
  execute: async () => {
    await base44.entities.UserProfile.update(targetProfileId, { account_status: 'suspended' });
    return { afterState: { account_status: 'suspended' } };
  },
});
```

### Sensitive Actions (require `confirmedBy`)
```
user_ban, user_role_change, user_trust_score_override
payout_force_complete, creator_demonetize
fraud_signal_escalate, platform_setting_change, ad_budget_override
```

---

## Moderation Pipeline

### 5-Stage Architecture
```
Stage 0: Rule-based gate (0ms, free)
  → link spam, caps, scam patterns → HIGH → auto-hide
Stage 1: AI fast check (gpt_5_mini, ~1s)
  → hybrid severity merge → flag/review/hide
Stage 2: User-reported queue (async)
  → ModerationReport created → moderator queue
Stage 3: Human review
  → Moderator action: warn | remove | suspend | ban
Stage 4: Appeal
  → AppealRequest created → T&S review → outcome
```

### Queue Routing
| Severity | Reason              | Queue                  | SLA     |
|----------|---------------------|------------------------|---------|
| low      | any                 | moderator_standard     | 24h     |
| medium   | any                 | senior_moderator       | 4h      |
| high     | content             | trust_safety_senior    | 1h      |
| any      | financial_fraud     | finance_review         | 30min   |
| any      | ad_fraud            | advertiser_management  | 2h      |

### Action Lifecycle
```
pending → under_review → resolved_action_taken / resolved_no_action / dismissed
```

Actions: `none | warning | content_removed | account_suspended | account_banned`

---

## Trust Score System

### Score Formula (0–100)
```
Account age (max 30):     min(30, floor(days/10) × 3)
Verification (max 20):    email=5, id=12, educator=20
Report quality (max 15):  15 - actioned_reports × 5
Payment health (max 10):  10 - failed_payouts × 3
Fraud penalty (max -40):  severity-weighted open signals
Suspension penalty:       -30 per suspension
```

### Trust Tiers
| Score | Tier      | Capabilities          |
|-------|-----------|----------------------|
| 80–100| Trusted   | Full monetization    |
| 60–79 | Good      | Standard features    |
| 40–59 | Fair      | Limited (no withdraw)|
| 20–39 | At Risk   | Flagged for review   |
| 0–19  | Restricted| Read-only access     |

### Score Refresh Triggers
- Account suspension / unsuspension
- Payout failure / success
- New fraud signal opened / closed
- Verification status change
- Appeal resolution

---

## Appeal Workflow

```
User action → submitAppeal() → AppealRequest created (pending)
  → T&S queue notification
  → Reviewer picks up → resolveAppeal()
  → outcome:
    action_reversed      → entity reinstated + user notified
    action_upheld        → decision stands + user notified
    action_modified      → partial reversal
    escalated_to_senior  → bumped to senior T&S
```

### Priority Routing
- `normal`  — standard content removal
- `high`    — creator account, demonetization
- `urgent`  — account ban, financial impact

### SLA Targets
- Normal: 72 hours
- High: 24 hours
- Urgent: 4 hours

---

## Advertisement Platform

### Campaign Lifecycle
```
draft → pending_review → approved → active → completed/paused
                      ↘ rejected
                      ↘ needs_revision (revision required)
active → suspended (policy violation)
```

### Review Gate
1. Rule-based creative check (instant, free)
2. Human reviewer approve/reject (mandatory)
3. Budget validation against advertiser wallet

### Billing Models
| Type      | Deduction Point       | Use Case          |
|-----------|-----------------------|-------------------|
| CPM       | Per 1000 impressions  | Awareness         |
| CPC       | Per click             | Engagement/Traffic|
| CPA       | Per conversion        | Enrollment/Install|
| flat_rate | Campaign start        | School promotions |

### Click Fraud Detection
- CTR > 20% → `high_ctr` fraud flag (score +15)
- Same user > 3 clicks/24h on same ad → `repetitive_clicker`
- Budget utilization > 90% in < 1h → `velocity_abuse`
- Future: IP velocity analysis, bot fingerprinting, Flink stream processing

### Targeting Dimensions
```js
targeting: {
  schools: ['school_id_1'],           // School-specific ads
  interests: ['mathematics', 'tech'], // Subject affinity
  roles: ['student', 'educator'],     // Platform role
  geo: ['Lagos', 'Abuja'],            // State/city
  device: 'mobile',                   // Device type
  age_range: { min: 16, max: 25 },   // Future: age gate
}
```

---

## Coordinated Abuse Detection

### Triggers
- > 10 gift events to same creator in 1h → `coordinated_gift_abuse`
- > 50 new follows to same user in 1h → coordinated follow ring
- Multiple FraudSignal records from same IP subnet (future)

### Response Flow
```
detect → FraudSignal created (severity: high/critical)
       → PlatformAlert created (auto_generated: true)
       → Assigned to trust_safety queue
       → Manual investigation or auto-freeze
```

---

## Platform Health Monitoring

### Health Dashboard (getPlatformHealthSnapshot)
```js
{
  health_status: 'healthy' | 'degraded' | 'critical',
  queues: {
    moderation: { pending, backlogged },
    fraud: { open, critical },
    payouts: { pending, urgent },
    appeals: { pending, high_priority },
    ads: { pending_review },
  },
  alerts: {
    total_open, critical, recent: PlatformAlert[],
  },
}
```

### Health Status Rules
- `critical`: any open CRITICAL PlatformAlerts
- `degraded`: moderation pending > 100, or fraud signals > 20
- `healthy`: all queues within bounds

### Alert Types
```
abuse_spike               → content abuse rate exceeds threshold
payment_failure_rate      → Paystack success rate drops
moderation_queue_backlog  → pending reports > 50
fraud_cluster_detected    → coordinated abuse pattern
live_stream_abuse         → multiple reports on same stream
creator_churn_spike       → 10+ creators deactivated in 24h
ad_fraud_detected         → campaign fraud score > 70
```

---

## Moderation Analytics

### Metrics Tracked
- Reports submitted per day (30-day rolling)
- Resolution rate (action_taken / total)
- Average resolution time (hours)
- Report reasons distribution (top violation types)
- Reviewer throughput (reports resolved per moderator)
- Appeal overturn rate (reversed / total appeals)

---

## Enterprise Scalability Roadmap

### Phase 1 — Current (MVP Client-Side)
- Services as importable JS modules
- AdminAuditLog persisted to DB
- Rule-based + AI moderation gate
- Manual payout review

### Phase 2 — Dedicated Admin Service
- Separate NestJS admin app (same DB)
- Role-scoped API endpoints per reviewer type
- Bulk moderation actions (select + action)
- Moderator assignment + SLA tracking

### Phase 3 — Operational Tooling Scale
- BullMQ queues per reviewer tier
- Kafka: all admin actions → audit stream → ClickHouse
- Prometheus + Grafana: realtime health dashboard
- PagerDuty integration for critical alerts
- Moderator performance analytics (throughput, accuracy)

### Phase 4 — Enterprise Grade
- SOC 2 compliance logging (data retention policies)
- IP-level fraud detection (MaxMind GeoIP + velocity)
- ML moderation: BERT toxicity + spam classifiers
- Advertiser self-serve portal (separate Next.js app)
- School admin portal with white-label support
- Regulatory compliance tools (NDPR/GDPR data export)

### Multi-Tenant School Architecture (Future)
```
School → school_id scoped:
  Posts, Groups, Courses, MarketplaceListings
  School Admin role: full CRUD within school boundary
  Cross-school visibility: configured per school privacy settings
  School billing: separate invoice per institution
``