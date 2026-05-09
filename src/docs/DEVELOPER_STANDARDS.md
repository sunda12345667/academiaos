# StudentOS — Developer Standards & Governance
*v1.0 | 2026-05-09*

---

## Code Organization

### Directory Rules

```
src/
  api/              Base44 client initialization only. No business logic.
  components/
    ui/             shadcn/ui primitives — NEVER modified directly
    layout/         App shell, navigation (AppShell, Sidebar, BottomNav)
    feed/           Feed-domain components (FeedContainer, PostCard, etc.)
    auth/           Auth guards (RequireRole, AccountStatusGuard)
    social/         Social components (SuggestedUsers, FollowButton)
    groups/         Group-domain components
    [domain]/       Each domain owns its components
  docs/             Architecture docs, audits, roadmaps
  entities/         JSON schema definitions only
  hooks/            React hooks — stateful, component-facing
  lib/
    errors/         Error boundary, AppError class
    infra/          Logger, perf, retry, flags, event-queue, bootstrap
    realtime/       RealtimeBus, PresenceBus
    utils.js        Pure utility functions
  pages/            One file per route. Minimal logic — delegate to hooks/services.
  providers/        React context providers (Feed, Notification, Messaging, etc.)
  services/
    [domain]/       All business logic grouped by domain
    README.md       Architecture reference (auto-maintained)
  repositories/     (FUTURE) Typed data access layer over base44.entities
  utils/            Shared pure utilities (date, format, string, etc.)
```

### File Size Rules
- Pages: max 150 lines. Extract to components/ if larger.
- Components: max 120 lines. Extract sub-components if larger.
- Services: max 300 lines per file. Split by concern if larger.
- Hooks: max 100 lines. Delegate heavy logic to services.

---

## Naming Conventions

### Files
```
PascalCase.jsx        — React components (pages, components)
camelCase.js          — Services, hooks, utilities
kebab-case.md         — Documentation
SCREAMING_SNAKE.md    — Architecture documents (README, ARCHITECTURE, etc.)
EntityName.json       — Entity schemas
```

### Variables & Functions
```js
// Services: verb + noun
async function getCreatorProfile(profileId) {}
async function creditWallet(userId, opts) {}
async function computeTrustScore(profile, creator) {}

// Hooks: use + domain noun
function useFeed(feedType, config) {}
function useCurrentUser() {}
function useOnboarding() {}

// Constants: SCREAMING_SNAKE
const TIER_THRESHOLDS = {};
const HALF_LIFE_HOURS = 6;

// Private helpers: underscore prefix
function _computeDecay(ageHours) {}
function _getCountField(type) {}

// React components: PascalCase
function PostCard({ post, onLike }) {}
function FeedContainer({ feedType }) {}
```

### Entity Field Naming
```
snake_case for all entity fields
_id suffix for foreign keys: author_id, user_id, recipient_id
_at suffix for timestamps: created_at, started_at, resolved_at
_count suffix for counters: like_count, follower_count
_url suffix for media: avatar_url, media_url, thumbnail_url
_status for state machines: account_status, moderation_status
```

---

## Service Contract Rules

### Public Service API Rules

1. **Every public function is documented** with JSDoc `@param`, `@returns`, and a Migration note
2. **Every function that writes to DB returns the written record** (not just `{ success: true }`)
3. **Every function with financial impact accepts an `idempotencyKey`**
4. **Errors are thrown, never swallowed** — unless explicitly fire-and-forget (marked with `.catch(() => {})`)
5. **No cross-domain entity writes** — services only write to their owned entities (see ownership map in ARCHITECTURE_AUDIT.md)

### Fire-and-Forget Pattern
```js
// CORRECT: explicitly marked
notificationEvents.onPostLiked(actor, recipientId, postId).catch(() => {});
eventQueue.contentView(postId, 'post', 'feed_home'); // always F&F

// WRONG: swallowing real errors
try {
  await walletService.creditWallet(userId, opts);
} catch (e) {
  // never do this for financial operations
}
```

### Hook Rules

1. Hooks own local state + bridge to services. No raw `base44.entities` calls in hooks.
2. Hooks use react-query for server-fetched non-realtime data.
3. Realtime state lives in Providers, not hooks (hooks read from provider context).
4. Every hook exposes `loading` and handles the `null` profile case gracefully.
5. Hooks never call other hooks that own different domain state (no cross-hook dependencies).

---

## State Governance

### State Ownership Matrix

