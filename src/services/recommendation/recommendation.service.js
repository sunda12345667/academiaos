/**
 * Recommendation Service — Multi-Entity Intelligence Pipeline
 *
 * Strategies per entity type:
 *   POST      subject_match | social_graph | creator_affinity | trending | watch_history
 *   CREATOR   followers_of_followers | subject_overlap | trending_creators | taste_match
 *   GROUP     subject_overlap | member_network | activity_score | academic_fit
 *   COURSE    subject_match | enrollment_social_proof | difficulty_fit | instructor_affinity
 *   LIVE      real_time_interest | followed_host | subject_match | viewer_momentum
 *   MARKETPLACE  school_proximity | category_affinity | price_fit | trending_items
 *
 * Scoring architecture:
 *   Each strategy produces scored candidates → weighted interleave merge →
 *   personalization re-rank (taste profile boost) → diversity filter →
 *   persist to ContentRecommendation → return with reason_labels
 *
 * Feedback loop:
 *   served → clicked/dismissed tracked → CTR per strategy →
 *   future: dynamically adjust strategy weights per user cohort
 *
 * Migration path:
 *   MVP (now):    client-side rules + entity queries
 *   Phase 2:      server-side Node.js pre-computation, Redis cache per user (1h TTL)
 *   Phase 3:      Kafka Streams aggregation + two-tower ML model (SageMaker/Vertex)
 *   Phase 4:      Real-time feature store (Feast) + online inference (<50ms)
 */

import { base44 } from '@/api/base44Client';
import rankingEngine from '@/services/feed/ranking.engine';
import watchService from '@/services/analytics/watch.service';
import personalizationEngine from '@/services/ai/personalization.engine';

// ─── Strategy Weights (tunable, future: per-user A/B) ────────────────────────

const POST_WEIGHTS = {
  subject_match:    0.28,
  social_graph:     0.28,
  creator_affinity: 0.22,
  trending:         0.12,
  watch_history:    0.10,
};

const CREATOR_WEIGHTS = {
  followers_of_followers: 0.35,
  subject_overlap:        0.30,
  trending_creators:      0.20,
  taste_match:            0.15,
};

const GROUP_WEIGHTS = {
  subject_overlap:  0.35,
  member_network:   0.30,
  activity_score:   0.20,
  academic_fit:     0.15,
};

const COURSE_WEIGHTS = {
  subject_match:        0.40,
  social_proof:         0.25,
  difficulty_fit:       0.20,
  instructor_affinity:  0.15,
};

const LIVE_WEIGHTS = {
  followed_host:     0.40,
  subject_match:     0.35,
  viewer_momentum:   0.25,
};

// ─── Post Recommendations ─────────────────────────────────────────────────────

export async function getPostRecommendations(userProfileId, { limit = 20 } = {}) {
  const [watchHistory, tasteProfile, existingRecs] = await Promise.all([
    watchService.getUserWatchHistory(userProfileId, { limit: 200 }),
    personalizationEngine.buildTasteProfile(userProfileId).catch(() => null),
    _getServedIds(userProfileId, 'post'),
  ]);

  const [subjectRecs, socialRecs, creatorRecs, trendingRecs] = await Promise.all([
    _subjectMatchStrategy(userProfileId, watchHistory, existingRecs, 15).catch(() => []),
    _socialGraphStrategy(userProfileId, watchHistory, existingRecs, 15).catch(() => []),
    _creatorAffinityStrategy(userProfileId, watchHistory, existingRecs, 10).catch(() => []),
    _trendingStrategy(userProfileId, watchHistory, existingRecs, 10).catch(() => []),
  ]);

  let merged = _weightedMerge([
    { items: subjectRecs,  weight: POST_WEIGHTS.subject_match },
    { items: socialRecs,   weight: POST_WEIGHTS.social_graph },
    { items: creatorRecs,  weight: POST_WEIGHTS.creator_affinity },
    { items: trendingRecs, weight: POST_WEIGHTS.trending },
  ], limit * 2);

  // Personalization re-rank
  if (tasteProfile) {
    merged = merged
      .map(item => ({
        ...item,
        score: item.score * 0.6 + personalizationEngine.scorePostRelevance(item.data || {}, tasteProfile) * 0.4,
      }))
      .sort((a, b) => b.score - a.score);
  }

  const final = merged.slice(0, limit);
  _persistRecommendations(userProfileId, final, 'post').catch(() => {});
  return final;
}

// Legacy alias used by feed.service
export const getRecommendations = getPostRecommendations;

// ─── Creator Recommendations ──────────────────────────────────────────────────

