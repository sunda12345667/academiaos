# StudentOS — Motion Architecture & Design System
*v1.0 | 2026-05-09*

---

## 1. Motion Philosophy

Motion has three valid purposes. If an animation doesn't serve one of these, remove it.

1. **Orientation** — Tells the user where they went, what changed, what's new
2. **Feedback** — Confirms an action was received
3. **Delight** — Creates an emotional moment (used sparingly: milestones, gifts, onboarding)

---

## 2. Timing Constants

```javascript
// All durations in lib/constants/motion.js
export const MOTION = {
  instant:    0,    // Accessibility mode / state-only changes
  subtle:     80,   // Hover states, icon transforms, toggles
  quick:      150,  // Button presses, chips, badges
  standard:   200,  // Tab switches, simple UI transitions
  enter:      280,  // Screen entrances, bottom sheets
  emphasis:   400,  // Achievement reveals, card expansions
  cinematic:  600,  // Gift animations, onboarding, milestones
  legendary:  4000, // Legendary gift takeover
};

export const EASING = {
  standard:   'cubic-bezier(0.4, 0, 0.2, 1)',    // default
  decelerate: 'cubic-bezier(0, 0, 0.2, 1)',       // entering elements
  accelerate: 'cubic-bezier(0.4, 0, 1, 1)',       // leaving elements
  spring:     'cubic-bezier(0.32, 0.72, 0, 1)',   // bottom sheets, modals
};
```

---

## 3. Animation Hierarchy

### Tier 1 — Navigation (orientation)

```
Tab switch:
  Outgoing screen: opacity 1 → 0 (200ms ease-accelerate)
  Incoming screen: opacity 0 → 1 + translateY 8px → 0 (200ms ease-decelerate)
  
Route push (navigate deeper):
  New screen: translateX(100%) → translateX(0) (280ms ease-spring)
  Old screen: translateX(0) → translateX(-30%) + opacity 0.6 (same duration)
  
Back navigation:
  Reverse of push (new screen slides out right, old screen returns from -30%)
  
Bottom sheet:
  Open: translateY(100%) → translateY(0) + backdrop opacity 0 → 0.5 (320ms spring)
  Close: translateY(0) → translateY(100%) (250ms ease-accelerate)
```

### Tier 2 — Interactions (feedback)

```
Like:
  Heart: scale(1) → scale(1.35) → scale(1.0) [120ms spring]
  Color: gray → brand-rose [instant, not animated — state change clarity]
  Count: +1 flies up (translateY -12px, opacity 1 → 0) simultaneously with new count appearing

Follow button:
  Text morphs: "Follow" → "Following" with button width animation [180ms]
  Color: border-primary → filled-primary background

Send message:
  Message appears at bottom: translateY(20px) → translateY(0) [150ms]
  Opacity: 0.6 (pending) → 1.0 (delivered) [0ms — instant confidence signal]
  
Post publish:
  Composer closes: slide-down (reverse open)
  Feed shows "Your post is live" toast (from bottom)
  
Scroll to top (re-tap nav tab):
  Smooth scroll, 400ms ease-out (not instant — gives sense of distance traveled)
```

### Tier 3 — Loading (orientation)

```
Skeleton shimmer:
  Background: linear-gradient(90deg, muted 0%, muted-lighter 50%, muted 100%)
  Animation: translateX(-100%) → translateX(100%) [1.4s linear infinite]
  
Content transition (skeleton → real):
  Skeleton fades out: opacity 1 → 0 [200ms]
  Content fades in: opacity 0 → 1 [200ms, starts 100ms after skeleton fades]
  
Pull to refresh:
  Custom icon (book + spark, brand mark) spins during pull
  Release: snap + spinner, content slides in from top
```

### Tier 4 — Delight (emotional moments)

```
Streak milestone:
  Fire cascade: emojis rain from top, staggered 50ms each, fade out at bottom
  Badge: scale(0) → scale(1.05) → scale(1.0) [500ms spring]
  
Follower milestone:
  Count rolls from N-3 to N [150ms per digit, ease-out]
  Confetti burst: 40 particles, 600ms, fall off screen edges
  
Tier upgrade:
  Full-screen overlay slides up [320ms]
  Badge reveals with glow effect (box-shadow pulse, 3 beats)
  Feature list items stagger in [100ms each, translateY 12px → 0]
```

