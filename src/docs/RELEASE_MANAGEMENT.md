# StudentOS — Release Management Architecture
*v1.0 | 2026-05-09*

---

## Release Channels

```
production    ← live.studentos.app      (real users, no experiments without flag)
staging       ← staging.studentos.app   (pre-production validation, realistic data)
preview       ← pr-{N}.studentos.app    (per-PR preview, auto-deployed by Base44)
dev           ← localhost:5173          (engineer local, dev DB)
```

### Channel Promotion Flow
```
dev → preview (automatic on PR open)
    → staging (manual: "merge to staging" branch)
      → production (manual: release PR + sign-off)
```

---

## Versioning Strategy

### Semantic Versioning: `MAJOR.MINOR.PATCH`
```
MAJOR — breaking platform changes (new entity schema incompatible with old data)
MINOR — new user-facing feature (new page, new flow, feature flag at 100%)
PATCH — bug fix, performance improvement, copy change
```

### Version in Code
```js
// Sourced from: import.meta.env.VITE_APP_VERSION
// Set at build time: VITE_APP_VERSION=1.2.3 vite build
// Logged by: logger.setContext({ version: ... }) in app-bootstrap.js
```

### Release Naming Convention
```
v0.1.0 — Private Alpha (Phase 0)
v0.2.0 — Campus Beta (Phase 1)
v1.0.0 — Public Launch (Phase 2)
v1.1.0 — Creator Economy (Phase 3)
```

---

## Release Process (standard)

### Step 1 — Feature Development
```
1. Engineer creates feature branch: feature/wallet-optimistic-lock
2. PR opened → Base44 preview deployment auto-created
3. PR checklist completed (see DEVELOPER_EXPERIENCE.md)
4. Code review (1 approval minimum, 2 for security/financial changes)
5. Feature flag created (off by default)
6. Merged to main
```

### Step 2 — Staging Validation (1–2 days)
```
1. Promote main → staging
2. QA smoke test: 10-point checklist (see below)
3. Product owner sign-off on new user-facing changes
4. Performance regression check: Lighthouse mobile score ≥ previous
5. Database migration verified (if schema change)
```

### Step 3 — Gradual Rollout
```
1. Deploy to production (flag: OFF)
2. Internal team test on production (verify no environment-specific issues)
3. Flag rollout: 5% users (monitor error rate for 1 hour)
4. Flag rollout: 25% users (monitor 2 hours)
5. Flag rollout: 100% users
```

### Step 4 — Release Closure
```
1. Monitor: error rate, p95 API latency, realtime lag for 24 hours
2. Update CHANGELOG.md
3. Close feature flag (feature is permanent at 100%)
4. Update production checklist status
```

---

## QA Smoke Test Checklist (run on every staging deploy)

| # | Test | Expected |
|---|---|---|
| 1 | Sign in / Auth | Loads in < 2s, profile visible |
| 2 | Home feed load | Posts visible within 3s |
| 3 | Create post (text) | Post appears in feed within 5s |
| 4 | Like a post | Like count +1 immediately (optimistic) |
| 5 | Send a DM | Message delivered, notification received |
| 6 | Follow a user | Following feed updates |
| 7 | Wallet balance view | Balance visible, no errors |
| 8 | Join a group | Member count +1, group visible |
| 9 | Creator profile | Tier, badges, post count visible |
| 10 | Notification bell | Unread count visible, marks read on click |

---

## Feature Flag Rollout Strategy

### Rollout Tiers

```
Tier 0 (Internal)     → team email list only
Tier 1 (Alpha)        → Phase 0 invited users (50 users)
Tier 2 (Beta 5%)      → 5% by userId hash (deterministic A/B)
Tier 3 (Beta 25%)     → 25% by userId hash
Tier 4 (Full)         → 100% users
```

### Flag Ownership
Every feature flag has an assigned owner:
```js
// lib/infra/feature-flags.js — add owner comment to every flag
'FEED_AI_RANKING':       { default: false, owner: 'feed-team', tier: 2 },
'GIFTING_ENABLED':       { default: false, owner: 'fintech-team', tier: 1 },
'LIVE_STREAMS':          { default: false, owner: 'creator-team', tier: 0 },
```

