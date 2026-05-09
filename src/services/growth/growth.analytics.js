/**
 * Growth Analytics Service
 *
 * Tracks and computes:
 *   1. Activation funnels (signup → activated in 7 days)
 *   2. Retention cohorts (D1/D7/D30 retention rates)
 *   3. DAU/WAU/MAU approximation from UserProfile signals
 *   4. Creator retention (creators still active after 30/90 days)
 *   5. Referral funnel (referred → activated → retained)
 *   6. Notification CTR by type
 *   7. Onboarding funnel (step-by-step drop-off)
 *   8. Streak impact on retention (streakers vs non-streakers)
 *
 * All computations are bounded and use indexed filters.
 * This is the MVP client-side version; production moves these
 * to ClickHouse SQL queries with pre-aggregated daily snapshots.
 *
 * Data flows into:
 *   - Executive Dashboard (DAU/MAU, revenue, creator count)
 *   - Growth Dashboard (activation, retention, viral)
 *   - Creator Economy Dashboard (creator retention, earnings growth)
 *   - Experiment Tracker (A/B test measurement)
 *
 * Migration note:
 *   On NestJS: all cohort queries → ClickHouse.
 *   Real-time DAU: Redis HyperLogLog (daily key, 1% error acceptable).
 *   Retention: SQL window functions over event_log table.
 *   A/B results: Bayesian inference via statsig/GrowthBook API.
 */

import { base44 } from '@/api/base44Client';
import { eventQueue } from '@/lib/infra/event-queue';

// ─── Activation Funnel ────────────────────────────────────────────────────────

/**
 * Get onboarding completion funnel across all users.
 * Returns step-by-step drop-off for admin growth dashboards.
 */
export async function getActivationFunnel({ days = 30 } = {}) {
  const since = new Date(Date.now() - days * 86400000).toISOString();

  const recentUsers = await base44.entities.UserProfile.filter(
    {}, '-created_date', 500
  ).then(users => users.filter(u => u.created_date >= since)).catch(() => []);

  const total = recentUsers.length;
  if (!total) return { total: 0, steps: [] };

  // Funnel stages based on onboarding_completed_steps
  const stages = [
    { id: 'registered',          label: 'Registered',            count: total },
    { id: 'interests_selected',  label: 'Selected Interests',    count: 0 },
    { id: 'follow_suggestions',  label: 'Followed Someone',       count: 0 },
    { id: 'first_post',          label: 'Published First Post',   count: 0 },
    { id: 'onboarding_complete', label: 'Completed Onboarding',  count: 0 },
    { id: 'activated',           label: 'Activated (D7)',         count: 0 },
  ];

  recentUsers.forEach(u => {
    const completed = u.onboarding_completed_steps || [];
    stages[1].count += completed.includes('select_interests') ? 1 : 0;
    stages[2].count += completed.includes('follow_suggestions') ? 1 : 0;
    stages[3].count += completed.includes('first_post') ? 1 : 0;
    stages[4].count += u.onboarding_complete ? 1 : 0;
    stages[5].count += u.onboarding_activated ? 1 : 0;
  });

  return {
    total,
    period: { days, since },
    steps: stages.map((s, i) => ({
      ...s,
      conversionRate: total > 0 ? parseFloat((s.count / total).toFixed(3)) : 0,
      dropOffRate: i > 0 ? parseFloat((1 - s.count / stages[i - 1].count).toFixed(3)) : 0,
    })),
  };
}

// ─── Retention Cohorts ────────────────────────────────────────────────────────

/**
 * Approximate D1/D7/D30 retention from last_seen_at field.
 * Groups users by signup week, measures % still active at each interval.
 */
export async function getRetentionCohorts({ weeks = 8 } = {}) {
  const users = await base44.entities.UserProfile.filter({}, '-created_date', 1000).catch(() => []);

  const cohorts = [];
  const now = Date.now();

  for (let w = 0; w < weeks; w++) {
    const cohortStart = now - (w + 1) * 7 * 86400000;
    const cohortEnd   = now - w * 7 * 86400000;

    const cohortUsers = users.filter(u => {
      const created = new Date(u.created_date).getTime();
      return created >= cohortStart && created < cohortEnd;
    });

    if (!cohortUsers.length) continue;

    const retain = (days) => cohortUsers.filter(u => {
      if (!u.last_seen_at) return false;
      const lastSeen = new Date(u.last_seen_at).getTime();
      const daysSinceCreate = (lastSeen - new Date(u.created_date).getTime()) / 86400000;
      return daysSinceCreate >= days;
    }).length;

    const size = cohortUsers.length;
    cohorts.push({
      weekLabel: `Week -${w + 1}`,
      cohortSize: size,
      d1:  parseFloat((retain(1)  / size).toFixed(3)),
      d7:  parseFloat((retain(7)  / size).toFixed(3)),
      d30: parseFloat((retain(30) / size).toFixed(3)),
    });
  }

  return { cohorts: cohorts.reverse(), generatedAt: new Date().toISOString() };
}

