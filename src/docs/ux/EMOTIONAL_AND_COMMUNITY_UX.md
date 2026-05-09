# StudentOS — Emotional Design & Community UX
*v1.0 | 2026-05-09*

---

## 1. Emotional Design Framework

### The Emotion Map

| Surface | Target Emotion | Anti-Emotion (avoid) | Primary Trigger |
|---|---|---|---|
| Feed | Surprise + curiosity | Boredom, overwhelm | Variable reward content |
| Creator Dashboard | Confidence + momentum | Anxiety, confusion | Earnings visibility |
| Live Session | Excitement + belonging | Isolation | Real-time signals |
| DMs | Warmth + intimacy | Cold, transactional | Read receipts, presence |
| Wallet | Trust + control | Fear + opacity | Clear transaction history |
| Onboarding | Delight + anticipation | Friction, interrogation | Content preview before ask |
| Empty states | Hope + invitation | Abandonment | Specific action prompts |
| Achievements | Pride + recognition | Emptiness | Shareable milestones |
| Moderation notice | Fairness + clarity | Shame, confusion | Reason always explained |

---

## 2. Variable Reward Architecture

### Why Variable Rewards Work

The engagement loop runs on intermittent reinforcement: unpredictable rewards create stronger behavioral loops than predictable ones. Every social app exploits this. StudentOS does it ethically — rewards are real (followers, earnings, learning outcomes), not fabricated urgency.

```
Fixed rewards (every time — build reliability):
  Post published → "Posted ✓" confirmation
  Message sent → delivered receipt
  Withdrawal initiated → "On its way" notification
  
Variable rewards (sometimes — build the "check" behavior):
  Post goes trending unexpectedly
  Creator responds to your comment personally
  First gift received (timing unpredictable)
  Post reaches someone from a different campus
  Follower milestone while you were sleeping
```

### Reward Delivery Timing

```
Immediate (< 500ms): Like, follow, send — the micro-rewards of social engagement
Short-delay (1–5s):  Comment reply notification, message delivered
Delayed (hours):     Follower milestone, earnings milestone, post trending
Surprise:            Featured in discover, campus trending, streak bonus
```

---

## 3. Onboarding Delight System

### Philosophy: Earn attention before asking anything

```
Screen 1: THE PREVIEW (8 seconds, not skippable)
  What: Animated collage of real student content from the platform
  Why: Show the product before asking for anything
  Visual: Masonry grid of real posts + smooth entrance animation
  Copy: "Your campus. Your creators. Your platform."
  CTA: Appears after 8 seconds: "Let's go →"
  
  Psychological principle: Show before tell. The content answers
  "What is this?" better than any marketing copy.

Screen 2: WHAT ARE YOU STUDYING? (< 30 seconds)
  What: Interest chip selection (multi-select, academic + social topics)
  Min selection: 3 (enforced — below 3, CTA stays disabled)
  Feedback: Each chip bounces + fills on select (spring animation)
  Copy: "Select the things that matter to you."
  Subtext: "We'll use this to build your feed."
  Progress: Minimal dot indicator (not numbered steps — avoids anxiety)

Screen 3: FIND YOUR CAMPUS (< 20 seconds)
  What: School search (auto-populated from geolocation)
  Social proof: "[X] students from [School] are already here"
  Visual: Blurred preview of real content from that school
  Copy: "Your people are already here."
  
Screen 4: FOLLOW 3 CREATORS (< 60 seconds)
  What: Curated creator cards (school-matched first)
  Lock: "Continue" disabled until 3 followed
  Feedback: "Your feed is waking up" appears as follows accumulate
  Visual: Feed preview updates in real-time as follows are added
  
  Psychological principle: Investment creates commitment.
  Once users have followed 3 people, they have a stake in the platform.

Screen 5: THE REVEAL (no form, no friction)
  What: The actual feed loads. Real content. Their campus. Their interests.
  Copy: Single line fades in: "This is yours now."
  CTA: "Start exploring →" (barely visible — they don't need it, they're already scrolling)
  
  Psychological principle: Deliver the promised value immediately.
  The best onboarding ends with the user already in the product.
```

### Onboarding Progression Emotion Targets

```
Screen 1: "What is this?" (curiosity)
Screen 2: "Oh, this is for me" (recognition)
Screen 3: "My people are here" (belonging)
Screen 4: "I'm making choices" (investment)
Screen 5: "This is mine" (ownership)
```

---

## 4. Campus Identity UX

### Social Proof Systems (passive, non-intrusive)

```
On post cards:
  "Ada and 4 others from your school liked this"
  (shown when ≥ 2 social graph members interacted)
  Appears below creator name, muted foreground color

On creator profiles:
  "[X] students from UNILAG follow this creator"
  Shown only when viewer is from the same school
  
On groups:
  "Join 847 students from UNILAG in this group"
  "31 members active today" (engagement signal)
  
On trending section:
  "Trending at UNILAG" (not generic "Trending")
  "Most shared in Computer Science this week"
  
Discovery section:
  Groups sorted by campus density match (your school first)
  Creators sorted by "from your school" then "followed by people you follow"
```

### Department Identity Features

