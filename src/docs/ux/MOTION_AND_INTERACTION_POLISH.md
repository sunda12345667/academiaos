# StudentOS Motion & Interaction Polish System
**Engineering Tactile Feedback, Momentum, & Celebration into Every Interaction**

---

## 1. MOTION PHILOSOPHY

### Core Principles
1. **Purposeful** — Every animation exists to communicate state or create delight
2. **Performant** — 60fps minimum; GPU-accelerated transforms only
3. **Responsive** — Users feel immediate feedback within 100ms
4. **Predictable** — Consistent easing and timing across patterns
5. **Respectful** — Honors `prefers-reduced-motion` setting

### Motion Hierarchy Framework

**Tier 1: Micro Feedback (100–150ms)**
- Button hover/press states
- Icon color transitions
- Badge appear/disappear
- Checkbox toggle
- **Easing:** `cubic-bezier(0.4, 0, 0.2, 1)` (ease-out)
- **Used for:** Instant tactile response, no cognition required

**Tier 2: Interaction (200–350ms)**
- Modal open/close
- Sheet slide-up/down
- Dropdown reveal
- Notification toast slide-in
- Sidebar collapse/expand
- **Easing:** `cubic-bezier(0.34, 1.56, 0.64, 1)` (spring) OR `ease-in-out`
- **Used for:** Deliberate, intentional UI changes

**Tier 3: Loading (500–1000ms)**
- Page transition fade-in
- Skeleton shimmer loop
- Image lazy-load reveal
- Feed append animation
- **Easing:** `ease-out` or `ease-in-out`
- **Used for:** Content loading, reduce perception of wait time

**Tier 4: Delight (600–2000ms)**
- Achievement unlock animation
- Gifting send animation (gift flies across screen)
- Milestone celebration (confetti burst)
- Earnings balance update
- Creator milestone badge appearance
- **Easing:** Spring-based or bounce
- **Used for:** Celebratory moments, emotional resonance

---

## 2. INTERACTION RESPONSE PATTERNS

### Button Response Machine

**State Transitions:**
```
Idle
  ↓ (mouseover / focus)
Hover
  ↓ (click)
Active (Press)
  ↓ (mouseup)
Idle (or Loading if async)

Disabled (any state → disabled)
  ↓ (re-enable)
Idle
```

**Hover State:**
- Background: 10% lighter (use color-mix or opacity)
- Shadow: 0 4px 12px rgba(primary, 0.2)
- Cursor: pointer
- Timing: 150ms ease-out
- Scale: subtle 1 → 1.02 (optional, for emphasis buttons)

**Active/Press State:**
- Background: 10% darker
- Shadow: inset 0 2px 4px rgba(0,0,0,0.1)
- Scale: 0.98 (compressed feeling)
- Timing: 80ms ease-out
- Duration: held until mouseup

**Disabled State:**
- Background: --muted
- Text: --muted (70% opacity)
- Cursor: not-allowed
- No pointer events
- No transitions (instant)

### Form Input Focus States

**Focus Ring:**
- Border: 2px solid --primary
- Outline: 4px solid rgba(primary, 0.1)
- Timing: 150ms ease-out
- Keyboard-visible: always
- Mouse-visible: on click (not hover, following UX best practice)

**Input Validation Feedback:**
```
Valid Input:
├─ Border: --success
├─ Icon: checkmark (right, 16px, --success)
└─ Timing: 200ms ease-out

Invalid Input:
├─ Border: --error
├─ Background: --error with 10% opacity
├─ Icon: alert circle (right, 16px, --error)
├─ Error message: appear below input with slide-down (200ms)
└─ Shake (optional): scale 1 → 1.02 ↔ 0.98 (2 wiggles, 100ms total)
```

### Checkbox & Toggle Animations

**Checkbox Check Mark Animation:**
```
Off → On:
├─ Box scales: 1 → 1.1 → 1 (120ms, cubic-bezier(0.34, 1.56, 0.64, 1))
├─ Fill color: --border → --primary (200ms, ease-out)
└─ Checkmark draws: path animation (150ms, ease-out)

On → Off:
├─ Uncheck: reverse order
└─ Duration: same timings
```

**Toggle Switch Animation:**
```
Off → On:
├─ Thumb slides right (200ms, ease-out)
├─ Background color shifts: --muted → --primary
└─ Ripple pulse: optional overlay (150ms, ease-out)
```