---

## 4. Optimistic UI Motion Rules

| Action | Optimistic Visual | Rollback |
|---|---|---|
| Like | Heart fills + count +1 immediately | Heart unfills + count reverts (150ms reverse) |
| Follow | Button switches to "Following" immediately | Button reverts + brief shake (3px, 2 cycles) |
| Send message | Message appears in pending state (opacity 0.7) | Message turns red + "Retry" label |
| Gift send | Animation plays immediately | Toast: "Returned to wallet. ₦X refunded" |
| Post reaction | Reaction adds optimistically | Silent revert (no error shown — feels like network noise) |

**Rule:** Never cancel a gift animation mid-play. Let it complete. Show failure toast after. (Cancelling mid-animation is the worst UX experience on the platform.)

---

## 5. Notification Animations

```
In-app notification badge (bottom nav):
  New notification: dot appears with scale(0) → scale(1.0) spring
  Count badge: number fades in if > 1 new
  Clear: dot shrinks and fades on tab tap
  
In-feed notification toast (bottom, non-blocking):
  Slides up from bottom [200ms spring]
  Auto-dismisses [4s for info, 8s for errors]
  Dismiss: swipe down or right → slides out [150ms ease-accelerate]
  
Live session alert (top banner, while in feed):
  Slides down from below header [200ms]
  Red pulse on "● LIVE" dot [1.5s ease-in-out infinite]
  User dismisses: slides back up
```

---

## 6. Typography System

### Type Scale

```
Family:
  Display/Headings: Plus Jakarta Sans (emotion, brand personality)
  Body/UI text:     Inter (readability, clarity)

Scale (rem, base 16px):
  display-xl:   3.0rem / 800 weight → Onboarding hero, celebration screens
  display-lg:   2.25rem / 700      → Profile hero name, milestone headers
  display-md:   1.875rem / 700     → Section headers
  heading-lg:   1.5rem / 600       → Card titles, modal headings
  heading-md:   1.25rem / 600      → Feed post usernames
  heading-sm:   1.125rem / 600     → Tab labels (active)
  body-lg:      1.0rem / 400       → Post body text, messages (primary reading)
  body-md:      0.875rem / 400     → Captions, metadata, secondary info
  body-sm:      0.75rem / 400      → Timestamps, badges, small labels
  label:        0.625rem / 500     → Status pills, notification counts (caps only)

Line height:
  Display: 1.1   (tight — impactful)
  Heading: 1.3
  Body:    1.6   (generous — long-form readable)
  Label:   1.0   (single-line only)
  
Letter spacing:
  Display: -0.02em  (large text needs optical tightening)
  Label:   +0.05em  (all-caps labels need breathing room)
  Numbers: tabular-nums always (wallet amounts, analytics stats)
```

---

## 7. Color System

### Semantic Color Tokens

```css
/* Core brand */
--primary: 245 70% 52%      /* Indigo — trust, platform identity, CTAs */
--accent:  270 80% 60%      /* Violet — creativity, creator content, premium */

/* Status */
--success: 158 64% 42%      /* Emerald — earnings, uploads, achievements */
--warning: 38 92% 50%       /* Amber — streak warnings, low balance */
--destructive: 0 84% 60%    /* Red — delete, moderation, LIVE badge */

/* Social signals */
--like-active: 350 89% 60%  /* Rose — active like hearts */
--live-red: 0 72% 51%       /* Pure red — LIVE badge (universally understood) */
--gift-gold: 38 92% 60%     /* Gold — gift animations, earnings */
```

### Dark Mode (default on mobile)

```
Why dark-first:
  - Students use phones at night (library, dorms) — bright white = eye strain
  - Video content is more cinematic on dark backgrounds
  - Notification badges (red) pop more against dark
  - Matches the "social media at night" behavior pattern of the audience

Dark tokens:
  --background: 222 47% 6%   /* Deep navy — not pure black (softer) */
  --card:       222 40% 9%   /* Elevated from background */
  --border:     222 35% 16%  /* Subtle — visible but not harsh */
  
Light mode available but non-default. System preference respected.
```

