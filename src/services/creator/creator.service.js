/**
 * Creator Economy Service
 *
 * Manages creator profiles, analytics, tier progression,
 * monetization eligibility, and trust scoring.
 *
 * Creator tier progression:
 *   none → basic (50+ followers) → pro (500+ followers, 70+ trust)
 *         → verified (platform review) → elite (top 1%, monetization enabled)
 *
 * Trust score inputs (0–100):
 *   - account age                      (+10 max)
 *   - verification status              (+20 max)
 *   - avg engagement rate              (+25 max)
 *   - content quality signals          (+25 max, future ML)
 *   - moderation history               (-30 max penalty)
 *   - streak / consistency             (+10 max)
 *   - spam score (inverted)            (-10 max penalty)
 *
 * Migration note:
 *   CreatorProfile analytics → ClickHouse OLAP with event sourcing from Kafka.
 *   Trust score → real-time ML model updated on each new interaction event.
 *   Tier upgrades → async background job triggered on follower count thresholds.
 */

import { base44 } from '@/api/base44Client';
import engagementService from '@/services/engagement/engagement.service';

// ─── Tier Thresholds ──────────────────────────────────────────────────────────

const TIER_THRESHOLDS = {
  none:     { followers: 0,    trust: 0  },
  basic:    { followers: 50,   trust: 20 },
  pro:      { followers: 500,  trust: 50 },
  verified: { followers: 2000, trust: 70 }, // requires platform review
  elite:    { followers: 10000,trust: 85 }, // by invitation
};

// ─── Profile Lifecycle ────────────────────────────────────────────────────────

export async function getCreatorProfile(userProfileId) {
  const profiles = await base44.entities.CreatorProfile.filter({ user_id: userProfileId });
  return profiles[0] ?? null;
}

export async function getOrCreateCreatorProfile(userProfileId) {
  const existing = await getCreatorProfile(userProfileId);
  if (existing) return existing;

  return await base44.entities.CreatorProfile.create({
    user_id: userProfileId,
    tier: 'none',
    verification_status: 'unverified',
    total_followers: 0,
    total_views: 0,
    total_posts: 0,
    total_live_sessions: 0,
    avg_engagement_rate: 0,
    trust_score: 30, // default baseline trust
    monetization_enabled: false,
    tips_enabled: false,
    paid_content_enabled: false,
    content_quality_score: 50,
    spam_score: 0,
    badges: [],
    analytics_opt_in: true,
  });
}

export async function updateCreatorProfile(userProfileId, updates) {
  const profile = await getCreatorProfile(userProfileId);
  if (!profile) throw new Error('Creator profile not found');

  // Guard against client-side privilege escalation
  const allowedFields = [
    'display_name', 'tagline', 'niche', 'subject_focus',
    'social_links', 'featured_post_ids', 'analytics_opt_in',
  ];
  const sanitized = {};
  allowedFields.forEach(f => { if (updates[f] !== undefined) sanitized[f] = updates[f]; });

  return await base44.entities.CreatorProfile.update(profile.id, sanitized);
}

// ─── Analytics ────────────────────────────────────────────────────────────────

/**
 * Compute and persist creator analytics snapshot.
 * Call after significant events (new follower, new post, live session end).
 * Future: Replaced by ClickHouse aggregation pipeline.
 */
export async function refreshCreatorAnalytics(userProfileId) {
  const [creatorProfile, userProfile] = await Promise.all([
    getCreatorProfile(userProfileId),
    base44.entities.UserProfile.filter({ id: userProfileId }),
  ]);

  if (!creatorProfile || !userProfile.length) return null;

  const summary = await engagementService.getCreatorSummary(userProfileId);
  const streak  = await engagementService.getPostingStreak(userProfileId);

  const updates = {
    total_followers: userProfile[0].follower_count || 0,
    total_posts: summary.totalPosts,
    avg_engagement_rate: summary.engagementRate,
    last_published_at: summary.topPost?.created_date ?? null,
  };

  // Recompute trust score
  const newTrust = computeTrustScore(userProfile[0], creatorProfile, summary, streak);
  updates.trust_score = newTrust;

  // Recompute tier eligibility
  const newTier = computeEligibleTier(userProfile[0].follower_count || 0, newTrust, creatorProfile.tier);
  if (newTier !== creatorProfile.tier && newTier !== 'verified' && newTier !== 'elite') {
    updates.tier = newTier;
  }

  // Recompute badges
  updates.badges = computeBadges(userProfile[0], summary, streak, newTrust);

  await base44.entities.CreatorProfile.update(creatorProfile.id, updates);
  return { ...creatorProfile, ...updates };
}

