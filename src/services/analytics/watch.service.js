/**
 * Watch-Time & Session Analytics Service
 *
 * Tracks content consumption signals for feed ranking and creator analytics:
 *   - watch duration per video/live session
 *   - completion rate (retention curve proxy)
 *   - session source (where user found the content)
 *   - device type
 *   - daily active session tracking
 *
 * This is the analytics data layer that feeds:
 *   1. Feed ranking (watch-time signal in ranking.engine.js)
 *   2. Creator analytics dashboard (creator.service.js)
 *   3. Recommendation readiness (recommendation.service.js)
 *   4. Platform health metrics
 *
 * All writes are fire-and-forget — never block UI for analytics.
 *
 * Migration note:
 *   WatchEvent records → Kafka topic → ClickHouse OLAP table
 *   Session tracking → client-side SDK (Amplitude/PostHog) + server-side validation
 *   Retention curves → ClickHouse query: percentile(exited_at_seconds, [25,50,75])
 *   Watch-time signal for ranking → Redis sorted set per content_id
 */

import { base44 } from '@/api/base44Client';

// ─── Session ID Management ────────────────────────────────────────────────────
// Ephemeral session ID per browser session — never persisted by itself

let _sessionId = null;

function getSessionId() {
  if (_sessionId) return _sessionId;
  _sessionId = `s_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  return _sessionId;
}

// ─── Watch Event Recording ────────────────────────────────────────────────────

/**
 * Record a watch event when a user finishes watching or leaves a video.
 * Call this on: video end, page leave, tab close (via beforeunload), feed scroll past.
 *
 * @param {object} opts
 * @param {string} opts.userProfileId
 * @param {string} opts.contentId         — Post.id or LiveSession.id
 * @param {string} opts.contentType       — 'post' | 'live_session' | 'course_lesson'
 * @param {number} opts.watchDuration     — seconds actually watched
 * @param {number} opts.contentDuration   — total content duration seconds
 * @param {string} opts.source            — where user found it
 * @param {string} opts.deviceType
 */
export async function recordWatchEvent({
  userProfileId,
  contentId,
  contentType,
  watchDuration,
  contentDuration,
  source = 'feed_home',
  deviceType = 'desktop',
  exitedAtSeconds,
}) {
  if (!userProfileId || !contentId) return;

  const completionRate = contentDuration > 0
    ? Math.min(1, watchDuration / contentDuration)
    : 0;

  const fullyWatched = completionRate >= 0.85;

  // Fire-and-forget — never await in calling code
  base44.entities.WatchEvent.create({
    user_id: userProfileId,
    content_id: contentId,
    content_type: contentType,
    watch_duration_seconds: Math.round(watchDuration),
    content_duration_seconds: contentDuration,
    completion_rate: parseFloat(completionRate.toFixed(3)),
    session_id: getSessionId(),
    source,
    device_type: deviceType,
    fully_watched: fullyWatched,
    exited_at_seconds: exitedAtSeconds ?? Math.round(watchDuration),
  }).catch(() => {});

  // NOTE: Post.view_count is owned by engagement.service — do NOT update it here.
  // watch.service owns WatchEvent records only. Dual-write removed (TD-10).
}

/**
 * Record a simple view impression (non-video content).
 * Fire-and-forget call on post scroll-into-view.
 */
export function recordImpression(userProfileId, contentId, source = 'feed_home') {
  if (!userProfileId || !contentId) return;
  // Debounced in useWatchTime hook — this function itself just records
  base44.entities.WatchEvent.create({
    user_id: userProfileId,
    content_id: contentId,
    content_type: 'post',
    watch_duration_seconds: 0,
    completion_rate: 0,
    session_id: getSessionId(),
    source,
    fully_watched: false,
  }).catch(() => {});
}

// ─── Analytics Queries ────────────────────────────────────────────────────────

/**
 * Get average completion rate for a piece of content.
 * Used as watch-time signal in ranking.engine.js.
 */
export async function getAvgCompletionRate(contentId) {
  const events = await base44.entities.WatchEvent.filter(
    { content_id: contentId, content_type: 'post' },
    '-created_date',
    200
  );
  if (!events.length) return 0;
  const avg = events.reduce((s, e) => s + (e.completion_rate || 0), 0) / events.length;
  return parseFloat(avg.toFixed(3));
}

/**
 * Get watch history for a user (content IDs they've watched).
 * Used for recommendation filtering (don't re-serve watched content).
 */
export async function getUserWatchHistory(userProfileId, { limit = 100 } = {}) {
  const events = await base44.entities.WatchEvent.filter(
    { user_id: userProfileId },
    '-created_date',
    limit
  );
  // Return Map<contentId, completion_rate> for ranking context
  const map = new Map();
  events.forEach(e => {
    if (!map.has(e.content_id)) map.set(e.content_id, e.completion_rate || 0);
  });
  return map;
}

/**
 * Get content the user has NOT seen yet (for recommendation freshness).
 */
export async function getUnwatchedContentIds(userProfileId, candidateIds) {
  if (!candidateIds.length) return candidateIds;
  const watchHistory = await getUserWatchHistory(userProfileId);
  return candidateIds.filter(id => !watchHistory.has(id));
}

/**
 * Creator watch analytics — total watch time, completion distribution.
 * Future: ClickHouse percentile queries.
 */
export async function getCreatorWatchAnalytics(creatorProfileId) {
  const posts = await base44.entities.Post.filter(
    { author_id: creatorProfileId, status: 'published' },
    '-created_date',
    50
  );

  if (!posts.length) return { totalWatchSeconds: 0, avgCompletion: 0, posts: [] };

  const postIds = posts.map(p => p.id);

  // Fetch watch events for recent posts (bounded)
  const watchData = await Promise.all(
    postIds.slice(0, 10).map(id =>
      base44.entities.WatchEvent.filter({ content_id: id }, '-created_date', 100).catch(() => [])
    )
  );

  const flatEvents = watchData.flat();
  const totalWatchSeconds = flatEvents.reduce((s, e) => s + (e.watch_duration_seconds || 0), 0);
  const avgCompletion = flatEvents.length
    ? flatEvents.reduce((s, e) => s + (e.completion_rate || 0), 0) / flatEvents.length
    : 0;

  // Per-post completion rates
  const postStats = posts.map((post, i) => {
    const events = watchData[i] ?? [];
    const avg = events.length
      ? events.reduce((s, e) => s + (e.completion_rate || 0), 0) / events.length
      : 0;
    return { postId: post.id, title: post.content?.slice(0, 50), avgCompletion: parseFloat(avg.toFixed(2)), eventCount: events.length };
  });

  return {
    totalWatchSeconds,
    avgCompletion: parseFloat(avgCompletion.toFixed(3)),
    posts: postStats,
  };
}

// ─── Engagement Source Attribution ───────────────────────────────────────────

/**
 * Track where a recommendation was clicked from (for feedback loop).
 * Future: Feeds into recommendation model as positive training signal.
 */
export async function recordRecommendationClick(recommendationId) {
  if (!recommendationId) return;
  base44.entities.ContentRecommendation.update(recommendationId, {
    clicked: true,
  }).catch(() => {});
}

export async function recordRecommendationDismiss(recommendationId) {
  if (!recommendationId) return;
  base44.entities.ContentRecommendation.update(recommendationId, {
    dismissed: true,
  }).catch(() => {});
}

const watchService = {
  recordWatchEvent,
  recordImpression,
  getAvgCompletionRate,
  getUserWatchHistory,
  getUnwatchedContentIds,
  getCreatorWatchAnalytics,
  recordRecommendationClick,
  recordRecommendationDismiss,
  getSessionId,
};

export default watchService;