### Gradient System

```
gradient-brand: linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)))
  → Used on: Create FAB, primary CTAs, tier badges, onboarding hero text

gradient-live: linear-gradient(135deg, #FF1744, #FF6D00)
  → Used on: LIVE badge, live session border, active stream UI

gradient-earnings: linear-gradient(135deg, #10B981, #34D399)
  → Used on: earnings toasts, first-earning celebration, positive metric change

gradient-card-hero: linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.8) 100%)
  → Used on: full-bleed card image overlays (ensures text readability)
```

---

## 8. Component Standards

### Card System

```
FeedCard (standard post):
  border-radius: 16px
  padding: 0 (media full-bleed) + 16px for text sections
  border: 1px solid hsl(var(--border) / 0.6)
  shadow: 0 1px 3px rgba(0,0,0,0.08)
  hover: shadow increases to 0 4px 12px rgba(0,0,0,0.12)

LiveCard:
  border-radius: 16px
  border: 2px solid hsl(var(--live-red))
  box-shadow: 0 0 16px hsla(var(--live-red), 0.25)
  border animation: gradient sweep [2s linear infinite]

CreatorCard (recommendation):
  border-radius: 20px
  height: 200px (fixed — for horizontal scroll uniformity)
  overflow: hidden
  bg: gradient-brand (on featured cards) or card (standard)

StatCard (analytics metrics):
  border-radius: 12px
  padding: 16px
  value: heading-lg + tabular-nums
  trend: absolute badge top-right (▲ success / ▼ destructive)
```

### Bottom Sheet Standards

```
Handle: 4×40px pill, centered top, muted foreground color
Max height: 90vh (never 100% — back nav always visible at top)
Drag threshold: 40% of sheet height to dismiss
Backdrop: 50% opacity dark overlay
Snap points: defined per sheet type:
  - Comment sheet: 40% / 70% / 95%
  - Gift catalog: 50% / 85%
  - Share sheet: 40% fixed (content determines height)
  - User settings: 60% / 90%
  
Rule: Prefer bottom sheet over modal for EVERYTHING on mobile.
Exception: Destructive action confirmation (center dialog feels more intentional).
```

### Toast System

```
Variants:
  success:  left border emerald + ✓ icon + white text
  error:    left border red + ✗ icon + retry action link
  info:     left border primary + ℹ icon
  reward:   gradient-brand background + confetti (milestones only)
  
Position: bottom-center mobile / top-right desktop
Auto-dismiss: 4s (success/info) / 8s (error) / none (reward)
Max visible: 3 (oldest dismisses when 4th appears)
Animation in: slide up from bottom (mobile) / slide in right (desktop)
Swipe to dismiss: swipe down (mobile only)
```

---

## 9. Spacing System

```
Base unit: 4px

Tokens:
  space-1:  4px    → Icon internal padding, tight inline gaps
  space-2:  8px    → Button icon gap, chip internal
  space-3:  12px   → Card section separator, compact list gap
  space-4:  16px   → Standard card padding, button padding H
  space-5:  20px   → Section header margin, form field gap
  space-6:  24px   → Card external margin, bottom sheet padding
  space-8:  32px   → Page section separators
  space-10: 40px   → Large section breaks, screen-top padding
  space-12: 48px   → Bottom nav clearance, hero section padding

Safe areas (mobile):
  padding-bottom: env(safe-area-inset-bottom, 16px) — pb-safe utility
  padding-top: env(safe-area-inset-top, 0px) — pt-safe utility
```

---

## 10. Accessibility Standards

```
Contrast: WCAG AA minimum (4.5:1 body, 3:1 large text)
Touch targets: 44×44px minimum (WCAG 2.5.5)
Focus rings: always visible (ring token, never removed)
Font scaling: respects system font size (no px-locked type)
Screen reader: all icons aria-labeled, all images alt-texted
Motion: prefers-reduced-motion respected

Reduce motion implementation:
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
  /* Gift animations: show text fallback only */
  .gift-animation-overlay { display: none; }
  .gift-text-fallback { display: block; }
}
``