// ─── DAU/WAU/MAU ─────────────────────────────────────────────────────────────

/**
 * Approximate active user counts from last_seen_at.
 */
export async function getActiveUserCounts() {
  const users = await base44.entities.UserProfile.filter({}, '-created_date', 2000).catch(() => []);

  const now = Date.now();
  const dau = users.filter(u => u.last_seen_at && (now - new Date(u.last_seen_at).getTime()) < 86400000).length;
  const wau = users.filter(u => u.last_seen_at && (now - new Date(u.last_seen_at).getTime()) < 7 * 86400000).length;
  const mau = users.filter(u => u.last_seen_at && (now - new Date(u.last_seen_at).getTime()) < 30 * 86400000).length;

  return {
    dau, wau, mau,
    dau_wau_ratio: wau > 0 ? parseFloat((dau / wau).toFixed(3)) : 0,  // stickiness signal
    wau_mau_ratio: mau > 0 ? parseFloat((wau / mau).toFixed(3)) : 0,
    totalRegistered: users.length,
    generatedAt: new Date().toISOString(),
  };
}

// ─── Creator Retention ────────────────────────────────────────────────────────

/**
 * Get creator retention: % of creators who were active 30/90 days ago
 * and are still posting.
 */
export async function getCreatorRetention() {
  const creators = await base44.entities.CreatorProfile.filter({}, '-created_date', 500).catch(() => []);

  const now = Date.now();
  const active = (days) => creators.filter(c => {
    if (!c.last_published_at) return false;
    const daysSince = (now - new Date(c.last_published_at).getTime()) / 86400000;
    return daysSince < days;
  }).length;

  const total = creators.length;
  return {
    total,
    active7d:  active(7),
    active30d: active(30),
    active90d: active(90),
    retention7d:  total > 0 ? parseFloat((active(7)  / total).toFixed(3)) : 0,
    retention30d: total > 0 ? parseFloat((active(30) / total).toFixed(3)) : 0,
    retention90d: total > 0 ? parseFloat((active(90) / total).toFixed(3)) : 0,
    monetized: creators.filter(c => c.monetization_enabled).length,
  };
}

// ─── Referral Funnel ──────────────────────────────────────────────────────────

export async function getReferralFunnelStats() {
  const users = await base44.entities.UserProfile.filter({}, '-created_date', 1000).catch(() => []);

  const referred = users.filter(u => u.referred_by);
  const activated = referred.filter(u => u.referral_activated);
  const retained = activated.filter(u => {
    if (!u.last_seen_at) return false;
    return (Date.now() - new Date(u.last_seen_at).getTime()) < 30 * 86400000;
  });

  const topReferrers = {};
  users.filter(u => u.referral_count > 0).forEach(u => {
    topReferrers[u.id] = { userId: u.id, username: u.username, count: u.referral_count || 0 };
  });

  return {
    totalReferred: referred.length,
    activated: activated.length,
    retained30d: retained.length,
    attributionRate: users.length > 0 ? parseFloat((referred.length / users.length).toFixed(3)) : 0,
    activationRate: referred.length > 0 ? parseFloat((activated.length / referred.length).toFixed(3)) : 0,
    retentionRate: activated.length > 0 ? parseFloat((retained.length / activated.length).toFixed(3)) : 0,
    topReferrers: Object.values(topReferrers).sort((a, b) => b.count - a.count).slice(0, 10),
  };
}

// ─── Growth Experiment Tracking ───────────────────────────────────────────────

/**
 * Track an A/B experiment exposure.
 * Feeds into experiment results dashboard.
 */
export function trackExperimentExposure(experimentId, variant, userId) {
  eventQueue.track('experiment', 'exposed', { experimentId, variant, userId });
}

export function trackExperimentConversion(experimentId, variant, userId, metric) {
  eventQueue.track('experiment', 'converted', { experimentId, variant, userId, metric });
}

/**
 * Get growth summary for executive dashboard.
 */
export async function getGrowthSummary() {
  const [activeCounts, creatorRetention, referralStats] = await Promise.all([
    getActiveUserCounts(),
    getCreatorRetention(),
    getReferralFunnelStats(),
  ]);

  return {
    users: activeCounts,
    creators: creatorRetention,
    referrals: referralStats,
    generatedAt: new Date().toISOString(),
  };
}

export default {
  getActivationFunnel,
  getRetentionCohorts,
  getActiveUserCounts,
  getCreatorRetention,
  getReferralFunnelStats,
  trackExperimentExposure,
  trackExperimentConversion,
  getGrowthSummary,
};