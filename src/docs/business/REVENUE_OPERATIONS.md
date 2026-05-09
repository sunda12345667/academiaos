# StudentOS — Revenue Operations Strategy
*v1.0 | 2026-05-09*

---

## 1. Payout Operations

### Payout Processing Architecture

```
Creator requests withdrawal
  → Risk engine scores request (risk.engine.js)
  → Fraud signal check (FraudSignal records)
  → Manual review queue IF:
     - Risk score > 40
     - Amount > ₦50,000
     - New bank account (< 7 days)
     - First payout ever
  → Approved → Paystack Transfer API initiates bank transfer
  → LedgerEntry records the debit
  → Creator notified: "₦X sent to [bank]"
```

### Payout SLA by Phase

| Phase | Review Type | SLA |
|---|---|---|
| Phase 1 | 100% manual review | 48h |
| Phase 2 | Risk-score gated (>40 = manual) | 24h auto, 48h manual |
| Phase 3 | Auto for trusted creators (<20 risk, <₦200k) | 2h auto, 24h manual |

### Payout Operations Staffing

```
Phase 1 (< 50 payouts/week):   1 person, 2h/day review
Phase 2 (50–200 payouts/week): 1 dedicated ops person
Phase 3 (200+ payouts/week):   Automated + 1 fraud analyst + Paystack reconciliation tooling
```

### Reconciliation Process (weekly)

```
Every Monday morning:
1. Run LedgerEntry reconcile: sum all entries per wallet
2. Compare to Wallet.balance for all wallets with PayoutRequests in last 7 days
3. Any discrepancy > ₦100: flag for investigation
4. Paystack settlement reconciliation: match gateway_reference to Paystack dashboard
5. Create weekly reconciliation report (CSV: wallet_id, expected, actual, delta)
6. Escalate any unresolved deltas to Founder by EOD
```

---

## 2. Advertiser Billing Operations

### Advertiser Onboarding (Phase 3)

```
Advertiser types:
  1. Digital-native SMBs (tutoring services, student apps, EdTech)
  2. Consumer brands targeting youth (telecoms, FMCG, fashion)
  3. Financial institutions (student accounts, POS, fintech)
  4. Universities advertising courses to prospective students

Onboarding flow:
  1. Advertiser fills interest form (company, budget, objective)
  2. Ops reviews: brand safety check (no gambling, alcohol, adult content)
  3. Account activated → minimum first spend: ₦100,000
  4. Campaign manager creates AdCampaign entity
  5. Ad creative reviewed within 48h
  6. Campaign goes live on approval
```

### Ad Billing Model

```
Prepaid model (Phase 3):
  - Advertiser deposits minimum ₦100,000 to ad wallet
  - Spend deducted daily based on actual impressions/clicks
  - Low balance alert at ₦20,000 remaining
  - Campaign pauses at ₦0 balance

Invoiced model (Phase 4, for enterprise):
  - Monthly invoice for campaigns > ₦500,000/month
  - Net-30 payment terms
  - Requires credit check + contract

Ad fraud protection:
  - AdCampaign.fraud_score updated daily
  - Click velocity monitoring
  - IP dedup on click events
  - Invalid traffic credit back to advertiser within 7 days
```

---

## 3. Fraud Operations

### Fraud Signal Categories by Priority

| Signal | Priority | Auto Action | Human Review |
|---|---|---|---|
| Self-gifting detected | P0 | Wallet freeze + gift reversal | Immediate |
| Coordinated gift abuse | P0 | All wallets frozen | Immediate |
| Velocity spike (withdrawal) | P1 | Withdrawal blocked 24h | Within 4h |
| New bank account withdrawal | P2 | Manual review queue | Within 24h |
| Multiple failed payments | P2 | Payment method flagged | Within 48h |
| KYC mismatch | P1 | Transaction blocked | Within 4h |
| Unusual IP/device | P3 | Flagged only | Weekly review |

### Fraud Operations Budget

```
Phase 1: Founder-reviewed + automated signals
Phase 2: 1 dedicated fraud analyst (₦120k/month)
Phase 3: 2 fraud analysts + automated ML scoring
Year 2: Fraud team of 3 + contract with a fraud prevention SaaS
```

### Chargebacks & Reversals

