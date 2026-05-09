# StudentOS — Business Architecture
*v1.0 | 2026-05-09*

---

## What StudentOS Actually Is (Investor-Grade Definition)

StudentOS is a **vertically integrated campus social operating system** — not a social app, not an LMS, not a fintech app. It is all three, unified under a single identity layer tied to the Nigerian university system.

The strategic position:

> **"StudentOS owns the authenticated, enrolled-student identity graph for Nigerian universities — and monetizes that graph through creator economics, social engagement, fintech, and campus commerce."**

This is defensible because competitors (TikTok, WhatsApp, Discord) cannot verify enrollment. We can. That verification layer is the moat.

---

## Business Model Architecture

### Revenue Pillars (ordered by launch sequence)

```
Pillar 1: Creator Gifting (Platform Take Rate)
  Model: Platform takes 30% of all gifts sent
  Why first: Zero marginal cost to enable, immediate creator incentive
  Revenue type: Transaction-based
  Unit: ₦ per gift × volume

Pillar 2: Premium Creator Tools (SaaS)
  Model: ₦2,000–₦8,000/month for pro analytics, scheduling, insights
  Why second: Builds after creator base is established
  Revenue type: Recurring subscription
  Unit: MRR per paying creator

Pillar 3: Advertising Platform (CPM/CPC)
  Model: Targeted ads to verified student demographic
  Why third: Requires audience scale (> 10k MAU)
  Revenue type: Performance-based
  Unit: CPM, CPC, CPA by campaign objective

Pillar 4: School SaaS (B2B)
  Model: ₦50k–₦500k/year per institution for classroom tools, analytics, LMS embed
  Why fourth: Long sales cycle (6–12 months), but high ACV + recurring
  Revenue type: Annual contract (B2B)
  Unit: ACV per school

Pillar 5: Marketplace Commission
  Model: 5–10% take rate on transactions within marketplace
  Why fifth: Requires trust infrastructure and liquidity
  Revenue type: Transaction-based
  Unit: GMV × take rate

Pillar 6: Fintech Services
  Model: Payment processing spread, wallet float interest, premium wallet features
  Why sixth: Requires CBN licensing or partnership
  Revenue type: Spread + float
  Unit: AUM × annual yield
```

### Business Model Canvas (Condensed)

| Block | Description |
|---|---|
| Value Prop (Students) | Only platform designed for Nigerian campus life: social + study + earn |
| Value Prop (Creators) | Reach verified student audience + monetize (gifts, tips, courses) |
| Value Prop (Schools) | Analytics, classroom tools, verified school community management |
| Value Prop (Advertisers) | Verified 18–25 Nigerian student demographic at scale |
| Key Resources | Enrollment verification, creator network, student identity graph |
| Revenue Streams | Gifts, SaaS, ads, marketplace, fintech spread |
| Cost Structure | Infrastructure, moderation, creator support, engineering |
| Key Partners | Paystack/Flutterwave, universities, content creators, campus ambassadors |

---

## Platform P&L Model (Year 1 → Year 3)

### Year 1 (Growth Phase, ~25,000 registered users, ~5,000 MAU)
```
Revenue:
  Gifting (30% take rate):     ₦2M GMV → ₦600k revenue
  Creator Tools (SaaS):        20 creators × ₦3,000/mo × 6 months → ₦360k
  Total Revenue:               ₦960k (~$600 USD)

Costs:
  Infrastructure (Base44):     ~₦200k/month → ₦2.4M/year
  Engineering (2 FTEs):        ₦6M/year (₦250k/person/month)
  Operations (2 FTEs):         ₦3.6M/year
  Creator acquisition:         ₦1.2M/year (₦100k/month)
  Total Costs:                 ₦13.2M/year

Net Position: -₦12.2M (funded by pre-seed investment)
Metric to watch: Revenue growth rate, not profitability
```

### Year 2 (Monetization Phase, ~100,000 registered users, ~25,000 MAU)
```
Revenue:
  Gifting (30%):               ₦30M GMV → ₦9M
  Creator Tools:               150 creators × ₦4,000/mo → ₦7.2M
  Advertising:                 20 campaigns × ₦500k avg → ₦10M
  Marketplace (8% take):       ₦20M GMV → ₦1.6M
  School SaaS (3 schools):     3 × ₦300k/yr → ₦900k
  Total Revenue:               ₦28.7M (~$18k USD)

Costs:
  Infrastructure:              ₦600k/month → ₦7.2M
  Engineering (5 FTEs):        ₦15M
  Operations (4 FTEs):         ₦7.2M
  Sales & Marketing:           ₦6M
  Total Costs:                 ₦35.4M

Net Position: -₦6.7M (funded by seed round)
```

### Year 3 (Scale Phase, ~500,000 registered users, ~150,000 MAU)
```
Revenue:
  Gifting (30%):               ₦200M GMV → ₦60M
  Creator Tools:               1,000 × ₦5,000/mo → ₦60M
  Advertising:                 200 campaigns → ₦100M
  Marketplace (8%):            ₦100M GMV → ₦8M
  School SaaS (30 schools):    ₦15M
  Fintech spread:              ₦500M AUM × 3% → ₦15M
  Total Revenue:               ₦258M (~$162k USD)

Costs:
  Infrastructure:              ₦3.6M/month → ₦43M
  Engineering (15 FTEs):       ₦45M
  Operations (10 FTEs):        ₦18M
  Sales & Marketing:           ₦20M
  Total Costs:                 ₦126M

Net Position: +₦132M (profitability threshold crossed ~Year 2.5)
```

---

## Revenue Infrastructure Requirements

### Payment Stack

```
Inbound (deposits):  Paystack → wallet (DONE: paystackWebhook exists)
Internal (transfers): Double-entry ledger (DONE: LedgerEntry entity)
Outbound (payouts):  Paystack Transfer API → creator bank accounts (PENDING)
Float management:    Wallet balance pool → Paystack investment arm (Year 2)
```

### Billing Infrastructure (by revenue stream)

| Stream | Billing Method | Infrastructure Needed |
|---|---|---|
| Gifts | Auto-deduct from wallet | Done (wallet.service) |
| Creator Tools SaaS | Monthly recurring charge to wallet | Subscription entity needed |
| Advertising | Pre-paid credit + invoice | AdCampaign.budget_total (done) |
| Marketplace | Transaction fee auto-split | Escrow + commission split |
| School SaaS | Annual invoice | Stripe/manual for B2B |
| Fintech spread | Backend calculation | Paystack investment API (future) |