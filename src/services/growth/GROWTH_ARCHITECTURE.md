# StudentOS — Growth, Retention & Viral Architecture

## System Map

```
┌─────────────────────────────────────────────────────────────────────┐
│                     GROWTH SYSTEMS LAYER                            │
├─────────────────────────────────────────────────────────────────────┤
│  onboarding.service.js       Role-aware progressive onboarding      │
│  retention.service.js        Streaks, achievements, return triggers │
│  viral.service.js            Referrals, share loops, campus growth  │
│  notification.intelligence.js Psychology-optimized delivery        │
│  growth.analytics.js         Funnels, cohorts, DAU/WAU/MAU, A/B    │
├─────────────────────────────────────────────────────────────────────┤
│  hooks/useGrowth.js          useOnboarding, useReferral, useAchievements │
│  lib/infra/feature-flags.js  A/B test variant assignment            │
│  lib/infra/event-queue.js    Growth event tracking pipeline         │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Onboarding Intelligence

### Role-Adaptive Flows

| Role         | Steps                                                      | Activation Trigger    |
|--------------|------------------------------------------------------------|-----------------------|
| `student`    | interests → school_match → follow_3 → join_group → post  | follow + post         |
| `educator`   | institution → subjects → course_create → invite           | first_course          |
| `creator`    | niche → creator_profile → first_post → monetization_intro | first_post            |
| `school_admin` | school_setup → invite → announce → verify               | school_profile        |
| `advertiser` | business_setup → campaign_goal → first_campaign           | first_campaign        |

### Progressive Onboarding Principles

1. **Required steps only block activation, not the platform** — users can always skip optional steps
2. **XP rewards for every step** — visible progress bar creates completion psychology
3. **Social graph bootstrapping on step 1** — interest selection seeds `getOnboardingSuggestions()`
4. **Campus loop seeded on school_match step** — shows "X students from your school are here"
5. **Personalization initialized before first feed load** — zero blank-slate experience

### Usage

```js
import { useOnboarding } from '@/hooks/useGrowth';

const { state, currentStep, progressPercent, completeStep, getSuggestions } = useOnboarding();

// Complete a step
await completeStep('select_interests');

// Get curated follow suggestions (school + subject scored)
const suggestions = await getSuggestions();

// Get group suggestions for onboarding
const groups = await getGroupSuggestions();

// Save interest selection (initializes personalization)
await saveInterests(['mathematics', 'python', 'economics'], schoolId);
```

---

## Retention Architecture

### Achievement System

39 achievements across 5 categories: **social, streak, engagement, creator, community**

```js
import retentionService from '@/services/growth/retention.service';

// Check and unlock achievements after key events
const unlocked = await retentionService.checkAndUnlockAchievements(userId, {
  firstPost: true,    // after first post published
  streakDays: 7,      // after streak computed
  firstFollower: true, // after first follower gained
});
// → [{id: 'first_post', label: 'First Post', xp: 100, icon: '✍️'}, ...]
```

Achievement milestones send celebratory notifications + update `UserProfile.achievements_earned[]`.
Badges are public on profiles — social proof drives sharing and follow behavior.

### Streak System

```js
// Posting streak (consecutive days with published post)
import engagementService from '@/services/engagement/engagement.service';
const { current, longest, lastPostDate } = await engagementService.getPostingStreak(profileId);

// Detect streak at-risk (> 18h since last post, not yet posted today)
const risk = await retentionService.detectStreakRisk(profileId);
// → { atRisk: true, hoursRemaining: 5 }

// Send rescue notification
import notificationIntelligence from '@/services/growth/notification.intelligence';
await notificationIntelligence.sendStreakRescueNotification(userId, streakDays);
```

**Streak rescue window:** Notification sent at 18h mark (6h remaining), max once per streak day.

### Return Triggers (Dormancy Response)

| Dormancy | Level | Message Strategy              |
|----------|-------|-------------------------------|
| 1 day    | d1    | FOMO: "Your followers are creating 🔥" |
| 3 days   | d3    | Content summary: "Posts waiting for you" |
| 7 days   | d7    | Social urgency: "Your community misses you" |
| 14 days  | d14   | FOMO + group activity: "You're missing out" |
| 30 days+ | —     | Email re-engagement (future SendGrid) |

```js
const trigger = await retentionService.computeReturnTrigger(userId);
if (trigger) await notificationIntelligence.sendReturnTriggerNotification(userId, trigger);
```

---

## Viral Loop Architecture

### K-Factor Loops

```
Loop 1: Content Share
  Create post → share to WhatsApp → friend opens link → sees platform →
  signs up → lands on content that brought them → follows creator → activated