export async function getCreatorRecommendations(userProfileId, { limit = 10 } = {}) {
  const [follows, tasteProfile] = await Promise.all([
    base44.entities.Follow.filter({ follower_id: userProfileId, status: 'active' }, '-created_date', 200).catch(() => []),
    personalizationEngine.buildTasteProfile(userProfileId).catch(() => null),
  ]);
  const followingSet = new Set(follows.map(f => f.following_id));

  // Followers-of-followers
  const friendFollows = await Promise.all(
    [...followingSet].slice(0, 10).map(id =>
      base44.entities.Follow.filter({ follower_id: id, status: 'active' }, '-created_date', 20).catch(() => [])
    )
  );

  const candidateScores = new Map();
  friendFollows.flat().forEach(f => {
    if (!followingSet.has(f.following_id) && f.following_id !== userProfileId) {
      candidateScores.set(f.following_id, (candidateScores.get(f.following_id) || 0) + 1);
    }
  });

  // Subject overlap boost
  const topSubjects = tasteProfile ? personalizationEngine.getTopSubjects(tasteProfile, 5).map(s => s.subject) : [];

  if (topSubjects.length) {
    const creatorProfiles = await base44.entities.CreatorProfile.filter(
      { verification_status: 'verified' }, '-total_followers', 30
    ).catch(() => []);

    creatorProfiles.forEach(cp => {
      if (followingSet.has(cp.user_id) || cp.user_id === userProfileId) return;
      const overlap = (cp.subject_focus || []).filter(s => topSubjects.includes(s)).length;
      if (overlap > 0) {
        candidateScores.set(cp.user_id, (candidateScores.get(cp.user_id) || 0) + overlap * 0.5);
      }
    });
  }

  // Trending creators boost
  const trendingCreators = await base44.entities.CreatorProfile.filter(
    {}, '-total_followers', 20
  ).catch(() => []);
  trendingCreators.forEach(cp => {
    if (!followingSet.has(cp.user_id) && cp.user_id !== userProfileId) {
      const trendScore = Math.min(0.5, Math.log10((cp.total_followers || 1) + 1) / 5);
      candidateScores.set(cp.user_id, (candidateScores.get(cp.user_id) || 0) + trendScore);
    }
  });

  return [...candidateScores.entries()]
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)
    .map(([id, score]) => ({
      content_id: id,
      content_type: 'creator',
      score: Math.min(1, score / 5),
      strategy: 'creator_discovery',
      reason_label: followingSet.size > 0 ? 'People in your network follow them' : 'Popular in your field',
    }));
}

// ─── Group Recommendations ────────────────────────────────────────────────────

export async function getGroupRecommendations(userProfileId, { limit = 8 } = {}) {
  const [memberships, tasteProfile, academicId] = await Promise.all([
    base44.entities.GroupMembership.filter({ user_id: userProfileId, status: 'active' }, '-created_date', 50).catch(() => []),
    personalizationEngine.buildTasteProfile(userProfileId).catch(() => null),
    base44.entities.AcademicIdentity.filter({ user_id: userProfileId }).then(r => r[0]).catch(() => null),
  ]);

  const joinedGroupIds = new Set(memberships.map(m => m.group_id));
  const topSubjects = tasteProfile ? personalizationEngine.getTopSubjects(tasteProfile, 5).map(s => s.subject) : [];
  const userSubjects = [...topSubjects, ...(academicId?.subjects || [])];

  // Fetch candidate groups
  const groups = await base44.entities.Group.filter(
    { status: 'active', privacy: 'public' }, '-member_count', 50
  ).catch(() => []);

  const candidates = groups.filter(g => !joinedGroupIds.has(g.id));

  // Score each group
  const scored = candidates.map(g => {
    let score = 0;
    // Subject overlap
    const overlap = (g.subject_tags || []).filter(s => userSubjects.includes(s)).length;
    score += Math.min(0.5, overlap * 0.15);
    // Activity score (member count proxy)
    score += Math.min(0.3, Math.log10((g.member_count || 1) + 1) / 5);
    // Academic type fit
    if (academicId?.school_id && g.school_id === academicId.school_id) score += 0.2;
    if (['study_group', 'department', 'classroom'].includes(g.type)) score += 0.1;

    const reasons = [];
    if (overlap > 0) reasons.push(`Matches your interest in ${g.subject_tags?.[0]}`);
    if (g.school_id === academicId?.school_id) reasons.push('From your school');

    return {
      content_id: g.id,
      content_type: 'group',
      score: Math.min(1, score),
      strategy: 'group_recommendation',
      reason_label: reasons[0] || `${g.member_count?.toLocaleString()} members`,
      data: g,
    };
  });

  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}

// ─── Course Recommendations ───────────────────────────────────────────────────

