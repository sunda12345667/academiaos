# StudentOS — Developer Experience Standards

**Version:** 1.0  
**Audience:** All engineers contributing to StudentOS  
**Goal:** Consistent, high-velocity, low-defect development across all domains

---

## 1. Repository Structure

```
src/
├── api/                    # Base44 SDK client (singleton)
├── agents/                 # AI agent configs (JSON)
├── components/
│   ├── ui/                 # shadcn primitives — NEVER modify
│   ├── layout/             # AppShell, Sidebar, MobileNav, RightPanel
│   ├── feed/               # Feed-specific components
│   ├── auth/               # Guards, permission gates
│   └── {domain}/           # One folder per domain (social/, wallet/, creator/)
├── docs/                   # Architecture docs (this folder)
├── entities/               # JSON schemas — one file per entity
├── functions/              # Backend functions (Deno deploy)
├── hooks/                  # Custom React hooks
│   └── use{Feature}.js     # camelCase, use prefix always
├── lib/
│   ├── errors/             # ErrorBoundary, error types
│   ├── infra/              # logger, retry, perf, flags, event-queue
│   └── realtime/           # RealtimeBus, PresenceBus
├── pages/                  # Route-level components (lazy-loaded)
├── providers/              # React context providers
└── services/
    ├── ai/                 # AI gateway, personalization, study assistant
    ├── analytics/          # Watch events, analytics queries
    ├── auth/               # Permissions, RBAC, security events
    ├── community/          # Groups, membership
    ├── creator/            # Creator profiles, tiers, monetization
    ├── engagement/         # Reactions, scores, streaks, trending
    ├── feed/               # Feed construction, ranking engine
    ├── growth/             # Onboarding, retention, viral, analytics
    ├── live/               # Live session management
    ├── media/              # File upload, media processing
    ├── messaging/          # DMs, conversations
    ├── moderation/         # Reports, content moderation, ML
    ├── notifications/      # Notification CRUD, dispatch
    ├── ops/                # Admin audit, trust safety, ad platform
    ├── recommendation/     # Content recommendations
    ├── social/             # Graph, follows, notification events
    ├── user/               # User profile management
    └── wallet/             # Fintech: wallet, ledger, payment, payout, risk
```

---

## 2. Naming Conventions

### Files
```
pages/       PascalCase.jsx         → Home.jsx, CreatorDashboard.jsx
components/  PascalCase.jsx         → PostCard.jsx, AvatarStack.jsx
hooks/       useCamelCase.js        → useFeed.js, useWallet.js
services/    kebab-case.service.js  → wallet.service.js, feed.service.js
providers/   PascalCase.jsx         → WalletProvider.jsx
entities/    PascalCase.json        → UserProfile.json
functions/   camelCase (no ext)     → paystackWebhook
```

### Variables & Functions
```js
// Services: verb-noun pattern
export async function createPost(...)       // ✅
export async function getCreatorProfile()   // ✅
export async function postCreate(...)       // ❌

// Hooks: use + noun
export function useWallet()                 // ✅
export function walletHook()               // ❌

// Event handlers in components: handle + Event
const handleSubmit = () => {}              // ✅
const onSubmit = () => {}                  // ✅ (React convention — both acceptable)
const submitHandler = () => {}             // ❌

// Boolean variables: is/has/can/should prefix
const isLoading = true                     // ✅
const loading = true                       // ❌ (ambiguous)
const canPost = true                       // ✅
const hasFollowers = true                  // ✅
```

### Constants
```js
// SCREAMING_SNAKE_CASE for module-level constants
export const MAX_GIFT_AMOUNT_KOBO = 1000000;   // ✅
export const maxGift = 1000000;                 // ❌

// Object constant groups
export const FEE = { PLATFORM_PERCENT: 0.10 }  // ✅
```

---

## 3. Service Ownership Boundaries

Each domain team owns exactly one service folder. Cross-domain calls follow these rules:

```
ALLOWED cross-domain calls (one-way only):
  notification.service  ← called by any domain (it's infrastructure)
  user.service          ← called by any domain (identity is shared)
  engagement.service    ← called by feed, creator, growth
  
FORBIDDEN cross-domain calls:
  wallet.service → notification.service  ✅ allowed (financial events notify)
  notification.service → wallet.service  ❌ creates circular dependency
  feed.service → wallet.service          ❌ feed has no business touching finances
  moderation.service → growth.service    ❌ separate concerns

Rule: Lower-level services (wallet, user, notification) can NEVER import from
      higher-level services (feed, growth, creator).
```

### Domain Dependency Graph (allowed directions only)
```
infrastructure (logger, retry, flags, events)
      ↑
identity (user.service, auth/permissions)
      ↑
   ┌──┴──────────────────────────┐
social   fintech   content   comms
graph    wallet    post      notification
   └──┬──────────────────────────┘
      ↑
creator   feed   community   moderation
      ↑
growth   recommendation   AI
      ↑
  (no imports from below this line)
```

---

## 4. Component Rules

### Component Responsibilities
```
Page (pages/)          — Route, data fetching, layout orchestration
                          Max: 200 lines. Split into sections if larger.

Section component      — A named region within a page (HeroSection, FeedSection)
                          Max: 150 lines.

Leaf component         — Atomic UI (PostCard, AvatarBadge, StatWidget)
                          Max: 100 lines. Zero data fetching.

Container component    — Manages a hook + renders a section/leaf
                          Example: FeedContainer uses useFeed, renders PostCards
```

### Data Fetching Rules
```
DO: fetch in hooks (useFeed, useWallet, useCreator)
DO: fetch in page-level components (then pass as props)
DON'T: fetch in leaf components (PostCard, Badge, StatWidget)
DON'T: call base44.entities.* directly in any component
```