Loop 2: Campus Expansion (highest k-factor for Nigerian market)
  Student joins → completes school_match → sees "237 from your school" →
  shares campus invite link to WhatsApp group → classmates join with school pre-filled →
  school community bootstrapped instantly

Loop 3: Creator Invitation
  Creator grows audience → invites collab creator externally →
  new creator joins → brings existing audience → both grow together

Loop 4: Group Invite
  User joins group → invites classmates via WhatsApp → classmates join →
  group becomes school-specific community → content shared back externally
```

### Referral System

```js
import viralService from '@/services/growth/viral.service';
import { useReferral } from '@/hooks/useGrowth';

// Get referral link for sharing
const { referralCode, referralLink, stats } = useReferral();
// → { referralCode: 'ada1x3f', referralLink: 'https://studentos.app/join?ref=ada1x3f' }

// Share tracking (fire-and-forget)
const { trackShare, buildShareUrl } = useReferral();
trackShare('post', postId, 'whatsapp');

// Campus adoption widget (shows on school_match step)
const schoolStats = await viralService.getSchoolAdoptionStats(schoolId);
// → { count: 237, school: {...}, recentJoiners: [...] }
```

**Referral rewards:**
- Referrer: +200 XP on attribution, +300 XP on referee activation (future: gift coins)
- Referee: +XP bonus + referrer as top follow suggestion

---

## Notification Intelligence

### Priority Tiers

| Priority | Types                              | Caps             | Quiet Hours |
|----------|------------------------------------|-----------------|-------------|
| P0 CRITICAL | financial, security, ban        | None            | Never       |
| P1 HIGH  | DM, live_starting, direct reply    | 10/day          | Respected   |
| P2 MEDIUM | new_follower, comment, mention    | 5/day           | Respected   |
| P3 LOW   | streak reminder, course update     | 2/day           | Respected   |
| P4 SYSTEM | achievements, onboarding tips     | 1/day (digest)  | Respected   |

**Quiet hours:** 23:00–07:00 Nigeria WAT (UTC+1)

**Anti-flood:** Max 2 notifications per 4-hour window for P2+

### Fatigue Prevention Rules

1. If user hasn't opened app in 7+ days → P3/P4 skipped, only P0/P1 delivered
2. If daily cap reached for priority tier → notification queued for next day
3. If 2+ notifications sent in last 4h → P2+ deferred
4. Milestones always deliver (override caps) — they celebrate the user

```js
import notificationIntelligence from '@/services/growth/notification.intelligence';

// Smart send — checks all caps, quiet hours, flood prevention
await notificationIntelligence.sendIntelligentNotification({
  recipientId: userId,
  type: 'new_follower',
  title: '@ada followed you',
  body: 'Check out their profile!',
  actorId: followerProfileId,
});

// Specialized senders
await notificationIntelligence.sendStreakRescueNotification(userId, streakDays);
await notificationIntelligence.sendMilestoneCelebration(userId, 'followers_100');
await notificationIntelligence.sendReturnTriggerNotification(userId, trigger);
```

### Optimal Send Windows (Nigeria Market)

- **07:30–09:00** — Morning commute / pre-class (high open rate)
- **12:00–13:30** — Lunch break (peak engagement)
- **18:00–21:00** — Evening social (highest CTR window)

---

## Growth Analytics

### Executive Dashboard Metrics

```js
import growthAnalytics from '@/services/growth/growth.analytics';

// Full growth summary
const summary = await growthAnalytics.getGrowthSummary();
// → { users: { dau, wau, mau, stickiness }, creators: { total, retention30d }, referrals: { activationRate } }

// Active user counts
const counts = await growthAnalytics.getActiveUserCounts();
// → { dau: 1240, wau: 4200, mau: 12000, dau_wau_ratio: 0.295 }

