# StudentOS — Release Management Architecture

**Date:** 2026-05-09  
**Coverage:** Release channels, staging, feature flags, hotfix, rollback

---

## 1. Release Channels

### Web (Primary)

```
main branch     → Production (auto-deploy on merge to main)
staging branch  → Staging environment (mirrors prod, test data)
develop branch  → Development (active feature work, PRs merge here)

Feature branches: feat/wallet-optimistic-lock
Hotfix branches:  hotfix/notification-dedup-fix
```

### Mobile (Capacitor → App Store)

```
Alpha track:    Internal team only (TestFlight / Play Store Internal)
Beta track:     Campus ambassadors + power users (TestFlight / Play Store Beta)
Production:     Full release (staged 10% → 50% → 100% via store rollout)
```

### Release Cadence

```
Patch (x.x.N): Bug fixes, hotfixes → deploy immediately (no wait)
Minor (x.N.0): New features, feature flag enables → Tuesday + Thursday only
Major (N.0.0): Breaking changes, schema migrations → planned maintenance window
```

---

## 2. Staging Workflow

### Environment Strategy

| Environment | Purpose | Data | Deploy Trigger |
|---|---|---|---|
| `local` | Developer testing | Mocked / dev DB | Manual |
| `staging` | Pre-release validation | Anonymized prod snapshot | PR merge to staging |
| `production` | Live users | Real data | PR merge to main |

### Staging Validation Checklist (before every production deploy)

```
Automated:
  [ ] All CI tests passing
  [ ] No TypeScript errors (when TS added)
  [ ] Bundle size within 10% of previous deploy
  [ ] Lighthouse score > 85 (mobile)

Manual:
  [ ] Signup + onboarding flow tested end-to-end
  [ ] Post create + moderation + notifications tested
  [ ] Any modified service tested with real data
  [ ] Feature flags verified (new flags default OFF)
  [ ] Mobile (375px) breakpoint tested in Chrome DevTools
```

---

## 3. Feature Flag Rollout Strategy

### Rollout Stages (standard)

```
Stage 0: OFF (default)
Stage 1: Internal team only (URL override: ?flag_FEATURE=true)
Stage 2: 5% canary (flags.rollout('FEATURE', userId, 0.05))
Stage 3: 25% rollout
Stage 4: 50% rollout
Stage 5: 100% (remove flag, feature becomes default)
```

### Canary Decision Criteria

Move from stage N to N+1 when:
- No increase in error rate for affected flows
- Feature-specific success metrics trending positive
- No P1+ bug reports related to feature
- Stage N has been stable for ≥ 48 hours

### Emergency Flag Rollback

```
Symptom: Error rate spike, user complaints, financial anomaly
Action:  Set flag to OFF via feature-flags.js FEATURE_FLAGS override
Effect:  Immediate for new requests (no deploy needed)
Time:    < 5 minutes from decision to all users on rollback
```

---

## 4. Hotfix Process

### When to use hotfix (not standard release):
- Financial data integrity issue
- Security vulnerability
- > 20% of users affected by bug
- Moderation system broken
- Payment flow broken

### Hotfix Procedure

```
1. Create branch: git checkout -b hotfix/short-description main
2. Make minimal surgical fix (zero feature changes)
3. Test on staging (expedited — 30min validation)
4. Get 1 reviewer approval (emergency: self-merge allowed for P0 security)
5. Merge to main → auto-deploy
6. Merge back to develop (prevent re-introducing bug)
7. Post-incident review within 24h
8. Document in #war-room-incidents
```

### Hotfix SLA by Severity

| Severity | Example | Target Deploy Time |
|---|---|---|
| P0 — Financial | Wrong wallet balance | < 30 min |
| P0 — Security | Data exposed | < 30 min |
| P1 — Outage | Feed broken for all users | < 1h |
| P2 — Feature bug | Notifications not sending | < 4h |
| P3 — Visual | Wrong color, misaligned layout | Next release |

---

## 5. Rollback Procedure

### Web
```
1. Identify last good deploy SHA (from deployment logs)
2. git revert <bad-commit> OR git reset --hard <good-SHA>
3. Push → auto-deploy triggers
4. Total time: < 10 minutes
5. If DB migration was included: execute rollback migration script
```

### Database (Entity schema)

**Never destructively remove entity fields** — always add new fields, never remove.

If a field change causes issues:
```
1. Add new field (e.g., wallet_version_v2) — old field remains
2. New code uses new field, old code uses old field (backward compat)
3. After 100% rollout stable: clean up old field in next planned release
```

### Feature Flag Rollback (fastest)
```
If a feature flag controls the broken feature:
  → Toggle flag OFF in feature-flags.js
  → Deploy (< 5 min)
  → No DB rollback needed
  → No user data impact
```

---

## 6. App Store Release Management

### iOS App Store

```
Review preparation:
  1. Test on real device (iPhone SE, iPhone 14, iPhone 15 Pro)
  2. Screenshots: 6.5" (iPhone 14 Plus) + 12.9" (iPad) required
  3. App preview video (optional but recommended — show feed + post create)
  4. Privacy policy URL in app metadata
  5. Support URL (email or WhatsApp)
  6. Age rating: 12+ (social, mild language, financial)
  7. Category: Social Networking (primary), Education (secondary)

Review notes for Apple:
  - Demo account credentials provided
  - Note: payments via Paystack (in-app, not IAP — complies with App Store guidelines
    for marketplace-style platforms where payments are to creators, not Apple)
  - Note: content moderation system active

Potential rejection risks:
  - Fintech features → ensure Paystack is described as peer-to-peer creator payments
  - User-generated content → content moderation disclosure required
  - Live streaming → moderation disclosure + reporting mechanism required
```

### Google Play Store

```
Requirements:
  1. Target SDK 34 (Android 14) minimum
  2. Privacy policy URL
  3. Data safety form:
     - Collected: name, email, location (optional), financial (wallet)
     - Shared: display name, posts (public)
     - Encrypted: yes (HTTPS)
     - User deletion: yes (account deletion feature required)
  4. Content rating: Teen (social, mild financial features)
  5. Financial features disclosure in Play Console

Account deletion requirement (mandatory for app store):
  → Add "Delete Account" option in Profile settings
  → On delete: anonymize data, retain Transaction records (legal requirement)
  → Backend function: deleteUserAccount(userId) — anonymizes PII, preserves ledger
```

### App Store Listing Copy

**App Name:** StudentOS  
**Subtitle:** For Nigerian students & creators  
**Keywords:** student, campus, education, creator, Nigeria, university, study, social, learning

**Description (short):**
> StudentOS is the campus social platform for Nigerian students and educators. 
> Share knowledge, follow creators, join study groups, and earn from your expertise.

---

## 7. Post-Launch Monitoring

### Key Signals to Watch (automated alerts)

```
Error rate:       > 2% of requests → PagerDuty alert
New signups/hour: < 2 after launch → Ambassador check
D1 retention:     < 30% → Investigate feed quality
Wallet errors:    ANY → Immediate investigation
Moderation queue: > 100 items → Add reviewer
Notification CTR: < 10% → Investigate delivery
``