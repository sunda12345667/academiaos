# StudentOS — Navigation Architecture & Design System
*v1.0 | 2026-05-09*

---

## 1. Navigation Architecture

### Bottom Navigation (mobile primary)

```
5-tab layout (optimal for one-hand use):

[🏠 Home] [🔍 Discover] [➕ Create] [👥 Groups] [👤 Profile]

Rules:
  - Home (far left): main feed, most-used, dominant thumb position
  - Discover (second): search + trending + explore
  - Create (center): FAB-style, elevated, primary action of the platform
  - Groups (second right): campus community
  - Profile (far right): identity + settings + earnings
  
  Active state: icon fills + label appears (inactive: icon outline only, no label)
  Badge: red dot (unread notifications / new followers) on Home + Profile
  Create button: gradient background (brand indigo → violet), no label needed
```

### Create FAB Behavior (center tab)

```
Single tap: Opens creation mode chooser (bottom sheet):
  [📝 Post]  [📸 Photo]  [🎥 Video]  [📊 Poll]  [🔴 Go Live]
  
Long press: Direct to last-used creation type (power user shortcut)

Creator-specific additions (Pro tier+):
  + [📚 Add to Course]
  + [📅 Schedule Post]
```

### Desktop Sidebar Navigation

```
Width: 256px (standard) / 288px (xl screens)
Background: sidebar-background token (dark navy)

Structure:
  [Logo + brand mark]
  ──────────────────
  🏠 Home
  🔍 Discover
  👥 Groups
  📚 Learn
  🛒 Marketplace
  💰 Wallet
  ──────────────────
  [Creator shortcut: + Create / 🔴 Go Live (if creator)]
  ──────────────────
  🔔 Notifications (with unread count badge)
  👤 Profile
  ⚙️  Settings
  ──────────────────
  [User card: avatar + name + tier badge + wallet balance]
```

### Contextual Navigation (page-level)

```
Feed page: Feed type tabs (Following | For You | Video) below mobile header
Groups page: My Groups | Discover Groups tabs
Profile page: Posts | Live | Courses | Saved (horizontal scrollable tabs)
Creator Dashboard: Overview | Posts | Live | Analytics | Earnings tabs
Wallet: Overview | Transactions | Payouts | Top Up
```

---

## 2. Search & Discovery Architecture

### Search-First Discovery (Discover tab)

```
Default state (no query):
  1. Search bar (full-width, auto-focused on tab enter)
  2. "Trending at [user's school]" horizontal scroll
  3. "Popular this week" topic pills
  4. "Creators you might like" (3-4 cards, horizontal scroll)
  5. "Active groups on your campus"
  6. "Trending content" vertical feed

Query entered:
  - Real-time results as typing (debounced 300ms)
  - Results sections: People | Posts | Groups | Courses | Hashtags
  - Recent searches (local storage, max 8)
  - School-boosted results (same campus users ranked higher)
  
Voice search: microphone icon in search bar (Phase 2)
```

---

## 3. Typography System

### Type Scale

```
Font family hierarchy:
  Display (hero text, feed card large titles): Plus Jakarta Sans
  Body (all paragraph text, captions, UI labels): Inter
  Mono (code blocks, wallet amounts, stats): JetBrains Mono (Phase 2 addition)

Scale (mobile-first, all in rem):
  display-xl:   3.0rem  (48px) — Onboarding hero, milestone splash screens
  display-lg:   2.25rem (36px) — Profile name on profile page
  display-md:   1.875rem(30px) — Section headers
  heading-lg:   1.5rem  (24px) — Card titles, modal headings
  heading-md:   1.25rem (20px) — Feed post usernames
  heading-sm:   1.125rem(18px) — Tab labels (active state)
  body-lg:      1rem    (16px) — Post body text, messages
  body-md:      0.875rem(14px) — Captions, metadata, secondary info
  body-sm:      0.75rem (12px) — Timestamps, badges, labels
  label:        0.625rem(10px) — Status pills, notification counts

Line height:
  Display: 1.1 (tight, impactful)
  Heading: 1.3 (comfortable)
  Body: 1.6 (readable, generous)
  Label: 1.0 (single-line only)

Letter spacing:
  Display: -0.02em (tighten for large text)
  Label: +0.04em (open up for all-caps labels)
```

### Typography Rules

```
NEVER:
  - Mix more than 2 font sizes in a single card
  - Use Inter for display text (feels corporate)
  - Use Plus Jakarta Sans for body paragraphs (too heavy, tiring at length)
  - Text smaller than 12px on mobile
  - Bold everything — bold loses meaning when overused

ALWAYS:
  - Truncate long text with ellipsis + "Show more" for posts > 3 lines
  - Use tabular-nums for all numeric data (wallet, analytics) — prevents layout jump
  - Right-align numbers in tabular contexts (wallet transactions)
```

---

## 4. Color Emotion System

### Primary Palette

```
Brand tokens (in index.css :root):
  --primary:     245 70% 52%   → Indigo (trust, intelligence, platform identity)
  --accent:      270 80% 60%   → Violet (creativity, creator content, premium)
  --foreground:  222 47% 9%    → Near-black (not pure black — softer)
  --background:  220 20% 98%   → Cool off-white (not warm — feels modern)
  
Semantic colors:
  --success:     158 64% 42%   → Emerald (earnings positive, upload success)
  --warning:     38 92% 50%    → Amber (streak warning, low balance)
  --destructive: 0 84% 60%     → Red (delete, suspend, report)
  --live:        0 72% 51%     → Pure red (live badge — universally understood)
```

