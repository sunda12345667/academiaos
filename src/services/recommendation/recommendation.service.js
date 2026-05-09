/**
 * Recommendation Service
 *
 * MVP recommendation strategies using collaborative signals available in the DB.
 * Each strategy produces a scored list of ContentRecommendation-compatible items.
 *
 * Strategy roster:
 *   1. subject_match      — content matching user's academic subjects
 *   2. social_graph       — content liked/saved by people you follow
 *   3. creator_affinity   — more from creators you engage with most
 *   4. trending           — velocity-ranked content platform-wide
 *   5. watch_history      — based on completion rates of past watches
 *   6. collaborative_filtering (stub) — placeholder for ML service
 *
 * Recommendation lifecycle:
 *   generate → persist to ContentRecommendation → serve → track (clicked/dismissed)
 *   → feedback loop (future: re-train model on click data)
 *
 * Migration note:
 *   This module becomes a thin client to a dedicated Recommendation API service.
 *   Strategies run as Kafka Streams jobs, results stored in Redis per user with 1h TTL.
 *   ML models (matrix factorization, two-tower) replace rules-based scoring.
 *   A/B testing framework gates strategy allocation per user cohort.
 */

import { base44 } from '@/api/base44Client';
import rankingEngine from '@/services/feed/ranking.engine';
import watchService from '@/services/analytics/watch.service';

// ─── Recommendation Orchestrator ─────────────────────────────────────────────

/**
 * Get recommendations for a user, blending multiple strategies.
 * Returns up to `limit` deduplicated items, sorted by confidence score.
 */
export async function getRecommendations(userProfileId, { limit = 20, contentType = 'post' } = {}) {
  const [watchHistory, existingRecs] = await Promise.all([
    watchService.getUserWatchHistory(userProfileId, { limit: 200 }),
    _getExistingRecs(userProfileId, contentType),
  ]);

  // Skip already-served recommendations
  const servedIds = new Set(existingRecs.filter(r => r.served).map(r => r.content_id));

  // Run multiple strategies in parallel
  const [subjectRecs, socialRecs, creatorRecs, trendingRecs] = await Promise.all([
    _subjectMatchStrategy(userProfileId, watchHistory, servedIds, 15).catch(() => []),
    _socialGraphStrategy(userProfileId, watchHistory, servedIds, 15).catch(() => []),
    _creatorAffinityStrategy(userProfileId, watchHistory, servedIds, 10).catch(() => []),
    _trendingStrategy(userProfileId, watchHistory, servedIds, 10).catch(() => []),
  ]);

  // Merge and deduplicate by content_id
  const merged = _mergeStrategies([
    { items: subjectRecs,  strategy: 'subject_match',    weight: 0.30 },
    { items: socialRecs,   strategy: 'social_graph',     weight: 0.30 },
    { items: creatorRecs,  strategy: 'creator_affinity', weight: 0.25 },
    { items: trendingRecs, strategy: 'trending',         weight: 0.15 },
  ], limit);

  // Persist recommendations for tracking (fire-and-forget)
  _persistRecommendations(userProfileId, merged, contentType).catch(() => {});

  return merged;
}

/**
 * Get creator recommendations (suggested creators to follow)
 */
export async function getCreatorRecommendations(userProfileId, { limit = 10 } = {}) {
  const follows = await base44.entities.Follow.filter(
    { follower_id: userProfileId, status: 'active' },
    '-created_date',
    200
  );
  const followingSet = new Set(follows.map(f => f.following_id));

  // Followers-of-followers strategy
  const friendFollows = await Promise.all(
    [...followingSet].slice(0, 10).map(id =>
      base44.entities.Follow.filter({ follower_id: id, status: 'active' }, '-created_date', 20).catch(() => [])
    )
  );

  const candidateIds = new Map(); // profileId → score
  friendFollows.flat().forEach(f => {
    if (!followingSet.has(f.following_id) && f.following_id !== userProfileId) {
      candidateIds.set(f.following_id, (candidateIds.get(f.following_id) || 0) + 1);
    }
  });

  const sorted = [...candidateIds.entries()]
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit * 2)
    .map(([id, score]) => ({ content_id: id, score: score / 10, strategy: 'social_graph' }));

  return sorted.slice(0, limit);
}

// ─── Strategy Implementations ─────────────────────────────────────────────────

