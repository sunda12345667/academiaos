# StudentOS — Mobile-First Interaction System
*v1.0 | 2026-05-09*

---

## 1. Thumb-Zone Architecture

All primary interactions must be reachable by the right thumb in one-hand usage on a 375px (iPhone SE) screen.

```
Screen zones for 375×812 viewport:

┌─────────────────────┐  ← 0px
│                     │
│   DISPLAY ZONE      │  ← 0–480px: content, video, images
│   (view only)       │     no primary interactions placed here
│                     │
├─────────────────────┤  ← 480px
│   INTERACTION ZONE  │  ← 480–720px: all primary interactions
│                     │     like, comment, share, gift, follow
│   Action bar        │  ← 680–724px: sticky action bar
│   ─────────────────  │
│   Caption + name    │  ← 725–780px: creator info
├─────────────────────┤  ← 780px
│   BOTTOM NAV        │  ← 780–812px (+ safe area)
└─────────────────────┘  ← 812px

Rule: No important CTA above 480px on mobile. Users will see it but can't easily reach it.
```

### Touch Target Standards

```
Minimum touch target: 44×44px (WCAG 2.5.5 AA)
Recommended: 48×48px for primary actions
Icon-only buttons: always labeled with aria-label
Adjacent targets: minimum 8px gap (no accidental mis-taps)

Specific targets:
  Like button:       48×48px
  Comment button:    48×48px
  Follow button:     min-width 80px × 36px height (inline on cards)
  Gift button:       48×48px
  Nav tabs:          full width / 5 = ~75px × 56px
  Create FAB:        56×56px (elevated, gradient)
```

---

## 2. Gesture System

### Supported Gestures

| Gesture | Target | Action |
|---|---|---|
| Swipe right (edge) | Any screen | Navigate back |
| Swipe up | Video feed card | Next video |
| Swipe down | Bottom sheet | Dismiss sheet |
| Swipe down (at top) | Feed | Pull to refresh |
| Swipe left | Post card | Quick actions |
| Double tap | Image / video | Like |
| Long press | Post card | Context menu |
| Pinch out | Image | Zoom in |
| Two-finger tap | Video | Toggle mute |

### Gesture Feedback Protocol

Every gesture must emit feedback at three points:

```
1. Initiation (finger down):
   - Immediate: scale(0.97) on tapped element OR resistance on drag start
   
2. In-progress (finger moving):
   - Element follows finger (translateX/Y bound to gesture delta)
   - Visual affordance (color shift or opacity) indicates completion threshold
   
3. Completion (finger up):
   - Spring snap to destination + haptic feedback
   - State change animation (not just position change)
   
4. Cancellation (finger released before threshold):
   - Spring snap back to origin (200ms ease-spring)
   - No state change
   - No haptic (prevents confusion)
```

### Haptic Feedback Map

```
Light impact (10ms):    Like, save, reaction, small gift send
Medium impact (20ms):   Follow, send message, post publish
Heavy impact (40ms):    Tier upgrade, first earning, live session start
Success pattern:        Message delivered, withdrawal confirmed
Warning pattern:        Low balance, streak at risk
Error pattern:          Payment failed, action blocked
```

---

## 3. Navigation Behavior

### Bottom Navigation (5 tabs)

```
Tab layout:
[🏠 Home] [🔍 Discover] [➕ Create] [👥 Groups] [👤 Profile]

Positioning rationale:
  Home    — far left:  most-used, dominant right thumb (leftward reach)
  Discover— 2nd left:  secondary exploration, close to home
  Create  — center:    elevated FAB, brand gradient, always accessible
  Groups  — 2nd right: community, natural after Discover
  Profile — far right: less frequent, acceptable reach distance

Active state: icon fills + label appears below (14px, brand primary)
Inactive: icon outline, no label
Badge: red dot (top-right of icon) for unread notifications on Home + Profile

Tab persistence: each tab maintains scroll position (never resets on switch)
Tab re-tap: scrolls to top if already on that tab (Twitter/Instagram pattern)
```

### Create FAB (Center Tab) Behavior

