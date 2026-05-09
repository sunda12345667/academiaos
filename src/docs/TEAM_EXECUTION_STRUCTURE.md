# StudentOS — Team Execution Structure
*v1.0 | 2026-05-09*

---

## Engineering Squad Structure (when team scales)

### Phase 0–1 (Founding Team: 1–3 Engineers)
Single team owns everything. Use domain ownership mental model:

```
Founder/Tech Lead        — Architecture, fintech, security, deployment
Frontend Engineer        — Feed, creator UX, mobile, design system
Growth/Fullstack         — Onboarding, notifications, analytics, growth
```

**Operations support:**
```
Founder (product decisions)
1× Campus Ambassador per pilot university (non-technical, student)
1× Part-time Moderator (on-call for content escalations)
```

### Phase 2 (5–8 Engineers, 3 squads)

```
Squad Alpha: Social Platform
  - Feed, posts, groups, messaging, reactions
  - Owns: Post, Comment, Follow, Group, Message, Notification entities
  - Key metrics: DAU, feed engagement, DM volume

Squad Bravo: Creator Economy
  - Creator profiles, live streaming, gifting, payouts, monetization
  - Owns: CreatorProfile, LiveSession, Gift, Wallet, Transaction entities
  - Key metrics: creator DAU, gift revenue, live viewer hours

Squad Charlie: Platform & Growth
  - Onboarding, growth systems, AI features, infra, moderation
  - Owns: Onboarding, Recommendations, WatchEvent, ModerationReport entities
  - Key metrics: activation rate, D7 retention, referral k-factor
```

**Non-engineering:**
```
Product Manager × 1
Designer × 1
Community Manager × 1 (campus ambassadors + creator relations)
Trust & Safety Analyst × 1 (moderation queue)
```

### Phase 3 (10–15 Engineers, 4 squads + Platform)

Add:
```
Squad Delta: Ads & Monetization
  - AdCampaign, MarketplaceListing, advertiser self-serve
  - Key metrics: ad revenue, creator earnings, ARPU

Platform Team (2–3 engineers):
  - Infrastructure, migration readiness, shared services
  - Owns: infra layer, observability, RealtimeBus, performance
```

---

## Domain Ownership

| Domain | Squad | Primary Contact | Escalation |
|---|---|---|---|
| Feed ranking | Alpha | Squad Alpha lead | CTO |
| Post creation/moderation | Alpha | Squad Alpha lead | CTO |
| Notifications | Charlie | Squad Charlie lead | Tech lead |
| Wallet/payments | Bravo | Squad Bravo lead | Founder |
| Creator profiles | Bravo | Squad Bravo lead | Founder |
| Live streaming | Bravo | Squad Bravo lead | CTO |
| AI systems | Charlie | Squad Charlie lead | CTO |
| Growth/onboarding | Charlie | Squad Charlie lead | Product |
| Ads platform | Delta | Squad Delta lead | Founder |
| Infrastructure | Platform | Platform lead | CTO |
| Security | Platform | CTO | Founder |

---

## Operational Support Workflow

### User Support Tiers
```
Tier 1 (Self-service):
  FAQ + in-app help tooltips → resolve 70% of issues
  Response time: instant

Tier 2 (Community Manager):
  DM on Twitter/Instagram, in-app support chat
  Response time: < 24 hours
  Handles: account issues, onboarding help, feedback

Tier 3 (Engineering):
  Escalated by Tier 2 only — bugs, financial issues
  Response time: < 4 hours for financial, < 48 hours for UX bugs
  Handles: payout failures, wallet discrepancies, access issues

SEV-1 Escalation:
  Direct to Founder + CTO
  Any financial data issue or security concern
```

### Moderation Workflow (Content Trust & Safety)

**Staffing at Phase 0–1:**
```
1× Part-time moderator (20 hrs/week minimum)
1× On-call backup (Founder handles nights/weekends initially)
```

**Daily Moderation Routine:**
```
09:00 — Review ModerationReport queue (target: < 4 hour SLT)
10:00 — Review new creator account requests
11:00 — Live session monitoring (during peak hours 12:00–21:00)
15:00 — Process FraudSignal alerts (payout review)
18:00 — Evening peak monitoring (highest risk window)
```

**Escalation Triggers:**
```
Escalate immediately to Founder:
- Any suspected CSAM content
- Coordinated abuse/fraud attempt (FraudSignal cluster)
- Live stream with potential illegal activity
- Credible threat of harm

Escalate to Tech Lead:
- Payment dispute > ₦50,000
- Account compromise suspected
- Platform-wide feature failure
```

