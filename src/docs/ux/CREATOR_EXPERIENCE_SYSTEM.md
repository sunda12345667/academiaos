# StudentOS — Creator Experience System
*v1.0 | 2026-05-09*

---

## 1. Creator UX Philosophy

Creators must always know three things at a glance:
1. **Am I growing?** (follower velocity)
2. **Am I earning?** (revenue this week)
3. **What should I do next?** (actionable insight)

The creator dashboard is NOT a reporting tool. It is a **motivation machine**.

---

## 2. Creator Dashboard Architecture

### Above-the-Fold (first screen, no scroll)

```
┌─────────────────────────────────────────────┐
│  Good morning, [Name] ☀️                    │
│                                              │
│  [Tier badge: PRO] [Streak: 🔥 7 days]      │
│                                              │
│  ┌────────────┐  ┌────────────┐             │
│  │ This week  │  │ All time   │             │
│  │ ₦12,400   │  │ ₦87,000   │             │
│  │ +23% ↑    │  │ ↗ trending │             │
│  └────────────┘  └────────────┘             │
│                                              │
│  [Post Now]  [Go Live]  [See Analytics]     │
│                                              │
│  ── Today's insight ──────────────────────  │
│  "Best time to post today: 6PM–8PM"         │
└─────────────────────────────────────────────┘
```

### Key Design Decisions

- **Revenue is shown first** (not views or followers) — because revenue is the reason creators stay
- **Trend indicator** (▲▼) shown next to every metric — absolute numbers without trend are meaningless
- **Three-button CTA row** always visible — no hunting for the create button
- **Single AI insight** per day — not a wall of data, one actionable thing
- **Streak shown prominently** — daily return mechanic for creators

---

## 3. Live Session Entry UX

### Pre-Live Setup Flow (max 3 steps)

```
Step 1 — Title + Type (30 seconds max)
  - Title input (required, placeholder: "What are you teaching today?")
  - Session type selector (chips): Lecture / Q&A / Study Room / Creator Stream
  - Thumbnail: auto-generate from camera frame, tap to change
  - Schedule toggle: "Now" or "Later" (later = date/time picker)
  
Step 2 — Audience Settings (optional, skippable)
  - Visibility: Public / Followers only / School only
  - Allow gifts: YES (default) / NO
  - Allow questions: YES (default)
  - Moderation mode: Open / Slow / Subscribers only
  
Step 3 — Camera Check + Go Live
  - Camera preview fills screen
  - Mic level indicator (visual waveform — are they being heard?)
  - "Start in 5...4...3..." countdown on tap (builds anticipation)
  - Camera flip button prominent (most creators switch mid-setup)
```

### In-Live Creator View

```
┌─────────────────────────────────────────────┐
│ [CAM VIEW - fills screen]                   │
│                                              │
│  👁 47 watching      🎁 ₦2,100 earned       │ ← top bar (transparent overlay)
│                                              │
│                              [reaction flood] │
│              🎓 🚀 ❤️          ← viewer reactions float up-right
│                                              │
│  📌 [pinned question: "How do I solve..."]  │ ← pinned at center
│                                              │
│  [gift animation: 💎 Diamond gift from Ada] │ ← full-screen burst, 3 seconds
│                                              │
│  ─────── Live chat (bottom 25%) ──────────  │
│  Ada: You're amazing 🔥                     │
│  Tunde: Can you explain Q3?                 │
│  [Type a message...]                         │
│                                              │
│  [📌][🎤][🔁][✕ End]                       │ ← creator control bar, bottom
└─────────────────────────────────────────────┘
```

### Gift Animation System (in-live)

```
Gift tiers and animations:
  Common (< 500 coins):  Small emoji float upward from bottom-right
  Rare (500–1,999):      Emoji burst + name callout: "Ada sent a 📚!"
  Epic (2,000–9,999):    Full-screen banner for 2 seconds + sound cue
  Legendary (10,000+):   FULLSCREEN takeover 3 seconds + confetti + sound
                          Creator's earnings counter animates upward

Design rules:
  - Animations NEVER obscure the content/speaker permanently
  - Common gifts: subtle, non-intrusive (viewer experience is primary)
  - Legendary gifts: justified full-screen (earned by sender's generosity)
  - All animations have reduce-motion fallback (plain text only)
```

---

## 4. Creator Analytics UX

### Anti-Pattern: The Spreadsheet Dashboard
Most creator tools show tables of numbers. This is wrong. Numbers without emotional context do not drive behavior.

### Correct Pattern: The Progress Narrative

```
"Your audience grew 18% this week. Your Thursday post about thermodynamics
drove most of that growth — it was your most-watched video in 30 days."

NOT:
"Followers: 847 (+128). Views: 12,400. Engagement rate: 7.2%."
```

### Analytics Screen Layout

```
Top: Trend summary sentence (AI-generated, plain language)
Mid: 3 sparkline cards (Followers / Views / Earnings — this week vs last week)
     Tap each to expand full 30-day chart
Bot: "Best performing content" → 3 top posts (thumbnail + metric)
     "Audience breakdown" → campus distribution donut chart
     "Next milestone" → progress bar: "87 followers until Pro tier"
```

### Milestone Celebration UX

```
100 followers reached:
  Full-screen celebration: confetti + "100 people chose to follow you"
  Share button: "Share this moment" → auto-generates image with number
  
First ₦1,000 earned:
  Earnings widget pulses → tap → "Your first ₦1,000 🎉"
  Toast: "Tap to withdraw or keep growing"
  
Pro tier achieved:
  Modal overlay: "You're now a Pro Creator"
  Animated badge reveal
  List of newly unlocked features
  CTA: "Set up your subscriber list"
```

---

## 5. Post Creation UX

### Composer Design (mobile-first)

```
Route: /create (full-screen, no app chrome while composing)

Layout:
  Top bar: [Cancel] .............. [Post] (primary button, grayed until content added)
  Media area: camera icon (tap to add media) — fills center
  Text area: below media (or full-screen if text-only)
  Bottom toolbar: [📷 Photo] [🎥 Video] [📊 Poll] [📚 Resources] [🔗 Link]
  
Progressive composition:
  Default: text cursor active (fastest to start)
  Add media: image/video picker slides up from bottom
  Add poll: poll builder replaces text area
  
Mention (@username):
  Type @ → suggestions appear above keyboard (contact list style)
  Real-time search, campus-prioritized results
  
Hashtag (#topic):
  Type # → trending hashtag suggestions above keyboard
  Bold in-composer as typed
  
Character limit:
  Progress indicator appears at 80% of max (not from zero)
  Circle fills around the Post button
  Hard limit: subtle shake + red flash (no character counter visible until 80%)
```

---

## 6. Creator Identity Expression

### Profile Customization Points

```
Cover image: Full-width banner (desktop) / 2:1 ratio (mobile)
  → 5 curated templates if no custom image (campus colors, gradients)

Avatar: Circle crop, 400×400 minimum
  → Animated avatar support (Phase 2 — GIF profile pictures for Elite tier)

Bio: 150 chars, support bold/italic via markdown shortcuts
  → "Academic niche" chip visible below bio (set during onboarding)

Creator links: 3 external links max (YouTube, TikTok, Twitter, etc.)
  → Displayed as branded icon buttons (not raw URLs)
  
Featured posts: 3-post pinned grid at top of profile
  → Creator selects manually ("Pin this post")
  → Shows before chronological feed
  
Tier badge placement:
  → Adjacent to name, always visible (Verified = checkmark, Elite = gold checkmark)
  → On every post card, comments, messages (consistent identity)
``