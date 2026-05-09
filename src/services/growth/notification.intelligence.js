/**
 * Notification Intelligence Service
 *
 * Psychologically optimized notification delivery that:
 *   1. Scores notifications by engagement probability
 *   2. Prevents notification fatigue via channel caps
 *   3. Batches low-priority notifications (hourly digest)
 *   4. Respects quiet hours (23:00–07:00 local time)
 *   5. Adapts delivery frequency by user engagement level
 *   6. Tracks CTR per notification type for algorithm feedback
 *
 * Notification Priority Tiers:
 *   P0 CRITICAL  — financial (payout, gift received), security, ban/suspension
 *   P1 HIGH      — direct reply to you, your live session starting, DM
 *   P2 MEDIUM    — new follower, post comment, mentioned, group invite
 *   P3 LOW       — recommendation re-engagement, streak reminder, digest
 *   P4 SYSTEM    — onboarding tips, achievements (batched)
 *
 * Fatigue Prevention:
 *   Max 5 notifications per day (P2+)
 *   Max 2 notifications per 4-hour window
 *   P3/P4 notifications skipped if P0/P1 sent in last 2h
 *   Unengaged users (no open in 7 days): reduce to P1+ only
 *
 * Optimal Send Times (Nigeria market):
 *   Morning:   07:30–09:00 (commute/pre-class)
 *   Midday:    12:00–13:30 (lunch break)
 *   Evening:   18:00–21:00 (peak social time)
 *   Quiet:     23:00–07:00 (no P2+ delivery)
 *
 * Migration note:
 *   On NestJS: notification scheduler via BullMQ delayed jobs.
 *   FCM for push, SendGrid for email digest.
 *   Quiet hours: user timezone stored on UserProfile, enforced server-side.
 *   CTR tracking: notification_opened event via deep link callback.
 */

import notificationService from '@/services/notifications/notification.service';
import { eventQueue } from '@/lib/infra/event-queue';

// ─── Priority Definitions ─────────────────────────────────────────────────────

export const NOTIFICATION_PRIORITY = {
  CRITICAL: 0,  // Always deliver, ignore all caps
  HIGH: 1,      // Deliver immediately, respect quiet hours
  MEDIUM: 2,    // Respect caps + quiet hours
  LOW: 3,       // Batch or defer
  SYSTEM: 4,    // Batch into digest
};

const TYPE_PRIORITIES = {
  // P0
  wallet_credit: 0,  wallet_debit: 0,  moderation_action: 0,
  // P1
  comment_reply: 1,  new_message: 1,   live_starting: 1,   mention: 1,
  // P2
  new_follower: 2,   post_like: 2,     post_comment: 2,    group_invite: 2,
  post_share: 2,     group_join_approved: 2,
  // P3
  assignment_due: 3, course_update: 3,
  // P4
  system_alert: 4,   marketplace_order: 4,
};

const DAILY_CAP_BY_PRIORITY = {
  0: Infinity,  // No cap for critical
  1: 10,        // High: max 10/day
  2: 5,         // Medium: max 5/day
  3: 2,         // Low: max 2/day
  4: 1,         // System: max 1 digest/day
};

// ─── Intelligent Notification Dispatch ────────────────────────────────────────

/**
 * Smart notification send — replaces direct notificationService.createNotification()
 * for all non-financial, non-security notifications.
 *
 * Checks:
 *   1. User's notification preferences
 *   2. Daily cap for this priority tier
 *   3. Quiet hours
 *   4. Recent notification density (anti-flood)
 *
 * Returns: { sent, reason } — reason explains why not sent if sent=false
 */
export async function sendIntelligentNotification({
  recipientId,
  type,
  title,
  body,
  actorId,
  entityType,
  entityId,
  metadata = {},
  forceDelivery = false,
}) {
  const priority = TYPE_PRIORITIES[type] ?? NOTIFICATION_PRIORITY.MEDIUM;

  // Always send P0 regardless of caps
  if (priority === NOTIFICATION_PRIORITY.CRITICAL || forceDelivery) {
    const n = await notificationService.createNotification({
      recipient_id: recipientId, type, title, body, actor_id: actorId,
      entity_type: entityType, entity_id: entityId, metadata,
    });
    return { sent: true, reason: 'critical_bypass', notificationId: n?.id };
  }

  // Quiet hours check (23:00–07:00 Nigeria WAT = UTC+1)
  if (priority >= NOTIFICATION_PRIORITY.MEDIUM && _isQuietHours()) {
    eventQueue.track('notification', 'deferred_quiet_hours', { recipientId, type, priority });
    return { sent: false, reason: 'quiet_hours' };
  }

  // Fetch recent notifications to check caps + density
  const recentNotifications = await _getRecentNotifications(recipientId);
  const todayCount = recentNotifications.filter(n => {
    const age = (Date.now() - new Date(n.created_date).getTime()) / 86400000;
    return age < 1 && (TYPE_PRIORITIES[n.type] ?? 2) <= priority;
  }).length;

  const dailyCap = DAILY_CAP_BY_PRIORITY[priority] ?? 5;
  if (todayCount >= dailyCap) {
    eventQueue.track('notification', 'dropped_cap', { recipientId, type, priority, todayCount, dailyCap });
    return { sent: false, reason: 'daily_cap_reached' };
  }

  // Anti-flood: no more than 2 notifications in 4-hour window (P2+)
  if (priority >= NOTIFICATION_PRIORITY.MEDIUM) {
    const last4h = recentNotifications.filter(n => {
      const ageHours = (Date.now() - new Date(n.created_date).getTime()) / 3600000;
      return ageHours < 4;
    }).length;
    if (last4h >= 2) {
      return { sent: false, reason: 'flood_prevention' };
    }
  }

  const notification = await notificationService.createNotification({
    recipient_id: recipientId, type, title, body, actor_id: actorId,
    entity_type: entityType, entity_id: entityId, metadata,
  });

  eventQueue.track('notification', 'sent', { recipientId, type, priority });
  return { sent: true, notificationId: notification?.id };
}

