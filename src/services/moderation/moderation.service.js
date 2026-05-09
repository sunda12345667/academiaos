/**
 * Moderation Service
 * 
 * Content moderation, user reports, and action enforcement.
 * 
 * Migration note: Becomes a ModerationModule in NestJS with a
 * dedicated review queue, AI-assisted flagging pipeline, and appeal system.
 */

import { base44 } from '@/api/base44Client';
import { PERMISSIONS, hasPermission } from '@/services/auth/permissions';

/**
 * Submit a content report
 */
async function submitReport(reporterProfile, { entityType, entityId, reason, description, evidenceUrls = [] }) {
  // Rate limiting: prevent report spam
  // Future: Redis-based rate limiter per user per entity
  const recentReports = await base44.entities.ModerationReport.filter({
    reporter_id: reporterProfile.id,
    entity_id: entityId,
  });
  if (recentReports.length >= 3) {
    throw new Error('You have already reported this content multiple times');
  }

  return await base44.entities.ModerationReport.create({
    reporter_id: reporterProfile.id,
    entity_type: entityType,
    entity_id: entityId,
    reason,
    description,
    evidence_urls: evidenceUrls,
    status: 'pending',
  });
}

/**
 * Flag content for review (auto-moderation trigger)
 * Future: ML classifier integration point
 */
async function autoFlagContent(entityType, entityId, reason = 'auto_detected') {
  if (entityType === 'post') {
    await base44.entities.Post.update(entityId, { moderation_status: 'flagged' });
  } else if (entityType === 'listing') {
    await base44.entities.MarketplaceListing.update(entityId, { moderation_status: 'flagged' });
  }

  // Create system report
  await base44.entities.ModerationReport.create({
    reporter_id: 'system',
    entity_type: entityType,
    entity_id: entityId,
    reason: 'spam',
    description: `Auto-flagged by system: ${reason}`,
    status: 'pending',
  });
}

/**
 * Get pending moderation queue (moderators/admins only)
 */
async function getPendingQueue(reviewerRole, { limit = 50 } = {}) {
  if (!hasPermission(reviewerRole, PERMISSIONS.REPORT_REVIEW)) {
    throw new Error('Insufficient permissions to view moderation queue');
  }

  return await base44.entities.ModerationReport.filter(
    { status: 'pending' },
    'created_date',
    limit
  );
}

/**
 * Take moderation action on a report
 */
async function resolveReport(reportId, reviewerProfile, { action, notes }) {
  if (!hasPermission(reviewerProfile.role, PERMISSIONS.REPORT_REVIEW)) {
    throw new Error('Insufficient permissions');
  }

  const reports = await base44.entities.ModerationReport.filter({ id: reportId });
  if (!reports.length) throw new Error('Report not found');
  const report = reports[0];

  // Execute action
  if (action === 'content_removed') {
    if (report.entity_type === 'post') {
      await base44.entities.Post.update(report.entity_id, {
        status: 'removed',
        moderation_status: 'removed',
        moderation_notes: notes,
      });
    } else if (report.entity_type === 'listing') {
      await base44.entities.MarketplaceListing.update(report.entity_id, {
        status: 'removed',
        moderation_status: 'removed',
      });
    } else if (report.entity_type === 'comment') {
      await base44.entities.Comment.update(report.entity_id, {
        status: 'removed_by_moderator',
      });
    }
  }

  if (action === 'account_suspended' || action === 'account_banned') {
    const newStatus = action === 'account_banned' ? 'banned' : 'suspended';
    const userProfiles = await base44.entities.UserProfile.filter({ id: report.entity_id });
    if (userProfiles.length) {
      await base44.entities.UserProfile.update(report.entity_id, { account_status: newStatus });
    }
  }

  // Close report
  await base44.entities.ModerationReport.update(reportId, {
    status: action === 'none' ? 'resolved_no_action' : 'resolved_action_taken',
    reviewer_id: reviewerProfile.id,
    reviewer_notes: notes,
    action_taken: action,
    reviewed_at: new Date().toISOString(),
  });

  // Auto-resolve other pending reports on same entity
  const siblingReports = await base44.entities.ModerationReport.filter({
    entity_id: report.entity_id,
    entity_type: report.entity_type,
    status: 'pending',
  });
  await Promise.all(
    siblingReports
      .filter(r => r.id !== reportId)
      .map(r => base44.entities.ModerationReport.update(r.id, { status: 'resolved_action_taken' }))
  );

  return { success: true, action };
}

export default {
  submitReport,
  autoFlagContent,
  getPendingQueue,
  resolveReport,
};