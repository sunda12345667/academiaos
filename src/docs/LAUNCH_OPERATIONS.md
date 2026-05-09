# StudentOS — Launch Operations Plan
*v1.0 | 2026-05-09*

---

## Performance Targets by Phase

### Phase 0 — Private Alpha (Week 1–4)
```
DAU target:             50 users (hand-selected)
Concurrent users:       20 (non-peak)
Live streams:           Max 10 concurrent (flag enforced)
Notifications/day:      < 1,000
Posts/day:              < 500
Gifts/day:              0 (gifting flag: off)
Payouts/week:           0 (payout flag: off)
Error rate target:      < 5% (learning phase)
Uptime target:          95% (Base44 provides baseline)
```

### Phase 1 — Campus Beta (Week 5–12)
```
DAU target:             500–2,000 users
Concurrent users:       200 (peak 18:00–21:00 WAT)
Live streams:           Max 50 concurrent (flag enforced)
Notifications/day:      < 20,000
Posts/day:              < 5,000
Gifts/day:              < 500 transactions
Payouts/week:           < 50 (manual review threshold: ₦3,000)
Error rate target:      < 2%
Feed P95 load:          < 3s
Uptime target:          99%
```

### Phase 2 — Public Launch (Week 13–24)
```
DAU target:             5,000–15,000
Concurrent users:       1,000 (peak)
Live streams:           Max 200 concurrent
Notifications/day:      < 200,000
Payouts/week:           < 500
Error rate target:      < 1%
Feed P95 load:          < 1.5s
Uptime target:          99.5%
```

### Scale Trigger Points (infrastructure upgrade required)
```
> 1,000 DAU:      Monitor WatchEvent write volume, add batch inserts
> 5,000 DAU:      Add Redis caching layer (sessions, rate limits)
> 10,000 DAU:     NestJS API migration begins
> 50,000 DAU:     PostgreSQL migration, Kafka event bus
```

---

## Product Analytics Launch Dashboard

### Core Metrics (monitored daily from Day 1)

#### Acquisition
| Metric | Definition | Target (Phase 1) |
|---|---|---|
| New registrations/day | SignUp events | 50–200 |
| Referral attribution rate | % signups with ref code | > 30% |
| Campus penetration | signups / total students per campus | > 5% in 4 weeks |
| Creator invites sent | creator_invited events | > 10/week |

#### Activation (D0–D7)
| Metric | Definition | Target |
|---|---|---|
| Onboarding completion | % who complete all required steps | > 60% |
| Interests selected | % who complete step 1 | > 85% |
| First follow | % who follow 3+ accounts | > 70% |
| First post | % who publish within D7 | > 25% (creators: > 80%) |
| First group join | % who join 1+ group | > 50% |

#### Retention
| Metric | Definition | Target |
|---|---|---|
| D1 retention | Opened app on day after signup | > 40% |
| D7 retention | Active in first week | > 25% |
| D30 retention | Active in first month | > 15% |
| Weekly posting streak | % creators with 7-day streak | > 20% of creators |
| DAU/MAU ratio | Stickiness | > 25% |

#### Engagement
| Metric | Definition | Target |
|---|---|---|
| Posts/user/week | Active user post rate | > 3 |
| Reactions/post | Avg likes+comments per post | > 10 |
| DM sessions/week | Conversations initiated | > 2 per active user |
| Feed scroll depth | Avg posts seen per session | > 10 |
| Live attendance | Avg viewers per live session | > 20 |

#### Creator Economy
| Metric | Definition | Target (Phase 1) |
|---|---|---|
| Creator activation | % users who publish + get 10 followers | > 5% of all users |
| First live rate | % creators who go live in D30 | > 30% |
| Gift send rate | % active users who send gift/week | > 5% (Phase 1) |
| Creator D30 retention | % creators still posting at D30 | > 50% |
| Avg earnings/creator/month | Total gifts / active creators | ₦5,000+ (Phase 1) |

#### Viral
| Metric | Definition | Target |
|---|---|---|
| Referral k-factor | referred_signups / invites_sent | > 0.3 (target > 1.0) |
| Campus share rate | campus_invite_links_clicked | > 100/campus/week |
| Content share rate | content_shared events per post | > 5% of viewed posts |

---

## Onboarding Analytics Events (track from day 1)

