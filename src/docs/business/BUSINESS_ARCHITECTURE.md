# StudentOS — Business Architecture
*v1.0 | 2026-05-09 | Principal Strategy Layer*

---

## 1. Business Model Architecture

StudentOS operates a **multi-sided platform** with four interconnected participant types:

```
┌─────────────────────────────────────────────────────────────────┐
│                        STUDENTOS PLATFORM                        │
│                                                                  │
│  STUDENTS ←──── social value ────→ CREATORS                     │
│      │                                    │                      │
│   attention                           earnings                   │
│      │                                    │                      │
│  ADVERTISERS ←── audience access ──→ SCHOOLS                    │
│                                                                  │
│  Platform takes: transaction fees + ad revenue + SaaS fees      │
└─────────────────────────────────────────────────────────────────┘
```

### Four Revenue Pillars

| Pillar | Revenue Type | Time to Revenue | Scale Ceiling |
|---|---|---|---|
| **Creator Economy** | Take rate on gifts, subscriptions, tips | Month 4–6 | Very high (GMV-based) |
| **Advertising** | CPM/CPC on student audience | Month 8–12 | High (DAU-constrained) |
| **School SaaS** | B2B recurring subscription | Month 10–18 | Medium (institutional sales) |
| **Fintech** | Payment spread, wallet premium | Month 6–12 | Very high (TPV-based) |

### Why This Structure Wins

The platform doesn't need to choose between social, education, or fintech. Each strengthens the others:
- Social graph → lower CAC for creators
- Creator quality → higher student retention
- High retention → better advertiser CPMs
- High engagement → school SaaS upsell
- School SaaS → institutional data → better AI recommendations
- Better AI → better creator discovery → more creator revenue

---

## 2. Revenue Architecture Breakdown

### Stream 1: Creator Economy (Take Rate Model)

```
Gift sent by student:
  Student pays: ₦1,000
  Creator receives: ₦700 (70%)
  Platform keeps: ₦300 (30% take rate)
  Paystack fee: ~₦50 (creator bears on withdrawal)
  Net platform margin: ₦250–300 per ₦1,000 gift

Subscription (Phase 2):
  Subscriber pays: ₦500–₦2,000/month per creator
  Creator receives: 80%
  Platform keeps: 20%
  Volume: 1,000 subs × ₦1,000 × 20% = ₦200,000/month at Phase 2
```

### Stream 2: Advertising

```
Pricing model: CPM-based (cost per 1,000 impressions)
Target CPM: ₦500–₦2,000 for student demographics
  (Nigerian student CPM premium: 1.5–2× general social)

Revenue at 10,000 DAU:
  Feed impressions/DAU/day: 50 posts viewed
  Monetizable (%): 15% (1 in 7 posts is an ad)
  Total ad impressions/day: 75,000
  CPM: ₦800
  Daily ad revenue: ₦60,000
  Monthly: ₦1.8M
```

### Stream 3: School SaaS

```
School Basic Plan: ₦50,000/month
  - Verified school page
  - Department groups (unlimited)
  - School analytics dashboard
  - Bulk student onboarding tools
  - Priority moderation

School Pro Plan: ₦150,000/month
  - Everything in Basic
  - LMS integration (Moodle/Google Classroom)
  - Assignment submission
  - Lecturer-student live session tools
  - Student attendance analytics
  - Custom domain (school.studentos.app)

At 20 schools paying ₦100k average → ₦2M/month recurring
```

### Stream 4: Fintech Revenue

```
Wallet topup fee: 0% (subsidized — user acquisition strategy)
Withdrawal fee: 1% (capped at ₦1,000)
Currency conversion spread: 0.5% (future: USD creator earnings)
Premium wallet features (Phase 3): ₦500/month
  - Instant withdrawal (standard: 24h, premium: 2h)
  - Transaction analytics
  - Creator earnings dashboard
  - Multi-bank account support
```

---

## 3. Monetization Sequencing

**Guiding principle:** Never monetize before the behavior you're monetizing is habitual. Extract value only after delivering it.

