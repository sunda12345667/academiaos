# StudentOS — Motion Design Architecture
*v1.0 | 2026-05-09*

---

## 1. Motion Philosophy

Motion is not decoration. Every animation must serve one of three functions:
1. **Orientation** — Help the user understand where they are / where they went
2. **Feedback** — Confirm that an action was received
3. **Delight** — Create an emotional moment (used sparingly, reserved for milestones)

Motion that serves none of these three purposes is noise. Remove it.

---

## 2. Animation Hierarchy

### Tier 1 — Navigation Transitions (orientation)

```
Tab switch (bottom nav):
  Duration: 200ms
  Easing: ease-out
  Type: Opacity fade + 8px translateY on incoming screen
  Outgoing: opacity 0 only (no translate — reduces motion sickness)
  
Route push (navigate deeper):
  Duration: 280ms
  Easing: cubic-bezier(0.25, 0.46, 0.45, 0.94) — iOS-like spring
  Type: New screen slides in from right (translateX: 100% → 0)
  Back: Reverse (translateX: 0 → 30%, behind incoming)
  
Bottom sheet open:
  Duration: 320ms
  Easing: cubic-bezier(0.32, 0.72, 0, 1) — spring
  Type: translateY: 100% → 0 + backdrop opacity 0 → 0.5
  Dismiss: 250ms, translateY: 0 → 100%
  
Modal overlay (destructive actions only):
  Duration: 200ms
  Easing: ease-out
  Type: Scale 0.95 → 1 + opacity 0 → 1
```

### Tier 2 — Interaction Feedback (feedback)

```
Like button:
  On tap: heart scale 1 → 1.4 → 1 (120ms, spring)
  Color: gray → red (instant, no transition — state change is clear)
  Particle burst: 6 small hearts scatter, fade out (300ms, stagger)
  Count: +1 number flies up and fades (translateY -16px, opacity 0)
  
Follow button:
  "Follow" → "Following":
    Button width animates (180ms) — avoids layout jump
    Text crossfades (opacity 0 → 1 on new text)
    Subtle background color morph
  
Gift send (< 500 coins):
  Emoji floats up from button (Y -60px, opacity 0, 800ms ease-out)
  Count in wallet decreases (roll-down number animation)
  
Gift send (rare/epic):
  See GIFT_ANIMATION_SYSTEM below
  
Save post:
  Bookmark outline → filled: scale 1 → 1.2 → 1 (100ms)
  Color morph: border → fill (120ms)
  
Comment posted:
  New comment slides in from bottom of list (translateY 20px → 0, 200ms)
  Input field clears with spring reset
  
Share:
  Native share sheet (OS-level animation, no custom animation needed)
```

### Tier 3 — Loading States (orientation)

```
Skeleton screens:
  Content shape: exact mirror of loaded layout (no generic rectangles)
  Animation: shimmer (translateX -100% → 100%, 1.4s, linear, infinite)
  Shimmer color: slightly lighter than card background
  Transition OUT: skeleton fades away (opacity 0, 200ms) as content fades in
  
Progressive image loading:
  Phase 1: Dominant color extracted from image → solid background
  Phase 2: Low-res blur (scale 1.1, blur 20px) — loaded from thumb URL
  Phase 3: Full image fades in over blur (opacity 0 → 1, 300ms)
  
Pull to refresh:
  Custom spinner: StudentOS logo (book + spark) rotates (not OS default)
  Spring resistance: resist past 64px pull
  Release: snap + spinner, content slides in from top
```

### Tier 4 — Emotional Moments (delight)

```
Streak milestone (7, 30, 100 days):
  Full-screen overlay, behind content
  Fire emoji cascade from bottom (staggered, 400ms total)
  Badge reveals with scale spring 0 → 1.05 → 1 (500ms)
  
First earning:
  Coin fall from top (10 coins, staggered, physics-based arc)
  Counter rolls up from 0 to amount (300ms ease-out)
  
Follower milestone (100, 500, 1000):
  Number counts up from (N-5) to N (150ms, ease-out)
  Confetti burst (small, 0.5s, then falls off screen)
  
Level up (XP tier):
  Progress bar fills to 100% → flash → new tier label slides in
  Badge glow effect (box-shadow pulse, 3 beats, then steady)
```

---

## 3. Timing Constants

### All animation durations come from this table:

```
Token name          Duration    Use case
─────────────────────────────────────────────────────────
motion-instant      0ms         State changes with no motion (accessibility mode)
motion-subtle       80ms        Hover states, small icon transforms
motion-quick        150ms       Button presses, toggle switches
motion-standard     200ms       Tab navigation, micro-interactions
motion-enter        280ms       Screen entrances, bottom sheets opening
motion-emphasis     400ms       Achievement reveals, milestone celebrations
motion-cinematic    600–800ms   Gift animations, onboarding sequences
```