### Kill Switch Protocol
If a flag's feature causes elevated errors (> 2% error rate):
```
1. Immediately set flag to false (< 5 minutes response target)
2. All traffic → previous code path
3. Post-mortem within 24 hours
4. Fix → re-deploy → promote through tiers again
```

---

## Rollback Procedures

### Code Rollback (Base44 deployment)
```
1. Identify: error rate spike on monitoring dashboard
2. Revert: redeploy previous build from Base44 deployment history
3. Verify: smoke test confirms baseline behavior restored
4. Target: < 10 minutes from alert to stable production
```

### Data Rollback (entity record changes)
```
WARNING: Entity data cannot be "rolled back" via deployment.
Financial records (Transaction, LedgerEntry) are append-only.
Never attempt to delete or modify financial records post-production.

For bad schema migrations:
1. Deploy new schema with backward-compatible field additions
2. Never remove fields (mark deprecated instead)
3. Data fixes: backend function with admin authentication

For corrupted wallet balances (DEBT-001 scenario):
1. Immediately freeze affected wallets: status → 'frozen'
2. Run ledger reconciler: sum LedgerEntries → compare to Wallet.balance
3. Correct discrepancy via admin-authed creditWallet/debitWallet
4. Unfreeze wallet
5. File incident report
```

### Database Migration Strategy
```
RULE: All entity schema changes must be backward-compatible for 2 weeks.
  - Add new optional fields → OK to deploy immediately
  - Remove fields → mark deprecated, keep in schema for 2 weeks, then remove
  - Change field types → add new field, migrate data, deprecate old field
  - Rename fields → add new, copy data in background job, deprecate old
```

---

## Hotfix Process

### Severity Levels
```
SEV-1 (Critical): Production down, financial data at risk, security breach
  → Response: < 30 minutes | All engineers on call | War room
  → Deploy without full staging validation (smoke test only)
  → Post-mortem: 24 hours

SEV-2 (High): Key feature broken for > 10% users, payment failures
  → Response: < 2 hours | Assigned engineer + tech lead
  → Staging validation: 30-minute compressed QA
  → Post-mortem: 48 hours

SEV-3 (Medium): Minor feature broken, < 5% users affected
  → Response: next business day (or next release cycle)
  → Full release process
```

### Hotfix Branch Process
```
1. Branch from production tag: hotfix/1.0.1-wallet-freeze
2. Minimal fix only — no features piggyback
3. Deploy to staging → compressed QA (30 min)
4. Deploy to production
5. Cherry-pick back to main
6. Tag: v1.0.1
```

---

## Incident Communication

### Internal Escalation Chain
```
Engineer detects → #incidents Slack channel
  → < 5 min: Tech Lead acknowledges
  → < 15 min: Assess severity, create incident channel
  → < 30 min (SEV-1): Founder notified
  → < 1 hour: Status page updated (studentos.app/status)
```

### User Communication Templates

**SEV-1 (Financial Impact)**
> "We've identified an issue affecting wallet transactions. All wallets have been temporarily paused while we resolve this. No funds have been lost. We'll update you within [X] hours. We apologize for the disruption."

**SEV-2 (Feature Down)**
> "We're aware of an issue with [feature]. Our team is actively working on a fix. Expected resolution: [time]. You can still use [alternative]."

**SEV-3 (Minor)**
> Handled via in-app notification after resolution. No proactive communication needed.

---

## Incident Post-Mortem Template

```markdown
# Incident Post-Mortem: [INC-XXX]
Date: YYYY-MM-DD
Severity: SEV-N
Duration: Xh Ym
Impact: [affected users / features]

## Timeline
HH:MM — Detection
HH:MM — First response
HH:MM — Root cause identified
HH:MM — Fix deployed
HH:MM — Incident resolved

## Root Cause
[5 Whys analysis]

## Contributing Factors
- [Factor 1]
- [Factor 2]

## What Went Well
- [Positive 1]

## Action Items (with owner + due date)
- [ ] [Action] — @owner — YYYY-MM-DD
```

---

## CHANGELOG Format

```markdown
# CHANGELOG

## [1.0.1] — 2026-05-15
### Fixed
- Wallet: atomic debit prevents race condition (DEBT-001)

### Security
- LiveSession: stream_key removed from client entity (DEBT-002)

## [1.0.0] — 2026-05-10
### Added
- Initial public launch
- Social feed, creator profiles, live streaming
- Wallet, gifts, payouts
``