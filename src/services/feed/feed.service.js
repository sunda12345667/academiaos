/**
 * Feed Service — Intelligent Feed Construction
 *
 * Replaces naive chronological queries with a multi-signal ranking pipeline.
 * Each feed type uses a different signal weight profile (see ranking.engine.js).
 *
 * Feed architecture:
 *   home     → blended (following 50% + discover 30% + trending 20%) → ranked
 *   discover → platform-wide trending → ranked by viral velocity
 *   following → fan-out from followed authors → ranked by social relevance
 *   video    → short_video type only → ranked by watch-time + velocity
 *   group    → group-scoped posts → ranked by recency + engagement
 *   profile  → author-scoped posts → chronological (profiles are portfolios)
 *   live     → active live sessions → ranked by viewer count
 *   saved    → saved posts by user → chronological
 *
 * Context enrichment:
 *   viewerProfile, followingIds, subjectInterests, watchHistory, creatorTrustMap
 *   are loaded once per feed request and passed to the ranking engine.
 *
 * Migration note:
 *   On NestJS: FeedService calls a PostgreSQL materialized view pre-ranked server-side.
 *   Context enrichment becomes JOIN clauses. Blending becomes UNION ALL + LIMIT.
 *   Redis caches ranked feed per user with 30s TTL.
 */

import { base44 } from '@/api/base44Client';
import rankingEngine from './ranking.engine';

// ─── Feed Context Loading ─────────────────────────────────────────────────────

/**
 * Load enrichment context for the ranking engine.
 * Batch-loads all signals needed to rank content for a viewer.
 * Future: Single materialized view query, not N+1 parallel fetches.
 */
async function loadRankingContext(viewerProfileId) {
  if (!viewerProfileId) return {};

  try {
    const [profiles, follows, academicId] = await Promise.all([
      base44.entities.UserProfile.filter({ id: viewerProfileId }),
      base44.entities.Follow.filter({ follower_id: viewerProfileId, status: 'active' }, '-created_date', 500),
      base44.entities.AcademicIdentity.filter({ user_id: viewerProfileId }),
    ]);

    const viewerProfile = profiles[0] ?? null;
    const followingIds = new Set(follows.map(f => f.following_id));
    const subjectInterests = [
      ...(academicId[0]?.subjects || []),
      ...(viewerProfile?.preferences?.subject_interests || []),
    ];

    // Load creator trust scores (cap at 50 profiles to bound query cost)
    const authorIds = [...followingIds].slice(0, 50);
    const creatorProfiles = authorIds.length
      ? await base44.entities.CreatorProfile.filter({ user_id: authorIds[0] }, '-trust_score', 50).catch(() => [])
      : [];

    const creatorTrustMap = new Map(creatorProfiles.map(c => [c.user_id, c.trust_score ?? 50]));

    return { viewerProfile, followingIds, subjectInterests, creatorTrustMap, watchHistory: new Map() };
  } catch {
    return {};
  }
}

// ─── Feed Builders ────────────────────────────────────────────────────────────

/**
 * Home feed: blended following + discover + trending streams
 */
async function getHomeFeed(viewerProfileId, { limit = 20 } = {}) {
  const context = await loadRankingContext(viewerProfileId);
  const fetchLimit = limit * 3; // Oversample for ranking quality

  // Parallel stream fetching
  const [followingPosts, discoverPosts, trendingPosts] = await Promise.all([
    _fetchFollowingPosts(viewerProfileId, context.followingIds, fetchLimit).catch(() => []),
    _fetchDiscoverPosts(Math.ceil(fetchLimit * 0.6)).catch(() => []),
    _fetchTrendingPosts(Math.ceil(fetchLimit * 0.4)).catch(() => []),
  ]);

  // Rank each stream independently with appropriate weight profiles
  const rankedFollowing = rankingEngine.rankPosts(followingPosts, 'following', context);
  const rankedDiscover  = rankingEngine.rankPosts(discoverPosts,  'discover',  context);
  const rankedTrending  = rankingEngine.rankPosts(trendingPosts,  'discover',  context);

  // Blend: 50% following, 30% discover, 20% trending
  const blended = rankingEngine.blendFeedStreams([
    { posts: rankedFollowing, weight: 0.50 },
    { posts: rankedDiscover,  weight: 0.30 },
    { posts: rankedTrending,  weight: 0.20 },
  ], limit);

  return { posts: blended, hasMore: blended.length === limit };
}