| State Type | Owner | Access Pattern |
|-----------|-------|---------------|
| Auth user + profile | `UserProvider` | `useCurrentUser()` |
| Feed posts | `FeedRealtimeProvider` → `useFeed()` | Per-feed hook instance |
| Notifications | `NotificationProvider` | `useNotificationStore()` |
| Messaging | `MessagingProvider` | `useConversation(id)` |
| Live sessions | `LiveSessionProvider` | `useLiveSessionStore()` |
| Wallet | `WalletProvider` | `useWallet()` |
| Server queries | react-query cache | `useQuery()` in page hooks |
| Ephemeral UI | local `useState` | Component-local |
| Analytics | event-queue (write-only) | `eventQueue.track()` |

### What Goes in Each Layer

```
Provider state  → realtime-mutated data (changes via subscription)
react-query     → server-fetched data with caching (not realtime)
local state     → UI-only (modal open, tab selection, form values)
service layer   → business logic, no state
```

### Provider Nesting Order (AppShell)
```
FeedRealtimeProvider          (Post subscription)
  NotificationProvider        (Notification subscription)
    AccountStatusGuard        (hard-blocks banned/suspended)
      MessagingProvider       (Message + Conversation subscription)
        WalletProvider        (Transaction subscription)
          LiveSessionProvider (LiveSession subscription)
            ErrorBoundary (route-level)
              Suspense
                <Outlet />
```
**Rule:** Never add a new provider without updating this diagram in AppShell.jsx comment.

---

## Event Taxonomy

### Analytics Event Schema (event-queue)
```js
eventQueue.track(domain, action, properties)

// Domains: session, content, social, search, ai, finance, notification,
//          onboarding, retention, viral, experiment, error

// Required properties on ALL events:
{
  timestamp: auto-set by event-queue,
  correlationId: auto-set by logger,
  userId: set via eventQueue.setUserId() on auth
}

// Action naming: snake_case verb_noun
// content_viewed, creator_followed, post_shared, payment_initiated
// notification_sent, achievement_unlocked, referral_attributed
```

### Banned Event Anti-Patterns
```js
// ❌ Never track PII
eventQueue.track('social', 'user_searched', { query: 'Ada Okonkwo' }); // contains name

// ❌ Never track financial amounts in plain events
eventQueue.track('finance', 'payment', { creditCard: '4111...' });

// ❌ Never fire events in render (causes duplicate tracking)
function PostCard() {
  eventQueue.contentView(postId); // ❌ fires on every re-render
  useEffect(() => { eventQueue.contentView(postId); }, []); // ✅ fires once
}
```

---

## Design System Standards

### Typography Scale
```css
/* Headings — Plus Jakarta Sans */
h1: text-2xl font-bold font-jakarta    (24px, page titles)
h2: text-xl font-semibold font-jakarta (20px, section titles)
h3: text-lg font-semibold font-jakarta (18px, card titles)
h4: text-base font-semibold            (16px, subsection titles)

/* Body — Inter */
body:    text-sm  (14px — primary body text)
caption: text-xs  (12px — metadata, timestamps, labels)
micro:   text-[10px] (10px — badges, tags, counts)
```

### Color Usage Rules
```
text-foreground       — primary content (never hardcode #colors)
text-muted-foreground — metadata, timestamps, secondary labels
text-primary          — interactive elements, links, highlights
text-destructive      — errors, warnings, danger states
bg-background         — page background
bg-card               — card/panel surfaces
bg-muted              — subtle backgrounds, code blocks, tags
border-border         — dividers, input borders
```

### Spacing Scale
```
p-3  / gap-3  — tight (card internals, badge padding)
p-4  / gap-4  — default (card padding, list items)
p-6  / gap-6  — comfortable (section padding, modals)
p-8  / gap-8  — spacious (page padding, hero sections)
```

### Component Conventions

**Loading States**
```jsx
// ALWAYS use skeleton, never spinner for content that has a known shape
<PostCardSkeleton />    // known shape
<Skeleton className="h-4 w-32" />  // inline

// Spinners only for actions (button loading, form submitting)
<Button disabled={isLoading}>
  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Submit'}
</Button>
```

**Empty States**
```jsx
// Use shared EmptyState component — never inline empty state text
<EmptyState
  icon={<BookOpen className="w-8 h-8" />}
  title="No posts yet"
  description="Be the first to share something with this group."
  action={<Button>Create Post</Button>}
/>
```

**Error States**
```jsx
// Component-level: ErrorBoundary (automatic)
// Data error: inline message with retry
{error && <p className="text-destructive text-sm">{error.message} <button onClick={retry}>Retry</button></p>}
```

**Toast Notifications**
```jsx
import { toast } from 'sonner';
toast.success('Post published!');
toast.error('Something went wrong. Please try again.');
// Never use alert() or console.log() for user-facing messages
```

### Animation Rules
```
Framer Motion for: page transitions, modal appears, card stacks
Tailwind animate-* for: loading states, skeleton pulse, spin
CSS transition for: hover states, color changes (transition-colors duration-150)

Animation duration:
  Micro:   150ms (hover, tab switch)
  Standard: 200ms (modal, popover)
  Slow:    300ms (page transition, slide-up sheet)

Disabled for: reduced-motion (respect prefers-reduced-motion)
```