```
Profile display:
  [University name] · [Department] · [Year/Level]
  "UNILAG · Computer Science · 300L"
  
Post context signal:
  Same department as viewer → small "📚 From your department" chip
  Appears on post cards when: author.department === viewer.department AND author.school === viewer.school
  
Study group suggestions:
  After engaging with any academic post:
  Card injection into feed: "Join [Course Code] study group · [N] members from your school"
  
Campus leaderboard (groups section):
  "Top creators at UNILAG this week" horizontal scroll
  Rank badge (1st/2nd/3rd) on creator cards
```

---

## 5. Community / Group UX

### Group Experience Design

```
Group feed vs main feed differences:
  - Group posts show member role badge (Owner/Mod/Member)
  - Announcements pinned at top (distinct visual treatment — blue background)
  - "Post to group" CTA is prominent (groups exist for posting, not lurking)
  - Active member count shown in header: "47 active today"
  - New posts since last visit badge: "12 new posts since you were here"

Group real-time signals:
  - Members currently online: "[N] members online" (aggregate, not individual)
  - Recent activity: "[3 members] posted in the last hour"
  - New members: "[Name] just joined" appears in group feed inline (system post)
```

### Realtime Discussion Feel

```
Comment threads:
  New replies appear without refresh (RealtimeBus Post subscription)
  New reply indicator: "2 new replies ↓" pill inside thread
  Live typing indicator in fast threads: "[N] people are typing..."
  (aggregate only — not individual names in high-traffic threads)
  
Live chat (during sessions):
  Messages appear in real-time (RealtimeBus Message subscription)
  Emoji reactions float above chat panel
  Creator's messages: highlighted (gradient-brand left border)
  Moderator messages: subtle role badge
  
Chat density management:
  Slow mode (host-set): 30s cooldown per user → grayed input + countdown timer
  High traffic (> 50 msg/min): oldest messages fade out faster (2s TTL visible)
```

---

## 6. AI UX Integration

### Non-Intrusive AI Principles

```
AI never:
  - Takes over a screen without user request
  - Shows loading state attributed to AI (just loads like any content)
  - Interrupts content consumption with unsolicited suggestions
  - Labels suggestions with "ALGORITHM" or prominent "AI" branding

AI always:
  - Appears in clearly designated AI spaces (study assistant, creator insights)
  - Shows small "✦" marker on AI-generated recommendations (subtle, honest)
  - Has a one-tap dismiss on every AI surface
  - Explains its suggestion briefly: "Based on your Computer Science interest"
```

### Study Assistant UX

```
Entry: Floating button in Learn tab (bottom-right, brand gradient, 56px circle)
       NOT visible in Feed — prevents intrusion into social space

Chat interface:
  Header: "✦ AI Study Assistant" + school + course context chip
  Context chip: "UNILAG · Computer Science · 300L" → tap to change
  
  Quick start prompts (shown on empty state):
    "Explain [topic] like I'm a first-year"
    "Give me 5 practice questions on [topic]"
    "Summarize [topic] in bullet points"
    "Help me outline an essay on [topic]"
  
Response design:
  Streaming text (tokens appear as generated — not waiting for full response)
  Math equations: display properly (LaTeX → rendered via Phase 2 KaTeX)
  Code blocks: monospace, copy button
  Long responses: auto-collapsed with "Show more →" at 8 lines
  
  Follow-up prompts: 3 chips appear below every response
    "Go deeper →"  "Give an example →"  "Test me →"
  
Voice input: microphone in text field (Phase 2, mobile only)
```

### AI Creator Insights

```
Where: Creator Dashboard, below stats
Format: Single sentence, refreshed daily
Example outputs:
  "Engineering students from OAU are engaging with your content — they're a growing audience."
  "Your posts with diagrams get 2.3× more saves. Your next post might benefit from visuals."
  "Thursday 6PM is your peak. You haven't posted at that time in 2 weeks."
  
Implementation: InvokeLLM call with creator's top metrics, cached for 24h
Model: standard (cost-controlled — daily batch, not per-visit)
```

---

## 7. Realtime Interaction UX

### Latency Masking

```
Actions to make instant (optimistic, sync in background):
  Like / unlike → UI state changes immediately
  Follow / unfollow → button state changes immediately
  Send message → appears in thread immediately (pending state)
  React to post → reaction adds immediately
  Gift send → animation plays immediately

Actions to defer (show confirmed state):
  Wallet balance → show last known + stale indicator after 5 min
  Notification read count → decrement immediately, sync in background
  Post publish → show "live" state on post card, sync in background

Never block:
  Like button — if it blocks, it feels broken (even 200ms feels wrong)
  Follow button — immediate state change is the entire UX
  Chat input send — message must appear instantly
```

### Presence Design

```
Online indicator:
  Green dot: active in last 5 minutes
  No indicator: offline (never show "Offline" label — feels punitive)
  
DM presence:
  "[Name] is active now" — below their name in DM header when active
  Shows only when: they are active + user is viewing their DM thread
  
Read receipts:
  ✓ Sent → ✓✓ Delivered → ✓✓ Blue = Read
  Privacy: can be disabled in settings (symmetric — if you disable, you also can't see others')
  
Live viewer count:
  Updates every 15 seconds (not realtime — reduce unnecessary DB writes)
  Shown as: "47 watching" (no individual names)
``