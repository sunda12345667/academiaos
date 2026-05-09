# StudentOS — Launch Operations Plan

**Date:** 2026-05-09  
**Coverage:** Campus rollout, creator recruitment, war room, support ops

---

## 1. Pre-Launch Timeline

```
T-8 weeks: Phase 0 Private Beta
  - 50 users from 1 campus (handpicked)
  - No payments, no live streaming
  - Focus: social loop validation, feed quality, bug triage
  - Success metric: D7 retention > 40%

T-4 weeks: Phase 0 → Phase 1 Transition
  - Fix all bugs from private beta
  - Enable live streaming for 3 creator accounts
  - Enable wallet topup (no withdrawals)
  - Onboard 10 creators (content seeds)
  - 3 campus ambassadors briefed

T-0 weeks: Phase 1 Public Beta
  - 3 campuses, ~500 users
  - Referral codes active
  - Campus expansion loop enabled
  - Creator onboarding form live
  - Support channel active (WhatsApp + email)

T+4 weeks: Phase 1 Review
  - DAU/WAU/MAU review
  - Retention cohort analysis
  - Creator health check
  - Bug list prioritization
  - Phase 2 scope locked

T+8 weeks: Phase 2 Creator Economy Launch
  - Gifts enabled (after TD-01 fixed)
  - Withdrawals enabled (after payout tested)
  - Marketplace (textbooks only)
  - New campus cohort (+2 campuses)
```

---

## 2. Campus Rollout Strategy

### Campus Selection Criteria
Priority: campuses with highest WhatsApp group density + student content creators already active.

| Tier | Example Campuses | Approach |
|---|---|---|
| Alpha (Phase 0) | 1 tech-heavy campus | Invite-only, founder-sent |
| Beta (Phase 1) | UNILAG, LASU, UniAbuja | Campus ambassador + referral |
| Expansion (Phase 2) | +10 campuses | Self-serve + viral referral |
| National (Phase 3) | All major universities | Platform-driven growth |

### Campus Ambassador Program

Each campus gets 1 ambassador. Role: promote, recruit, report bugs, seed content.

**Ambassador Selection:**
- Already active on social media
- Known within campus community
- Willing to post 3× per week minimum
- Gets: verified badge, early creator tier, ₦5,000 monthly stipend equivalent in wallet credits

**Ambassador Kit:**
- Referral code (personalized link with school pre-filled)
- Poster templates (for WhatsApp groups, notice boards)
- Onboarding script for classmates
- WhatsApp group template message
- Bug reporting channel access

### School Onboarding Process

```
Step 1: Ambassador identifies target WhatsApp groups (class groups, department groups)
Step 2: Posts tailored message: "I just joined StudentOS — [X] students from [School] 
         are already on it. Here's my link: [referral URL with school pre-filled]"
Step 3: New users open link → school is pre-selected → 1-step signup
Step 4: Platform shows "You and [Ambassador Name] go to the same school 👋"
Step 5: New user gets school-specific feed immediately (school groups, local content)
Step 6: Ambassador gets XP + notified of new campus join
```

---

## 3. Creator Recruitment Workflow

### Target Creator Profiles
1. Micro-influencers (1k–50k followers) on TikTok/Instagram from Nigerian universities
2. Lecturers with a personal following
3. Student content creators (vlogs, tutorials, study tips)
4. Debate/comedy/spoken word students

### Recruitment Funnel

```
Discovery → DM/Email Outreach → Application Form → Onboarding Call → 
Account Setup → First Post Milestone → Creator Tier Grant → Monetization Intro
```

**Outreach Message Template:**
> "We're building a creator platform specifically for Nigerian students and educators. 
> Your audience would love the content you make, and you'd be among the first verified 
> creators on StudentOS. We're offering [early verified badge + ₦10,000 creator seed credit]. 
> Interested? [application link]"

### Creator Onboarding Flow (Product)

```
1. Creator applies via form (name, school, niche, social handles, content samples)
2. Admin reviews + approves within 48h
3. Creator gets role=creator + account activated
4. Onboarding sends "Creator Welcome Kit" notification
5. Creator completes creator onboarding flow (niche, profile, first post)
6. After first post: auto-upgraded to basic tier
7. After 50 followers: pro tier unlocked (if trust ≥ 50)
8. After 500 followers: monetization eligibility notification
9. Creator dashboard unlocked showing: views, followers, engagement rate
```

### Creator Seeding Strategy

**Target before Phase 1 launch:** 10 creators with ≥5 posts each.  
**Target before Phase 2 launch:** 50 creators, 5 per campus, across 5 niches.

Niches to seed: education/study tips, tech/coding, business/entrepreneurship, campus life/comedy, arts/entertainment.

---

## 4. Launch War Room

### War Room Structure (Launch Day)