export async function getCourseRecommendations(userProfileId, { limit = 8 } = {}) {
  const [tasteProfile, academicId, enrollments] = await Promise.all([
    personalizationEngine.buildTasteProfile(userProfileId).catch(() => null),
    base44.entities.AcademicIdentity.filter({ user_id: userProfileId }).then(r => r[0]).catch(() => null),
    base44.entities.AcademicIdentity.filter({ user_id: userProfileId }).then(r => r[0]?.courses || []).catch(() => []),
  ]);

  const enrolledIds = new Set(enrollments);
  const topSubjects = tasteProfile ? personalizationEngine.getTopSubjects(tasteProfile, 6).map(s => s.subject) : [];
  const allSubjects = [...new Set([...topSubjects, ...(academicId?.subjects || [])])];

  const courses = await base44.entities.Course.filter(
    { status: 'published' }, '-enrollment_count', 80
  ).catch(() => []);

  const candidates = courses.filter(c => !enrolledIds.has(c.id));

  const scored = candidates.map(c => {
    let score = 0;
    const courseSubjects = [...(c.subject_tags || []), c.category].filter(Boolean);
    const overlap = courseSubjects.filter(s => allSubjects.includes(s)).length;
    score += Math.min(0.45, overlap * 0.15);
    // Social proof
    score += Math.min(0.25, Math.log10((c.enrollment_count || 1) + 1) / 5);
    // Quality signal
    score += ((c.rating_average || 0) / 5) * 0.20;
    // Free courses get slight boost for discoverability
    if (c.pricing_type === 'free') score += 0.10;

    const reasons = [];
    if (overlap > 0) reasons.push(`Matches your interest in ${courseSubjects[0]}`);
    if (c.enrollment_count > 100) reasons.push(`${c.enrollment_count.toLocaleString()} enrolled`);

    return {
      content_id: c.id,
      content_type: 'course',
      score: Math.min(1, score),
      strategy: 'course_recommendation',
      reason_label: reasons[0] || 'Popular course',
      data: c,
    };
  });

  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}

// ─── Live Session Recommendations ─────────────────────────────────────────────

export async function getLiveSessionRecommendations(userProfileId, { limit = 6 } = {}) {
  const [follows, tasteProfile] = await Promise.all([
    base44.entities.Follow.filter({ follower_id: userProfileId, status: 'active' }, '-created_date', 100).catch(() => []),
    personalizationEngine.buildTasteProfile(userProfileId).catch(() => null),
  ]);

  const followingIds = new Set(follows.map(f => f.following_id));
  const topSubjects = tasteProfile ? personalizationEngine.getTopSubjects(tasteProfile, 5).map(s => s.subject) : [];

  const liveSessions = await base44.entities.LiveSession.filter(
    { status: 'live', visibility: 'public' }, '-current_viewer_count', 30
  ).catch(() => []);

  const scored = liveSessions.map(s => {
    let score = 0;
    if (followingIds.has(s.host_id)) score += 0.5;
    const subjectOverlap = (s.subject_tags || []).filter(t => topSubjects.includes(t)).length;
    score += Math.min(0.35, subjectOverlap * 0.12);
    // Viewer momentum
    score += Math.min(0.15, Math.log10((s.current_viewer_count || 1) + 1) / 4);

    const isFollowed = followingIds.has(s.host_id);
    return {
      content_id: s.id,
      content_type: 'live_session',
      score: Math.min(1, score),
      strategy: 'live_recommendation',
      reason_label: isFollowed ? `${s.host_username} is live now` : `${s.current_viewer_count?.toLocaleString() || 0} watching`,
      data: s,
    };
  });

  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}

// ─── Marketplace Recommendations ──────────────────────────────────────────────

export async function getMarketplaceRecommendations(userProfileId, { limit = 8 } = {}) {
  const [profile, academicId] = await Promise.all([
    base44.entities.UserProfile.filter({ id: userProfileId }).then(r => r[0]).catch(() => null),
    base44.entities.AcademicIdentity.filter({ user_id: userProfileId }).then(r => r[0]).catch(() => null),
  ]);

  const listings = await base44.entities.MarketplaceListing.filter(
    { status: 'active', moderation_status: 'clean' }, '-created_date', 80
  ).catch(() => []);

  // Exclude own listings
  const candidates = listings.filter(l => l.seller_id !== userProfileId);

  const scored = candidates.map(l => {
    let score = 0;
    // School proximity
    if (academicId?.school_id && l.school_id === academicId.school_id) score += 0.4;
    // Category affinity heuristic — educational materials always relevant
    if (['textbooks', 'study_materials', 'courses'].includes(l.category)) score += 0.3;
    // Recency
    const ageHours = (Date.now() - new Date(l.created_date).getTime()) / 3600000;
    score += Math.max(0, 1 - ageHours / 168) * 0.20; // 168h = 7 days
    // Free items get discovery boost
    if (l.pricing_type === 'free') score += 0.10;

    return {
      content_id: l.id,
      content_type: 'marketplace',
      score: Math.min(1, score),
      strategy: 'marketplace_recommendation',
      reason_label: l.school_id === academicId?.school_id ? 'From your campus' : 'Recently listed',
      data: l,
    };
  });

  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}