---

## Moderation Playbook

### Content Categories & Response Times

| Category | Response SLT | Action |
|---|---|---|
| CSAM/Illegal | Immediate | Remove + report to authorities + ban |
| Violence/Threats | < 1 hour | Remove content + review account |
| Harassment/Bullying | < 4 hours | Warning → suspend → ban (escalating) |
| Spam/Scam | < 4 hours | Remove + trust score penalty |
| Copyright claim | < 24 hours | Remove pending review |
| Misinformation | < 24 hours | Add label or remove |
| Policy grey area | < 24 hours | Human review required |

### Account Action Ladder
```
Strike 1: Warning notification (first offense, minor)
Strike 2: 24-hour posting restriction
Strike 3: 7-day suspension
Strike 4: Permanent ban (appeal available)

Bypass ladder (immediate ban):
- CSAM
- Financial fraud confirmed
- Coordinated abuse network
```

### Appeal Process
```
User files AppealRequest → auto-assigned to moderator
Moderator reviews within 48 hours
If upheld: action reversed, compensation notification sent
If denied: explanation provided, no further appeal within 30 days
```

---

## Creator Support Workflow

### Creator Relations (Phase 0–1)
```
All invited creators get:
- WhatsApp group with direct line to team
- Weekly check-in (async Loom video from team)
- Dedicated #creator-support channel
- Priority bug resolution (< 24 hours)
```

### Creator Onboarding Checklist (per creator)
```
Pre-invite:
[ ] Creator has > 500 followers on any existing platform
[ ] Subject area aligns with student demographics
[ ] Content quality screening (review last 10 posts)
[ ] Background check on brand safety

Day 1 (invite sent):
[ ] Onboarding email with setup guide
[ ] WhatsApp welcome message
[ ] Creator dashboard walkthrough (Loom video link)

Day 3 (follow-up):
[ ] Has creator published first post?
[ ] Have they set up their creator profile?
[ ] Resolve any setup issues

Day 7 (activation check):
[ ] Has creator gone live at least once?
[ ] Are they gaining followers?
[ ] Send personalization tips based on their analytics
```

---

## Campus Ambassador Program

### Ambassador Role
Each pilot university has 1 Ambassador who:
- Not a paid employee (stipend + premium features)
- Runs campus WhatsApp/Telegram group
- Recruits first 200 students on their campus
- Reports weekly on: new signups, engagement, bugs
- Escalates campus-specific moderation issues

### Ambassador Criteria
```
- 3rd or 4th year student (credibility + tenure)
- Active on social platforms (> 500 followers anywhere)
- Interested in tech/education
- Not in final exams during launch window
```

### Compensation
```
- Platform XP multiplier (5×) — visible on profile
- "Campus Ambassador" badge
- ₦10,000/month stipend (Phase 1)
- Creator tier upgrade (verified status)
- Referral commission: ₦500 per activated student referral
```

---

## Launch War Room

### War Room Composition (launch day)
```
Founder: product decisions, creator communication
CTO/Tech Lead: deployment, infrastructure, incident response
Engineer 1: frontend monitoring, feature flag management
Engineer 2: backend/database monitoring, Paystack webhook
Community Manager: creator + campus ambassador communication
Moderator: content moderation (all hands on launch day)
```

### Launch Day Timeline (T = launch time)
```
T-48h: Staging deploy + full QA
T-24h: Production deploy (flag: off)
T-4h:  Internal team test on production
T-2h:  Invited creators notified ("going live in 2 hours")
T-1h:  Embassy ambassadors told to share invite links
T-0:   Feature flag → 100% (no gradual on launch day — full on)
T+1h:  First metrics review (DAU, errors, Paystack)
T+4h:  Creator welfare check (DMs to all Phase 0 creators)
T+24h: Launch retrospective + next-day fixes prioritized
```

### War Room Monitoring Dashboard (must be visible during launch)
```
1. Error rate (< 1% threshold)
2. Active users (realtime DAU)
3. Feed P95 load time (< 2s threshold)
4. Paystack webhook success rate (100% expected)
5. Notification delivery rate
6. Active live sessions (manual stream health check)
7. ModerationReport queue depth (< 10 unreviewed)
8. Open FraudSignals (0 expected on day 1)
``