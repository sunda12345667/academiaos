# StudentOS — 12-Month Execution Roadmap

**Date:** 2026-05-09  
**Scope:** Product, engineering, operations, growth

---

## Quarter 1 — Foundation & Private Beta (Months 1–3)

### Month 1: Fix & Stabilize
**Engineering:**
- [ ] Fix all P0 security items (PRODUCTION_READINESS.md)
- [ ] TD-01: Wallet atomic lock backend function
- [ ] TD-02: stream_key removed from LiveSession entity
- [ ] TD-03: markAllAsRead bulk operation
- [ ] Capacitor mobile wrapper setup (iOS + Android builds)
- [ ] Paystack webhook end-to-end tested

**Product:**
- [ ] Finalize Phase 0 feature set (no changes during beta)
- [ ] Creator content seeded (10+ creators, 50+ posts)
- [ ] Campus 1 ambassador recruited and briefed
- [ ] Support channel (WhatsApp) operational

**KPIs:**
- 50 users on Campus 1
- D7 retention > 40%
- Error rate < 1%
- Feed load P95 < 3s

---

### Month 2: Private Beta Learning
**Engineering:**
- [ ] React Native exploration (architecture decision documented)
- [ ] Push notifications via FCM (Capacitor integration)
- [ ] TD-05: engagement_score async recompute
- [ ] TD-09: Feed service circuit breaker

**Product:**
- [ ] Weekly bug triage from beta users
- [ ] A/B test: onboarding interest selection (4 vs 8 options)
- [ ] Creator dashboard v1 (view-only analytics)
- [ ] Live streaming enabled for 3 whitelisted creators

**KPIs:**
- 50→150 users
- First live session completed
- Creator NPS surveyed
- Feed engagement rate > 8%

---

### Month 3: Phase 1 Prep & Launch
**Engineering:**
- [ ] Wallet topup (Paystack popup) enabled behind flag
- [ ] Referral system tested end-to-end
- [ ] Campus referral link flow (school pre-filled)
- [ ] Notification intelligence (caps + quiet hours) verified in production

**Product:**
- [ ] 2 additional campus ambassadors recruited
- [ ] Creator onboarding form live
- [ ] Phase 1 feature flags set (see MVP_LAUNCH_STRATEGY.md)
- [ ] Launch war-room checklist completed

**KPIs:**
- Phase 1 launch: 3 campuses
- 500 users target
- 20+ active creators
- D1 retention > 35%

---

## Quarter 2 — Campus Expansion & Creator Economy (Months 4–6)

### Month 4: Creator Economy Alpha
**Engineering:**
- [ ] Gift sending (TD-01 fix prerequisite — must be complete)
- [ ] Creator wallet balance dashboard
- [ ] Payout request UI (no bank transfer yet — just queue)
- [ ] Live gift display (animation overlay during stream)

**Product:**
- [ ] 10 creators trialing gift feature
- [ ] Creator ambassador program: top 5 creators get referral incentives
- [ ] School #2 full rollout

**KPIs:**
- 1,000 users
- First gift sent
- Creator D30 retention > 50%
- Gift GMV > ₦50,000

---

### Month 5: Payout & Creator Monetization
**Engineering:**
- [ ] Paystack Transfer API integration (payout backend function)
- [ ] KYC flow: NIN/BVN verification (basic)
- [ ] Withdrawal UI with manual review queue
- [ ] Marketplace (textbooks only, whitelist)

**Product:**
- [ ] First creator payout processed
- [ ] Payout review SOP documented and ops trained
- [ ] Creator success metrics dashboard for ops team

**KPIs:**
- First ₦ paid out to creator
- Creator monetization activation > 20%
- Marketplace: 20+ listings

---

### Month 6: Scale & Retention
**Engineering:**
- [ ] React Native migration kickoff (Feed screen + PostCard)
- [ ] WatchEvent batch write + cleanup job
- [ ] Notification push (FCM) for Android
- [ ] ContentRecommendation pruning job

**Product:**
- [ ] Retention campaigns: streak rescue notifications live
- [ ] Achievement system visible on profiles
- [ ] Phase 2 scope review meeting
- [ ] NestJS migration scoping

**KPIs:**
- 2,500 users
- D30 retention > 25%
- 50 active creators
- Monthly gift GMV > ₦200,000

---

## Quarter 3 — Platform Maturity (Months 7–9)

### Month 7: Mobile App Launch
**Engineering:**
- [ ] iOS App Store submission + review
- [ ] Android Play Store submission + review
- [ ] APNs push notifications for iOS
- [ ] React Native: Feed + Profile screens

**Product:**
- [ ] App Store listing optimized (screenshots, description)
- [ ] App launch announcement across campuses
- [ ] Creator "get the app" campaign

**KPIs:**
- App Store + Play Store live
- 5,000 total installs
- Mobile DAU > 50% of total DAU