### List Item Interactions (Feed, Chat, etc.)

**Hover State:**
- Background: shift to --card-hover
- Shadow: optional, subtle (0 2px 8px rgba(0,0,0,0.12))
- Timing: 150ms ease-out
- Action buttons: fade-in or become visible

**Selection State:**
- Background: --primary with 10% opacity
- Left border: 4px solid --primary
- Timing: 100ms ease-out

**Delete/Archive Gesture:**
```
Swipe Right (mobile):
├─ Drag: follows finger, opacity fades
├─ Release & drop:
   ├─ Snap back: cubic-bezier(0.34, 1.56, 0.64, 1), 200ms
   ├─ OR
   ├─ Slide out: ease-in, 300ms, scale 0.9 at end
└─ Confirm toast: "Item archived" with undo button
```

---

## 3. SCROLL & MOMENTUM PATTERNS

### Feed Scroll Behavior

**Inertial Scrolling (Mobile):**
```
User swipe → momentum scroll
├─ Deceleration: ease-out, 400ms
├─ Bounce: 10px on top/bottom edge (iOS-style)
├─ Pull-to-refresh trigger: 60px threshold
└─ Snap: no snap-to-grid (free-form scroll)
```

**Desktop Scroll:**
```
Mouse wheel / touchpad
├─ Smooth: browser native OR custom easing
├─ No auto-snap
├─ Scrollbar appears on hover
└─ Scrollbar: thin (4px), --border color
```

**Infinite Scroll Append Animation:**
```
New items load:
├─ Skeleton placeholders appear at bottom
├─ Fade-in: 0 → 1 (300ms, ease-out) when content loaded
├─ Stagger: each item +50ms offset (cascading effect)
└─ Timing: smooth, not jarring
```

**Sticky Headers & Parallax (Optional):**
```
Section header (e.g., "Today"):
├─ Sticky position on scroll
├─ Background: solid (not transparent) for clarity
├─ Fade-in when sticky: 0 → 1 (200ms)

Parallax (image + text overlay):
├─ Image moves slower than scroll (0.5x speed)
├─ Text fades: 1 → 0.7 (subtle depth)
└─ No parallax on mobile (reduces jank)
```

---

## 4. MODAL & SHEET CHOREOGRAPHY

### Modal Open Animation

```
Trigger: User clicks button or action
├─ Overlay fade: 0 → 0.4 opacity (200ms, ease-out)
├─ Modal scale: 0.95 → 1 (300ms, cubic-bezier(0.34, 1.56, 0.64, 1))
├─ Modal opacity: 0 → 1 (200ms, ease-out) [can overlap scale]
└─ Focus: set to first interactive element (after animation)

Timing (parallel):
├─ Start overlay fade immediately
├─ Start modal scale at 50ms offset
└─ Complete in 300ms total
```

### Modal Close Animation

```
Trigger: User clicks close/outside or action completes
├─ Modal scale: 1 → 0.95 (150ms, ease-in)
├─ Modal opacity: 1 → 0 (150ms, ease-in)
├─ Overlay fade: 0.4 → 0 (200ms, ease-in)
└─ Total duration: 150ms

Focus: return to trigger element
```

### Bottom Sheet Slide Animation (Mobile)

```
Open:
├─ Overlay fade: 0 → 0.4 (200ms, ease-out)
├─ Sheet slide: translateY(100%) → 0 (400ms, cubic-bezier(0.34, 1.56, 0.64, 1))
└─ Content fade: 0 → 1 (300ms, ease-out) [offset 100ms]

Close (Drag Down):
├─ Sheet follows finger (no easing, real-time)
├─ On release:
   ├─ If > 40% dragged: snap-to-close (ease-in, 200ms)
   ├─ If < 40% dragged: snap-back-to-open (spring, 300ms)
└─ Overlay fades with sheet

Close (Swipe/Tap):
├─ Sheet slide: 0 → translateY(100%) (300ms, ease-in)
└─ Overlay fade: 0.4 → 0 (300ms, ease-in)
```

---

## 5. NOTIFICATION & TOAST CHOREOGRAPHY

### Notification Toast (Top or Bottom)