```
Chargeback received from Paystack:
1. Freeze user's wallet immediately
2. Deduct chargeback amount from wallet
3. If wallet insufficient: negative balance flag
4. If chargeback is disputed: creator notified + evidence collection
5. Paystack dispute process: 14-day resolution window
6. If lost: absorb cost (platform bears chargeback risk under ₦10,000)
7. If won: restore wallet balance + send confirmation

Chargeback rate target: < 0.5% of transactions (Paystack threshold: 1%)
```

---

## 4. Moderation Staffing Economics

### Cost Model

```
Phase 1 (500 users, 100 posts/day):
  Part-time moderator: ₦30,000/month (10h/week)
  AI moderation (InvokeLLM): ~₦15,000/month
  Total moderation cost: ₦45,000/month
  Per-user cost: ₦90/month

Phase 2 (5,000 users, 1,000 posts/day):
  Full-time moderator ×1: ₦100,000/month
  Part-time coverage ×1: ₦40,000/month
  AI moderation: ₦80,000/month (higher volume)
  Total: ₦220,000/month
  Per-user cost: ₦44/month (improving)

Phase 3 (25,000 users, 5,000 posts/day):
  Full-time moderators ×3: ₦350,000/month
  Lead T&S: ₦200,000/month
  AI moderation + tools: ₦200,000/month
  Total: ₦750,000/month
  Per-user cost: ₦30/month ✅ (sustainable)
```

### Moderation ROI Calculation

```
Cost of moderation per ₦1 revenue:
  Phase 1: ₦45k cost / ₦0 revenue = N/A (investment)
  Phase 2: ₦220k cost / ₦2M revenue = 11% of revenue (acceptable)
  Phase 3: ₦750k cost / ₦10M revenue = 7.5% of revenue (target: < 10%)
```

---

## 5. Customer Support Operations

### Support Cost Model

```
Phase 1 (500 users):
  Ops founder handles all support
  Target: < 20 tickets/week at launch
  
Phase 2 (5,000 users):
  1 community manager (₦80,000/month)
  Tools: WhatsApp Business API + simple ticketing
  Ticket volume: ~100/week
  Cost per resolved ticket: ~₦160

Phase 3 (25,000 users):
  2 support agents (₦160,000/month combined)
  1 creator success manager (₦120,000/month)
  AI support chatbot (₦30,000/month tooling)
  Ticket volume: ~500/week
  Cost per resolved ticket: ~₦120 (improving)
```

### Support Deflection Strategy (reduce tickets before they're raised)

```
Priority deflection investments:
1. In-app help tooltips on every complex feature (especially wallet)
2. FAQ page indexed in Google (captures "how to withdraw on StudentOS")
3. Onboarding email sequence (7-email series, reduces confusion tickets by 40%)
4. Status page (studentos.app/status) — reduces "is it down?" tickets
5. Campus ambassador first line of support — deflects ~30% of tickets
6. AI chatbot for common queries (Phase 3) — deflects ~40% of tickets
```

---

## 6. Advertiser Operations

### Brand Safety Framework

```
PROHIBITED categories:
  - Gambling (all forms)
  - Alcohol / tobacco / cannabis
  - Predatory lending / payday loans
  - Adult content
  - Political campaigns (Phase 1–2)
  - Crypto/NFT speculation

RESTRICTED categories (require additional review):
  - Financial products (must be licensed by CBN)
  - Health claims (no unverified medical claims)
  - Weight loss products (must meet advertising standards)
  - Religious content (non-divisive only)

PREFERRED categories (premium placement pricing):
  - EdTech / tutoring services
  - Student-friendly financial products (student accounts)
  - Telecom data bundles
  - Graduate programs / professional certifications
  - Verified student brands
```

### Advertiser Success Metrics (report monthly)

```
Per campaign:
  - Impressions, unique reach, frequency
  - CTR (click-through rate)
  - Cost per click
  - Cost per conversion (if conversion tracking set up)
  - Audience breakdown (school, age, device)

Platform aggregate (for advertiser pitch decks):
  - Student audience size per campus
  - Avg session duration (engagement quality signal)
  - Content consumption categories (target by interest)
  - Peak engagement times (Friday 17:00–21:00 WAT is prime student time)
``