| Role | Person | Responsibility |
|---|---|---|
| Incident Commander | Founder/CTO | Decision authority, escalation |
| Platform Engineer | Lead Engineer | Infrastructure, deploy, rollback |
| Product Lead | PM | Feature flag decisions, user comms |
| Trust & Safety Lead | Ops | Moderation queue, abuse response |
| Creator Support | Ops | Creator-specific issues |
| Analytics Watcher | Any engineer | DAU, error rate, notification queue |

### War Room Channels
- **#war-room-incidents** — active incident management
- **#war-room-metrics** — DAU/error rate/notification CTR dashboard feed
- **#war-room-creators** — creator onboarding, first posts, issues
- **#war-room-bugs** — real-time bug reports from beta users

### Go/No-Go Checklist (Launch Day)

Run at T-1h, T-30min, T-0:

```
T-1h Check:
  [ ] DB accessible and responsive
  [ ] Paystack webhook receiving test events
  [ ] Error rate < 0.5% in last 24h
  [ ] All P0 items from PRODUCTION_READINESS.md checked
  [ ] 3+ admin users created and tested
  [ ] Content moderation pipeline processing test posts
  [ ] Creator content seeded (10+ posts live)
  [ ] Campus ambassador links tested and working

T-30min Check:
  [ ] Analytics dashboard showing live data
  [ ] Notification service sending test notifications
  [ ] Feature flags verified (WALLET=OFF, LIVE=OFF initially)
  [ ] On-call engineer confirmed available for 8h post-launch
  [ ] Support channel (WhatsApp) staffed and responsive

T-0 Launch:
  [ ] Enable referral codes
  [ ] Notify campus ambassadors: "GO"
  [ ] Post first official platform content
  [ ] Monitor: new user signups, first posts, error rate
```

---

## 5. Operational Support Workflow

### Support Tiers

| Tier | Channel | Response SLA | Handler |
|---|---|---|---|
| T1 — User questions | WhatsApp group | 2h | Campus ambassador |
| T2 — Account issues | Email / in-app | 4h | Ops team |
| T3 — Financial issues | Dedicated WhatsApp | 1h | Ops + Founder |
| T4 — Security / abuse | Internal | 30min | Founder / CTO |
| T4 — Platform outage | #war-room-incidents | 15min | Engineering |

### Moderation Workflow Staffing

**Phase 0 (50 users):** Founder reviews all reports personally.  
**Phase 1 (500 users):** 1 part-time moderator (3h/day). Queue reviewed 3×/day.  
**Phase 2 (2,000 users):** 2 full-time moderators. Queue reviewed continuously 08:00–22:00 WAT.  
**Phase 3 (10,000+ users):** 5 moderators + AI auto-enforcement for clear-cut violations.

**Moderation Queue SLA:**
- Critical (CSAM, violence, fraud) → 1h
- High (hate speech, harassment) → 4h
- Medium (spam, misinformation) → 24h
- Low (copyright, misleading) → 72h

### Incident Escalation Process

```
Level 1 — Degraded experience (slow feed, broken image uploads)
  Handler: On-call engineer
  Response: Fix or workaround within 2h
  Communication: Status page update

Level 2 — Feature outage (notifications not sending, DMs broken)
  Handler: Lead engineer + PM
  Response: Rollback or hotfix within 1h
  Communication: In-app banner + ambassador notification

Level 3 — Platform outage (login broken, feed empty)
  Handler: All hands
  Response: Rollback within 30min
  Communication: SMS to ambassadors + email to registered users

Level 4 — Financial incident (wallet balance incorrect, double-charge)
  Handler: Founder mandatory
  Response: Freeze affected wallets within 15min
  Communication: Direct contact to affected users
  Recovery: Manual reconciliation from LedgerEntry records
```

---

## 6. Launch Analytics Dashboard

### Metrics to Watch on Launch Day (hourly)

| Metric | Target | Alert Threshold |
|---|---|---|
| New signups / hour | 20–50 on launch day | < 5 → check ambassador comms |
| Onboarding completion rate | > 60% | < 40% → UX issue |
| First post rate | > 25% of signups | < 15% → feed composer issue |
| D1 retention | > 40% | < 25% → critical re-engagement needed |
| Error rate | < 1% of requests | > 3% → incident |
| Notification CTR | > 15% | < 8% → notification issue |
| Feed load P95 | < 3s | > 5s → performance incident |
| Moderation queue depth | < 20 items | > 50 → add reviewers |

### Product Analytics (weekly cohort review)

| Metric | Target at 30 days |
|---|---|
| DAU/MAU (stickiness) | > 0.25 |
| D7 retention | > 35% |
| D30 retention | > 20% |
| Creator activation rate | > 60% of creators post in week 1 |
| Average posts per creator per week | > 3 |
| Referral activation rate | > 50% of referred users become active |
| First live session rate | > 30% of creators in month 1 |
| Avg session duration | > 8 minutes |