/**
 * Discover feed: platform-wide trending content ranked by viral velocity
 */
async function getDiscoverFeed(viewerProfileId, { limit = 20 } = {}) {
  const [context, rawPosts] = await Promise.all([
    loadRankingContext(viewerProfileId),
    _fetchDiscoverPosts(limit * 2),
  ]);

  // Sort by viral velocity first, then re-rank with full signals
  const velocitySorted = rawPosts
    .map(p => ({ ...p, _velocity: rankingEngine.computeViralVelocity(p) }))
    .sort((a, b) => b._velocity - a._velocity)
    .slice(0, limit * 1.5);

  const ranked = rankingEngine.rankPosts(velocitySorted, 'discover', context);
  return { posts: ranked.slice(0, limit), hasMore: rawPosts.length >= limit * 2 };
}

/**
 * Following feed: posts from followed users ranked by social relevance
 */
async function getFollowingFeed(viewerProfileId, { limit = 20 } = {}) {
  const context = await loadRankingContext(viewerProfileId);
  const followingIds = context.followingIds ?? new Set();

  if (!followingIds.size) return { posts: [], hasMore: false };

  const rawPosts = await _fetchFollowingPosts(viewerProfileId, followingIds, limit * 2);
  const ranked = rankingEngine.rankPosts(rawPosts, 'following', context);
  return { posts: ranked.slice(0, limit), hasMore: rawPosts.length >= limit * 2 };
}

/**
 * Video feed: short_video posts ranked by watch-time completion + velocity
 * TikTok-style: each video fills the viewport, optimized for completion.
 */
async function getVideoFeed(viewerProfileId, { limit = 15 } = {}) {
  const [context, rawPosts] = await Promise.all([
    loadRankingContext(viewerProfileId),
    base44.entities.Post.filter(
      { type: 'short_video', status: 'published', visibility: 'public', moderation_status: 'clean' },
      '-engagement_score',
      limit * 3
    ),
  ]);

  const ranked = rankingEngine.rankPosts(rawPosts, 'video', context);
  return { posts: ranked.slice(0, limit), hasMore: rawPosts.length >= limit * 3 };
}

/**
 * Group feed: group-scoped posts ranked by recency + engagement
 */
async function getGroupFeed(groupId, viewerProfileId, { limit = 20 } = {}) {
  const [context, rawPosts] = await Promise.all([
    loadRankingContext(viewerProfileId),
    base44.entities.Post.filter(
      { group_id: groupId, status: 'published', moderation_status: 'clean' },
      '-created_date',
      limit * 2
    ),
  ]);

  const ranked = rankingEngine.rankPosts(rawPosts, 'group', context);
  return { posts: ranked.slice(0, limit), hasMore: rawPosts.length >= limit * 2 };
}

/**
 * Profile feed: user's published posts (portfolio view — chronological)
 */
async function getUserFeed(authorId, { limit = 20 } = {}) {
  const posts = await base44.entities.Post.filter(
    { author_id: authorId, status: 'published', moderation_status: 'clean' },
    '-created_date',
    limit
  );
  return { posts, hasMore: posts.length === limit };
}

/**
 * Live feed: active live sessions ordered by viewer count
 */
async function getLiveFeed({ schoolId, limit = 10 } = {}) {
  const filter = { status: 'live' };
  if (schoolId) filter.school_id = schoolId;

  const sessions = await base44.entities.LiveSession.filter(filter, '-current_viewer_count', limit);
  return { sessions, hasMore: sessions.length === limit };
}