/**
 * Full analytics dashboard data for a creator.
 * Returns aggregated metrics suitable for rendering charts.
 */
export async function getCreatorDashboard(userProfileId) {
  const [creatorProfile, summary, streak, recentPosts, liveSessions] = await Promise.all([
    getCreatorProfile(userProfileId),
    engagementService.getCreatorSummary(userProfileId),
    engagementService.getPostingStreak(userProfileId),
    base44.entities.Post.filter({ author_id: userProfileId, status: 'published' }, '-created_date', 20),
    base44.entities.LiveSession.filter({ host_id: userProfileId }, '-created_date', 10).catch(() => []),
  ]);

  // Post performance breakdown by type
  const byType = {};
  recentPosts.forEach(p => {
    byType[p.type] = byType[p.type] ?? { count: 0, totalEngagement: 0 };
    byType[p.type].count++;
    byType[p.type].totalEngagement += (p.like_count || 0) + (p.comment_count || 0) + (p.share_count || 0);
  });

  // Engagement trend (last 7 posts as a simple time series)
  const trend = recentPosts.slice(0, 7).reverse().map(p => ({
    date: p.created_date,
    engagement: (p.like_count || 0) + (p.comment_count || 0) + (p.share_count || 0),
    views: p.view_count || 0,
  }));

  // Live session summary
  const totalLiveViewers = liveSessions.reduce((s, l) => s + (l.total_viewer_count || 0), 0);
  const avgLiveViewers = liveSessions.length
    ? Math.round(totalLiveViewers / liveSessions.length)
    : 0;

  return {
    profile: creatorProfile,
    summary,
    streak,
    trend,
    byType,
    liveSummary: { totalSessions: liveSessions.length, totalViewers: totalLiveViewers, avgViewers: avgLiveViewers },
    recentPosts: recentPosts.slice(0, 10),
  };
}

// ─── Monetization ─────────────────────────────────────────────────────────────

export async function enableTips(userProfileId) {
  const profile = await getCreatorProfile(userProfileId);
  if (!profile) throw new Error('No creator profile');
  if (profile.trust_score < 40) throw new Error('Trust score too low to enable tips');

  await base44.entities.CreatorProfile.update(profile.id, { tips_enabled: true });
  return { tipsEnabled: true };
}

export async function enableMonetization(userProfileId) {
  const [creatorProfile, userProfile] = await Promise.all([
    getCreatorProfile(userProfileId),
    base44.entities.UserProfile.filter({ id: userProfileId }),
  ]);

  if (!creatorProfile) throw new Error('No creator profile');
  if (creatorProfile.trust_score < 60) throw new Error('Trust score too low');
  if ((userProfile[0]?.follower_count || 0) < 500) throw new Error('Not enough followers (500 required)');

  await base44.entities.CreatorProfile.update(creatorProfile.id, {
    monetization_enabled: true,
    paid_content_enabled: true,
    tier: creatorProfile.tier === 'none' || creatorProfile.tier === 'basic' ? 'pro' : creatorProfile.tier,
  });

  return { monetizationEnabled: true };
}

// ─── Discovery ────────────────────────────────────────────────────────────────

/**
 * Get suggested creators for a user.
 * Ranked by engagement rate × trust score, filtered by subject overlap.
 * Future: Collaborative filtering model.
 */