---

### Month 8: AI Features
**Engineering:**
- [ ] AI study assistant (feature-flagged, 20% canary)
- [ ] AI-powered feed ranking (A/B test against heuristic)
- [ ] AI content moderation improvement (reduce manual queue by 30%)

**Product:**
- [ ] Study assistant UX designed + tested
- [ ] AI feed ranking A/B test: 7-day retention comparison

**KPIs:**
- AI study assistant: 500 MAU
- Feed ranking A/B: +5% engagement improvement

---

### Month 9: Campus Network Density
**Engineering:**
- [ ] School-specific feed improvements
- [ ] Campus leaderboards (top creators per school)
- [ ] Group live sessions
- [ ] Advertiser self-serve alpha (invite-only)

**Product:**
- [ ] 10 campus ambassador expansion
- [ ] Campus competition: first 3 schools get verified school badge
- [ ] Advertiser waitlist opened

**KPIs:**
- 10 active campuses
- 10,000 registered users
- Campus DAU density > 15%

---

## Quarter 4 — Monetization Scale (Months 10–12)

### Month 10: Advertiser Platform
**Engineering:**
- [ ] Ad campaign creation UI (objective, targeting, creative)
- [ ] Ad delivery in feed (sponsored_post format)
- [ ] Ad billing integration (wallet deduction)
- [ ] Advertiser dashboard (impressions, clicks, CTR)

**Product:**
- [ ] 5 paying advertisers onboarded
- [ ] Ad review policy published
- [ ] Advertiser support documentation

**KPIs:**
- First ad campaign live
- Advertiser revenue > ₦500,000/month

---

### Month 11: NestJS Migration Sprint
**Engineering:**
- [ ] Wallet module (PostgreSQL + atomic lock — migration of TD-01)
- [ ] Notification module (BullMQ queue + FCM/APNs fanout)
- [ ] Auth adapter (Base44 → Clerk or custom JWT)

**Product:**
- [ ] Zero user-facing changes (pure infrastructure)
- [ ] Performance improvement announcement (if applicable)

**KPIs:**
- Wallet concurrency issues: zero
- Notification delivery reliability: > 99%
- Feed P95 latency: < 1s

---

### Month 12: Growth & Series A Readiness
**Engineering:**
- [ ] ClickHouse analytics integration (real-time retention cohorts)
- [ ] ML recommendation model alpha (replaces heuristic ranking)
- [ ] Multi-campus referral analytics
- [ ] Full RN migration: 80% of screens

**Product:**
- [ ] Series A data room: DAU, MAU, creator revenue, GMV, retention charts
- [ ] Creator economy report published
- [ ] Top 3 campus ambassadors promoted to regional managers

**KPIs:**
- 25,000 registered users
- 5,000 MAU
- 200+ active creators
- Monthly GMV (gifts + marketplace) > ₦2,000,000
- D30 retention > 30%
- 15+ active campuses

---

## Performance Targets Summary

| Metric | Phase 0 | Phase 1 | Phase 2 | Year 1 |
|---|---|---|---|---|
| Registered users | 50 | 500 | 2,500 | 25,000 |
| DAU | 30 | 200 | 800 | 5,000 |
| Active creators | 5 | 20 | 50 | 200 |
| D7 retention | 40% | 35% | 35% | 35% |
| D30 retention | — | 25% | 28% | 30% |
| Monthly GMV | ₦0 | ₦0 | ₦200k | ₦2M |
| Campuses | 1 | 3 | 8 | 15+ |
| Error rate | < 1% | < 1% | < 0.5% | < 0.1% |
| Feed P95 load | < 3s | < 2s | < 1.5s | < 1s |

---

## Concurrency Targets

| Scenario | Phase 1 Target | Phase 2 Target | Year 1 Target |
|---|---|---|---|
| Concurrent feed users | 50 | 200 | 2,000 |
| Concurrent live viewers per session | 100 | 500 | 5,000 |
| Notifications/min throughput | 200 | 1,000 | 10,000 |
| Gift sends/sec | 2 | 20 | 200 |
| Messages/sec | 10 | 100 | 1,000 |
| Simultaneous live sessions | 3 | 10 | 50 |

---

## Documentation Deliverables (by end of Month 3)

| Document | Owner | Status |
|---|---|---|
| API docs (backend functions) | Lead Engineer | Needed |
| Moderator playbook | T&S Lead | Needed |
| Creator onboarding guide | Creator Success | Needed |
| Payout operations runbook | Ops | Needed |
| Incident response playbook | Lead Engineer | Needed |
| Community guidelines (public) | Founder | Needed |
| Privacy policy | Legal/Founder | Needed |
| Terms of service | Legal/Founder | Needed |
| App store listing copy | PM | Needed |
| Campus ambassador kit | Campus Ops | Needed |