### Easing Vocabulary

```
ease-standard:     cubic-bezier(0.4, 0, 0.2, 1)   — Material standard
ease-decelerate:   cubic-bezier(0, 0, 0.2, 1)      — Elements entering screen
ease-accelerate:   cubic-bezier(0.4, 0, 1, 1)      — Elements leaving screen
ease-spring:       cubic-bezier(0.32, 0.72, 0, 1)  — Bottom sheets, modals
ease-bounce:       spring(1, 80, 10, 0)             — Achievement reveals (Framer)
```

---

## 4. Gesture System

### Supported Gestures (mobile)

```
SWIPE RIGHT (from left edge):     Navigate back (iOS standard)
SWIPE LEFT (on post card):        Dismiss / Mark read
SWIPE UP (on post card, video):   Skip / Next video
SWIPE DOWN (on bottom sheet):     Dismiss sheet
SWIPE DOWN (on scroll at top):    Pull to refresh
LONG PRESS (on post):             Quick action menu
DOUBLE TAP (on image/video):      Like
PINCH (on image):                 Zoom in
TWO-FINGER TAP:                   Mute/unmute video
```

### Gesture Feedback Rules

```
Every gesture must have:
1. Initiation feedback: subtle scale or opacity change as gesture begins
2. Progress feedback: element follows finger (translateX/Y tracking)
3. Completion feedback: spring snap to destination + haptic
4. Cancellation feedback: spring snap back to origin (gesture cancelled)

Haptic patterns:
  Light impact:     Like, save, small gift send
  Medium impact:    Follow, unfollow, send message
  Heavy impact:     First earning, tier upgrade, milestone
  Success pattern:  DM delivered, gift received confirmation
  Error pattern:    Payment failed, action blocked
```

---

## 5. Gift Animation System (Detailed)

### Common Gift (< 500 coins)

```
Duration: 400ms total
Trigger: Gift button confirm tapped
Sequence:
  T+0ms:   Emoji appears at button (scale 0 → 1, 80ms spring)
  T+80ms:  Emoji floats upward (+80px translateY, opacity 1 → 0, ease-out)
  T+100ms: Sender's coin count rolls down by gift amount
  T+100ms: In live session: small floating emoji appears in comment area
```

### Rare Gift (500–1,999 coins)

```
Duration: 1,200ms total
Sequence:
  T+0ms:   Gift catalog closes
  T+100ms: Center of screen: gift emoji appears at scale 0 (spring → 1.0)
  T+200ms: Creator name + gift name banner slides in from bottom (translateY)
  T+300ms: Subtitle: "[Sender Name] sent a [Gift Name]!"
  T+800ms: Banner fades out (opacity 0, 400ms)
  T+1200ms: Resume normal stream
```

### Epic Gift (2,000–9,999 coins)

```
Duration: 2,500ms total
Sequence:
  T+0ms:    Screen darkens (backdrop opacity 0 → 0.6, 150ms)
  T+150ms:  Gift animation asset plays (Lottie or CSS keyframe)
  T+200ms:  Full-width text: "[Gift Name]" in large type, scale in
  T+400ms:  "[Sender] → [Creator]" with arrow animation
  T+500ms:  Particle burst (confetti, themed to gift type)
  T+2000ms: Fade out (opacity 0, 500ms)
  T+2500ms: Stream view fully visible again
```

### Legendary Gift (10,000+ coins)

```
Duration: 4,000ms total (intentionally long — this is a major social moment)
Sequence:
  T+0ms:    Full black flash (screen goes black, 80ms)
  T+80ms:   Lottie animation fills screen (gift-specific cinematic sequence)
  T+500ms:  "[Sender Name]" appears with dramatic text reveal
  T+800ms:  "[Gift Name]" reveals below
  T+1200ms: Creator's total earnings counter for this session animates upward
  T+1500ms: Chat explodes with viewer reactions (simulated cascade)
  T+3000ms: Animation loops once more
  T+4000ms: Fade back to stream
  
  Sound: Plays audio cue (if user not muted) — brief fanfare, 2s
```

---

## 6. Optimistic UI Motion Patterns

```
Like (before server confirms):
  Instant: Heart fills red, count increments
  On server error: Heart un-fills (reverse animation, 150ms) + count reverts
  Never show "failed to like" toast — just silently revert

Send message:
  Instant: Message appears in chat with "pending" opacity (0.6)
  On deliver: Opacity → 1 (0ms, instant — no animation, just appears real)
  On error: Message turns red outline + "Tap to retry" label

Follow:
  Instant: Button changes to "Following" state
  On error: Reverts to "Follow" with brief shake (3px left-right, 2 cycles)

Gift (pending payment):
  Animation plays immediately (full experience)
  On payment failure: Toast "Gift couldn't be sent. ₦X returned to wallet"
  Never cancel the animation mid-play (feels awful) — abort after if failure
``