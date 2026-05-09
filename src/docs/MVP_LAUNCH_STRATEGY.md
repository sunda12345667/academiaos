# StudentOS — MVP Launch Strategy
*Principal Product/Platform Architect | v1.0 | 2026-05-09*

---

## Executive Summary

StudentOS ships in three sequential phases:

| Phase | Name | Target | Timeline |
|---|---|---|---|
| 0 | **Private Alpha** | 50 hand-picked creators + 2 campus pilots | Week 1–4 |
| 1 | **Campus Beta** | 5 Nigerian universities, 500–2,000 users | Week 5–12 |
| 2 | **Public Launch** | Open registration, national rollout | Week 13–24 |
| 3 | **Creator Economy** | Monetization + Ads live | Week 25–36 |

Each phase has a hard feature gate. Nothing in Phase 2 ships without Phase 1 targets met.

---

## True MVP Scope (Phase 0 + Phase 1)

### ✅ MUST SHIP — Core Social Loop
The only thing that matters for retention is: **post → discover → follow → return**.

| Feature | Status | Notes |
|---|---|---|
| Feed (home, discover, following) | ✅ Implemented | Ship all three tabs |
| Post create (text, image, video) | ✅ Implemented | Ship |
| Comments + reactions | ✅ Implemented | Ship |
| Follow / unfollow | ✅ Implemented | Ship |
| User profiles | ✅ Implemented | Ship |
| Notifications (social) | ✅ Implemented | Ship — dedup + quiet hours active |
| Group creation + membership | ✅ Implemented | Ship — campus groups essential |
| Direct messages | ✅ Implemented | Ship — DMs drive daily return |
| Search | ✅ Implemented | Ship |

### ✅ MUST SHIP — Creator Foundation
| Feature | Status | Notes |
|---|---|---|
| Creator profiles (public) | ✅ Implemented | Ship |
| Creator tiers (basic/pro display) | ✅ Implemented | Ship display only, no monetization yet |
| Live sessions (schedule + host) | ✅ Implemented | **Gate: max 50 concurrent streams at Phase 0** |
| Post analytics (creator dashboard) | ✅ Implemented | Ship simplified view |
| Onboarding (student + creator flow) | ✅ Implemented | Critical for activation |

### ✅ MUST SHIP — Fintech (Phase 1 only, NOT Phase 0)
| Feature | Status | Notes |
|---|---|---|
| Wallet (view balance) | ✅ Implemented | Phase 1 — read-only at first |
| Wallet topup (Paystack) | ✅ Implemented | Phase 1 — after DEBT-001 wallet race fixed |
| Gift sending | ✅ Implemented | Phase 1 — after atomic debit confirmed |
| Payout requests | ✅ Implemented | Phase 1 — manual review only |

### ⚠️ DEFER TO PHASE 2
| Feature | Reason to Defer |
|---|---|
| Marketplace | Requires separate moderation, fraud surface, no social retention value at MVP |
| Ad campaigns | No advertiser base yet; premature complexity |
| Paid courses (monetization) | Requires full KYC, payout infrastructure proven first |
| Subscriptions | Same as paid courses |
| Gift coin purchases | Fintech risk — defer until DEBT-001 fully resolved and audited |
| AI-powered feed ranking | Ship heuristic ranking first; ML model needs data to train |
| Collaborative filtering | Same — needs data |
| School ERP integration | Too complex for MVP; manual school onboarding only |

### ❌ TOO RISKY FOR MVP — DO NOT SHIP
| Feature | Risk |
|---|---|
| Advertiser self-serve campaigns | No fraud detection at scale; financial liability without proven moderation |
| Livestream ticketed events | Payment + live streaming + fraud = three risk vectors simultaneously |
| Creator verification (public badge) | Requires ID verification pipeline not built |
| Automated payout (no manual review) | Wallet race condition (DEBT-001) must be production-proven for 30 days first |
| Open referral rewards (gift coins) | Abuse vector — self-referral and farm accounts at small user base |

---

## Feature Gating Matrix

### Must-Have vs. Defer Decision Framework

```
SHIP if: Needed for core loop retention OR creator activation
DEFER if: Adds moderation surface without retention value
KILL if: Creates financial/legal liability without proven infrastructure
```

### Feature Flag Assignments (all in `lib/infra/feature-flags.js`)

| Flag | Phase 0 | Phase 1 | Phase 2 |
|---|---|---|---|
| `FEED_AI_RANKING` | false | 10% rollout | 100% |
| `GIFTING_ENABLED` | false | true | true |
| `WALLET_TOPUP` | false | true | true |
| `PAYOUT_REQUESTS` | false | true (manual) | true (auto) |
| `LIVE_STREAMS` | 10 invited creators | 50 creators | all |
| `MARKETPLACE` | false | false | true |
| `AD_CAMPAIGNS` | false | false | Phase 3 |
| `CREATOR_TIPS` | false | trust≥40 only | all eligible |
| `REFERRAL_REWARDS` | false | XP only | XP + coins |
| `AI_STUDY_ASSISTANT` | false | 20% rollout | 100% |
| `PUSH_NOTIFICATIONS` | false | true | true |

### Flag Management (operational)
- Feature flag state lives in `lib/infra/feature-flags.js` + Vite env vars
- URL override (`?flag_X=true`) available for QA testing any flag in production
- Each flag has an owner who approves rollout and rollback
- Never remove a flag before the feature is 100% rolled out for 30 days

---

## MVP Hardening Checklist (before Phase 0)

### Non-Negotiable Technical Gates
- [ ] DEBT-001: Wallet atomic debit implemented and audited
- [ ] DEBT-002: LiveSession.stream_key removed from client entity
- [ ] DEBT-007: Personalization cache cleared on logout
- [ ] All P0 security items in PRODUCTION_READINESS.md resolved
- [ ] Paystack webhook signature validation confirmed
- [ ] At least 2 moderator accounts created
- [ ] `LIVE_STREAMS` flag limits enforced (max 50 concurrent)
- [ ] ErrorBoundary smoke-tested on every page
- [ ] Feed loads under 2 seconds on Lighthouse mobile (Good 3G)

### Moderation Gate (must have before first public user)
- [ ] Post create → AI moderation pipeline tested (flagging working)
- [ ] Report → escalation → resolution flow working end-to-end
- [ ] Admin dashboard accessible (even if minimal UI)
- [ ] Content removal wires post to `moderation_status: 'removed'`
- [ ] Account suspension blocks UI via AccountStatusGuard

### Creator Gate (must have before creator invite)
- [ ] Creator profile page renders with all tiers
- [ ] Posting streak displays correctly on creator dashboard
- [ ] Live session create → start → end flow tested
- [ ] Creator notifications (new follower, comment) delivering

---

## Operationally Dangerous Features (caution flags)

| Feature | Danger | Mitigation |
|---|---|---|
| Live streaming | RTMP key exposure, stream abuse, CSAM risk | Rate limit stream start; mandatory content type declaration; 1-click admin terminate |
| Gift sending | Self-gifting, coordinated fraud, money laundering | Self-gift detection (risk.engine), KYC basic required, high-value alert at ₦2,000 |
| Payout processing | Irreversible bank transfers, fraud | Manual review for all Phase 1 payouts; 48h hold; risk score gate |
| DMs | Harassment, unsolicited content | Report button on every message; rate limit 5/min; block enforcement |
| AI content moderation | False positives silencing legitimate content | Always human review escalation path; appeal flow must work before AI goes live |
| Referral rewards | Farm accounts for referral farming | Activation requirement (7-day window, must post); IP fingerprint dedup |