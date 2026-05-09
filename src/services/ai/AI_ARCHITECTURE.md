# StudentOS AI & Intelligence Architecture

## System Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                   AI INTELLIGENCE LAYERS                         │
├──────────────────────────────────────────────────────────────────┤
│  UI Layer          useStudyAI / useSearch / useFeed hooks        │
│  Intelligence      search.service / personalization.engine       │
│  AI Gateway        ai.gateway.js — provider-agnostic LLM calls   │
│  Recommendation    recommendation.service — 7 strategy pipeline  │
│  Behavioral        behavioral.events.js — structured event bus   │
│  Analytics         platform.analytics / watch.service            │
│  Feed Ranking      ranking.engine — multi-signal post scorer     │
└──────────────────────────────────────────────────────────────────┘
```

## AI Gateway

### Provider Routing

| Profile | Model | Use Cases | Cost Weight |
|---|---|---|---|
| `fast` | gpt_5_mini | Feed labels, moderation, summaries, search fallback | 1× |
| `quality` | claude_sonnet_4_6 | Quiz gen, flashcards, study plans, explanations | 8× |
| `search` | gemini_3_flash | Semantic search, educational Q&A (web context) | 3× |
| `vision` | gemini_3_flash | Content moderation with images | 3× |

### Fallback Chain

```
quality → fast → graceful degradation (return null, show error)
search  → fast → show "Try a different query"
```

### Rate Limits (daily per user)

| Tier | Calls/Day |
|---|---|
| free | 20 |
| basic | 100 |
| pro/creator | 500 |
| admin | unlimited |

### Usage

```js
import aiGateway, { PROMPTS } from '@/services/ai/ai.gateway';

// Simple completion
const text = await aiGateway.aiComplete(PROMPTS.NOTE_SUMMARIZE(content, 'bullets'), {
  profile: 'fast', useCase: 'note_summary', userId
});

// Structured JSON response
const result = await aiGateway.aiStructured(PROMPTS.QUIZ_GENERATE(topic, 5, 'hard'), schema, {
  profile: 'quality', useCase: 'quiz_gen', userId
});
```

---

## Educational AI Features

### Capability Surface

| Feature | Profile | Response |
|---|---|---|
| `explainTopic(topic, level)` | quality | `{ explanation: string }` |
| `generateQuiz(topic, count, difficulty)` | quality | `{ questions: [...] }` |
| `generateFlashcards(content, count)` | quality | `{ cards: [{front, back}] }` |
| `summarizeNotes(content, style)` | fast | `{ summary: string }` |
| `generateStudyPlan(subject, duration)` | quality | `{ weeks: [...] }` |
| `educationalSearch(query)` | search | `{ answer: string }` |
| `getAssignmentGuidance(topic, type)` | quality | `{ guidance: string }` |
| `moderateContent(content)` | fast | `{ safe, flags, severity }` |
| `getLearningInsights(stats)` | fast | `{ insights, engagement_level }` |

### Anti-Plagiarism Stance

`getAssignmentGuidance` returns:
- Suggested outline (sections, NOT full text)
- Key concepts to research
- Methodological approach (HOW to work, not the work itself)
- Reputable source types

The model is explicitly instructed NOT to write the assignment.

### Hook Usage

```jsx
const {
  explanation, explanationLoading,
  quiz, quizLoading,
  flashcards, flashcardsLoading,
  summary, summaryLoading,
  studyPlan, planLoading,
  explainTopic, generateQuiz, generateFlashcards,
  summarizeNotes, generateStudyPlan, educationalSearch,
  dailyUsage,
} = useStudyAI();

