# StudentOS — Feed Experience & Creator UX
*v1.0 | 2026-05-09*

---

## 1. Feed Post Card Architecture

### Card Anatomy (mobile, all post types)

```
┌─────────────────────────────────────────┐
│ [Avatar 40px] [Name + tier badge]  [···] │  ← Header: 52px
│               [@username · timestamp]   │
├─────────────────────────────────────────┤
│                                         │
│  [MEDIA — full bleed, no horizontal    │  ← Media: auto height
│   padding. Image/Video/Poll/Text]       │     (4:3, 1:1, or 16:9)
│                                         │
├─────────────────────────────────────────┤
│ Caption (2–3 lines, truncated)          │  ← Content: 16px padding
│ #hashtag #hashtag @mention              │
├─────────────────────────────────────────┤
│ [❤️ 127] [💬 34] [↗ Share] [🎁] [···] │  ← Actions: 48px
└─────────────────────────────────────────┘

Post card is NOT a static rectangle. It is a living unit:
  - View count increments in realtime during scroll
  - Like count animates when others like during your session
  - "Trending" badge appears dynamically when engagement spikes
  - "3 friends liked this" social proof layer appears if applicable
```

### Dynamic Signals On Cards

```
Trending signal:
  Small fire badge (🔥) top-right overlay when:
    post.engagement_score > percentile(90, last_6_hours)
  Text: "Trending at [School]" (school-scoped trending)

Social proof overlay:
  Below creator name: "Ada and 4 others from your school liked this"
  Source: batch-check following interactions (interaction.repository.js)
  Shown when: ≥ 2 people in user's social graph interacted

Realtime view counter:
  Shows when: post < 24 hours old
  Format: "1.2k views" (animated ticker when new views arrive)
  Updates via: RealtimeBus Post subscription
```

---

## 2. Feed Content Hierarchy

### Visual Priority Tiers

```
TIER 1 — LIVE SESSION CARD (highest weight)
  Full-width banner, 200px tall
  Red pulsing border animation
  "● LIVE • 47 watching" badge (upper left)
  Creator avatar + session title
  "Join Now" CTA button (primary, full-width)
  Never compresses. Always prominent.

TIER 2 — VIDEO POST
  Autoplay (muted) when 80% in viewport
  Duration badge: top-right
  Play/pause: tap center
  Action bar overlaid on video (semi-transparent bg)
  
TIER 3 — IMAGE POST (single)
  Full-bleed, 4:3 ratio
  Tap → lightbox full-screen view
  Swipe in lightbox → next image in same post

TIER 4 — IMAGE POST (multi)
  2-up grid preview (swipeable horizontal inside card)
  "1/4" counter top-right
  
TIER 5 — TEXT POST
  Background: creator brand color OR campus color (soft gradient)
  Short text (< 80 chars): 24px centered, impactful
  Long text: 16px, left-aligned, 4-line truncation + "Show more"
  
TIER 6 — POLL
  Real-time vote bars (animate on vote + on new votes from others)
  Vote triggers optimistic bar expansion instantly
  Results visible before voting (transparency builds trust)
```

---

## 3. Infinite Feed Psychology

### Pre-fetch Strategy

```
Trigger: User is 3 posts from bottom of loaded content
Action: Fetch next 10 posts silently
Result: User never encounters empty feed bottom
Never show: "Loading more posts..." spinner at bottom
Show instead: Continued content seamlessly appearing
```

### Feed Freshness Signals

```
New posts while reading (from follows):
  → Floating pill at top: "↑ 3 new posts"
  → Tap: smooth scroll to top, new posts appear
  → Auto-refresh: NEVER (disrupts reading position)

Caught up state (seen all following posts):
  → Don't show empty state — inject discover content
  → Soft label: "You're caught up · Explore more →"
  → Continue with discover-ranked content below (no visual break)

Long session (30 min):
  → No forced interruption
  → Subtle tab-switch suggestion: "Try the Video feed" as a card injection
```

---

## 4. Post Interaction Design

### Like System

```
Tap like button:
  1. Heart fills red instantly (0ms — optimistic)
  2. Scale pulse: 1.0 → 1.35 → 1.0 (120ms spring)
  3. Particle burst: 6 small hearts scatter + fade (300ms staggered)
  4. Count increments with translateY -12px animation
  5. Haptic: light impact
  
Double-tap anywhere on media:
  Same as above PLUS:
  Large heart (80px) appears at tap point, fades (scale 0 → 1.2 → 1.0, opacity 1 → 0, 600ms)
  
Unlike:
  Heart empties (fill → outline, 80ms)
  Count decrements
  No particle burst (undoing is quieter than doing)
```

### Comment Sheet

```
Trigger: Comment button tap
Opens: Bottom sheet (not new page — keeps feed context)
Sheet height: 70vh (snap points: 40% / 70% / 95%)

Structure:
  [Handle bar]
  [Comment count] · [Sort: Top / Recent]
  ──────────────
  [Comment list (scrollable inside sheet)]
  ──────────────
  [User avatar] [Comment input] [Send →]
  [Keyboard pushes sheet up, input stays visible]
  
Comment posting:
  Optimistic: appears instantly at bottom of list with pending state (opacity 0.7)
  Confirmed: full opacity, timestamp appears
  Failed: red outline + "Retry" inline
  
Reply:
  Swipe right on comment → reply input pre-filled with @username
  (same gesture as WhatsApp/iMessage — familiar)
```

---

## 5. Creator Dashboard UX

### Dashboard Philosophy

