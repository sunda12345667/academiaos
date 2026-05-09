/**
 * Engagement Service
 *
 * Manages engagement scoring, streaks, trending computation,
 * activity feeds, and creator growth signals.
 *
 * Architecture:
 *   - Engagement score: denormalized on Post entity, recomputed on interaction
 *   - Streaks: computed from PostInteraction/Post records, stored on UserProfile
 *   - Trending: weighted recency + velocity signals
 *
 * Migration note:
 *   Streaks → Redis sorted sets with daily TTL resets
 *   Trending topics → Flink/Spark streaming job over Kafka interaction events
 *   Creator analytics → separate ClickHouse OLAP store
 *   Activity feed → Redis LPUSH fan-out pattern (Twitter-style timeline)
 */

import { base44 } from '@/api/base44Client';

// ─── Scoring Weights ──────────────────────────────────────────────────────────

const WEIGHTS = {
  view:     1,
  like:     3,
  love:     4,
  insightful: 5,
  comment:  6,
  share:    8,
  save:     4,
  poll_vote: 2,
};

const HALF_LIFE_HOURS = 6;

// ─── Post Engagement Score ─────────────────────────────────────────────────────

export function computeEngagementScore(post) {
  const raw =
    (post.view_count   || 0) * WEIGHTS.view +
    (post.like_count   || 0) * WEIGHTS.like +
    (post.comment_count || 0) * WEIGHTS.comment +
    (post.share_count  || 0) * WEIGHTS.share +
    (post.save_count   || 0) * WEIGHTS.save;

  const ageHours = (Date.now() - new Date(post.created_date).getTime()) / 3_600_000;
  const decay = Math.pow(0.5, ageHours / HALF_LIFE_HOURS);
  return Math.round(raw * decay);
}

/**
 * Record a post interaction and update engagement score.
 * Idempotent for view/like/save (one per user).
 */
export async function recordInteraction(postId, profileId, type, { pollChoice, shareDestination } = {}) {
  // Deduplicate for like/save/poll_vote (not for view/share)
  const dedupTypes = ['like', 'love', 'insightful', 'save', 'poll_vote'];
  if (dedupTypes.includes(type)) {
    const existing = await base44.entities.PostInteraction.filter({
      post_id: postId,
      user_id: profileId,
      type,
    });
    if (existing.length) return { duplicate: true };
  }

  await base44.entities.PostInteraction.create({
    post_id: postId,
    user_id: profileId,
    type,
    poll_choice: pollChoice,
    share_destination: shareDestination,
  });

  // Update denormalized counters on Post
  const countField = _getCountField(type);
  if (countField) {
    const posts = await base44.entities.Post.filter({ id: postId });
    if (posts.length) {
      const post = posts[0];
      const newCount = (post[countField] || 0) + 1;
      const newScore = computeEngagementScore({ ...post, [countField]: newCount });
      await base44.entities.Post.update(postId, {
        [countField]: newCount,
        engagement_score: newScore,
      });
    }
  }

  return { recorded: true };
}

/**
 * Remove an interaction (un-like, un-save)
 */
export async function removeInteraction(postId, profileId, type) {
  const existing = await base44.entities.PostInteraction.filter({
    post_id: postId,
    user_id: profileId,
    type,
  });
  if (!existing.length) return;

  await base44.entities.PostInteraction.delete(existing[0].id);

  const countField = _getCountField(type);
  if (countField) {
    const posts = await base44.entities.Post.filter({ id: postId });
    if (posts.length) {
      const post = posts[0];
      const newCount = Math.max(0, (post[countField] || 0) - 1);
      const newScore = computeEngagementScore({ ...post, [countField]: newCount });
      await base44.entities.Post.update(postId, {
        [countField]: newCount,
        engagement_score: newScore,
      });
    }
  }
}

/**
 * Check if a user has interacted with a post
 */
export async function getUserInteraction(postId, profileId) {
  const interactions = await base44.entities.PostInteraction.filter({
    post_id: postId,
    user_id: profileId,
  });

  const result = { liked: false, saved: false, voted: false, shared: false };
  interactions.forEach(i => {
    if (['like', 'love', 'insightful'].includes(i.type)) result.liked = true;
    if (i.type === 'save') result.saved = true;
    if (i.type === 'poll_vote') { result.voted = true; result.pollChoice = i.poll_choice; }
    if (i.type === 'share') result.shared = true;
  });
  return result;
}

// ─── Trending Topics ──────────────────────────────────────────────────────────

/**
 * Get trending posts by engagement velocity.
 * Velocity = engagement_score / age_hours (recency-normalized).
 * Future: Kafka Streams aggregation over last 1h/24h windows.
 */
export async function getTrendingPosts({ limit = 20, schoolId } = {}) {
  const filter = { status: 'published', visibility: 'public', moderation_status: 'clean' };
  if (schoolId) filter.school_id = schoolId;

  const posts = await base44.entities.Post.filter(filter, '-engagement_score', limit * 2);

  // Re-rank by velocity (live decay)
  return posts
    .map(p => ({ ...p, _velocity: computeEngagementScore(p) }))
    .sort((a, b) => b._velocity - a._velocity)
    .slice(0, limit);
}