await explainTopic('Newton\'s Laws', { level: 'secondary' });
```

---

## Personalization Engine

### UserTasteProfile Schema

```js
{
  userProfileId: string,
  subjectAffinity:      { "mathematics": 0.9, "physics": 0.7, ... },  // 0–1
  contentTypeAffinity:  { "video": 0.6, "article": 0.3, ... },        // 0–1
  creatorAffinity:      { [profileId]: 0.85, ... },                   // 0–1
  engagementStyle:      "passive" | "active" | "interactive",
  preferredLength:      "short" | "medium" | "long",
  retentionRisk:        "low" | "medium" | "high",
  computedAt:           ISO datetime,
}
```

### Signal Weights for Subject Affinity

| Signal | Weight |
|---|---|
| Academic identity subjects | +0.3 |
| User preferences | +0.2 |
| Save interaction | +0.15 |
| Love/insightful reaction | +0.12 |
| Share | +0.10 |
| Like | +0.08 |
| View | +0.02 |

### A/B Experiment Bucketing

```js
personalizationEngine.isInExperiment(userId, 'feed_ranking_v2')
// → stable hash-based 50% rollout
// → when true: personalized strategy (50%) replaces default blend
```

Current experiments:

| Experiment | Enabled | Rollout |
|---|---|---|
| `feed_ranking_v2` | false | 0% |
| `quiz_gen_inline` | true | 100% |
| `semantic_search` | false | 0% |
| `creator_ai_tips` | true | 50% |

---

## Recommendation System

### Strategy Roster (Default)

| Strategy | Weight | Signal |
|---|---|---|
| `subject_match` | 30% | tasteProfile.subjectAffinity × tag overlap |
| `social_graph` | 30% | saves by followed users |
| `creator_affinity` | 25% | tasteProfile.creatorAffinity top creators |
| `trending` | 15% | viral velocity (interactions/hour) |

### Personalized Variant (A/B: feed_ranking_v2)

| Strategy | Weight |
|---|---|
| `personalized` | 50% |
| `trending` | 25% |
| `social_graph` | 25% |

### Recommendation Feedback Loop

```
serve rec → ContentRecommendation.served=true
user clicks → ContentRecommendation.clicked=true
user dismisses → ContentRecommendation.dismissed=true
getRecommendationQuality() → CTR per strategy → weight adjustment (future ML)
```

### Extended Recommenders

```js
// Get creator recommendations
await recommendationService.getCreatorRecommendations(userProfileId);

// Get group recommendations (subject-matched)
await recommendationService.getGroupRecommendations(userProfileId);

// Get course recommendations (subject-matched + enrollment count)
await recommendationService.getCourseRecommendations(userProfileId);
```

---

## Search Intelligence

### Scoring Signals

| Signal | Weight | Description |
|---|---|---|
| Text match quality | 50% | exact > starts-with > contains > word-level |
| Popularity | 20% | log-normalized follower/enrollment count |
| Recency | 10% | freshness over 30-day window |
| Trending boost | 10% | viral velocity for posts |
| Verification boost | 8% | verified accounts/institutions |
| Personalization | 12% | taste profile relevance |

### Semantic Fallback

When search returns < 3 results:
- AI generates search refinement suggestions
- "Did you mean...?" style guidance
- Shown inline in results page

### Trending Searches

In-memory sorted map updated on every search.
Future: Redis sorted set with sliding 24h window.

### Hook Usage

```jsx
const { query, setQuery, results, loading, trending, trackResultClick } = useSearch({ tabs: ['users', 'courses'] });
```

---

## Behavioral Event Pipeline

### Event Taxonomy

| Namespace | Events |
|---|---|
| `content.*` | impression, click, video_start, video_complete, like, save, share, comment, dismissed |
| `social.*` | follow, unfollow, group_join, group_leave, dm_sent, profile_view |
| `creator.*` | post_create, live_start, live_end, gift_receive, replay_publish |
| `learn.*` | quiz_start/complete, flashcard_view, course_enroll, lesson_complete, notes_summary |
| `search.*` | query, result_click, zero_results, abandon |
| `finance.*` | topup_initiate/complete, gift_send, payout_request |
| `session.*` | app_open, page_view, feature_discover |
| `ai.*` | quiz_gen, flashcard_gen, notes_summary, study_plan_gen, search_enhance |

### Usage

```js
import events from '@/services/analytics/behavioral.events';

events.identify(userProfileId);   // call once on auth

