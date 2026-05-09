# StudentOS — Feed Experience Framework
*v1.0 | 2026-05-09*

---

## 1. Feed Psychology

The feed is not a list. It is a **variable reward machine** governed by three psychological drives:
1. **Curiosity gap** — What is the next post? (infinite scroll)
2. **Social comparison** — What are people like me engaging with?
3. **Local identity** — What's happening at my campus right now?

---

## 2. Feed Content Hierarchy

### Post Rendering Tiers

Every post rendered in the feed gets a visual weight based on type:

```
Tier 1 — LIVE SESSION (highest visual weight)
  - Full-bleed banner: pulsing red "LIVE" pill + viewer count
  - Creator avatar + name + stream title
  - "Join Now" CTA button (primary, full width on mobile)
  - Dismissable only by explicit swipe-away
  - Never collapses to standard card height
  
Tier 2 — VIDEO POST (second highest)
  - Auto-plays (muted) when 80% in viewport
  - Cover image shown until autoplay triggers (< 500ms)
  - Vertical aspect ratio prioritized (9:16 fills screen on video feed tab)
  - Interaction bar: like/comment/share/gift overlay on video
  - Duration badge top-right
  
Tier 3 — IMAGE POST (standard)
  - Single image: fill card width, maintain aspect ratio
  - Multi-image: 2-up grid (swipeable)
  - No auto-expand — tap to full-screen
  
Tier 4 — TEXT POST (minimal)
  - Background color from creator's brand color (or campus color)
  - Large type if short (< 100 chars): 24px, centered
  - Regular if long (> 100 chars): 16px, left-aligned, truncated at 3 lines
  
Tier 5 — POLL (interactive)
  - Always shows current % even before voting
  - Vote → immediate optimistic update (bar fills)
  - "See results" appears after vote
  
Tier 6 — COURSE PREVIEW (lowest visual weight in main feed)
  - Smaller card with course thumbnail
  - "Course • N lessons" badge
  - Enroll CTA in-card (no navigation required)
```

---

## 3. Feed Interaction Placement (Thumb-Zone Architecture)

### Mobile Thumb Zone Map

```
Screen (375px × 812px iPhone SE)

┌─────────────────────┐
│ [CONTENT AREA]      │  ← Top 60%: display only, no interaction required
│                     │
│                     │
│                     │
│                     │
├─────────────────────┤
│ [INTERACTION ZONE]  │  ← Bottom 40%: all primary interactions here
│                     │
│ ❤️  💬  ↗️  🎁  ···  │  ← Action bar: exactly 44px tall, 5 icons
│                     │
│ Creator name        │
│ Caption text        │
└─────────────────────┘
   [ Bottom Nav ]
```

### Action Bar Design

```
Like button:     Far left (dominant thumb reach, most-used)
Comment:         Second from left
Share:           Center (native share sheet on mobile)
Gift:            Second from right (monetization, intentional positioning)
More (...):      Far right (report, save, copy link)

Like interaction: Double-tap anywhere on content = like (TikTok pattern)
  → Heart explosion animation from tap point
  → Haptic feedback: light impact (iOS) / vibrate(10ms) (Android)
  → Optimistic: count +1 immediately, sync in background

Comment:
  → Opens bottom sheet (not new page on mobile)
  → Comment box auto-focused at bottom
  → Keyboard pushes comment list up (not page)
  → Draft persists if user dismisses (not lost)

Gift:
  → Opens bottom sheet: gift catalog
  → Categories: Appreciation / Educational / Premium
  → Confirm with single tap (not two-step for < ₦500)
  → Two-step for > ₦2,000 (intentional friction at high value)
```

---

## 4. Infinite Scroll Architecture

### Loading Strategy (perceived speed > actual speed)

```
Pre-fetch window: Load next 5 posts when user is 3 posts from end
  → User never sees empty feed
  → Fetch happens during reading, not during scrolling
  
Content diversity injection:
  Every 5 posts: 1 creator recommendation card
  Every 10 posts: 1 "Join this group" campus card
  Every 15 posts: 1 trending topic prompt
  Every 20 posts: 1 sponsored post (Phase 3)
  
Session freshness:
  After 30 minutes: "Caught up! Here's new content →" (refresh signal)
  After 60 minutes: Soft prompt to switch tabs (prevents feed addiction spiral)
  
Scroll position memory:
  Leave feed → return to feed → exact scroll position restored
  User never loses place (critical for session continuation)
```

### Content Deduplication Rule

```
Same post NEVER appears twice in a session (even if ranking score changes)
Track seen post IDs in session memory (not persisted)
This prevents the "I keep seeing this" complaint
```

---

## 5. Video Feed (Vertical/TikTok-Style)

### Triggered by "Video" tab in feed navigation

```
Layout: Full-screen vertical (no card borders, no padding)
Navigation: Swipe up = next, swipe down = previous
Audio: Muted by default, unmute tap anywhere on video
Controls: No seek bar (pure consumption experience)
Creator info: Overlay bottom-left (username, caption, hashtags)
Actions: Overlay bottom-right (like, comment, share, gift, follow)
Music/audio: Bottom center (spinning disc icon) if background music used
```

### Video Feed Interaction Specifics

```
Autoplay on entry: YES (muted)
Loop: YES (infinite for < 30 second videos)
Auto-advance: On completion (for videos < 60s) → 2-second pause → next
Progress bar: Thin line at bottom edge (minimal, not full controls)
Double-tap: Like (heart animation at tap point)
Long-press: Pause (similar to Instagram Stories)
Swipe left: Creator profile overlay (slide in from right, stays below video)
```

---

## 6. Feed Empty States (no generic "nothing here")

```
First-time feed (no follows):
  Title: "Your feed is waiting"
  Body: "Follow 3 creators to bring it to life. We'll handle the rest."
  CTA: "Discover people from [User's School]" → search filtered by school

After unfollowing many people:
  Title: "Getting quiet in here"
  Body: "Your discover tab always has something. Or follow someone new."
  CTA: "Explore Discover"

Offline:
  Title: "You're offline"
  Body: "Here's what you were reading earlier"
  Shows: last 10 cached posts (stale badge on cards)
  CTA: "Retry connection"

No new content (all caught up):
  Title: "You're all caught up"
  Body: "New posts from people you follow will appear here"
  Shows: "While you wait" → 3 recommended creators
```

---

## 7. Realtime Feed Signals (Feed Feels Alive)

```
New post from followed creator:
  → Floating pill at top: "2 new posts — tap to see"
  → Tapping scrolls to top smoothly
  → NOT an auto-refresh (user controls when they see new content)

Someone goes live (followed creator):
  → Persistent live bar under mobile header (red pulse, dismissable)
  → "CreatorX is live — 23 watching"
  → Tap: enter live session in-place (slide up)

Popular post trending:
  → Small fire emoji + "Trending" overlay on card
  → "127 people from UNILAG are reading this"

Engagement on your post:
  → Heart counter on your posts in feed animates when new likes come in
  → Small "+3" badge fades in and out (real-time)
``