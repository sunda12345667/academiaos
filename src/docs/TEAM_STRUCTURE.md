# StudentOS — Team Execution Structure

**Date:** 2026-05-09  
**Stage:** Pre-seed to Seed stage startup structure

---

## 1. Phase 0 Team (Pre-Launch, 1–3 people)

```
Founder / CTO
  → All engineering, product decisions, incident response
  → Designs moderation queue priority
  → Manages first 10 creators personally

Ops / Partnerships Lead (1 person)
  → Campus ambassador recruitment
  → Creator outreach
  → User support (T1, T2)
  → Moderation (under Founder guidance)
```

---

## 2. Phase 1 Team (~10 people, post seed-funding)

### Engineering

| Role | Count | Domain |
|---|---|---|
| Backend Engineer | 1 | NestJS migration, wallet backend, payout API |
| Full-Stack Engineer | 1 | Feed quality, notifications, creator dashboard |
| Mobile Engineer | 1 | Capacitor → React Native migration |
| Platform Engineer | 1 | Infrastructure, CI/CD, observability |

### Product / Design

| Role | Count | Domain |
|---|---|---|
| Product Manager | 1 | Feature prioritization, analytics, roadmap |
| UI/UX Designer | 1 | Mobile-first design system, creator UX |

### Operations

| Role | Count | Domain |
|---|---|---|
| Trust & Safety Lead | 1 | Moderation, abuse policy, appeals |
| Creator Success | 1 | Creator onboarding, support, retention |
| Campus Operations | 1 | Ambassador program, school partnerships |

---

## 3. Squad Structure (Phase 2, 15–25 people)

### Squad 1: Social Feed & Discovery
**Mission:** Maximize time-in-feed, recommendation quality, content diversity  
**Owns:** `feed/`, `ranking.engine`, `recommendation/`, `engagement/`  
**Metrics:** DAU, avg session duration, feed engagement rate, video completion rate

### Squad 2: Creator Economy
**Mission:** Grow creator supply, creator retention, and creator revenue  
**Owns:** `creator/`, `live/`, `wallet/gifting`, `growth/creator`  
**Metrics:** Active creator count, creator D30 retention, gift GMV, creator earnings

### Squad 3: Campus & Community
**Mission:** Drive campus network density and group activity  
**Owns:** `community/`, `social/graph`, `growth/viral`, onboarding  
**Metrics:** Groups per campus, WAU by campus, referral k-factor, campus DAU density

### Squad 4: Platform & Infrastructure
**Mission:** Reliability, performance, security, migration  
**Owns:** `lib/infra`, `lib/realtime`, backend functions, observability  
**Metrics:** P95 feed load, error rate, uptime, DB query performance

### Squad 5: Trust, Safety & Ops
**Mission:** Platform health, moderation quality, user trust  
**Owns:** `moderation/`, `ops/`, `risk.engine`, appeals workflow  
**Metrics:** Report resolution SLA, moderation accuracy, fraud signal rate, ban appeal approval rate

---

## 4. Domain Ownership

| Domain | Squad | Primary Engineer | Escalation |
|---|---|---|---|
| Feed & ranking | Feed | Engineer 1 | CTO |
| Notifications | Feed | Engineer 1 | CTO |
| Wallet & fintech | Platform | Engineer 4 | Founder |
| Payout & KYC | Platform | Engineer 4 | Founder |
| Live streaming | Creator Economy | Engineer 2 | CTO |
| Gifting | Creator Economy | Engineer 2 | Founder |
| Moderation | Trust & Safety | T&S Lead | Founder |
| Growth & onboarding | Campus | Engineer 3 | PM |
| Mobile | Platform | Engineer 3 | CTO |
| Analytics | Platform | Engineer 4 | PM |

---

## 5. Product / Design Collaboration Flow

```
Discovery → Design → Engineering → QA → Staged Rollout → Analytics Review

Week 1: PM defines problem + success metrics (no solution yet)
Week 1: Designer explores 2-3 concepts
Week 2: Engineering feasibility review (complexity, debt risk)
Week 2: Design finalized → Figma handoff
Week 3-4: Engineering builds (feature flagged OFF)
Week 4: Internal QA + designer review
Week 5: 10% canary rollout → analytics review
Week 6: Full rollout OR iterate based on data
```

### Decision Framework

| Decision Type | Owner | Input Required |
|---|---|---|
| Feature scope | PM | Engineering effort estimate |
| UX pattern | Designer | Accessibility review |
| Technical approach | Lead Engineer | PM approval if > 3 days |
| Feature flag enable/disable | PM + Engineering | Analytics data |
| Financial feature change | Founder | Legal/compliance check |
| Moderation policy change | T&S Lead | Founder sign-off |

---

## 6. Creator Support Workflow

### Support Tiers

| Tier | Issue Type | Handler | SLA |
|---|---|---|---|
| L1 | "How do I post?" | In-app FAQ + campus ambassador | Self-serve |
| L2 | Account verification issues | Creator Success team | 24h |
| L3 | Monetization setup, payout issues | Creator Success + Ops | 4h |
| L4 | Financial dispute, incorrect balance | Founder | 1h |

### Creator Escalation Triggers
- Withdrawal request stuck > 48h → L4
- Trust score dropped unexpectedly → L2
- Tier not upgraded despite meeting threshold → L2
- Content removed incorrectly → Appeals flow
- Live session terminated by moderation → L2 + Appeals

### Creator Success Metrics (track weekly)
- Creator D7 retention (target: > 70%)
- Creator D30 retention (target: > 50%)
- Average posts per creator per week (target: > 3)
- Creator-reported satisfaction (target: NPS > 40)
- Monetization activation rate (target: > 30% of eligible creators)

---

## 7. Moderation Team Staffing Plan

| Phase | Users | Moderators | Coverage Hours |
|---|---|---|---|
| Phase 0 | < 100 | Founder (part-time) | Business hours |
| Phase 1 | 100–1,000 | 1 part-time | 08:00–20:00 WAT |
| Phase 2 | 1,000–5,000 | 2 full-time | 08:00–22:00 WAT |
| Phase 3 | 5,000–20,000 | 4 full-time + AI | 24/7 coverage |
| Phase 4 | 20,000+ | Dedicated T&S team | 24/7 + automated |

### Moderator Training Requirements
- Community guidelines review (30min)
- Escalation procedure walkthrough (30min)
- Moderation queue tool training (1h)
- Shadow shift with senior moderator (4h)
- First 2 weeks: 100% decisions reviewed by T&S Lead