events.content.like(postId);
events.search.query('photosynthesis', resultsCount);
events.learn.quizComplete(topic, score);
events.finance.giftSend(giftItemId, amount);
```

### Batching

Events are batched in memory (10 events or 5 seconds), then flushed.
Tab close and visibility change trigger immediate flush.
Migration → Kafka: batch becomes a single produce() call per flush.

---

## Analytics Intelligence

### Creator Analytics

```js
const analytics = await platformAnalytics.getCreatorAnalytics(userProfileId, { days: 30 });
// → { earningsBreakdown, contentPerformance, giftSummary, followerGrowth, topPost }
```

### Recommendation Quality

```js
const quality = await platformAnalytics.getRecommendationQuality(userProfileId);
// → { ctr, dismissRate, byStrategy: { subject_match: { ctr, dismissRate }, ... } }
```

### Platform Metrics (Admin)

```js
const metrics = await platformAnalytics.getPlatformMetrics({ days: 7 });
// → { content, transactions, gifting, growth }
```

---

## Feed Ranking Engine

### 8-Signal Pipeline

```
raw posts → enrichment context → for each post:
  signal 1: engagementVelocity  = weighted_interactions × time_decay(half_life)
  signal 2: socialRelevance     = following_bonus + school_bonus + featured_bonus
  signal 3: subjectMatch        = taste_profile_affinity × tag_overlap
  signal 4: recency             = linear_decay over 72h
  signal 5: creatorTrust        = trust_score / 100
  signal 6: watchTimeBonus      = avg_completion_rate (video only)
→ weighted sum → diversity penalty → sorted
```

### Feed Type Weight Profiles

| Feed | Engagement | Social | Subject | Recency | Creator | WatchTime |
|---|---|---|---|---|---|---|
| home | 30% | 25% | 20% | 15% | 10% | 0% |
| discover | 40% | 10% | 15% | 20% | 15% | 0% |
| video | 25% | 10% | 15% | 10% | 15% | 25% |
| following | 20% | 40% | 10% | 25% | 5% | 0% |
| group | 25% | 20% | 25% | 25% | 5% | 0% |

---

## AI Moderation Pipeline (Readiness)

### Current: Fast AI Check

```js
const { safe, flags, severity } = await educationAI.moderateContent(content);
// flags: ['spam', 'hate_speech', 'adult_content', 'scam', 'misinformation']
// severity: 'none' | 'low' | 'medium' | 'high'
```

### Future: Multi-Stage Pipeline

```
Stage 1: Rule-based filter (blocklisted words, regex patterns)   — <1ms
Stage 2: Fast AI check (gpt_5_mini)                             — ~500ms
Stage 3: Quality AI review (claude_sonnet for borderline cases) — ~2s
Stage 4: Human review queue (ModerationReport entity)           — async
```

---

## ML Scalability Roadmap

### Phase 1 (Current — Rule-Based)
- Weighted signal ranking (ranking.engine.js)
- Strategy-based recommendations (recommendation.service.js)
- LLM-powered educational features (education.ai.service.js)

### Phase 2 (Near-Term — Feature Engineering)
- User taste profiles persisted (UserTasteProfile entity, computed nightly)
- Content embeddings stored (Post._embedding field from Sentence Transformers)
- Recommendation CTR tracked → strategy weight auto-adjustment

### Phase 3 (Scale — ML Models)
- Two-tower model: user_embedding × content_embedding → score
- Collaborative filtering: matrix factorization on interaction matrix
- Sequential recommendation: Transformer over session event sequence
- Churn prediction: LSTM over session.* behavioral events
- Spam detection: BERT fine-tuned on FraudSignal training data

### Infrastructure Migration Path

```
Current:   Client-side ranking → Base44 entities
Phase 2:   NestJS API → PostgreSQL + Redis cache (ranked feeds)
Phase 3:   Kafka Streams → ClickHouse → ML microservice (TF Serving)
           User embeddings: Pinecone vector index
           A/B framework: GrowthBook per user cohort
``