/**
 * Retention & Habit Formation Service
 *
 * Drives recurring engagement through:
 *   1. Multi-dimensional streak system (posting, learning, social, live)
 *   2. Achievement & milestone engine (progress → reward → share)
 *   3. Return trigger computation (when/why to notify dormant users)
 *   4. Streak risk detection (user about to lose streak → rescue notification)
 *   5. Daily engagement scoring (normalized DAU signal per user)
 *   6. Cohort retention computation
 *
 * Streak Types:
 *   posting_streak    — consecutive days posting content
 *   learning_streak   — consecutive days completing a course lesson
 *   social_streak     — consecutive days engaging (like/comment/follow)
 *   live_streak       — consecutive weeks hosting a live session
 *   login_streak      — consecutive days opening the app
 *
 * Achievement System:
 *   XP thresholds trigger badges + celebratory notifications.
 *   Badges are visible on profiles — social proof, not just private rewards.
 *
 * Return Triggers (dormancy response):
 *   D+1 dormant: "Your followers are waiting for you"
 *   D+3 dormant: Personal re-engagement with content summary
 *   D+7 dormant: Creator milestone missed (social urgency)
 *   D+14 dormant: School/group activity they missed (FOMO)
 *
 * Migration note:
 *   Streaks → Redis ZADD with daily expiry (midnight TTL)
 *   Achievements → event-sourced on Kafka (never recalculate from scratch)
 *   Return triggers → scheduled BullMQ jobs per dormant user segment
 *   Cohort retention → ClickHouse day-0/day-7/day-30 retention queries
 */

import { base44 } from '@/api/base44Client';
import { eventQueue } from '@/lib/infra/event-queue';
import notificationService from '@/services/notifications/notification.service';

// ─── Achievement Definitions ──────────────────────────────────────────────────

export const ACHIEVEMENTS = {
  // Social milestones
  first_post:         { id: 'first_post',         xp: 100, label: 'First Post',          icon: '✍️',  category: 'social' },
  first_follower:     { id: 'first_follower',      xp: 50,  label: 'First Follower',      icon: '👥',  category: 'social' },
  ten_followers:      { id: 'ten_followers',        xp: 150, label: '10 Followers',        icon: '🎯',  category: 'social' },
  fifty_followers:    { id: 'fifty_followers',      xp: 300, label: '50 Followers',        icon: '⭐',  category: 'social' },
  hundred_followers:  { id: 'hundred_followers',    xp: 500, label: '100 Followers',       icon: '💫',  category: 'social' },
  five_hundred_followers: { id: 'five_hundred_followers', xp: 1000, label: '500 Followers', icon: '🚀', category: 'social' },

  // Streak milestones
  streak_3:           { id: 'streak_3',            xp: 75,  label: '3-Day Streak',        icon: '🔥',  category: 'streak' },
  streak_7:           { id: 'streak_7',            xp: 200, label: '7-Day Streak',        icon: '🔥',  category: 'streak' },
  streak_30:          { id: 'streak_30',           xp: 750, label: '30-Day Streak',       icon: '💎',  category: 'streak' },
  streak_100:         { id: 'streak_100',          xp: 2000, label: '100-Day Streak',     icon: '👑',  category: 'streak' },

  // Engagement milestones
  first_hundred_views: { id: 'first_hundred_views', xp: 150, label: '100 Views',          icon: '👁️',  category: 'engagement' },
  first_like:         { id: 'first_like',           xp: 25,  label: 'First Like',         icon: '❤️',  category: 'engagement' },
  ten_likes:          { id: 'ten_likes',            xp: 100, label: '10 Likes on a Post', icon: '🎉',  category: 'engagement' },

  // Creator milestones
  first_live:         { id: 'first_live',           xp: 200, label: 'First Live Session', icon: '🎙️',  category: 'creator' },
  first_tip:          { id: 'first_tip',            xp: 300, label: 'First Tip Received', icon: '💰',  category: 'creator' },
  first_course:       { id: 'first_course',         xp: 400, label: 'First Course Created', icon: '📚', category: 'creator' },
  monetized:          { id: 'monetized',            xp: 500, label: 'Monetization Enabled', icon: '💎', category: 'creator' },

  // Learning milestones
  first_lesson:       { id: 'first_lesson',         xp: 50,  label: 'First Lesson Completed', icon: '📖', category: 'learning' },
  first_course_complete: { id: 'first_course_complete', xp: 300, label: 'Course Completed', icon: '🎓', category: 'learning' },

  // Community
  first_group:        { id: 'first_group',          xp: 60,  label: 'Joined First Group', icon: '🏘️',  category: 'community' },
  group_creator:      { id: 'group_creator',        xp: 150, label: 'Group Creator',      icon: '🏗️',  category: 'community' },
};