// Creator retention
const creatorRetention = await growthAnalytics.getCreatorRetention();
// → { total: 450, active30d: 312, retention30d: 0.693, monetized: 87 }
```

### Activation Funnel

```js
const funnel = await growthAnalytics.getActivationFunnel({ days: 30 });
// → {
//     total: 1240,
//     steps: [
//       { id: 'registered',          count: 1240, conversionRate: 1.000 },
//       { id: 'interests_selected',  count: 980,  conversionRate: 0.790 },
//       { id: 'follow_suggestions',  count: 720,  conversionRate: 0.580 },
//       { id: 'first_post',          count: 310,  conversionRate: 0.250 },
//       { id: 'onboarding_complete', count: 180,  conversionRate: 0.145 },
//       { id: 'activated',           count: 520,  conversionRate: 0.419 },
//     ]
//   }
```

### Retention Cohorts

```js
const cohorts = await growthAnalytics.getRetentionCohorts({ weeks: 8 });
// → { cohorts: [{ weekLabel: 'Week -1', cohortSize: 340, d1: 0.62, d7: 0.41, d30: 0.22 }] }
```

### Referral Funnel

```js
const referralStats = await growthAnalytics.getReferralFunnelStats();
// → { totalReferred: 430, activated: 280, retained30d: 195,
//     attributionRate: 0.34, activationRate: 0.65, retentionRate: 0.70 }
```

### A/B Experiment Tracking

```js
import { trackExperimentExposure, trackExperimentConversion } from '@/services/growth/growth.analytics';
import flags from '@/lib/infra/feature-flags';

// Assign variant
const variant = flags.rollout('ONBOARDING_V2', userId, 0.50) ? 'v2' : 'control';

// Track exposure
trackExperimentExposure('onboarding_flow', variant, userId);

// Track conversion (e.g. completed onboarding)
trackExperimentConversion('onboarding_flow', variant, userId, 'onboarding_complete');
```

---

## Creator Growth Engine

### Creator Milestone Progression

```
First Post         → achievement unlocked + XP + profile badge
10 Followers       → achievement + "Share your profile" prompt
50 Followers       → tier upgrade: basic + monetization teaser
100 Followers      → milestone celebration notification
500 Followers      → monetization eligibility notification
First Live         → achievement + "Schedule your next live" prompt
First Tip          → celebration + payout setup prompt
First Course       → achievement + "Invite students" CTA
Monetized          → milestone celebration + creator welcome kit
```

### Creator Retention Hooks

1. **Weekly insight digest** — "Your content got 2.3k views this week" (future email)
2. **Posting streak** — computed by `engagementService.getPostingStreak()`, displayed on creator dashboard
3. **Audience growth signal** — "+12 followers this week" shown in dashboard header
4. **Top performing post** — surfaced weekly as positive reinforcement
5. **Monetization milestones** — each ₦1000 earned triggers a celebration

---

## Growth Scalability Roadmap

### Phase 1 — Current (Service Layer)
- ✅ Progressive onboarding state on UserProfile entity
- ✅ Achievement system (client-computed, DB-persisted)
- ✅ Referral code generation + attribution
- ✅ Share URL building + tracking
- ✅ Notification intelligence (caps, quiet hours, priority)
- ✅ Growth analytics (client-side approximations)
- ✅ A/B test tracking via event-queue

### Phase 2 — Backend Workers
- [ ] Streak rescue scheduler (BullMQ cron — checks all users at 22:00 daily)
- [ ] Return trigger scheduler (BullMQ — segments dormant users D1/D3/D7/D14)
- [ ] Achievement computation worker (event-driven, fires on follower gain etc.)
- [ ] Email digest (SendGrid weekly creator summary, D30 re-engagement)
- [ ] Share link dynamic OG tags (Next.js ISR: /post/:id → unique social preview)

### Phase 3 — Data Infrastructure
- [ ] ClickHouse: DAU/WAU/MAU, retention cohorts, activation funnels (real-time)
- [ ] Kafka: referral events, share events, achievement events
- [ ] Redis: streak state (sorted sets with midnight TTL), referral code lookup
- [ ] Statsig/GrowthBook: Bayesian A/B test results with statistical significance
- [ ] Push notifications: FCM (Android) + APNs (iOS) via NestJS notifications module

### Phase 4 — ML-Powered Growth
- [ ] Personalized notification timing (predict optimal send time per user)
- [ ] Churn prediction model (7-day churn probability → proactive rescue)
- [ ] Creator growth recommendations (AI-generated posting strategy per creator)
- [ ] Referral propensity scoring (predict who is most likely to refer)
- [ ] Content virality prediction (predict share rate before publishing)