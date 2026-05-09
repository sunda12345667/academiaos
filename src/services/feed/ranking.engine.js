/**
 * Feed Ranking Engine
 *
 * Multi-signal content scoring pipeline for algorithmic feed ordering.
 *
 * Signal taxonomy:
 *   1. Engagement velocity    — weighted interactions × time-decay
 *   2. Social relevance       — following/mutual/classmate bonus
 *   3. Content-type affinity  — personalized type preference
 *   4. Subject match          — academic interest alignment
 *   5. Creator trust          — quality and spam signals
 *   6. Watch-time completion  — video completion rate bonus
 *   7. Recency bias           — configurable per feed type
 *   8. Diversity penalty      — prevent same author/topic flooding
 *
 * Pipeline:
 *   raw posts → enrichment → signal computation → weighted sum → diversity filter → ranked list
 *
 * Migration note:
 *   This entire module moves server-side on NestJS migration.
 *   Signals become a PostgreSQL VIEW joining posts, interactions, follows, and creator_profiles.
 *   ML layer (TF-Serving / SageMaker) replaces weighted sums with a learned ranker.
 *   A/B testing per-signal weights via a config service.
 */

// ─── Signal Weights by Feed Type ─────────────────────────────────────────────
// Tuned per feed type to optimize for different engagement objectives

const FEED_WEIGHTS = {
  home: {
    engagementVelocity:  0.30,
    socialRelevance:     0.25,
    subjectMatch:        0.20,
    recency:             0.15,
    creatorTrust:        0.10,
    watchTimeBonus:      0.00,
    diversityPenalty:    0.10,
  },
  discover: {
    engagementVelocity:  0.40,
    socialRelevance:     0.10,
    subjectMatch:        0.15,
    recency:             0.20,
    creatorTrust:        0.15,
    watchTimeBonus:      0.00,
    diversityPenalty:    0.15,
  },
  video: {
    engagementVelocity:  0.25,
    socialRelevance:     0.10,
    subjectMatch:        0.15,
    recency:             0.10,
    creatorTrust:        0.15,
    watchTimeBonus:      0.25,
    diversityPenalty:    0.20,
  },
  following: {
    engagementVelocity:  0.20,
    socialRelevance:     0.40,
    subjectMatch:        0.10,
    recency:             0.25,
    creatorTrust:        0.05,
    watchTimeBonus:      0.00,
    diversityPenalty:    0.05,
  },
  group: {
    engagementVelocity:  0.25,
    socialRelevance:     0.20,
    subjectMatch:        0.25,
    recency:             0.25,
    creatorTrust:        0.05,
    watchTimeBonus:      0.00,
    diversityPenalty:    0.05,
  },
};

// Interaction weights for velocity signal
const INTERACTION_WEIGHTS = {
  view:       1,
  like:       4,
  love:       5,
  insightful: 6,
  comment:    8,
  share:      10,
  save:       6,
  poll_vote:  3,
};

// Content-type completion rate expectations (for watch-time normalization)
const VIDEO_TYPES = new Set(['short_video', 'video']);

// Half-life for engagement decay (hours)
const DECAY_HALF_LIFE = {
  home:      8,
  discover:  6,
  video:     4,
  following: 12,
  group:     24,
};

// ─── Core Ranking Pipeline ────────────────────────────────────────────────────

/**
 * Rank a list of posts using the multi-signal pipeline.
 *
 * @param {Array}  posts       — raw Post records
 * @param {string} feedType    — controls weight profile
 * @param {object} context     — { viewerProfile, followingIds, subjectInterests, watchHistory }
 * @returns {Array}            — re-ranked posts with _rankScore attached
 */