// ─── Achievement Unlock ───────────────────────────────────────────────────────

/**
 * Check and unlock achievements for a user based on current state.
 * Call after significant events (new follower, post published, streak increment).
 * Returns list of newly unlocked achievements.
 */
export async function checkAndUnlockAchievements(userProfileId, context = {}) {
  const [profiles, creatorProfiles] = await Promise.all([
    base44.entities.UserProfile.filter({ id: userProfileId }),
    base44.entities.CreatorProfile.filter({ user_id: userProfileId }).catch(() => []),
  ]);
  const profile = profiles[0];
  const creator = creatorProfiles[0];
  if (!profile) return [];

  const earned = new Set(profile.achievements_earned || []);
  const newlyUnlocked = [];

  // Social milestones
  const followers = profile.follower_count || 0;
  _checkAchievement('ten_followers',      followers >= 10,   earned, newlyUnlocked);
  _checkAchievement('fifty_followers',    followers >= 50,   earned, newlyUnlocked);
  _checkAchievement('hundred_followers',  followers >= 100,  earned, newlyUnlocked);
  _checkAchievement('five_hundred_followers', followers >= 500, earned, newlyUnlocked);

  // Streak milestones
  if (context.streakDays !== undefined) {
    _checkAchievement('streak_3',  context.streakDays >= 3,   earned, newlyUnlocked);
    _checkAchievement('streak_7',  context.streakDays >= 7,   earned, newlyUnlocked);
    _checkAchievement('streak_30', context.streakDays >= 30,  earned, newlyUnlocked);
    _checkAchievement('streak_100', context.streakDays >= 100, earned, newlyUnlocked);
  }

  // Creator milestones
  if (creator) {
    _checkAchievement('first_live',  (creator.total_live_sessions || 0) >= 1, earned, newlyUnlocked);
    _checkAchievement('monetized',   creator.monetization_enabled, earned, newlyUnlocked);
  }

  // Context-based (passed from calling service)
  if (context.firstPost)      _checkAchievement('first_post',     true, earned, newlyUnlocked);
  if (context.firstTip)       _checkAchievement('first_tip',      true, earned, newlyUnlocked);
  if (context.firstCourse)    _checkAchievement('first_course',   true, earned, newlyUnlocked);
  if (context.firstFollower)  _checkAchievement('first_follower', true, earned, newlyUnlocked);
  if (context.firstGroup)     _checkAchievement('first_group',    true, earned, newlyUnlocked);
  if (context.firstLesson)    _checkAchievement('first_lesson',   true, earned, newlyUnlocked);
  if (context.firstLike)      _checkAchievement('first_like',     true, earned, newlyUnlocked);

  if (newlyUnlocked.length > 0) {
    const allEarned = [...earned, ...newlyUnlocked.map(a => a.id)];
    const totalXp = (profile.total_xp || 0) + newlyUnlocked.reduce((s, a) => s + a.xp, 0);

    await base44.entities.UserProfile.update(userProfileId, {
      achievements_earned: allEarned,
      total_xp: totalXp,
    });

    // Notify user of each achievement (batched into one notification if multiple)
    if (newlyUnlocked.length === 1) {
      const a = newlyUnlocked[0];
      await notificationService.createNotification({
        recipient_id: userProfileId,
        type: 'system_alert',
        title: `${a.icon} Achievement Unlocked: ${a.label}`,
        body: `You earned ${a.xp} XP! Keep going! 🎉`,
        metadata: { achievement: a.id, xp: a.xp },
      }).catch(() => {});
    } else if (newlyUnlocked.length > 1) {
      await notificationService.createNotification({
        recipient_id: userProfileId,
        type: 'system_alert',
        title: `🎉 ${newlyUnlocked.length} Achievements Unlocked!`,
        body: newlyUnlocked.map(a => `${a.icon} ${a.label}`).join(' · '),
      }).catch(() => {});
    }

    // Analytics
    newlyUnlocked.forEach(a => {
      eventQueue.track('retention', 'achievement_unlocked', { achievementId: a.id, category: a.category, xp: a.xp });
    });
  }

  return newlyUnlocked;
}