async function _subjectMatchStrategy(userProfileId, watchHistory, servedIds, limit) {
  const [profiles, academicIds] = await Promise.all([
    base44.entities.UserProfile.filter({ id: userProfileId }),
    base44.entities.AcademicIdentity.filter({ user_id: userProfileId }),
  ]);

  const subjects = [
    ...(academicIds[0]?.subjects || []),
    ...(profiles[0]?.preferences?.subject_interests || []),
  ];
  if (!subjects.length) return [];

  const posts = await base44.entities.Post.filter(
    { status: 'published', visibility: 'public', moderation_status: 'clean' },
    '-engagement_score',
    100
  );

  return posts
    .filter(p =>
      !servedIds.has(p.id) &&
      !watchHistory.has(p.id) &&
      [...(p.subject_tags || []), ...(p.tags || [])].some(t => subjects.includes(t))
    )
    .map(p => {
      const matchCount = [...(p.subject_tags || []), ...(p.tags || [])].filter(t => subjects.includes(t)).length;
      return {
        content_id: p.id,
        score: Math.min(1, matchCount / subjects.length + 0.1),
        strategy: 'subject_match',
        reason_label: `Matches your interests in ${subjects[0]}`,
        data: p,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

async function _socialGraphStrategy(userProfileId, watchHistory, servedIds, limit) {
  const follows = await base44.entities.Follow.filter(
    { follower_id: userProfileId, status: 'active' },
    '-created_date',
    100
  );
  const followingIds = follows.map(f => f.following_id);
  if (!followingIds.length) return [];

  // Get posts liked/saved by people I follow
  const interactions = await Promise.all(
    followingIds.slice(0, 10).map(fid =>
      base44.entities.PostInteraction.filter(
        { user_id: fid, type: 'save' },
        '-created_date',
        10
      ).catch(() => [])
    )
  );

  const postIdScores = new Map();
  interactions.flat().forEach(i => {
    if (!servedIds.has(i.post_id) && !watchHistory.has(i.post_id)) {
      postIdScores.set(i.post_id, (postIdScores.get(i.post_id) || 0) + 0.3);
    }
  });

  const candidates = [...postIdScores.entries()]
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit * 2);

  const posts = await Promise.all(
    candidates.map(([id]) => base44.entities.Post.filter({ id }).then(r => r[0]).catch(() => null))
  );

  return posts
    .filter(Boolean)
    .filter(p => p.status === 'published' && p.moderation_status === 'clean')
    .map(p => ({
      content_id: p.id,
      score: postIdScores.get(p.id) ?? 0,
      strategy: 'social_graph',
      reason_label: 'Saved by people you follow',
      data: p,
    }))
    .slice(0, limit);
}

async function _creatorAffinityStrategy(userProfileId, watchHistory, servedIds, limit) {
  // Find creators the user interacts with most
  const interactions = await base44.entities.PostInteraction.filter(
    { user_id: userProfileId },
    '-created_date',
    100
  );

  const postIds = [...new Set(interactions.map(i => i.post_id))].slice(0, 20);
  if (!postIds.length) return [];

  const posts = await Promise.all(
    postIds.map(id => base44.entities.Post.filter({ id }).then(r => r[0]).catch(() => null))
  );

  // Tally engagement per author
  const authorAffinity = new Map();
  posts.filter(Boolean).forEach(p => {
    authorAffinity.set(p.author_id, (authorAffinity.get(p.author_id) || 0) + 1);
  });

  const topAuthors = [...authorAffinity.entries()]
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([id]) => id);

  const authorPosts = await Promise.all(
    topAuthors.map(aid =>
      base44.entities.Post.filter(
        { author_id: aid, status: 'published', moderation_status: 'clean' },
        '-created_date',
        5
      ).catch(() => [])
    )
  );

  return authorPosts.flat()
    .filter(p => !servedIds.has(p.id) && !watchHistory.has(p.id))
    .map(p => ({
      content_id: p.id,
      score: (authorAffinity.get(p.author_id) || 1) / 10,
      strategy: 'creator_affinity',
      reason_label: `More from ${p.author_username}`,
      data: p,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

async function _trendingStrategy(userProfileId, watchHistory, servedIds, limit) {
  const posts = await base44.entities.Post.filter(
    { status: 'published', visibility: 'public', moderation_status: 'clean' },
    '-engagement_score',
    50
  );

  return posts
    .filter(p => !servedIds.has(p.id) && !watchHistory.has(p.id))
    .map(p => ({
      content_id: p.id,
      score: Math.min(1, rankingEngine.computeViralVelocity(p) / 100),
      strategy: 'trending',
      reason_label: 'Trending on StudentOS',
      data: p,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _mergeStrategies(streams, limit) {
  const seen = new Set();
  const pool = [];

  // Weighted interleave
  const totalWeight = streams.reduce((s, st) => s + st.weight, 0);
  const allocs = streams.map(st => ({
    ...st,
    quota: Math.round((st.weight / totalWeight) * limit),
    index: 0,
  }));

  let changed = true;
  while (pool.length < limit && changed) {
    changed = false;
    for (const alloc of allocs) {
      if (pool.length >= limit) break;
      while (alloc.index < alloc.items.length) {
        const item = alloc.items[alloc.index++];
        if (!seen.has(item.content_id)) {
          seen.add(item.content_id);
          pool.push(item);
          changed = true;
          break;
        }
      }
    }
  }

  return pool.slice(0, limit);
}

async function _getExistingRecs(userProfileId, contentType) {
  return base44.entities.ContentRecommendation.filter(
    { user_id: userProfileId, content_type: contentType },
    '-created_date',
    100
  ).catch(() => []);
}

async function _persistRecommendations(userProfileId, items, contentType) {
  const ops = items.map(item =>
    base44.entities.ContentRecommendation.create({
      user_id: userProfileId,
      content_id: item.content_id,
      content_type: contentType,
      score: item.score,
      strategy: item.strategy,
      reason_label: item.reason_label,
      served: true,
      clicked: false,
      dismissed: false,
      expires_at: new Date(Date.now() + 86_400_000).toISOString(), // 24h
    }).catch(() => {})
  );
  await Promise.allSettled(ops);
}

const recommendationService = {
  getRecommendations,
  getCreatorRecommendations,
};

export default recommendationService;