```
Enter Animation:
├─ Slide: translateX(100%) → 0 (or translateY(-100%) → 0)
├─ Timing: 250ms, ease-out
├─ Opacity: 0 → 1 (200ms, overlapped)
└─ Shadow: fade-in (0 → 0.2, 300ms)

Exit Animation (Auto-dismiss after 4–6s):
├─ Fade: 1 → 0 (200ms, ease-out)
├─ Slide: 0 → translateX(100%) (300ms, ease-in)
└─ Total: 300ms exit

Dismiss (User click):
├─ Immediate: slide out + fade (200ms, ease-in)
└─ No delay
```

### Notification Badge Animation

```
On New Notification:
├─ Badge scale: 0 → 1.3 → 1 (300ms, cubic-bezier(0.34, 1.56, 0.64, 1))
├─ Color pulse: primary → primary-dark → primary (200ms)
└─ If count changes: counter increments smoothly

On Dismiss:
├─ Scale: 1 → 0 (150ms, ease-in)
└─ Opacity fades simultaneously
```

---

## 6. SOCIAL INTERACTION ANIMATIONS

### Heart/Like Animation

```
Idle State:
├─ Icon: heart outline
├─ Color: --muted-foreground
└─ Scale: 1

On Click (Toggle Like):
├─ Animation 1 (Icon):
│  ├─ Icon fill: outline → solid
│  ├─ Color: --muted → --error (primary heart color)
│  └─ Timing: 150ms, ease-out
├─ Animation 2 (Scale Pulse):
│  ├─ Scale: 1 → 1.3 → 1
│  ├─ Timing: 200ms, cubic-bezier(0.34, 1.56, 0.64, 1)
│  └─ Offset: start at 0ms (overlaps with fill)
└─ Animation 3 (Count Update):
   ├─ Count text scales: 1 → 1.15 → 1 (150ms)
   └─ Timing overlaps with icon animation

On Unlike (Toggle Back):
├─ Reverse icon fill (outline)
├─ Count scales down: same timing as fill
└─ No pulse scale (feels lightweight)
```

### Comment/Reply Animation

```
Add Comment:
├─ Input field bounces: scale 1 → 1.05 → 1 (200ms, on focus)
├─ On submit:
│  ├─ Button shows checkmark briefly
│  ├─ Comment appears in thread (fade-in, 200ms)
│  └─ Scroll-to: new comment visible in viewport
├─ Notification for replies:
│  ├─ Badges pulses with new comment count
│  └─ Optional: chat bubble briefly shows "2 new replies"
```

### Gift/Tip Send Animation

```
Trigger: User selects gift and confirms
├─ Gift Selection Sheet:
│  ├─ Item hover: scale 1.05, shadow brightens (200ms)
│  ├─ Item tap: scale 0.95 (80ms press state)
│  └─ Selected gift: border + glow --primary
├─ Send Button Click:
│  ├─ Button shows spinner (100ms before action)
│  └─ On success:
│     ├─ Gift emoji flies: start (button) → end (creator avatar)
│     ├─ Path: curved (cubic-bezier path)
│     ├─ Scale: 24px → 48px → 24px (800ms, spring)
│     ├─ Rotation: 0 → 360° (simultaneous)
│     ├─ Opacity: 1 → 1 → 0.5 (fade-out at end)
│     └─ On arrival:
│        ├─ Confetti burst (24 particles)
│        ├─ Creator avatar pulses: 1 → 1.2 → 1 (300ms)
│        ├─ "Gift received!" toast appears
│        └─ Creator balance updates (number animation)
└─ Total duration: 800ms gift flight + 300ms confetti
```

### Creator Tier/Badge Unlock

```
Milestone Achieved:
├─ Modal appears (scale 0.95 → 1, 400ms spring)
├─ Badge icon scales: 0 → 1.3 → 1 (500ms, cubic-bezier(0.34, 1.56, 0.64, 1))
├─ Text fade: 0 → 1 (300ms, 100ms offset)
├─ Confetti burst: 3–4 colors, 30–40 particles
│  ├─ Launch angle: random ±45° from center
│  ├─ Gravity: realistic downward acceleration
│  ├─ Duration: 2.5s per particle
│  └─ Easing: ease-out then ease-in (gravity)
├─ Sound (optional): celebration chime (300ms, 70% volume)
└─ Share button appears: fade-in (200ms, 300ms offset)

Post-Unlock:
├─ Profile header updates with new badge (smooth appearance)
├─ Badge glows: subtle shine effect (3s loop, 70% opacity)
└─ Creator dashboard shows new stat update
```

