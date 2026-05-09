# StudentOS — Unit Economics Framework
*v1.0 | 2026-05-09*

---

## Core Unit Economics Model

### Per-User Economics (Monthly)

```
Average Monthly Revenue Per User (ARPU) by segment:

Passive student (view-only): ₦0 direct / ₦5 ad impression value
Active student (posts, comments): ₦0 direct / ₦15 ad impression value
Gift sender (buys coins): ₦500 average coin purchase / month
Creator (earns gifts): ₦3,000 platform revenue generated (30% of their ₦10k earnings)
Creator (pays tools): ₦3,000–₦8,000 SaaS subscription

Blended ARPU (all users, Phase 1): ₦150/MAU/month
Blended ARPU (Phase 2, with ads): ₦500/MAU/month
Blended ARPU (Phase 3, full economy): ₦1,500/MAU/month
```

### Student Acquisition Cost (CAC)

```
Organic (referral + ambassador): ₦200–₦500
Paid social (Instagram/TikTok ads): ₦2,000–₦5,000
Event-driven (campus activations): ₦500–₦1,000

Blended CAC target (Phase 1): ₦600
Blended CAC target (Phase 2): ₦400 (referral program matures)
Blended CAC target (Phase 3): ₦300 (brand awareness lowers paid CAC)
```

### Student LTV

```
Average active student tenure: 3 years (university duration)
Monthly ARPU trajectory:
  Year 1: ₦150/month
  Year 2: ₦300/month (more ads, some gifts)
  Year 3: ₦500/month (full platform engagement)
  
3-year LTV: (₦150×12) + (₦300×12) + (₦500×12) = ₦1,800 + ₦3,600 + ₦6,000 = ₦11,400
Discounted (20% annual): ~₦8,000 NPV

LTV:CAC ratio:
  Phase 1: ₦8,000 / ₦600 = 13.3× ✅ Excellent
  Target minimum: 3× (typical SaaS benchmark)
```

---

## Creator Unit Economics

### Creator Revenue Split

```
Gift transaction:
  Sender pays:         100 coins = ₦100 (at ₦1/coin standard)
  Creator receives:    70 coins credit = ₦70 (70%)
  Platform keeps:      30 coins = ₦30 (30%)
  
Monthly active creator:
  Avg gifts received/month: 500 gifts × ₦100 avg = ₦50,000 GMV
  Creator earns:            ₦35,000
  Platform earns:           ₦15,000 per active creator
  
Annual platform revenue per top creator: ₦180,000
```

### Creator Acquisition ROI

```
Investment: ₦10,000 seed grant + ₦5,000 onboarding support = ₦15,000

Return (12-month active creator):
  Month 1–3: ₦5,000/month platform revenue (early gifts)
  Month 4–6: ₦10,000/month (established creator)
  Month 7–12: ₦15,000/month (Pro tier creator)
  Total 12-month platform revenue: ₦120,000

Creator ROI: 8× in year 1. Payback period: 6 weeks.
```

---

## Infrastructure Cost Scaling

### Baseline (Base44 platform, Phase 0–1)

```
Platform costs at current scale:
  Base44 subscription: Fixed + usage-based
  External services (estimated):
    Paystack transaction fee: 1.5% + ₦100 per transaction
    Email (via Base44 SendEmail): ~₦0.50/email
    AI inference (InvokeLLM): ~₦10/call (estimated)
    File storage (UploadFile): ~₦5/GB/month

Cost at 500 MAU:
  Paystack fees (100 transactions/day): ~₦90,000/month
  AI inference (moderation, 500 posts/day): ~₦150,000/month
  Total external costs: ~₦300,000/month
```

### Scale Economics (Phase 2, 5,000 MAU)

```
Paystack fees (1,000 transactions/day): ~₦900,000/month
AI inference (5,000 posts/day): ~₦1,500,000/month
Push notifications (FCM): ~₦0 (FCM is free)
CDN / media storage: ~₦200,000/month
Total infrastructure: ~₦3.5M/month
Revenue at this scale: ~₦5M+/month → Infrastructure < 70% of revenue
```

### Notification Cost Scaling

```
Push notifications (FCM): ₦0 per notification (Google free tier)
In-app notifications: DB write = ₦0.001 per notification (negligible)
Email notifications: ₦0.50/email via Base44

At 10,000 MAU, 5 notifications/user/day:
  Push: 50,000/day × ₦0 = ₦0
  In-app: 50,000/day × ₦0.001 = ₦50/day = ₦1,500/month
  Email (weekly digest only): 10,000/week × ₦0.50 = ₦5,000/week = ₦20,000/month
  Total notification cost at 10k MAU: ~₦22,000/month ✅ Negligible
```

### Livestream Cost Scaling