### Props & State Rules
```js
// Destructure at component top
function PostCard({ post, onLike, onShare }) { ... }  // ✅

// Never mutate props
function BadCard({ post }) {
  post.liked = true;  // ❌ NEVER
}

// Derive state from props, don't copy
function GoodCard({ initialPost }) {
  const [liked, setLiked] = useState(initialPost.liked);  // ✅ (tracks user action)
}
```

---

## 5. Testing Strategy Readiness

### Test Pyramid (target when CI is set up)

```
E2E Tests (Playwright)          — 10-20 critical user journeys
  ├── Sign up + onboarding
  ├── Post create → feed appear
  ├── Gift send → wallet debit + creator credit
  ├── Wallet topup → Paystack → credit confirmed
  └── Moderation: report → escalate → resolve

Integration Tests (Vitest + MSW)  — 50-100 service-level tests
  ├── wallet.service: credit/debit/transfer/race-condition
  ├── notification.intelligence: caps, quiet hours, priority
  ├── engagement.service: streaks, score computation
  ├── feed.service: ranking, blending, dedup
  └── viral.service: referral attribution, code generation

Unit Tests (Vitest)               — 100-200 pure function tests
  ├── ranking.engine: computeEngagementScore, blendFeedStreams
  ├── risk.engine: fraud signal scoring
  ├── trust.safety: trust score calculation
  └── permissions: can(), canAny(), isAtLeastRole()
```

### Test File Location
```
services/wallet/wallet.service.test.js       ← co-located
services/engagement/engagement.service.test.js
lib/infra/retry.test.js
```

### Mock Pattern (MSW for Base44 SDK)
```js
// tests/mocks/base44.mock.js
import { http, HttpResponse } from 'msw';

export const walletHandlers = [
  http.get('/api/entities/Wallet', ({ request }) => {
    return HttpResponse.json([mockWallet]);
  }),
];
```

### Wallet Test Requirements
Every wallet mutation MUST have tests for:
1. Happy path (successful credit/debit)
2. Insufficient balance (debit rejection)
3. Frozen wallet (all operations rejected)
4. Duplicate idempotency key (no-op return)
5. Concurrent call simulation (race condition detection)

### Realtime Test Strategy
```js
// Mock RealtimeBus in component tests
vi.mock('@/lib/realtime/RealtimeBus', () => ({
  default: {
    subscribe: vi.fn(() => vi.fn()),  // returns unsubscribe fn
    unsubscribe: vi.fn(),
  }
}));
```

---

## 6. Pull Request Standards

### PR Title Format
```
feat(wallet): add optimistic lock to creditWallet
fix(feed): prevent duplicate posts on realtime reconnect
refactor(notification): unify dispatch path to intelligence layer
chore(deps): upgrade @base44/sdk to 0.8.30
docs(arch): update ARCHITECTURE_AUDIT with TD-07 fix
test(wallet): add concurrent credit race condition test
```

### PR Checklist (required before merge)
- [ ] No `base44.entities.*` called directly from components
- [ ] No new `console.log` statements (use `logger.info/warn/error`)
- [ ] All async operations have loading + error states in UI
- [ ] No hardcoded hex colors (use token classes)
- [ ] New services have JSDoc on every exported function
- [ ] Cross-domain service imports follow dependency graph
- [ ] No `any` TypeScript type (when TS is added)
- [ ] Mobile breakpoint tested (375px minimum)

### Review Guidelines
- **Security changes** (wallet, auth, moderation): require 2 reviewer approvals
- **Schema changes** (entities/*.json): require architecture review
- **New provider added**: requires review of provider tree in services/README.md
- **New entity added**: requires entry in ARCHITECTURE_AUDIT.md entity inventory

---

## 7. Documentation Standards

### Service File Header (required)
```js
/**
 * [Service Name] — [One-line purpose]
 *
 * [2-3 sentences describing what this service owns and why]
 *
 * Architecture:
 *   - [Key design decision 1]
 *   - [Key design decision 2]
 *
 * Migration note:
 *   [What changes when moving off Base44 / to NestJS]
 */
```

### Function JSDoc (required for all exports)
```js
/**
 * [What it does in one line]
 * [Optional: why it exists, non-obvious behavior]
 *
 * @param {string} userId
 * @param {object} opts
 * @param {number}  opts.amount  - Amount in kobo
 * @returns {Promise<{ transaction, newBalance }>}
 * @throws {Error} If wallet is frozen or insufficient balance
 */
export async function creditWallet(userId, opts) { ... }
```

### Architecture Decision Records (ADRs)
Create `docs/adr/ADR-NNN-title.md` for any decision that:
- Affects 3+ services
- Introduces a new pattern
- Changes an existing contract
- Has significant trade-offs

Format: Context → Decision → Consequences (positive + negative)

---

## 8. Linting & Formatting Readiness

When CI is configured, enforce:

```json
// .eslintrc.json (recommended rules)
{
  "rules": {
    "no-console": ["warn", { "allow": ["warn", "error"] }],
    "no-unused-vars": "error",
    "react-hooks/exhaustive-deps": "error",
    "react-hooks/rules-of-hooks": "error",
    "import/no-cycle": "error",
    "no-direct-entity-access": "error"  // custom rule — blocks base44.entities.* in components
  }
}
```

```json
// .prettierrc
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100
}
```

### Custom ESLint Rule (future): `no-direct-entity-access`
Enforce that `base44.entities.*` is only called from files matching `services/**/*.js` or `functions/**`.