---

## 7. REAL-TIME & LIVE INDICATORS

### Live Pulse Animation

```
Live Session Active:
├─ Badge background: animate opacity pulse
│  ├─ Opacity: 1 → 0.7 → 1
│  ├─ Duration: 1.5s ease-in-out, infinite
│  └─ Delay: 0s
├─ Badge text: always visible, no animation
├─ Live icon (dot): pulse independently
│  ├─ Scale: 1 → 1.2 → 1 (1s, ease-in-out)
│  └─ Offset: 0.3s after opacity pulse (staggered feel)
└─ Conversation starter: "12 watching now" (updates in real-time)

Multiple Live Sessions:
└─ Stagger pulse timing by 200ms for visual distinction
```

### Typing Indicator

```
"Person is typing..." indicator:
├─ Three dots animation:
│  ├─ Dot 1: scale 1 → 1.3 → 1 (800ms, ease-in-out)
│  ├─ Dot 2: offset +150ms
│  ├─ Dot 3: offset +300ms
│  └─ Loop: infinite
├─ Color: --muted-foreground (subtle, not distracting)
├─ Opacity: 0.7 (faded, not urgent)
└─ Icon: optional speaker/microphone icon

Animation Example (CSS):
```css
@keyframes typing {
  0%, 60%, 100% { transform: translateY(0); }
  30% { transform: translateY(-8px); }
}

.typing-indicator span:nth-child(1) { animation: typing 0.8s infinite; }
.typing-indicator span:nth-child(2) { animation: typing 0.8s 0.15s infinite; }
.typing-indicator span:nth-child(3) { animation: typing 0.8s 0.3s infinite; }
```
```

### Real-Time Counter Update

```
When Counter Changes (views, likes, followers):
├─ Animation 1 (Scale Pulse):
│  ├─ Scale: 1 → 1.15 → 1
│  ├─ Timing: 150ms, cubic-bezier(0.34, 1.56, 0.64, 1)
│  └─ Starts immediately
├─ Animation 2 (Color Flash):
│  ├─ Background: transparent → rgba(primary, 0.2) → transparent
│  ├─ Timing: 200ms, ease-out
│  └─ Offset: +50ms (after scale starts)
├─ Number Update: instant (optimistic)
└─ Server Confirmation: silent update if no change

Example Flow:
├─ T=0ms: User sees count + 1, scale pulse starts
├─ T=50ms: Color flash starts
├─ T=150ms: Scale animation completes
├─ T=200ms: Color animation completes
├─ [Server confirms] → silent update
└─ [Server mismatch] → subtle correction (undo animation)
```

---

## 8. LOADING STATES & SKELETON ANIMATIONS

### Skeleton Shimmer Pattern

```
Anatomy:
├─ Base color: --muted (placeholder shape)
├─ Shimmer gradient: linear-gradient(90°, transparent, rgba(white, 0.2), transparent)
├─ Animation: translateX(-100% → 100%) over 1.5s
└─ Easing: ease-in-out (start slow, fast middle, slow end)

Applied To:
├─ Feed card skeletons (while loading posts)
├─ Profile data (while fetching user)
├─ Image placeholders (while lazy-loading)
├─ Comments/replies (while loading thread)

Timing:
├─ Appears: when content starts loading
├─ Disappears: when real content is ready
├─ Fade-out: 200ms ease-out (not abrupt swap)
└─ Duration: 1.5s per cycle (loop)
```

### Page Transition Fade

```
Navigation Between Routes:
├─ Old page fade: 1 → 0 (300ms, ease-out)
├─ New page fade: 0 → 1 (300ms, ease-out)
├─ Offset: -100ms (overlap, no blank screen)
├─ Scale (optional): new page 0.98 → 1 (subtle)
└─ Total perceived duration: ~300ms

Error State Fade:
├─ If page fails to load: show error state (same fade-in timing)
└─ Retry button: ready immediately
```

### Skeleton Card Pulse (Alternative to Shimmer)