/**
 * Get trending hashtags/topics from recent posts.
 * Future: Dedicated Tag entity with count tracking.
 */
export async function getTrendingTopics({ limit = 10 } = {}) {
  const recentPosts = await base44.entities.Post.filter(
    { status: 'published', moderation_status: 'clean' },
    '-created_date',
    200
  );

  const tagCounts = {};
  recentPosts.forEach(post => {
    [...(post.tags || []), ...(post.subject_tags || [])].forEach(tag => {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    });
  });

  return Object.entries(tagCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)
    .map(([tag, count]) => ({ tag, count }));
}

// ─── Streaks ──────────────────────────────────────────────────────────────────

/**
 * Compute posting streak for a user.
 * Streak = consecutive days with at least one published post.
 * Future: Redis sorted set with daily TTL.
 */
export async function getPostingStreak(profileId) {
  const posts = await base44.entities.Post.filter(
    { author_id: profileId, status: 'published' },
    '-created_date',
    90
  );

  if (!posts.length) return { current: 0, longest: 0, lastPostDate: null };

  // Group by calendar date
  const days = new Set(
    posts.map(p => new Date(p.created_date).toISOString().split('T')[0])
  );

  const sorted = [...days].sort().reverse();
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  // Current streak must include today or yesterday to be "active"
  if (sorted[0] !== today && sorted[0] !== yesterday) {
    return { current: 0, longest: _longestStreak(sorted), lastPostDate: sorted[0] };
  }

  let streak = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1]);
    const curr = new Date(sorted[i]);
    const diff = (prev - curr) / 86400000;
    if (Math.round(diff) === 1) streak++;
    else break;
  }

  return { current: streak, longest: _longestStreak(sorted), lastPostDate: sorted[0] };
}

// ─── Activity Feed ─────────────────────────────────────────────────────────────

/**
 * Get recent activity for a profile (their interactions, posts, follows).
 * Future: Dedicated activity_log table with fan-out writes.
 */
export async function getRecentActivity(profileId, { limit = 20 } = {}) {
  const [recentPosts, recentInteractions] = await Promise.all([
    base44.entities.Post.filter({ author_id: profileId, status: 'published' }, '-created_date', 10),
    base44.entities.PostInteraction.filter({ user_id: profileId }, '-created_date', 10),
  ]);

  const activities = [
    ...recentPosts.map(p => ({ type: 'post', date: p.created_date, entity: p })),
    ...recentInteractions.map(i => ({ type: `interaction_${i.type}`, date: i.created_date, entity: i })),
  ];

  return activities
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, limit);
}

// ─── Creator Analytics ────────────────────────────────────────────────────────

/**
 * Get creator growth summary (follower growth, engagement rate, top posts)
 * Future: ClickHouse time-series aggregation.
 */
export async function getCreatorSummary(profileId) {
  const [posts, profile] = await Promise.all([
    base44.entities.Post.filter({ author_id: profileId, status: 'published' }, '-created_date', 50),
    base44.entities.UserProfile.filter({ id: profileId }),
  ]);

  const p = profile[0];
  const totalEngagement = posts.reduce((sum, post) =>
    sum + (post.like_count || 0) + (post.comment_count || 0) + (post.share_count || 0), 0
  );

  const avgEngagement = posts.length ? Math.round(totalEngagement / posts.length) : 0;
  const engagementRate = p?.follower_count
    ? ((avgEngagement / p.follower_count) * 100).toFixed(2)
    : '0.00';

  const topPost = posts.sort((a, b) => (b.engagement_score || 0) - (a.engagement_score || 0))[0];

  return {
    totalPosts: posts.length,
    totalEngagement,
    avgEngagement,
    engagementRate: parseFloat(engagementRate),
    followerCount: p?.follower_count || 0,
    topPost: topPost || null,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _getCountField(type) {
  const map = { like: 'like_count', love: 'like_count', insightful: 'like_count',
    comment: 'comment_count', share: 'share_count', save: 'save_count', view: 'view_count' };
  return map[type] ?? null;
}

function _longestStreak(sortedDays) {
  if (!sortedDays.length) return 0;
  let max = 1, cur = 1;
  for (let i = 1; i < sortedDays.length; i++) {
    const diff = (new Date(sortedDays[i-1]) - new Date(sortedDays[i])) / 86400000;
    if (Math.round(diff) === 1) { cur++; max = Math.max(max, cur); }
    else cur = 1;
  }
  return max;
}

const engagementService = {
  computeEngagementScore,
  recordInteraction,
  removeInteraction,
  getUserInteraction,
  getTrendingPosts,
  getTrendingTopics,
  getPostingStreak,
  getRecentActivity,
  getCreatorSummary,
};

export default engagementService;