```
Stream provider cost estimate (Agora/Mux):
  Agora: $0.00099/min/user (host) + $0.00099/min/user (viewer)
  
  Per live session (45 min, 50 viewers):
    Host cost: 45 min × $0.00099 = $0.045
    Viewer cost: 50 viewers × 45 min × $0.00099 = $2.23
    Total per session: ~$2.27 (~₦3,600)
    
  Platform gift revenue per session: ₦2,400 (earlier calculation)
  NET livestream margin: ₦2,400 - ₦3,600 = -₦1,200 per session 😬
  
CRITICAL FINDING: At 50 viewers/session, livestreaming is unprofitable.
  Break-even: 75 viewers/session (at ₦2,400 revenue)
  Profitable: > 75 viewers/session

Mitigation:
  1. Only enable live for creators with > 100 follower base (higher expected viewers)
  2. Minimum session gift floor: set minimum gift GMV before RTMP costs are a liability
  3. Long-term: negotiate bulk rate with stream provider at scale
  4. Alternative: Use free open-source LiveKit self-hosted → ₦0 streaming cost
     (requires own server at ~₦30,000/month for 100 concurrent streams)
```

### AI Inference Cost Scaling

```
InvokeLLM cost (estimated): ~₦10/call

Use cases and frequency:
  Post moderation: every post publish → 500 posts/day → ₦5,000/day = ₦150,000/month
  Feed recommendations: 5,000 MAU × 1/day = 5,000 calls → ₦50,000/day (❌ TOO EXPENSIVE)
  Study assistant: 500 queries/day → ₦5,000/day = ₦150,000/month
  
AI cost management strategy:
  1. Feed recommendations: Use cached heuristic scoring (no AI call), LLM only for cold-start
  2. Post moderation: Batch process async, not in real-time feed path
  3. Study assistant: Rate limit to 10 queries/user/day on free tier
  4. Recommendation refresh: Once per hour per user, not per page load
  
Total AI costs at scale (managed): ~₦300,000/month at 5,000 MAU
As % of revenue at ₦5M/month: 6% ✅ Acceptable
```

---

## Payment Processing Economics

### Paystack Fee Structure

```
Card payments (NGN): 1.5% + ₦100, capped at ₦2,000 per transaction
Bank transfer (NGN): ₦20–₦50 flat rate
USSD: 1.5% + ₦20

Coin package purchases:
  ₦500 package: 1.5% + ₦100 = ₦107.50 fee → platform nets ₦392.50
  ₦2,000 package: 1.5% + ₦100 = ₦130 fee → platform nets ₦1,870
  ₦5,000 package: 1.5% + ₦100 = ₦175 fee → platform nets ₦4,825
  ₦10,000 package: 1.5% + ₦100 = ₦250 fee → platform nets ₦9,750

Effective Paystack rate on coin purchases:
  ₦500 package: 21.5% (high for small amounts)
  ₦10,000 package: 2.5% (efficient for large amounts)
  
Strategy: Incentivize larger coin package purchases with bonuses (already designed).
This reduces blended Paystack fee rate from ~10% to ~4% at scale.
```

### Payout Economics

```
Paystack Transfer API: ₦10 flat per bank transfer (< ₦5,000)
                       ₦25 flat per bank transfer (₦5,000+)

Creator payout processing:
  Monthly payout to creator: ₦35,000 average
  Paystack fee: ₦25
  Admin review time: 15 min × ₦1,500/hour = ₦375
  Total payout cost: ₦400 per creator payout

At 200 creators/month: ₦80,000 total payout operations cost
As % of ₦7M creator payout volume: 1.1% ✅ Acceptable

Automation target: Zero admin review time at scale (risk engine auto-approves low-risk)
Automated payout processing cost: ₦25/creator (pure Paystack fee only)
```

---

## Moderation Operations Cost

```
Phase 1 (1 moderator, 20h/week):
  Cost: ₦50,000/month (part-time)
  Capacity: 200 reports/week
  Cost per report reviewed: ₦250

Phase 2 (2 full-time moderators):
  Cost: ₦200,000/month
  Capacity: 2,000 reports/week
  Cost per report reviewed: ₦100

Phase 3 (5 moderators + AI pre-filtering):
  AI pre-filters 70% of reports (auto-close clear violations + clear false positives)
  Human reviews remaining 30%: 2,000 reports → 600 human reviews
  Cost: ₦500,000/month (5 mods) + ₦150,000 AI costs = ₦650,000
  Cost per report reviewed: ₦325 (higher cost per review but lower total cost per content piece)

Benchmark: Facebook spends ~$0.20 per content review → ₦320. We're at scale.
```

---

## Break-Even Analysis

### Platform Break-Even (operational)

```
Monthly fixed costs (Phase 1):
  Engineering (2 FTEs): ₦500,000
  Operations (1 FTE): ₦150,000
  Infrastructure: ₦300,000
  Total: ₦950,000/month

Revenue needed to break even: ₦950,000/month

At ₦500 ARPU: need 1,900 paying MAU
At ₦150 ARPU (blended): need 6,333 MAU

Break-even MAU target: 2,000 monetized users OR 6,000+ total MAU
Expected timeline to break-even: Month 18–24 (post creator economy launch)
``