```
For Long-Load Content:
├─ Background: --muted
├─ Opacity pulse: 0.7 → 1 → 0.7
├─ Duration: 2s ease-in-out, infinite
├─ No horizontal shimmer (less intense)
└─ Feels more like "placeholder waiting for content"
```

---

## 9. GESTURE ANIMATIONS (Mobile)

### Pull-to-Refresh

```
Gesture: User pulls down from top
├─ Scroll Zone: top 60px
├─ Pull Feedback:
│  ├─ Refresh icon rotates: 0 → 180° (follows finger, proportional)
│  ├─ Icon opacity: 0.4 → 1 (as threshold approaches)
│  └─ Text: "Pull to refresh" → "Release to refresh" (at 60px)
├─ Release & Refresh:
│  ├─ Icon spins: continuous rotation (1s, linear) while loading
│  ├─ Content fades in when loaded (200ms, ease-out)
│  ├─ Scroll springs back (400ms, cubic-bezier(0.34, 1.56, 0.64, 1))
│  └─ Success toast: "Updated just now"
└─ Cancel (Release before threshold):
   └─ Scroll springs back (400ms)
```

### Swipe-to-Delete/Archive (List Items)

```
Gesture: User swipes right on item
├─ Drag Feedback:
│  ├─ Item follows finger (no easing, real-time)
│  ├─ Background color shifts: transparent → danger
│  ├─ Trailing icon appears: "Archive" or trash icon
│  └─ Opacity: 0 → 1 (follows drag distance)
├─ Release & Decision:
│  ├─ If > 40% swiped:
│  │  ├─ Item slides out (ease-in, 300ms)
│  │  ├─ Item fades (0 → 0, 300ms)
│  │  └─ Undo toast appears (slide-up, 250ms)
│  └─ If < 40% swiped:
│     ├─ Item snaps back (spring, 400ms)
│     └─ Action canceled
└─ Undo Action:
   └─ Item slides back in (spring, 400ms) or fades in (200ms)
```

---

## 10. FRAMER MOTION IMPLEMENTATION GUIDE

### Installation & Setup
```jsx
// components/motion/MotionProvider.jsx
import { AnimatePresence } from 'framer-motion';
export function MotionProvider({ children }) {
  return <AnimatePresence mode="wait">{children}</AnimatePresence>;
}
```

### Button Tap Animation
```jsx
import { motion } from 'framer-motion';

export function MotionButton({ children, onClick }) {
  return (
    <motion.button
      whileHover={{ backgroundColor: 'rgba(99, 102, 241, 0.9)' }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
    >
      {children}
    </motion.button>
  );
}
```

### Feed Card Entry Animation
```jsx
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  exit={{ opacity: 0, y: -20 }}
  transition={{ duration: 0.3, ease: 'easeOut' }}
>
  {/* Card content */}
</motion.div>
```

### Gift Send Animation (Emoji Path)
```jsx
<motion.div
  initial={{ x: 0, y: 0, scale: 0.6, opacity: 0 }}
  animate={{ 
    x: targetX, 
    y: targetY, 
    scale: 1.2, 
    opacity: 1 
  }}
  exit={{ scale: 0.5, opacity: 0 }}
  transition={{
    duration: 0.8,
    ease: [0.34, 1.56, 0.64, 1], // spring curve
  }}
>
  🎁
</motion.div>
```

### Confetti Particle System
```jsx
// components/Confetti.jsx
import confetti from 'canvas-confetti';

export function triggerConfetti() {
  confetti({
    particleCount: 40,
    spread: 70,
    origin: { x: 0.5, y: 0.5 },
    colors: ['#6366f1', '#a78bfa', '#ec4899', '#10b981'],
    duration: 2500,
  });
}
```

---

## 11. MOTION TESTING CHECKLIST

- [ ] All animations respect `prefers-reduced-motion`
- [ ] 60fps performance on Pixel 4 (lower-end mobile)
- [ ] No layout shift (use transform, not position)
- [ ] Easing curves consistent across similar animations
- [ ] Timing tests: stagger, overlap, sequential
- [ ] Accessibility: animations don't distract from content
- [ ] Mobile gesture animations test on iOS + Android
- [ ] Sound (if used) optional and user-controllable

---

**Motion Summary:** Every interaction is purposeful, performant, and delightful. StudentOS motion makes users feel in control, celebrated, and excited to create and connect.