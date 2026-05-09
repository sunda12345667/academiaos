/**
 * Feed Service
 * 
 * Handles feed construction, ranking, and pagination.
 * 
 * Migration note: On NestJS migration, this becomes a FeedService
 * that queries a PostgreSQL materialized view with Redis caching.
 * The scoring algorithm moves server-side for security and performance.
 */

import { base44 } from '@/api/base44Client';

// ─── Feed Scoring Constants ───────────────────────────────────────────────────
// These weights simulate an algorithmic feed ranking system
// Future: Move to server-side ML-based scoring
const ENGAGEMENT_WEIGHTS = {
  view: 1,
  like: 3,
  comment: 5,
  share: 7,
  save: 4,
};

// Time decay factor: posts older than this lose score rapidly
const HALF_LIFE_HOURS = 6;

/**
 * Compute engagement score for a post
 * This is a simplified Wilson score approximation
 */
function computeEngagementScore(post) {
  const raw =
    (post.view_count || 0) * ENGAGEMENT_WEIGHTS.view +
    (post.like_count || 0) * ENGAGEMENT_WEIGHTS.like +
    (post.comment_count || 0) * ENGAGEMENT_WEIGHTS.comment +
    (post.share_count || 0) * ENGAGEMENT_WEIGHTS.share +
    (post.save_count || 0) * ENGAGEMENT_WEIGHTS.save;

  const ageHours = (Date.now() - new Date(post.created_date).getTime()) / (1000 * 60 * 60);
  const decayFactor = Math.pow(0.5, ageHours / HALF_LIFE_HOURS);

  return raw * decayFactor;
}

/**
 * Get personalized feed for a user
 * MVP: Follows + trending + subject matching
 * Future: ML-ranked feed with collaborative filtering
 */
async function getPersonalizedFeed(userId, { page = 1, limit = 20, feedType = 'home' } = {}) {
  const skip = (page - 1) * limit;

  if (feedType === 'following') {
    // Fetch follows first, then pull posts in parallel per author (bounded)
    // Future: Single JOIN query in PostgreSQL with a materialized feed table
    const follows = await base44.entities.Follow.filter({ follower_id: userId, status: 'active' });
    const followingIds = follows.map(f => f.following_id);

    if (!followingIds.length) return { posts: [], hasMore: false, page };

    // Fan-out: fetch recent posts from each followed user, cap at 5 authors to limit concurrency
    // Future: Replace with a server-side fan-in aggregation query
    const authorSlice = followingIds.slice(0, 5);
    const perAuthorLimit = Math.ceil(limit / authorSlice.length) + 2;

    const authorPostArrays = await Promise.all(
      authorSlice.map(authorId =>
        base44.entities.Post.filter(
          { author_id: authorId, status: 'published', visibility: 'public', moderation_status: 'clean' },
          '-created_date',
          perAuthorLimit
        ).catch(() => [])
      )
    );

    // Merge and sort by engagement score, deduplicate by ID
    const seen = new Set();
    const merged = authorPostArrays
      .flat()
      .filter(p => { if (seen.has(p.id)) return false; seen.add(p.id); return true; })
      .sort((a, b) => (b.engagement_score ?? 0) - (a.engagement_score ?? 0))
      .slice(skip, skip + limit);

    return { posts: merged, hasMore: merged.length === limit, page };
  }

  if (feedType === 'discover') {
    // Trending posts platform-wide
    const posts = await base44.entities.Post.filter(
      { status: 'published', visibility: 'public', moderation_status: 'clean' },
      '-engagement_score',
      limit
    );
    return { posts, hasMore: posts.length === limit, page };
  }

  // Home feed: blended approach
  const posts = await base44.entities.Post.filter(
    { status: 'published', visibility: 'public', moderation_status: 'clean' },
    '-created_date',
    limit
  );

  return { posts, hasMore: posts.length === limit, page };
}

/**
 * Get short video (TikTok-style) feed
 * Future: Dedicated video ranking pipeline with watch-time signals
 */
async function getVideoFeed({ page = 1, limit = 10 } = {}) {
  const posts = await base44.entities.Post.filter(
    { type: 'short_video', status: 'published', visibility: 'public', moderation_status: 'clean' },
    '-engagement_score',
    limit
  );
  return { posts, hasMore: posts.length === limit, page };
}

/**
 * Get posts for a specific group feed
 */
async function getGroupFeed(groupId, { page = 1, limit = 20 } = {}) {
  const posts = await base44.entities.Post.filter(
    { group_id: groupId, status: 'published', moderation_status: 'clean' },
    '-created_date',
    limit
  );
  return { posts, hasMore: posts.length === limit, page };
}

/**
 * Get posts by a specific user (profile wall)
 */
async function getUserFeed(authorId, { page = 1, limit = 20, viewerRole = 'student' } = {}) {
  const posts = await base44.entities.Post.filter(
    { author_id: authorId, status: 'published', moderation_status: 'clean' },
    '-created_date',
    limit
  );
  return { posts, hasMore: posts.length === limit, page };
}

/**
 * Update engagement score on a post after interaction
 * Future: This becomes a background job / queue task
 */
async function updatePostEngagement(postId) {
  const post = await base44.entities.Post.filter({ id: postId });
  if (!post.length) return;
  const score = computeEngagementScore(post[0]);
  await base44.entities.Post.update(postId, { engagement_score: score });
}

export default {
  getPersonalizedFeed,
  getVideoFeed,
  getGroupFeed,
  getUserFeed,
  updatePostEngagement,
  computeEngagementScore,
};