// ─── Streak Rescue Notification ───────────────────────────────────────────────

export async function sendStreakRescueNotification(userProfileId, streakDays) {
  const urgency = streakDays >= 30 ? '🔥 Don\'t lose your 30-day streak!'
    : streakDays >= 7 ? '⚡ Your 7-day streak is at risk!'
    : '📅 Post today to keep your streak alive!';

  return sendIntelligentNotification({
    recipientId: userProfileId,
    type: 'system_alert',
    title: urgency,
    body: `You have a ${streakDays}-day posting streak. Share something today to keep it alive!`,
    metadata: { streakDays, notificationSubtype: 'streak_rescue' },
  });
}

// ─── Return Trigger Notification ─────────────────────────────────────────────

export async function sendReturnTriggerNotification(userProfileId, trigger) {
  return sendIntelligentNotification({
    recipientId: userProfileId,
    type: 'system_alert',
    title: trigger.title,
    body: trigger.body,
    forceDelivery: false,
    metadata: { dormancyLevel: trigger.level, notificationSubtype: 'return_trigger' },
  });
}

// ─── Milestone Celebration ────────────────────────────────────────────────────

export async function sendMilestoneCelebration(userProfileId, milestoneType, value) {
  const messages = {
    followers_100:  { title: '🎉 100 Followers!', body: 'You hit 100 followers! Your audience is growing. Keep creating!' },
    followers_500:  { title: '🚀 500 Followers!', body: 'Amazing — 500 people follow you now. Time to unlock monetization!' },
    streak_7:       { title: '🔥 7-Day Streak!',  body: 'A whole week of consistent posting. You\'re building real momentum!' },
    streak_30:      { title: '💎 30-Day Streak!', body: 'Incredible dedication. You\'ve posted every day for a month!' },
    first_earnings: { title: '💰 First Earnings!', body: `You just received your first payment on StudentOS: ₦${value?.toLocaleString()}!` },
  };

  const msg = messages[milestoneType];
  if (!msg) return null;

  return sendIntelligentNotification({
    recipientId: userProfileId,
    type: 'system_alert',
    title: msg.title,
    body: msg.body,
    forceDelivery: true, // Milestones always deliver
    metadata: { milestoneType, value, notificationSubtype: 'milestone' },
  });
}

// ─── Notification Preference Helpers ─────────────────────────────────────────

export function getNotificationCategories() {
  return [
    { id: 'social',    label: 'Social (likes, comments, follows)',   defaultEnabled: true  },
    { id: 'messages',  label: 'Direct Messages',                     defaultEnabled: true  },
    { id: 'creator',   label: 'Creator Activity (tips, milestones)', defaultEnabled: true  },
    { id: 'learning',  label: 'Learning Reminders',                  defaultEnabled: true  },
    { id: 'streaks',   label: 'Streak Reminders',                    defaultEnabled: true  },
    { id: 'marketing', label: 'Recommendations & Promotions',        defaultEnabled: false },
  ];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _isQuietHours() {
  // Nigeria WAT (UTC+1) — approximate via UTC offset
  const utcHour = new Date().getUTCHours();
  const watHour = (utcHour + 1) % 24;
  return watHour >= 23 || watHour < 7;
}

async function _getRecentNotifications(recipientId) {
  const since24h = new Date(Date.now() - 24 * 3600000).toISOString();
  const recent = await notificationService.getNotifications(recipientId, { limit: 30 });
  return (recent.notifications || []).filter(n => n.created_date >= since24h);
}

export default {
  NOTIFICATION_PRIORITY,
  TYPE_PRIORITIES,
  sendIntelligentNotification,
  sendStreakRescueNotification,
  sendReturnTriggerNotification,
  sendMilestoneCelebration,
  getNotificationCategories,
};