# StudentOS — AI & Intelligence Layer Architecture

## System Overview

StudentOS's intelligence layer is a **multi-domain AI platform** powering:
- Feed ranking and content discovery
- Educational assistance and learning intelligence
- Creator discovery and audience modeling
- Behavioral analytics and retention prediction
- Moderation and trust infrastructure
- Search intelligence

---

## Architecture Map

```
┌─────────────────────────────────────────────────────────────┐
│                      CLIENT LAYER                           │
│  usePersonalization  useStudyAssistant  useFeed  useSearch  │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                  INTELLIGENCE ORCHESTRATION                  │
│                                                             │
│  ┌─────────────────┐  ┌──────────────────┐                  │
│  │  AI Gateway     │  │  Personalization  │                  │
│  │  ai.gateway.js  │  │  Engine           │                  │
│  │                 │  │  personalization  │                  │
│  │  fast / quality │  │  .engine.js       │                  │
│  │  search / vision│  │                   │                  │
│  └────────┬────────┘  └────────┬──────────┘                  │
│           │                    │                             │
│  ┌────────▼──────────────────▼──────────────────────────┐   │
│  │              DOMAIN SERVICES                          │   │
│  │                                                       │   │
│  │  education.ai.service   search.service               │   │
│  │  recommendation.service moderation.service           │   │
│  │  platform.analytics     behavioral.events            │   │
│  └───────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                  FEED INTELLIGENCE                           │
│  feed.service.js → ranking.engine.js → useFeed              │
└─────────────────────────────────────────────────────────────┘
```

---

## Provider Abstraction (ai.gateway.js)

### Routing Table

| Profile   | Model               | Use Cases                          | Cost Weight |
|-----------|---------------------|------------------------------------|-------------|
| `fast`    | gpt_5_mini          | Moderation, labels, quick answers  | 1×          |
| `quality` | claude_sonnet_4_6   | Quiz gen, study plans, explanations| 8×          |
| `search`  | gemini_3_flash      | Semantic search, web context       | 3×          |
| `vision`  | gemini_3_flash      | Image moderation, visual content   | 3×          |

### Fallback Chain
```
quality → fast (on error)
search  → fast (on error)
fast    → throw (terminal)
```

### Usage Metering
```js
getDailyUsage(userId) → { count, cost }
// Per-tier limits: free=20, basic=100, creator=500, admin=∞
// Future: Redis INCR with daily TTL
```

---

## Recommendation Infrastructure

### Entity Coverage

| Entity Type  | Strategies                                          |
|--------------|-----------------------------------------------------|
| Posts        | subject_match, social_graph, creator_affinity, trending |
| Creators     | followers_of_followers, subject_overlap, trending   |
| Groups       | subject_overlap, member_network, academic_fit       |
| Courses      | subject_match, social_proof, difficulty_fit         |
| Live Sessions| followed_host, subject_match, viewer_momentum       |
| Marketplace  | school_proximity, category_affinity, recency        |

### Scoring Pipeline
```
raw candidates
  → strategy score (0–1 per signal)
  → weighted interleave merge
  → personalization re-rank (+40% weight from taste profile)
  → diversity filter (author penalty)
  → persist to ContentRecommendation (served=true)
  → return with reason_labels
```

### Feedback Loop
```
served → clicked (CTR tracking) → dismissed (negative signal)
→ getRecommendationQuality() → byStrategy CTR analysis
→ future: dynamic weight adjustment per user cohort
```

---

## Personalization Engine (personalization.engine.js)

### UserTasteProfile Schema
```js
{
  subjectAffinity:    { math: 0.85, physics: 0.60 },   // normalized 0–1
  contentTypeAffinity:{ video: 0.7, article: 0.4 },    // normalized 0–1
  creatorAffinity:    { [creatorId]: 0.85 },            // engagement-derived
  engagementStyle:    'passive' | 'active' | 'interactive',
  preferredLength:    'short' | 'medium' | 'long',      // from avg completion rate
  retentionRisk:      'low' | 'medium' | 'high',        // churn prediction signal
  followingCount:     42,
  totalInteractions:  187,
  watchEventCount:    64,
  computedAt:         '2026-05-09T...',
}
```

### Signal Sources (ordered by trust weight)
1. Academic identity (declared subjects) — 30% base
2. Direct interactions (save > love > like > view) — weighted increments
3. Watch history (completion rate) — length preference
4. Social graph (followed creators) — creator affinity boost
5. Implicit time patterns — future (session timestamps)

### Cache Strategy (usePersonalization hook)
- Module-level Map: `profileId → { profile, computedAt }`
- 30-minute TTL (no network on subsequent renders)
- `invalidate()` for post-interaction refresh

---

## Educational AI System (education.ai.service.js)

### Capabilities

| Feature              | Model   | Use Case                           |
|----------------------|---------|------------------------------------|
| Topic Explanation    | quality | University-level concept breakdown |
| Quiz Generation      | quality | 5–20 MCQ with explanations         |
| Flashcard Generation | quality | Front/back from notes              |
| Note Summarization   | fast    | Bullets or paragraph style         |
| Study Plan           | quality | Weekly breakdown with resources    |
| Educational Search   | search  | Semantic Q&A with web context      |
| Assignment Guidance  | quality | Anti-plagiarism: outlines only     |
| Learning Insights    | fast    | Watch stats → personalized tips    |
| Content Moderation   | fast    | Post safety check pre-publish      |

### Anti-Plagiarism Stance
Assignment assistance returns:
- Suggested outline (structure only)
- Key concepts to research
- Methodology approach
- Reputable source types
**Never writes the assignment.**