### Accessibility Standards
```
All interactive elements: keyboard navigable (Tab + Enter/Space)
Images: always alt text (or alt="" for decorative)
Form inputs: always paired with <Label>
Error messages: aria-describedby pointing to input
Color contrast: minimum AA (4.5:1) for body text, 3:1 for large text
Loading: aria-live="polite" for async content areas
Icons without text: aria-label or title prop
```

---

## Pull Request Standards (Future Multi-Engineer Setup)

### PR Title Format
```
feat(feed): add pagination to following feed
fix(wallet): resolve race condition in debitWallet
refactor(notifications): unify dispatch to intelligence layer
docs(arch): update provider nesting diagram
test(engagement): add PostInteraction batch lookup tests
chore(deps): update framer-motion to 11.x
```

### PR Checklist
- [ ] No new raw `base44.entities.*` calls in hooks or components (use services)
- [ ] No `console.log()` left in production code (use `logger.*`)
- [ ] No hardcoded colors or spacing (use design tokens)
- [ ] New analytics events follow event taxonomy schema
- [ ] Financial mutations include idempotency key
- [ ] New notifications go through `notification.intelligence.sendIntelligentNotification()`
- [ ] Services only write to their owned entities (ownership map)
- [ ] Loading + empty + error states handled in any new UI component

---

## Testing Strategy

### Phase 1 — Critical Path Integration Tests (Before Launch)
Priority: wallet operations, auth, moderation actions

```js
// Example: wallet debit idempotency test
describe('walletService.debitWallet', () => {
  it('returns same result on duplicate idempotency key', async () => {
    const key = 'test_' + Date.now();
    const r1 = await walletService.debitWallet(userId, { amount: 1000, idempotencyKey: key, ... });
    const r2 = await walletService.debitWallet(userId, { amount: 1000, idempotencyKey: key, ... });
    expect(r2.idempotent).toBe(true);
    expect(r2.transaction.id).toBe(r1.transaction.id);
  });
});
```

### Phase 2 — Hook Tests (Before Team Scaling)
- `useFeed` — pagination, realtime update reconciliation
- `useWallet` — balance display, optimistic updates
- `useOnboarding` — step completion, XP calculation

### Phase 3 — E2E Critical Journeys (Before 1k Users)
Playwright tests:
1. Signup → onboarding → first post → notification received
2. Gift send → creator wallet credit → realtime balance update
3. Payout request → manual review → approved → bank transfer
4. Content flagged → moderation queue → removed → appeal filed
5. Referral link → new user signs up → referrer rewarded

### Phase 4 — Load Testing (Before 10k Users)
- Feed load test: 500 concurrent users loading home feed simultaneously
- Gift storm: 100 simultaneous gifts to same creator (wallet concurrency test)
- Notification fanout: 1 post → 10k follower notifications (via scheduled job)

---

## Migration Readiness

### Phase 1: Repository Layer (Month 1)
Extract all `base44.entities.*` calls into typed repository files.
```
repositories/
  post.repository.js
  user.repository.js
  wallet.repository.js
  notification.repository.js
  transaction.repository.js
```
Services import repos. Base44 SDK isolated to repositories only.
**Migration blast radius:** Only `repositories/` needs to change on NestJS migration.

### Phase 2: Backend Functions (Month 2-3)
Move write-heavy operations to backend functions:
- `atomicDebitWallet` — resolves DEBT-001
- `markAllNotificationsRead` — resolves DEBT-004
- `expirePaymentIntents` — resolves DEBT-014
- `computeCreatorAnalytics` — resolves DEBT-013 (scheduled)
- `cleanupExpiredRecommendations` — resolves DEBT-010

### Phase 3: NestJS Migration (Month 4-6)
Services map directly to NestJS modules:
```
services/wallet/      → WalletModule (NestJS)
services/feed/        → FeedModule
services/social/      → SocialModule
services/moderation/  → ModerationModule
services/creator/     → CreatorModule
services/notifications/ → NotificationsModule
```
Repositories become TypeORM repositories.
RealtimeBus → WebSocket gateway (Socket.io or WS).
event-queue → Kafka producer.

### Phase 4: Data Infrastructure (Month 6+)
```
PostgreSQL          — core entities (replaces Base44 DB)
Redis               — sessions, streaks, presence, rate limits, distributed locks
Kafka               — event streaming (WatchEvent, analytics, notification fanout)
ClickHouse          — OLAP queries (DAU/WAU, retention cohorts, funnels)
CDN (Cloudflare R2) — media uploads (replaces Base44 UploadFile)
``