### Dark Mode (dominant on mobile, matches platform energy)

```
Dark background: 222 47% 6% — deep navy, not pure black
Card background: 222 40% 9% — elevated from background
Border: 222 35% 16%         — subtle separation, not harsh lines

Why dark-dominant:
  - Students use phones at night (library, dorm) — bright white = unpleasant
  - Dark mode reduces eye strain for long sessions
  - Creator content (especially video) looks more cinematic on dark
  - Notification animations (bright red badges) pop more on dark
```

### Color Emotion Mapping

```
Indigo (primary):    Trust, learning, platform reliability → nav items, CTAs
Violet (accent):     Creativity, expression, creator → creator badges, live
Emerald (success):   Growth, earnings, achievement → revenue, follower gains
Amber (warning):     Urgency without panic → streak reminders, low balance
Red (destructive):   Clear danger signal → delete, ban, LIVE badge
Rose (social):       Affection, community, warmth → like hearts, friend suggestions
```

---

## 5. Component Library Standards

### Card System

```
4 card variants (all use feed-card utility class):

FeedCard (standard post):
  border-radius: 16px (var(--radius))
  padding: 16px
  border: 1px solid border (60% opacity)
  shadow: 0 1px 3px rgba(0,0,0,0.08)
  hover-shadow: 0 4px 12px rgba(0,0,0,0.12)

LiveCard (live session):
  border-radius: 16px
  border: 2px solid hsl(var(--live)) (red, pulsing)
  glow: 0 0 16px hsla(var(--live), 0.3)
  Special: animated border gradient (red→orange sweep, 2s loop)

CreatorCard (profile recommendation):
  border-radius: 20px
  padding: 20px
  gradient-brand background option (for featured cards)
  height: fixed at 200px (uniform horizontal scroll)

StatCard (dashboard metrics):
  border-radius: 12px
  compact: padding 12px
  value: heading-lg, tabular-nums
  trend badge: absolute top-right (▲ green / ▼ red)
```

### Button System

```
Primary button:
  background: gradient-brand (indigo → violet)
  color: white
  border-radius: 10px
  height: 44px (minimum touch target)
  font: body-lg, 600 weight
  states: hover scale(1.01), active scale(0.98)
  loading: spinner left of text (not replacing text)

Secondary button:
  background: secondary token
  color: secondary-foreground
  border: 1px solid border
  
Destructive:
  background: destructive token
  Requires: confirmation bottom sheet before execution

Ghost:
  background: transparent
  hover: secondary token
  Used for: secondary actions in tight spaces (edit, share)

Icon button:
  Size: 40×40px minimum
  border-radius: 50% (circular) or 10px (rounded square)
  padding: 8px
  Never smaller than 36×36px (accessibility)
```

### Toast / Notification System

```
Toast variants:
  Success: green left border + check icon + body-md text
  Error: red left border + X icon + retry action (optional)
  Info: blue left border + info icon
  Reward: gradient-brand background + confetti (for milestone toasts)

Toast behavior:
  Position: bottom-center on mobile, top-right on desktop
  Auto-dismiss: 4 seconds (success/info), 8 seconds (error), no auto-dismiss (reward)
  Max visible: 3 stacked (oldest auto-dismisses when 4th arrives)
  Animation in: slide up from bottom (mobile), slide in from right (desktop)
  Animation out: fade + scale down

DO NOT:
  - Show toast for every successful action (only notable ones)
  - Show toast for likes, follows (silently update counts)
  - Stack more than 3 (use notification center for overflow)
```

### Sheet & Drawer System

```
Bottom sheet (mobile primary overlay pattern):
  Trigger: any secondary action (comments, gift catalog, share, user settings)
  Handle bar: 4px × 40px pill, centered at top, always present
  Max height: 90vh (never full-screen — back nav always visible)
  Drag to dismiss: YES (threshold: 40% of sheet height)
  Backdrop: 50% opacity dark overlay
  Snap points: 40% / 70% / 90% (defined per sheet type)

Drawer (desktop equivalent):
  Position: right side on desktop, pushes content (not overlays)
  Width: 400px
  Same content as bottom sheet, different layout

Rule: Bottom sheet > Modal for everything on mobile.
  The only exception: destructive confirmation dialogs.
```

---

## 6. Spacing Rhythm

```
Base unit: 4px

Spacing scale:
  space-1:  4px   → icon internal padding
  space-2:  8px   → tight component gaps
  space-3:  12px  → button padding vertical
  space-4:  16px  → standard content padding, card internal
  space-5:  20px  → section gaps
  space-6:  24px  → card external gaps
  space-8:  32px  → page section separators
  space-10: 40px  → large section breaks
  space-12: 48px  → screen-level padding tops
  
Content width rules:
  Mobile: full-width − 32px (16px each side)
  Tablet: max 640px centered
  Desktop feed: max 680px centered (mimics Twitter/Instagram)
  Desktop full: max 1280px
```

---

## 7. Accessibility Standards

```
Minimum touch targets: 44×44px (WCAG 2.5.5)
Color contrast: 4.5:1 body text, 3:1 large text (WCAG AA)
Focus indicators: visible ring using ring token, not removed (never: outline: none)
Screen reader: all images have alt text, all icons have aria-label
Motion: prefers-reduced-motion → replace animations with instant state changes
Font size: user's system font size respected (no px-locked typography)

Reduce motion implementation:
  @media (prefers-reduced-motion: reduce) {
    * { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
    .gift-animation { display: none; /* show text fallback */ }
  }
``