```
Single tap → bottom sheet rises with creation options:
  ┌──────────────────────────────────────┐
  │  What do you want to create?         │
  │                                      │
  │  [📝 Post]   [📸 Photo]  [🎥 Video]  │
  │  [📊 Poll]   [📚 Course] [🔴 Live]   │
  │                                      │
  │  [Cancel]                            │
  └──────────────────────────────────────┘

Long press → opens last-used creation type directly (power user shortcut)

Pro/Verified creators see additional options: [📅 Schedule] [📢 Announcement]
```

### Context Switching Speed

```
Tab switch animation: 200ms fade (no slide — sliding between tabs implies order, these are peer surfaces)
Back navigation: 280ms slide-right (iOS native pattern — feels expected)
Deep link entry: 0ms (direct render, no transition — came from outside the app)
Modal open: 320ms slide up from bottom
```

---

## 4. Content Flow Architecture

### Vertical Feed Scrolling

```
Scroll physics:
  - Natural momentum (CSS scroll-behavior: smooth)
  - No artificial snap points on main feed (snap only on video feed)
  - Overscroll: pull-to-refresh at top, no bounce-to-load at bottom
  - Velocity: normal (no speed limiting — users hate slow scrolling)

Card sizing on mobile:
  - Text post: auto height, max 3 lines before truncation
  - Image post: 4:3 or 1:1 ratio (full width, fixed height)
  - Video post: 16:9 (full width, ~211px height on 375px screen)
  - Live session: fixed 200px banner card (larger — deserves prominence)
  
Inter-card spacing: 12px (tight — feels like a cohesive feed, not a list)
Card horizontal padding: 0px (full-bleed on mobile feels premium)
```

### Video Feed (Vertical Swipe Mode)

```
Activated by: "Video" tab in feed navigation
Layout: Full-screen (no chrome except creator overlay + bottom nav)
Navigation: Swipe up = next, swipe down = previous (snap)

Autoplay behavior:
  - Plays when 90% of video is in viewport
  - Muted by default, unmute: tap anywhere on video
  - Loop: videos < 60s loop continuously
  - Auto-advance: after video ends (2s pause) → swipe animation to next

Interaction overlay (right side, bottom):
  Avatar (with follow ring): 48px circle
  ♥ Like: count below
  💬 Comment: count below
  ↗ Share
  🎁 Gift
  
Creator info overlay (left side, bottom):
  @username (bold, white)
  Caption (2 lines max, truncated)
  📍 School tag
  🎵 Audio credit (if applicable)
```

---

## 5. Perceived Speed System

### Skeleton Screen Rules

```
Every data-fetching component must render a skeleton that:
1. Matches the EXACT layout of the loaded content (not generic rectangles)
2. Uses shimmer animation (gradient sweep, 1.4s infinite)
3. Transitions OUT with opacity fade (200ms) as content fades IN
4. Never shows a spinner where a skeleton can be used

Skeleton components needed (one per content type):
  PostCardSkeleton      — feed post (already exists ✅)
  CreatorCardSkeleton   — horizontal creator card
  LiveSessionSkeleton   — live banner card
  StatCardSkeleton      — creator dashboard metrics
  NotificationSkeleton  — notification list item
  MessageSkeleton       — DM list item
  GroupCardSkeleton     — group directory card
```

### Progressive Image Loading

```
Phase 1 (immediate):  Dominant color background (extracted at upload time)
Phase 2 (fast):       Low-resolution blur (20px radius, 1.1× scale)
Phase 3 (complete):   Full image fades in over blur (300ms ease-out)

Implementation:
  - Store low-res thumbnail URL alongside full image URL on Post entity
  - <img> tag: src={thumbUrl} on initial render, onLoad switch to fullUrl
  - CSS: filter: blur(20px) transform: scale(1.1) → remove on full load
```

### Route Transition Pre-loading

```
On hover (desktop) / on press-start (mobile):
  → Begin fetching data for the target route
  → By the time animation completes (280ms), data is often already loaded
  → User sees content immediately after navigation

Implementation: prefetchQuery in useNavigate wrapper
``