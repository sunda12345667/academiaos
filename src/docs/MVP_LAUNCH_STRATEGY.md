# StudentOS — MVP Launch Strategy

**Date:** 2026-05-09  
**Phase:** Pre-launch hardening  
**Author:** Platform Architecture Team

---

## 1. MVP Philosophy

StudentOS is a social creator ecosystem. The MVP is NOT a feature dump — it is the **minimum surface required to create one habit loop**:

> **"Open app → see valuable content from someone at your school → post something → get a reaction → come back tomorrow"**

Everything that doesn't serve this loop is deferred. Everything that breaks this loop is a blocker.

---

## 2. MVP Scope Definition

### ✅ Phase 0 — Private Beta (Campus 1, ~50 users)
**Goal:** Validate social loop. Find bugs. Tune feed.

| Feature | Status | Notes |
|---|---|---|
| User registration + profiles | ✅ Built | |
| Home feed (following + discover) | ✅ Built | |
| Post creation (text, image, video) | ✅ Built | |
| Like, comment, share, save | ✅ Built | |
| Follow / unfollow | ✅ Built | |
| DMs (1-on-1 messaging) | ✅ Built | |
| Push notifications (in-app) | ✅ Built | |
| Basic school matching | ✅ Built | |
| Interest selection (onboarding) | ✅ Built | |
| Content moderation (AI + manual) | ✅ Built | |

**DEFER from Phase 0:**
- Live streaming (infrastructure not tested under load)
- Wallet / payments (too risky for beta)
- Creator monetization (deferred until creator base established)
- Ads platform (no inventory to sell)
- Marketplace (secondary to social loop)
- AI study assistant (nice-to-have, not core to social loop)

---

### ✅ Phase 1 — Public Beta (3 campuses, ~500 users)
**Goal:** Validate campus network effect. Test retention. Start creator seeding.

**Include from Phase 0 +:**

| Feature | Risk | Notes |
|---|---|---|
| Group creation and management | LOW | Core to campus communities |
| Live sessions (broadcast only, no viewer limits) | MEDIUM | Test with selected creators first |
| Creator profiles + tier display | LOW | No monetization yet |
| Creator dashboard (analytics) | LOW | View-only, no financial data |
| Notifications (social only) | LOW | No financial alerts yet |
| Referral system | LOW | Campus expansion loop |
| Achievements + XP | LOW | Retention driver |
| Onboarding flow (all steps) | LOW | |
| Video feed (short-form) | MEDIUM | Media-heavy, test CDN performance |
| Wallet (view balance + top up only) | MEDIUM | **No withdrawals in Phase 1** |
| Course viewing (no creation yet) | LOW | |

**DEFER from Phase 1:**
- Payouts / withdrawals (too early — creator base too small)
- Gifts (economy not established)
- Marketplace (moderation overhead too high)
- Ads (no ad sales team)
- Co-hosted live sessions
- Premium content (paid access)

---

### ✅ Phase 2 — Creator Economy Launch (~2,000 users, top creators stable)
**Goal:** Establish creator economy. First revenue.

**Include from Phase 1 +:**

| Feature | Risk | Notes |
|---|---|---|
| Gift sending (during live) | HIGH | Requires TD-01 wallet lock fix first |
| Wallet withdrawals | HIGH | Requires KYC flow + Paystack payout API |
| Creator monetization (tips + paid content) | HIGH | After payout tested |
| Marketplace listings | MEDIUM | Category-limited (textbooks first) |
| AI study assistant | MEDIUM | Usage-based cost, feature-flagged |
| Ads platform (self-serve basic) | HIGH | After creator/advertiser base established |
| Premium live sessions (paid tickets) | HIGH | After gift economy proven |
| Creator verification workflow | MEDIUM | Admin-reviewed |

---

## 3. Must-Have vs Defer Matrix

| System | MVP Must-Have | Defer Until |
|---|---|---|
| Social feed (home, discover, video) | ✅ YES | — |
| Post creation (text + media) | ✅ YES | — |
| Follow graph | ✅ YES | — |
| Messaging (DMs) | ✅ YES | — |
| Groups (basic) | ✅ YES | — |
| Notifications (social) | ✅ YES | — |
| Content moderation pipeline | ✅ YES | — |
| School matching + onboarding | ✅ YES | — |
| Creator profiles (display only) | ✅ YES | — |
| Live streaming | Phase 1 | After CDN/stream provider confirmed |
| Wallet (view + topup) | Phase 1 | After Paystack tests pass |
| Gifts | Phase 2 | After wallet race condition fixed |
| Payouts | Phase 2 | After KYC flow built |
| Marketplace | Phase 2 | After social loop proven |
| Ads platform | Phase 3 | After 50+ active advertisers |
| AI study assistant | Phase 2 | Feature-flagged |
| Premium/paid content | Phase 2 | After creator base |

---

## 4. Features Too Risky for MVP

### 🔴 DO NOT LAUNCH WITHOUT THESE FIXES:

| Feature | Risk | Required Fix |
|---|---|---|
| Gift sending | Financial data corruption | TD-01 (wallet atomic lock) |
| Withdrawals / payouts | Bank transfer failures | Paystack payout API integration + KYC |
| Live stream key | Security: RTMP key exposed to clients | TD-02 (remove stream_key from entity) |
| Admin reverseTransaction | Unauthorized financial reversal | TD-15 (role check) — DONE ✅ |
| Marketplace (all categories) | Moderation overhead is massive | Limit to textbooks + study materials only |
| AI generation (InvokeLLM) in real-time posting | LLM latency spikes in feed path | Move to async, never block feed |

### 🟡 HIGH-MAINTENANCE SYSTEMS (defer or staff before launch):

| System | Operational Cost | Recommendation |
|---|---|---|
| Live streaming moderation | 24/7 coverage needed | Launch with recorded replay only first |
| Marketplace moderation | Physical goods = scam risk | Category whitelist, manual review for first 30 days |
| Payout reviews | Manual review queue required | Hire ops before enabling withdrawals |
| Advertiser review | Ad creative review required | No self-serve ads until ops team in place |
| Creator verification | Manual ID verification | Batch process weekly, not real-time |

---

## 5. Feature Flag Strategy

All risky or unfinished features must be behind feature flags at launch.

### Flag Registry (maps to `lib/infra/feature-flags.js`)

| Flag | Default | Phase |
|---|---|---|
| `LIVE_STREAMING` | OFF | Phase 1 — creator whitelist |
| `WALLET_TOPUP` | OFF | Phase 1 — after Paystack test |
| `WALLET_WITHDRAWAL` | OFF | Phase 2 — after ops ready |
| `GIFTING` | OFF | Phase 2 — after TD-01 fixed |
| `MARKETPLACE` | OFF | Phase 2 — category limited |
| `AI_STUDY_ASSISTANT` | OFF | Phase 2 — cost controlled |
| `AI_SMART_FEED` | OFF | Phase 1 — 10% canary |
| `AI_RECOMMENDATION_V2` | OFF | Phase 2 |
| `CREATOR_MONETIZATION` | OFF | Phase 2 |
| `ADS_PLATFORM` | OFF | Phase 3 |
| `PREMIUM_CONTENT` | OFF | Phase 2 |
| `PREMIUM_LIVE_TICKETS` | OFF | Phase 3 |

**Rollout order:** Flag OFF → Internal team → 5% canary → 25% → 50% → 100%  
**Rollback:** Toggle flag to OFF — immediate, no deploy required.