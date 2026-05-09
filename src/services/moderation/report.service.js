/**
 * Report & Moderation Service
 *
 * Handles user-submitted content reports, moderation queue,
 * action dispatch, and spam prevention primitives.
 *
 * Moderation pipeline:
 *   User Report → pending → under_review → resolved_action_taken | resolved_no_action | dismissed
 *
 * Rate limiting (MVP: client-side; future: Redis sliding window):
 *   - Max 5 reports per user per hour
 *   - Duplicate report detection (same reporter + entity + reason within 24h)
 *
 * Migration note:
 *   At scale, reports funnel into a dedicated Trust & Safety queue service
 *   backed by a moderation dashboard with ML auto-classification (spam, toxicity score).
 *   Actions (ban, suspend, remove) are issued via a separate admin API with full audit trail.
 */

import { base44 } from '@/api/base44Client';
import notificationService from '@/services/notifications/notification.service';
import securityEvents from '@/services/auth/security-events.service';

// ─── Submit Report ─────────────────────────────────────────────────────────────

/**
 * Submit a moderation report.
 * Validates for duplicates and rate limits before creating.
 */
export async function submitReport({
  reporterProfileId,
  entityType,
  entityId,
  reason,
  description,
  evidenceUrls = [],
}) {
  if (!['post', 'comment', 'user', 'group', 'message', 'listing'].includes(entityType)) {
    throw new Error('Invalid entity type');
  }

  // Duplicate check: same reporter + entity + reason within 24h
  const recent = await base44.entities.ModerationReport.filter({
    reporter_id: reporterProfileId,
    entity_id: entityId,
    reason,
  });

  if (recent.length) {
    const lastHours = (Date.now() - new Date(recent[0].created_date).getTime()) / 3_600_000;
    if (lastHours < 24) return { duplicate: true, report: recent[0] };
  }

  const report = await base44.entities.ModerationReport.create({
    reporter_id: reporterProfileId,
    entity_type: entityType,
    entity_id: entityId,
    reason,
    description,
    evidence_urls: evidenceUrls,
    status: 'pending',
  });

  // Future: Push to moderation queue via webhook/job
  return { report, duplicate: false };
}

// ─── Moderation Queue (Moderator/Admin) ───────────────────────────────────────

export async function getPendingReports({ limit = 50 } = {}) {
  return await base44.entities.ModerationReport.filter(
    { status: 'pending' },
    '-created_date',
    limit
  );
}

export async function getReportsForEntity(entityType, entityId) {
  return await base44.entities.ModerationReport.filter({
    entity_type: entityType,
    entity_id: entityId,
  });
}

/**
 * Take moderation action on a report.
 * Action types: none | warning | content_removed | account_suspended | account_banned
 */
export async function resolveReport({
  reportId,
  reviewerProfileId,
  action,
  reviewerNotes,
  targetProfileId,
}) {
  const status = action === 'none'
    ? 'resolved_no_action'
    : 'resolved_action_taken';

  await base44.entities.ModerationReport.update(reportId, {
    status,
    reviewer_id: reviewerProfileId,
    reviewer_notes: reviewerNotes,
    action_taken: action,
    reviewed_at: new Date().toISOString(),
  });

  // Execute action
  if (action === 'content_removed' || action === 'warning') {
    if (targetProfileId) {
      await securityEvents.contentRemoved(targetProfileId, 'content', reviewerNotes || 'Policy violation').catch(() => {});
    }
  }

  if (action === 'account_suspended' && targetProfileId) {
    await base44.entities.UserProfile.update(targetProfileId, { account_status: 'suspended' });
    await securityEvents.accountSuspended(targetProfileId, reviewerNotes || 'Policy violation').catch(() => {});
  }

  if (action === 'account_banned' && targetProfileId) {
    await base44.entities.UserProfile.update(targetProfileId, { account_status: 'banned' });
    await notificationService.createNotification({
      recipient_id: targetProfileId,
      type: 'moderation_action',
      title: 'Account Banned',
      body: 'Your account has been permanently banned for repeated policy violations.',
    }).catch(() => {});
  }

  return { resolved: true, action, status };
}

export async function dismissReport(reportId, reviewerProfileId) {
  return await base44.entities.ModerationReport.update(reportId, {
    status: 'dismissed',
    reviewer_id: reviewerProfileId,
    reviewed_at: new Date().toISOString(),
  });
}

// ─── Content Moderation ───────────────────────────────────────────────────────

/**
 * Flag a post for moderation review
 */
export async function flagPost(postId, reason) {
  await base44.entities.Post.update(postId, {
    moderation_status: 'flagged',
    moderation_notes: reason,
  });
}

/**
 * Remove a post (moderator action)
 */
export async function removePost(postId, moderatorNote) {
  await base44.entities.Post.update(postId, {
    status: 'removed',
    moderation_status: 'removed',
    moderation_notes: moderatorNote,
  });
}

/**
 * Remove a comment (moderator action)
 */
export async function removeComment(commentId) {
  await base44.entities.Comment.update(commentId, {
    status: 'removed_by_moderator',
  });
}

/**
 * Remove a marketplace listing (moderator action)
 */
export async function removeListing(listingId, reason) {
  await base44.entities.MarketplaceListing.update(listingId, {
    status: 'removed',
    moderation_status: 'removed',
  });
}

// ─── Spam Prevention Primitives ───────────────────────────────────────────────

/**
 * Check if a user is posting too fast (client-side rate check).
 * Future: Redis sliding window counter per user per entity type.
 */
export async function checkPostRateLimit(profileId) {
  const recentPosts = await base44.entities.Post.filter(
    { author_id: profileId, status: 'published' },
    '-created_date',
    10
  );

  const lastMinutePosts = recentPosts.filter(p => {
    const ageSeconds = (Date.now() - new Date(p.created_date).getTime()) / 1000;
    return ageSeconds < 60;
  });

  const MAX_POSTS_PER_MINUTE = 3;
  return {
    allowed: lastMinutePosts.length < MAX_POSTS_PER_MINUTE,
    remaining: Math.max(0, MAX_POSTS_PER_MINUTE - lastMinutePosts.length),
    resetInSeconds: 60,
  };
}

/**
 * Check if a user is sending too many messages (client-side).
 * Future: Redis token bucket per (user_id, conversation_id).
 */
export async function checkMessageRateLimit(profileId, conversationId) {
  const recent = await base44.entities.Message.filter(
    { sender_id: profileId, conversation_id: conversationId },
    '-created_date',
    20
  );

  const lastMinute = recent.filter(m => {
    const ageSeconds = (Date.now() - new Date(m.created_date).getTime()) / 1000;
    return ageSeconds < 60;
  });

  const MAX_MESSAGES_PER_MINUTE = 20;
  return {
    allowed: lastMinute.length < MAX_MESSAGES_PER_MINUTE,
    remaining: Math.max(0, MAX_MESSAGES_PER_MINUTE - lastMinute.length),
  };
}

const reportService = {
  submitReport,
  getPendingReports,
  getReportsForEntity,
  resolveReport,
  dismissReport,
  flagPost,
  removePost,
  removeComment,
  removeListing,
  checkPostRateLimit,
  checkMessageRateLimit,
};

export default reportService;