export async function getDiscoverCreators(viewerProfileId, { limit = 10 } = {}) {
  const [follows, viewerProfiles, allCreators] = await Promise.all([
    base44.entities.Follow.filter({ follower_id: viewerProfileId, status: 'active' }, '-created_date', 200),
    base44.entities.UserProfile.filter({ id: viewerProfileId }),
    base44.entities.CreatorProfile.filter({ monetization_enabled: false }, '-avg_engagement_rate', 100)
      .catch(() => base44.entities.CreatorProfile.list('-avg_engagement_rate', 100)),
  ]);

  const followingSet = new Set(follows.map(f => f.following_id));
  const viewerSubjects = viewerProfiles[0]?.preferences?.subject_interests ?? [];

  return allCreators
    .filter(c =>
      c.user_id !== viewerProfileId &&
      !followingSet.has(c.user_id) &&
      c.trust_score >= 30
    )
    .map(c => {
      const subjectOverlap = (c.subject_focus || []).filter(s => viewerSubjects.includes(s)).length;
      const score = (c.avg_engagement_rate || 0) * 0.4 +
                    (c.trust_score || 0) * 0.3 +
                    subjectOverlap * 10 +
                    (c.total_followers || 0) * 0.001;
      return { ...c, _score: score };
    })
    .sort((a, b) => b._score - a._score)
    .slice(0, limit);
}

// ─── Trust Scoring ────────────────────────────────────────────────────────────

export function computeTrustScore(userProfile, creatorProfile, summary, streak) {
  let score = 30; // baseline

  // Account age (days)
  const accountAgeDays = (Date.now() - new Date(userProfile.created_date).getTime()) / 86_400_000;
  score += Math.min(10, accountAgeDays / 30 * 5);

  // Verification
  if (userProfile.verification_status === 'educator_verified') score += 20;
  else if (userProfile.verification_status === 'id_verified') score += 15;
  else if (userProfile.verification_status === 'email_verified') score += 8;

  // Engagement rate (0–15%)
  const engRate = summary?.engagementRate ?? 0;
  score += Math.min(25, engRate * 3);

  // Consistency streak
  score += Math.min(10, (streak?.current ?? 0) * 2);

  // Moderation history penalty
  if (userProfile.account_status === 'suspended') score -= 30;
  if (userProfile.account_status === 'banned') return 0;

  // Spam score penalty
  score -= Math.min(10, (creatorProfile?.spam_score ?? 0) * 0.1);

  return Math.round(Math.max(0, Math.min(100, score)));
}

export function computeEligibleTier(followerCount, trustScore, currentTier) {
  // Never downgrade verified/elite automatically
  if (currentTier === 'verified' || currentTier === 'elite') return currentTier;

  if (followerCount >= TIER_THRESHOLDS.pro.followers && trustScore >= TIER_THRESHOLDS.pro.trust) return 'pro';
  if (followerCount >= TIER_THRESHOLDS.basic.followers && trustScore >= TIER_THRESHOLDS.basic.trust) return 'basic';
  return 'none';
}

export function computeBadges(userProfile, summary, streak, trustScore) {
  const badges = [];
  if ((userProfile.follower_count || 0) >= 1000) badges.push('popular_creator');
  if ((summary?.engagementRate ?? 0) >= 5) badges.push('high_engagement');
  if ((streak?.current ?? 0) >= 7) badges.push('consistent_poster');
  if ((streak?.current ?? 0) >= 30) badges.push('dedication_master');
  if (trustScore >= 80) badges.push('trusted_educator');
  if (userProfile.verification_status === 'educator_verified') badges.push('verified_educator');
  return badges;
}

const creatorService = {
  getCreatorProfile,
  getOrCreateCreatorProfile,
  updateCreatorProfile,
  refreshCreatorAnalytics,
  getCreatorDashboard,
  enableTips,
  enableMonetization,
  getDiscoverCreators,
  computeTrustScore,
  computeEligibleTier,
  computeBadges,
  TIER_THRESHOLDS,
};

export default creatorService;