---

## Search Intelligence (search.service.js)

### Scoring Signals (per entity)

| Signal           | Weight | Notes                              |
|------------------|--------|------------------------------------|
| Text match       | 50%    | Exact > starts-with > contains > word |
| Popularity       | 20%    | Log-normalized (prevents monopoly) |
| Recency          | 10%    | 30-day linear decay                |
| Trending boost   | 10%    | Viral velocity (posts only)        |
| Verified boost   | 8%     | Verified accounts/institutions     |
| Personalization  | 12%    | Taste profile relevance (if loaded)|

### Semantic Fallback
- Triggers when total results < 3
- AI generates search refinement suggestions
- Zero-results tracked as `search.zero_results` behavioral event

### Trending Searches
- In-memory sorted counter (module-level)
- Shown on empty search state
- Future: Redis sorted set with hourly decay

---

## Behavioral Event Pipeline (behavioral.events.js)

### Event Taxonomy
```
content.*  — feed impressions, clicks, video completion, shares
social.*   — follows, group joins, DMs
creator.*  — posts, live sessions, gift receives
learn.*    — quiz, flashcards, course enrollment, completions
search.*   — queries, result clicks, zero results, abandons
finance.*  — topups, gifts, payouts
session.*  — app open, page views, feature discovery
ai.*       — quiz gen, flashcards, summaries, search enhance
```

### Queue Mechanism
- 10-event batch threshold → immediate flush
- 5-second interval → background flush
- `beforeunload` + `visibilitychange` → final flush
- Dev mode: console.debug output
- Prod migration: POST to `/api/events` → Kafka

---

## AI Moderation Pipeline (moderation.service.js)

### Two-Stage Check
```
Stage 1: Rule-based (free, ~0ms)
  - Link spam (>3 URLs)
  - Excessive caps (>70%)
  - Scam patterns (9 regex patterns)
  - Phone harvesting
  → If HIGH severity: skip to action, no AI cost

Stage 2: AI check (gpt_5_mini, ~1-2s)
  - Spam, hate speech, adult content, scams, harassment, misinformation
  → Merge with rule result (take higher severity)
```

### Severity → Action Map
| Severity | Action    | Post Visible | Queue         |
|----------|-----------|--------------|---------------|
| none     | allow     | ✅ Yes        | —             |
| low      | flag      | ✅ Yes        | Background    |
| medium   | review    | ✅ Yes        | Moderator Q   |
| high     | auto_hide | ❌ No         | Escalated     |

---

## A/B Testing & Feature Flags (personalization.engine.js)

### Current Experiments
```js
const EXPERIMENTS = {
  feed_ranking_v2:  { enabled: false, rollout: 0.0 },
  quiz_gen_inline:  { enabled: true,  rollout: 1.0 },
  semantic_search:  { enabled: false, rollout: 0.0 },
  creator_ai_tips:  { enabled: true,  rollout: 0.5 },
};
```

### Bucketing Algorithm
- Deterministic hash (31× polynomial) on userId
- Stable across sessions (same user → same bucket always)
- No network call required
- Future: LaunchDarkly / GrowthBook SDK replacement

---

## Analytics Intelligence

### Creator Analytics (platform.analytics.js)
- `getCreatorAnalytics(id, { days })` → earnings, content performance, gifts, followers
- `getRecommendationQuality(id)` → CTR and dismiss rate per strategy
- `getPlatformMetrics({ days })` → platform revenue, gifting, content, growth

### Watch Analytics (watch.service.js)
- Per-content completion rates (used in ranking.engine as watchTimeBonus)
- User watch history (used in recommendation filtering)
- Creator watch analytics (avg completion per post)

---

## Migration Roadmap

### Phase 1 — Current (MVP Client-Side)
- All AI/recommendation logic runs in browser
- No server-side compute costs
- Bounded DB queries (all paginated)
- Behavioral events buffered in memory

### Phase 2 — Server Pre-Computation
- Taste profiles computed nightly on server
- Stored in Redis (24h TTL per user)
- Recommendation results pre-computed hourly
- Behavioral events → POST to backend → DB storage

### Phase 3 — Streaming Infrastructure
- Kafka topics: `behavioral-events`, `post-interactions`, `watch-events`
- ClickHouse: materialized views for DAU, retention, engagement funnels
- Redis: trending sorted sets, taste profile cache
- BullMQ: async AI jobs (quiz gen, moderation, summaries)

### Phase 4 — ML Models
- Two-tower embedding model (user × content vectors)
- Online feature store (Feast) for real-time feature serving
- SageMaker / Vertex AI for model hosting
- A/B framework: LaunchDarkly / GrowthBook
- Inference target: <50ms p99 for ranking
- Recommendation freshness: 5-minute cache invalidation

### Phase 5 — Advanced AI
- Fine-tuned BERT for Nigerian English toxicity detection
- LLM-generated personalized push notification copy
- AI-generated study schedules from learning progress
- Predictive churn intervention (retention email triggers)
- Semantic vector search (Pinecone / Weaviate for posts + courses)

---

## Key Design Principles

1. **Provider agnosticism** — model names live only in `ai.gateway.js`
2. **Fire-and-forget** — analytics/recommendations never block UI
3. **Graceful degradation** — all AI calls have fallbacks (fast model or null)
4. **Signal isolation** — each service owns its data, no cross-service state
5. **Behavioral completeness** — every meaningful action emits a structured event
6. **Anti-plagiarism by design** — educational AI guides, never completes
7. **Privacy first** — no PII in behavioral events, user IDs only
8. **Bounded queries** — all DB reads have explicit limits (no unbounded scans)