function _checkAchievement(id, condition, earned, newlyUnlocked) {
  if (condition && !earned.has(id) && ACHIEVEMENTS[id]) {
    earned.add(id);
    newlyUnlocked.push(ACHIEVEMENTS[id]);
  }
}

// ─── Streak Risk Detection ────────────────────────────────────────────────────

/**
 * Detect if a user is at risk of losing their posting streak.
 * Returns { atRisk, hoursRemaining, currentStreak }
 * Caller should send a rescue notification if atRisk=true.
 */
export async function detectStreakRisk(userProfileId) {
  const posts = await base44.entities.Post.filter(
    { author_id: userProfileId, status: 'published' },
    '-created_date',
    2
  ).catch(() => []);

  if (!posts.length) return { atRisk: false, currentStreak: 0 };

  const lastPost = new Date(posts[0].created_date);
  const now = new Date();
  const hoursSinceLastPost = (now - lastPost) / 3600000;
  const today = now.toISOString().split('T')[0];
  const lastPostDay = lastPost.toISOString().split('T')[0];

  // Already posted today — no risk
  if (lastPostDay === today) return { atRisk: false, currentStreak: null, postedToday: true };

  // Posted yesterday — at risk if > 18h since post (6h window remaining)
  const hoursRemaining = Math.max(0, 24 - hoursSinceLastPost);
  const atRisk = hoursSinceLastPost >= 18 && hoursSinceLastPost < 30;

  return { atRisk, hoursRemaining: Math.round(hoursRemaining), hoursSinceLastPost };
}

// ─── Return Triggers ──────────────────────────────────────────────────────────

/**
 * Compute the dormancy level and return trigger message for a user.
 * Returns null if user is active, otherwise { level, title, body }.
 * Caller (scheduled job) uses this to send targeted re-engagement notifications.
 */
export async function computeReturnTrigger(userProfileId) {
  const profiles = await base44.entities.UserProfile.filter({ id: userProfileId });
  const profile = profiles[0];
  if (!profile) return null;

  const lastSeen = profile.last_seen_at ? new Date(profile.last_seen_at) : new Date(profile.created_date);
  const daysDormant = Math.floor((Date.now() - lastSeen.getTime()) / 86400000);

  if (daysDormant < 1) return null; // Active — no trigger needed

  const triggers = [
    {
      minDays: 14,
      level: 'd14',
      title: 'You\'re missing out 👀',
      body: 'Your study groups and followed creators have been busy. Come see what\'s happening!',
    },
    {
      minDays: 7,
      level: 'd7',
      title: 'Your community misses you',
      body: 'There\'s new content from creators you follow. Jump back in and engage.',
    },
    {
      minDays: 3,
      level: 'd3',
      title: 'New content waiting for you',
      body: 'Posts, study sessions, and discussions you haven\'t seen yet.',
    },
    {
      minDays: 1,
      level: 'd1',
      title: 'Your followers are creating 🔥',
      body: 'Don\'t fall behind — check today\'s top content from your network.',
    },
  ];

  return triggers.find(t => daysDormant >= t.minDays) || null;
}

// ─── Daily Engagement Score ───────────────────────────────────────────────────

/**
 * Compute a normalized daily engagement score for a user (0–100).
 * Tracks signal quality for retention analytics.
 */
export async function computeDailyEngagementScore(userProfileId) {
  const since = new Date(Date.now() - 24 * 3600000).toISOString();
  const [posts, interactions, follows, sessions] = await Promise.all([
    base44.entities.Post.filter({ author_id: userProfileId, status: 'published' }, '-created_date', 5)
      .then(p => p.filter(x => x.created_date >= since)).catch(() => []),
    base44.entities.PostInteraction.filter({ user_id: userProfileId }, '-created_date', 20)
      .then(i => i.filter(x => x.created_date >= since)).catch(() => []),
    base44.entities.Follow.filter({ follower_id: userProfileId }, '-created_date', 5)
      .then(f => f.filter(x => x.created_date >= since)).catch(() => []),
    base44.entities.LiveSession.filter({ host_id: userProfileId, status: 'live' }, '-created_date', 2)
      .then(s => s.filter(x => x.started_at >= since)).catch(() => []),
  ]);

  const score =
    Math.min(30, posts.length * 30) +
    Math.min(40, interactions.length * 5) +
    Math.min(15, follows.length * 8) +
    Math.min(15, sessions.length * 15);

  return Math.min(100, score);
}

export default {
  ACHIEVEMENTS,
  checkAndUnlockAchievements,
  detectStreakRisk,
  computeReturnTrigger,
  computeDailyEngagementScore,
};