export function rankPosts(posts, feedType = 'home', context = {}) {
  if (!posts.length) return [];

  const weights = FEED_WEIGHTS[feedType] ?? FEED_WEIGHTS.home;
  const halfLife = DECAY_HALF_LIFE[feedType] ?? 8;
  const {
    viewerProfile = null,
    followingIds = new Set(),
    subjectInterests = [],
    watchHistory = new Map(), // contentId → completion_rate
    creatorTrustMap = new Map(), // authorId → trust_score (0–100)
  } = context;

  // Author diversity tracking — penalize flooding from one creator
  const authorScoreAccum = new Map();

  const scored = posts.map(post => {
    const signals = {};

    // 1. Engagement velocity (time-decayed)
    const ageHours = (Date.now() - new Date(post.created_date).getTime()) / 3_600_000;
    const decay = Math.pow(0.5, ageHours / halfLife);
    const rawEngagement =
      (post.view_count   || 0) * INTERACTION_WEIGHTS.view +
      (post.like_count   || 0) * INTERACTION_WEIGHTS.like +
      (post.comment_count|| 0) * INTERACTION_WEIGHTS.comment +
      (post.share_count  || 0) * INTERACTION_WEIGHTS.share +
      (post.save_count   || 0) * INTERACTION_WEIGHTS.save;
    signals.engagementVelocity = _normalize(rawEngagement * decay, 0, 5000);

    // 2. Social relevance
    let socialScore = 0;
    if (followingIds.has(post.author_id)) socialScore += 0.7;
    if (viewerProfile?.school_id && viewerProfile.school_id === post.school_id) socialScore += 0.2;
    if (post.is_featured) socialScore += 0.1;
    signals.socialRelevance = Math.min(socialScore, 1.0);

    // 3. Subject match
    const postSubjects = new Set([...(post.subject_tags || []), ...(post.tags || [])]);
    const matchCount = subjectInterests.filter(s => postSubjects.has(s)).length;
    signals.subjectMatch = subjectInterests.length
      ? Math.min(matchCount / subjectInterests.length, 1.0)
      : 0;

    // 4. Recency (linear decay over 72h window)
    signals.recency = Math.max(0, 1 - ageHours / 72);

    // 5. Creator trust (0–100 → 0–1)
    const trustScore = creatorTrustMap.get(post.author_id) ?? 50;
    signals.creatorTrust = trustScore / 100;

    // 6. Watch-time bonus (video only)
    if (VIDEO_TYPES.has(post.type)) {
      const completion = watchHistory.get(post.id) ?? null;
      // Reward content with high historical completion rates from other users
      const avgCompletion = post._avg_completion_rate ?? 0;
      signals.watchTimeBonus = avgCompletion;
    } else {
      signals.watchTimeBonus = 0;
    }

    // Weighted sum
    const rawScore = Object.keys(weights)
      .filter(k => k !== 'diversityPenalty')
      .reduce((sum, k) => sum + (signals[k] ?? 0) * weights[k], 0);

    // Author diversity penalty — penalize if we've already scored many from this author
    const authorCount = authorScoreAccum.get(post.author_id) || 0;
    const diversityPenalty = Math.min(authorCount * 0.15, 0.45);
    authorScoreAccum.set(post.author_id, authorCount + 1);

    const finalScore = rawScore * (1 - diversityPenalty * weights.diversityPenalty);

    return { ...post, _rankScore: finalScore, _signals: signals };
  });

  return scored.sort((a, b) => b._rankScore - a._rankScore);
}

/**
 * Blend multiple ranked lists with weights.
 * Used for the home feed blending (following + discover + trending).
 *
 * @param {Array} streams — [{ posts, weight }]
 * @param {number} limit
 */
export function blendFeedStreams(streams, limit = 20) {
  const seen = new Set();
  const pool = [];

  // Interleave from each stream proportionally by weight
  const totalWeight = streams.reduce((s, st) => s + st.weight, 0);
  const allocations = streams.map(st => ({
    ...st,
    quota: Math.round((st.weight / totalWeight) * limit),
    index: 0,
  }));

  let changed = true;
  while (pool.length < limit && changed) {
    changed = false;
    for (const alloc of allocations) {
      if (pool.length >= limit) break;
      if (alloc.index >= alloc.posts.length) continue;
      while (alloc.index < alloc.posts.length) {
        const p = alloc.posts[alloc.index++];
        if (!seen.has(p.id)) {
          seen.add(p.id);
          pool.push(p);
          changed = true;
          break;
        }
      }
    }
  }

  return pool.slice(0, limit);
}

/**
 * Compute viral velocity: rate of engagement gain per hour.
 * Posts above threshold get boosted in discover/trending.
 * Future: Flink sliding-window aggregation.
 */
export function computeViralVelocity(post) {
  const ageHours = Math.max(0.5, (Date.now() - new Date(post.created_date).getTime()) / 3_600_000);
  const totalInteractions =
    (post.like_count || 0) +
    (post.comment_count || 0) * 2 +
    (post.share_count || 0) * 3 +
    (post.save_count || 0);
  return totalInteractions / ageHours;
}

/**
 * Detect content-type affinity from watch history.
 * Returns {type → preference_score} map.
 * Future: Collaborative filtering over interaction matrix.
 */
export function computeTypeAffinity(interactions) {
  const typeCounts = {};
  interactions.forEach(i => {
    const key = `interaction_${i.type}`;
    typeCounts[key] = (typeCounts[key] || 0) + 1;
  });
  const total = Object.values(typeCounts).reduce((s, v) => s + v, 0) || 1;
  const affinity = {};
  Object.entries(typeCounts).forEach(([k, v]) => { affinity[k] = v / total; });
  return affinity;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _normalize(value, min, max) {
  if (max === min) return 0;
  return Math.min(1, Math.max(0, (value - min) / (max - min)));
}

export default { rankPosts, blendFeedStreams, computeViralVelocity, computeTypeAffinity };