```
Month 0–3: INVEST
  Cost: Infrastructure + CAC
  Revenue: ₦0
  Objective: Social loop habit formation

Month 4–6: SEED
  First revenue: Gift donations during live sessions
  Target: ₦500,000 total GMV
  Take rate: 30% → ₦150,000 gross revenue

Month 7–9: GROW
  Add: Creator subscriptions + marketplace commissions
  Add: First 5 paying advertisers (invite-only)
  Target: ₦2M/month GMV → ₦600k/month gross

Month 10–12: MONETIZE
  Add: School SaaS (3–5 pilot schools)
  Add: Advertiser self-serve platform
  Add: AI premium features (study assistant)
  Target: ₦5M/month GMV → ₦1.5M/month gross

Month 13–24: SCALE
  Add: Regional expansion (Ghana, Kenya)
  Add: Fintech premium tier
  Add: Institutional API licensing
  Target: ₦20M/month GMV → ₦6M/month gross revenue
```

---

## 4. Unit Economics Model

### Student CAC (Consumer Acquisition Cost)

```
Target channels and costs:
  Campus ambassador (word-of-mouth): ₦200–₦500 CAC
  Referral program: ₦500–₦1,000 CAC
  TikTok/Instagram organic (creator content): ₦0 CAC
  Paid social (eventual): ₦1,500–₦3,000 CAC

Blended Phase 1 target CAC: ₦600 per activated user
(Activated = completed onboarding + posted 1 content in D7)
```

### Creator Acquisition Cost

```
Founding creator outreach: ₦5,000–₦20,000 per creator
  (time cost + ₦10k seed credit package)
Organic referral (creator brings creator): ₦500
Creator tools value (keeps creator on platform): ₦0 marginal

Creator LTV at Month 12:
  Monthly gift revenue: ₦15,000 (platform share: ₦4,500)
  Monthly subs revenue: ₦10,000 (platform share: ₦2,000)
  Advertiser sponsorship facilitation fee: ₦2,000
  Creator monthly LTV to platform: ₦8,500/month
  Annual creator LTV: ₦102,000

Creator payback period (at ₦20k CAC): 2.4 months ✅
```

### Student LTV Model

```
Segment A — Consumer only (70% of users)
  Ad revenue contribution: ₦50/month (CPM × sessions)
  Gift spend: ₦200/month (5% gift rate × ₦4,000 avg)
  Monthly LTV: ₦110
  Annual LTV: ₦1,320
  CAC (₦600) payback: 5.5 months ✅

Segment B — Power user / Creator (15% of users)
  Ad revenue: ₦80/month
  Gift spend: ₦500/month
  Subscription spend: ₦800/month (2 creators subscribed)
  Monthly LTV: ₦380
  Annual LTV: ₦4,560
  CAC payback: 1.6 months ✅

Segment C — Creator monetizer (5% of users)
  Revenue TO platform: ₦8,500/month (see creator LTV above)
  CAC (₦20k) payback: 2.4 months ✅
```

### Infrastructure Cost Scaling

```
Base44 tier (Phase 0–1): ~$50/month
  Handles: 500 users, 1,000 posts/day, basic realtime

Scale tier (Phase 2): ~$300/month
  Handles: 5,000 users, 10,000 posts/day, realtime

NestJS + PG migration (Phase 3): ~$800/month
  (self-managed on Railway/Render/GCP)
  Handles: 50,000 users, 100,000 posts/day

Full cloud scale (Year 2): ~$3,000–$8,000/month
  (Kubernetes, managed DB, Redis, CDN)
  Handles: 500,000 users

Cost per user/month targets:
  Phase 1: ₦250 ($0.30) per MAU — subsidized
  Phase 2: ₦150 ($0.18) per MAU — improving
  Phase 3: ₦60  ($0.07) per MAU — healthy SaaS ratio
```

### AI Inference Cost Scaling

```
InvokeLLM call cost: ~$0.002 per call (gpt-4o-mini equivalent)
Study assistant: 5 calls/session × 2 sessions/week = 10 calls/week
Monthly cost per AI user: $0.08

At 10,000 AI MAU: $800/month
At 100,000 AI MAU: $8,000/month (but premium users pay ₦500/month = $0.60)
AI margin at scale: 87%+ gross margin on AI feature ✅
```