// ─── Trending Content ─────────────────────────────────────────────────────────

export async function getTrendingContent({ limit = 20, timeWindowHours = 24 } = {}) {
  const posts = await base44.entities.Post.filter(
    { status: 'published', visibility: 'public', moderation_status: 'clean' },
    '-engagement_score',
    100
  ).catch(() => []);

  const cutoff = Date.now() - timeWindowHours * 3600000;

  return posts
    .filter(p => new Date(p.created_date).getTime() > cutoff)
    .map(p => ({
      ...p,
      _velocity: rankingEngine.computeViralVelocity(p),
    }))
    .sort((a, b) => b._velocity - a._velocity)
    .slice(0, limit);
}

// ─── Strategy Implementations (Posts) ─────────────────────────────────────────

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
    '-engagement_score', 100
  );

  return posts
    .filter(p => !servedIds.has(p.id) && !watchHistory.has(p.id) &&
      [...(p.subject_tags || []), ...(p.tags || [])].some(t => subjects.includes(t)))
    .map(p => {
      const matchCount = [...(p.subject_tags || []), ...(p.tags || [])].filter(t => subjects.includes(t)).length;
      return {
        content_id: p.id,
        score: Math.min(1, matchCount / subjects.length + 0.1),
        strategy: 'subject_match',
        reason_label: `Matches your interest in ${subjects[0]}`,
        data: p,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

async function _socialGraphStrategy(userProfileId, watchHistory, servedIds, limit) {
  const follows = await base44.entities.Follow.filter(
    { follower_id: userProfileId, status: 'active' }, '-created_date', 100
  );
  const followingIds = follows.map(f => f.following_id);
  if (!followingIds.length) return [];

  const interactions = await Promise.all(
    followingIds.slice(0, 10).map(fid =>
      base44.entities.PostInteraction.filter({ user_id: fid, type: 'save' }, '-created_date', 10).catch(() => [])
    )
  );

  const postIdScores = new Map();
  interactions.flat().forEach(i => {
    if (!servedIds.has(i.post_id) && !watchHistory.has(i.post_id))
      postIdScores.set(i.post_id, (postIdScores.get(i.post_id) || 0) + 0.3);
  });

  const candidates = [...postIdScores.entries()].sort(([, a], [, b]) => b - a).slice(0, limit * 2);
  const posts = await Promise.all(
    candidates.map(([id]) => base44.entities.Post.filter({ id }).then(r => r[0]).catch(() => null))
  );

  return posts
    .filter(p => p && p.status === 'published' && p.moderation_status === 'clean')
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
  const interactions = await base44.entities.PostInteraction.filter(
    { user_id: userProfileId }, '-created_date', 100
  );
  const postIds = [...new Set(interactions.map(i => i.post_id))].slice(0, 20);
  if (!postIds.length) return [];

  const posts = await Promise.all(
    postIds.map(id => base44.entities.Post.filter({ id }).then(r => r[0]).catch(() => null))
  );

  const authorAffinity = new Map();
  posts.filter(Boolean).forEach(p => {
    authorAffinity.set(p.author_id, (authorAffinity.get(p.author_id) || 0) + 1);
  });

  const topAuthors = [...authorAffinity.entries()].sort(([, a], [, b]) => b - a).slice(0, 5).map(([id]) => id);

  const authorPosts = await Promise.all(
    topAuthors.map(aid =>
      base44.entities.Post.filter({ author_id: aid, status: 'published', moderation_status: 'clean' }, '-created_date', 5).catch(() => [])
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
    '-engagement_score', 50
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

function _weightedMerge(streams, limit) {
  const seen = new Set();
  const pool = [];
  const totalWeight = streams.reduce((s, st) => s + st.weight, 0);
  const allocs = streams.map(st => ({ ...st, quota: Math.round((st.weight / totalWeight) * limit), index: 0 }));

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

async function _getServedIds(userProfileId, contentType) {
  const recs = await base44.entities.ContentRecommendation.filter(
    { user_id: userProfileId, content_type: contentType, served: true },
    '-created_date', 100
  ).catch(() => []);
  return new Set(recs.map(r => r.content_id));
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
      expires_at: new Date(Date.now() + 86_400_000).toISOString(),
    }).catch(() => {})
  );
  await Promise.allSettled(ops);
}

export default {
  getPostRecommendations,
  getRecommendations,
  getCreatorRecommendations,
  getGroupRecommendations,
  getCourseRecommendations,
  getLiveSessionRecommendations,
  getMarketplaceRecommendations,
  getTrendingContent,
};