/**
 * Saved posts feed for a user
 */
async function getSavedFeed(viewerProfileId, { limit = 20 } = {}) {
  const saved = await base44.entities.PostInteraction.filter(
    { user_id: viewerProfileId, type: 'save' },
    '-created_date',
    limit
  );
  if (!saved.length) return { posts: [], hasMore: false };

  const postIds = saved.map(s => s.post_id);
  // Hydrate posts — bounded by saved list size
  const posts = await Promise.all(
    postIds.slice(0, limit).map(id =>
      base44.entities.Post.filter({ id }).then(r => r[0]).catch(() => null)
    )
  );
  return { posts: posts.filter(Boolean), hasMore: saved.length === limit };
}

// ─── Private Fetchers ─────────────────────────────────────────────────────────

async function _fetchFollowingPosts(viewerProfileId, followingIds, limit) {
  if (!followingIds.size) return [];

  // Fan-out across followed authors (cap at 8 to bound concurrency)
  const authorSlice = [...followingIds].slice(0, 8);
  const perAuthor = Math.ceil(limit / authorSlice.length) + 3;

  const arrays = await Promise.all(
    authorSlice.map(authorId =>
      base44.entities.Post.filter(
        { author_id: authorId, status: 'published', visibility: 'public', moderation_status: 'clean' },
        '-created_date',
        perAuthor
      ).catch(() => [])
    )
  );

  // Deduplicate
  const seen = new Set();
  return arrays.flat().filter(p => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });
}

async function _fetchDiscoverPosts(limit) {
  return base44.entities.Post.filter(
    { status: 'published', visibility: 'public', moderation_status: 'clean' },
    '-engagement_score',
    limit
  );
}

async function _fetchTrendingPosts(limit) {
  // 24h window: fetch recent posts and sort by velocity
  const recent = await base44.entities.Post.filter(
    { status: 'published', visibility: 'public', moderation_status: 'clean' },
    '-created_date',
    limit * 3
  );
  return recent
    .map(p => ({ ...p, _velocity: rankingEngine.computeViralVelocity(p) }))
    .sort((a, b) => b._velocity - a._velocity)
    .slice(0, limit);
}

// ─── Engagement Score Update ──────────────────────────────────────────────────

async function updatePostEngagement(postId) {
  const posts = await base44.entities.Post.filter({ id: postId });
  if (!posts.length) return;

  const post = posts[0];
  const rawEngagement =
    (post.view_count   || 0) * INTERACTION_WEIGHTS_EXPORT.view +
    (post.like_count   || 0) * INTERACTION_WEIGHTS_EXPORT.like +
    (post.comment_count|| 0) * INTERACTION_WEIGHTS_EXPORT.comment +
    (post.share_count  || 0) * INTERACTION_WEIGHTS_EXPORT.share +
    (post.save_count   || 0) * INTERACTION_WEIGHTS_EXPORT.save;

  const ageHours = (Date.now() - new Date(post.created_date).getTime()) / 3_600_000;
  const decay = Math.pow(0.5, ageHours / 8);
  const score = Math.round(rawEngagement * decay);

  await base44.entities.Post.update(postId, { engagement_score: score });
}

const INTERACTION_WEIGHTS_EXPORT = { view: 1, like: 4, comment: 8, share: 10, save: 6 };

const feedService = {
  getHomeFeed,
  getDiscoverFeed,
  getFollowingFeed,
  getVideoFeed,
  getGroupFeed,
  getUserFeed,
  getLiveFeed,
  getSavedFeed,
  updatePostEngagement,
  loadRankingContext,
  // Legacy compat
  getPersonalizedFeed: (userId, { feedType = 'home', limit = 20 } = {}) => {
    if (feedType === 'following') return getFollowingFeed(userId, { limit });
    if (feedType === 'discover')  return getDiscoverFeed(userId, { limit });
    return getHomeFeed(userId, { limit });
  },
};

export default feedService;