### Payment Processing Economics

```
Paystack fees: 1.5% + ₦100 per transaction (capped at ₦2,000)
Gift of ₦500: Paystack: ₦100 + ₦7.50 = ₦107.50
  Platform receives: ₦500 × 30% = ₦150 gross
  Net after Paystack: ₦150 - ₦107.50 × (platform share) = ~₦50 net
  ⚠️ Small gifts (<₦500) are margin-negative — enforce ₦500 minimum gift

Gift of ₦2,000: Paystack: ₦100 + ₦30 = ₦130
  Platform receives: ₦600 gross
  Net after Paystack: ~₦520
  Healthy margin ✅

Sweet spot: ₦1,000–₦5,000 gifts
Enforce minimum gift: ₦500 (₦200 on Phase 1 to seed behavior)
```

### Livestream Cost Scaling

```
Stream provider (Agora, 100ms, Mux):
  Agora: $0.0015/min per viewer
  1 stream × 100 viewers × 60 min = $9.00 per session
  100 sessions/day = $900/day = $27,000/month at scale

Revenue per stream (Phase 2):
  Avg gifts per session: ₦15,000 GMV
  Platform take (30%): ₦4,500 = ~$5.30
  Avg ticket (Phase 3): ₦1,000 × 80 viewers = ₦80,000
  Platform take (20%): ₦16,000 = ~$18.80

At Phase 2 (50 sessions/day): stream cost = $1,350/day
Revenue from those streams = $265/day (Phase 2 not yet profitable on streams)
→ Profitable when: avg stream revenue > $27/stream (requires gift volume or tickets)
→ Break-even at Phase 3 ✅

Strategy: Do NOT scale livestream aggressively before gift economy matures.
```

---

## 5. North-Star Metrics Framework

### The Single North-Star
**"Weekly Active Creators"** — the metric that predicts all other success.

When creators are active and growing:
→ Content quality rises → student retention rises → advertiser CPMs rise
→ Gifts rise → creator earnings rise → more creators join
→ More creators → more school official accounts → SaaS sales

Every metric below should ladder up to this north-star.

### Tier 1 — Platform Health (CEO/board level)
| Metric | Definition | Target (Month 12) |
|---|---|---|
| Weekly Active Creators | Creators who posted in last 7 days | 200+ |
| DAU/MAU | Platform stickiness | > 0.30 |
| Monthly GMV | Total gifting + subscription volume | ₦5M+ |
| D30 Retention | Users still active after 30 days | > 30% |
| Creator D30 Retention | Creators active after 30 days | > 60% |

### Tier 2 — Product Metrics (product/engineering level)
| Metric | Definition | Target |
|---|---|---|
| Feed session depth | Posts viewed per session | > 12 |
| Activation rate | Onboarding completion + first post in D7 | > 50% |
| Referral k-factor | Referred signups / invite sent | > 0.4 |
| Gift send rate | % active users who gift per month | > 8% |
| Live attendance | Avg viewers per live session | > 25 |
| Avg gift per giver | Mean gift value per gifting user/month | ₦2,500+ |

### Tier 3 — Growth Indicators
| Metric | Definition | Target |
|---|---|---|
| Campus density | Active users / total students per campus | > 10% |
| Inter-campus content sharing | Posts shared across campuses | > 20% of posts |
| School-to-school referral | % new campuses from existing user referral | > 40% |
| Creator follower velocity | Avg new followers/creator/week | > 15 |

### Tier 4 — Monetization Efficiency
| Metric | Definition | Target |
|---|---|---|
| ARPU (monthly) | Revenue per monthly active user | ₦500+ |
| Creator ARPU | Monthly platform revenue per active creator | ₦8,500+ |
| Ad CPM | Platform ad RPM per 1,000 feed impressions | ₦800+ |
| Take rate efficiency | Net platform revenue / GMV | > 22% |
| LTV/CAC ratio | User LTV : acquisition cost | > 3:1 |