```js
// These must fire before launch — no analytics = no optimization
eventQueue.track('onboarding', 'step_complete', { stepId, role, progressPercent })
eventQueue.track('onboarding', 'step_skipped', { stepId, role })
eventQueue.track('onboarding', 'activated', { role, stepsCompleted, daysSinceSignup })
eventQueue.track('onboarding', 'interests_selected', { interestCount, interests })
eventQueue.track('onboarding', 'school_matched', { schoolId, campusCount })
eventQueue.track('onboarding', 'follow_completed', { followCount, method })
```

Funnel analysis in `growth.analytics.getActivationFunnel()` — run weekly.

---

## School Onboarding Process

### Target Schools (Phase 1 pilots)
```
Priority 1 (Week 5–6):   University of Lagos (UNILAG)
Priority 1 (Week 5–6):   Lagos State University (LASU)
Priority 2 (Week 8–10):  University of Ibadan (UI)
Priority 2 (Week 8–10):  Covenant University
Priority 3 (Week 11–12): Obafemi Awolowo University (OAU)
```

### School Onboarding Steps
```
Week -2: Ambassador recruitment (student social media outreach)
Week -1: Ambassador briefing (platform walkthrough, WhatsApp group setup)
Day -3:  Soft launch email to Ambassador's existing network
Day -1:  Ambassador posts "early access" content on Instagram/WhatsApp
Day 0:   Campus launch event (can be digital — Twitter Space)
Week 1:  Daily check-ins with Ambassador
Week 2:  First analytics review — is the campus viral loop working?
```

### School-Specific Features (enable after 50 students from same school)
- School-specific group auto-created
- "X students from your school" shown on onboarding
- School-scoped trending feed
- Campus leaderboard (top creators from your school)

---

## Creator Recruitment Workflow

### Phase 0 Creator Selection Criteria
```
Must have ALL of:
  - Nigerian student/educator audience
  - > 500 followers on TikTok/Instagram/Twitter/YouTube
  - Content type: educational, lifestyle, entertainment (safe for campus)
  - Active in last 30 days

Bonus:
  - University-affiliated (lecturer, alumni, current student)
  - Existing community (WhatsApp group, Telegram channel)
  - Willing to commit to 3 posts/week for first month
```

### Phase 0 Creator Outreach Template
```
Subject: Early Access — StudentOS is building Nigeria's student social platform

Hi [Name],

We're building the social platform for Nigerian university students, and we want you 
as one of our founding creators.

Why you: Your content on [platform] reaches exactly the audience we're building for.

What you get:
- First-mover advantage (top creators get highest algorithmic priority)
- ₦50,000 in creator credits (gift coins for your audience)
- Verified badge from day one
- Direct line to our team (WhatsApp group)
- Revenue sharing from gifts sent by your audience

What we need:
- 3 posts/week for the first 30 days
- One live session in the first 2 weeks
- Honest feedback on what we should build

Interested? Reply and we'll send you early access in 24 hours.

[Founder name]
StudentOS
```

### Creator Activation Funnel
```
Invited (100) → Accepted (60%) → Set up profile (80%) → First post (70%) → First live (30%)
→ First gift received (20%) → Still active D30 (50%)

Bottleneck: First live (30%). Fix: personal outreach + scheduled live with team.
```

---

## API Documentation Readiness

### Phase 0 — Internal Only
No public API documentation needed. Internal JSDoc on all service methods.

### Phase 1 — Partner API (school integrations)
```
Document:
  - Auth: how to get API tokens (Base44 auth flow)
  - Entities: GET endpoint patterns (read-only for partners)
  - Webhooks: event subscriptions for LMS integrations

Tool: Generate from JSDoc using TypeDoc
Host: docs.studentos.app/api (Phase 2)
```

### Phase 2 — Developer Portal
```
OpenAPI spec generated from backend function schemas
Interactive playground (Swagger UI or Redocly)
SDK: @studentos/sdk (thin wrapper over REST API)
Rate limits documented: 1,000 req/hour per token
```

---

## Operational Runbooks