The creator dashboard must answer three questions without scrolling:
1. **Am I growing?** (follower delta this week)
2. **Am I earning?** (revenue this week + lifetime)
3. **What should I do?** (single AI insight)

### Dashboard Layout (mobile, above fold)

```
┌──────────────────────────────────────────────┐
│  Good morning, Tunde ☀️    [🔥 Streak: 12d] │
│                                               │
│  ┌─────────────────┐  ┌─────────────────┐   │
│  │  This week      │  │  Lifetime       │   │
│  │  ₦12,400 ↑23%  │  │  ₦87,000        │   │
│  └─────────────────┘  └─────────────────┘   │
│                                               │
│  ┌──────────┐ ┌──────────┐ ┌──────────────┐ │
│  │ +127     │ │ 8.2%     │ │ 23k          │ │
│  │ Followers│ │ Engage   │ │ Total views  │ │
│  └──────────┘ └──────────┘ └──────────────┘ │
│                                               │
│  [✦ AI] Post at 6PM today for 2× reach       │
│                                               │
│  [+ Post]        [🔴 Go Live]                │
└──────────────────────────────────────────────┘
```

### Creator Analytics: Narrative Over Numbers

```
WRONG (data dump):
  "Followers: 847 (+128). Views: 12,400. ER: 7.2%"

RIGHT (insight narrative):
  "Your Thursday post on thermodynamics drove 73% of this week's growth.
  Engineering students from OAU are your fastest-growing audience.
  Best time to post tomorrow: 5PM–7PM (based on your audience activity)"

Implementation: AI-generated daily summary (InvokeLLM, cached per creator, refreshed daily)
```

### Milestone Celebration UX

```
TIER UPGRADE (Basic → Pro → Verified → Elite):
  Trigger: Requirements met
  
  Step 1: Earnings/follower widget pulses (500ms glow pulse)
  Step 2: Full-screen overlay slides up from bottom
  Step 3: New tier badge reveals with spring scale (0 → 1.1 → 1.0)
  Step 4: List of unlocked features slides in (staggered, 100ms each)
  Step 5: Two CTAs: "Start earning →" + "Share this moment →"
  
  Share: Auto-generates card: "[Name] is now a Pro Creator on StudentOS"
  This is the viral loop: creator celebrates → posts to social → attracts new users

FIRST EARNING:
  Wallet balance widget pulses
  Tap → coin fall animation (10 coins from top, physics arc)
  Text reveals: "Your first ₦[X]. Someone paid to appreciate you. This is real."
  Toast: "Ready to withdraw? Or keep growing."

FOLLOWER MILESTONES (100, 500, 1k, 5k, 10k):
  Follower count animates from N-5 to N (ease-out)
  Confetti burst (small scale, tasteful)
  Full-screen prompt: share the milestone
```

---

## 6. Live Session UX

### Pre-Live Setup (3 steps max)

```
Step 1 — Session Identity (30 seconds)
  Title input [required]
  Type chips: [Lecture] [Q&A] [Study Room] [Broadcast]
  Schedule: [Now] [Later → datetime picker]
  [Continue →]

Step 2 — Audience & Settings (skippable)
  Visibility: [Public] [Followers] [School Only]
  Allow gifts: toggle (ON by default)
  Moderation: [Open] [Slow] [Subscribers Only]
  [Continue →] or [Skip]

Step 3 — Camera Check
  Camera preview fills screen
  Mic waveform (visual feedback: "you're being heard")
  [Flip camera] icon top-right
  [Go Live — 5...4...3...2...1] countdown button
```

### In-Live Creator HUD (Head-Up Display)

```
TOP BAR (transparent overlay):
  Left: [● LIVE] + duration timer
  Center: session title (truncated)
  Right: 👁 [viewer count] 🎁 [earned today]

RIGHT SIDE:
  Floating emoji reactions from viewers (upward drift, fade out)
  Max 12 concurrent (density cap)

CENTER (when gift received):
  Gift animation overlay (see Motion Architecture doc)

BOTTOM SECTION (25% of screen):
  Pinned question (if set): teal background, creator controls below
  Live chat: last 3 messages, auto-scroll paused by user scroll
  Chat input (creator's own messages)
  
BOTTOM CONTROL BAR:
  [📌 Pin] [🔇 Mute] [🔁 Flip] [💬 Chat mode] [✕ End Live]
  
End Live confirmation: bottom sheet (not full modal)
  "End this session?" [Cancel] [End + Post Replay]
```

### Gift Animation System

```
TIER 1 — Common (< 500 coins):
  Duration: 400ms
  Single emoji floats from gift button → fades at top-right
  Sender name shown for 1.5s in chat area: "Ada sent 📚"

TIER 2 — Rare (500–1,999 coins):
  Duration: 1.2s
  Center-screen: emoji appears (spring scale 0→1)
  Banner: "[Sender] sent a [Gift Name]!" (slides in from bottom)
  Auto-dismisses after 1.2s

TIER 3 — Epic (2,000–9,999 coins):
  Duration: 2.5s
  Screen dims (backdrop 60%)
  Animated gift asset (Lottie) fills center
  Sender + gift name in large type
  Particle burst
  Earnings counter animates upward

TIER 4 — Legendary (10,000+ coins):
  Duration: 4s (this is a social event)
  Full black flash → cinematic Lottie animation
  Sender name in hero text
  Chat simulates viewer reactions cascading
  Creator's session earnings counter animates
  Audio: brief fanfare (respects device mute)
  Stream resumes at 4s
``