### Runbook: Wallet Balance Reconciliation
```
Trigger: Automated daily job mismatch alert OR user reports wrong balance

Steps:
1. Freeze wallet: update({ status: 'frozen' })
2. Sum all LedgerEntry credits: SELECT SUM(amount) WHERE wallet_id AND entry_type='credit'
3. Sum all LedgerEntry debits: SELECT SUM(amount) WHERE wallet_id AND entry_type='debit'
4. Expected balance = credits - debits
5. Compare to Wallet.balance
6. If mismatch > 0: log INC-XXX, investigate Transaction history
7. If correction needed: admin-authed credit/debit with reason 'reconciliation'
8. Unfreeze wallet
9. Notify user of resolution

Expected time: 30 minutes
Escalate if: mismatch > ₦10,000 (to Founder)
```

### Runbook: Paystack Webhook Failure
```
Trigger: PaymentIntent stuck in 'pending' for > 1 hour

Steps:
1. Check paystackWebhook function logs in Base44 dashboard
2. Verify webhook received: Paystack dashboard → Events
3. If event received but function failed: manually invoke with event payload
4. If event never received: manually verify payment via Paystack API
5. If payment confirmed: manually credit wallet via admin backend function
6. Update PaymentIntent status to 'completed'
7. Send user notification: "Your payment has been confirmed"

Expected time: 45 minutes
Escalate if: user reports before we detect (means our monitoring failed)
```

### Runbook: Live Stream Stuck "Live"
```
Trigger: LiveSession.status = 'live' for > 6 hours with 0 viewers

Steps:
1. Check: is stream provider still active? (stream_provider API)
2. If not active: update LiveSession.status = 'ended', record duration
3. If active: contact host directly (DM or WhatsApp)
4. If no response after 30 min: admin terminate (live.service.endLiveSession)
5. Log admin action in AdminAuditLog

Expected time: 15 minutes
```

### Runbook: High FraudSignal Volume
```
Trigger: > 5 FraudSignals in 1 hour with same user_id

Steps:
1. Freeze user wallet immediately
2. Review FraudSignal records: what triggered them?
3. Check: is this a coordinated gifting farm?
   - Multiple senders to same creator in short window
   - New accounts (< 7 days old) sending large gifts
4. If confirmed fraud: ban accounts, reverse transactions, log in AdminAuditLog
5. If false positive: unfreeze wallet, resolve signals as 'false_positive'

Expected time: 1 hour
Escalate: All confirmed fraud to Founder (financial + legal implications)
```

---

## 12-Month Execution Roadmap

### Month 1–2: Private Alpha + Critical Fixes
```
Milestone: 50 active users, 10 creators, 0 financial incidents
Key work:
  - Resolve all P0 technical debts (DEBT-001, 002, 007)
  - Deploy Phase 0 feature set (social, creator, basic live)
  - Recruit + onboard 10 founding creators
  - Campus ambassador hired at UNILAG + LASU
  - Moderation workflow operational
```

### Month 3–4: Campus Beta Launch
```
Milestone: 2,000 users, 5 campuses, first gift transactions
Key work:
  - Launch Paystack wallet topup
  - Enable gift sending (after wallet fix audited for 30 days)
  - Phase 1 Capacitor mobile build (iOS + Android)
  - App Store submission (iOS)
  - Push notifications live
  - Onboarding A/B test: interests-first vs social-first
```

### Month 5–6: Growth + Creator Economy
```
Milestone: 5,000 users, ₦500k monthly gift volume
Key work:
  - AI feed ranking (feature flag 25%)
  - Creator monetization: tips enabled at trust ≥ 40
  - Payout automation (after 30 days manual payout, 0 incidents)
  - Referral rewards (XP first, coins after anti-abuse confirmed)
  - Campus leaderboards
  - First creator success story content marketing
```

### Month 7–9: Platform Expansion
```
Milestone: 15,000 users, 3 creator tiers earned organically
Key work:
  - Marketplace (Phase 2 feature) — textbooks, study materials
  - AI study assistant public beta
  - School official account onboarding (verified institution accounts)
  - React Query + performance optimizations (NestJS prep)
  - Repository layer introduced (DEBT-017)
  - Advertiser waitlist open
```

### Month 10–12: Monetization + Scale
```
Milestone: 30,000 users, ₦2M monthly revenue (gift + marketplace fees)
Key work:
  - Self-serve ad campaigns (Phase 3)
  - Subscriptions (creator exclusive content)
  - NestJS API migration (wallet service first)
  - ClickHouse analytics (replace client-side approximations)
  - Series A data room preparation
  - Team scale: 5 engineers, 1 PM, 1 designer
``