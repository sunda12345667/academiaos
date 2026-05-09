/**
 * Platform Operations Service — Admin Tooling & Health Monitoring
 *
 * Provides:
 *   1. User management actions (suspend, ban, unsuspend, role change)
 *   2. Creator governance (verify, demonetize, trust override)
 *   3. School governance (verify, suspend)
 *   4. Financial operations (payout review, force complete, fraud block)
 *   5. Platform health metrics (real-time abuse trends, queue depths)
 *   6. Moderation queue management
 *   7. Operational analytics (executive + moderation + growth dashboards)
 *
 * ALL mutations go through admin.audit.service.logAndExecute()
 * to guarantee immutable audit trail.
 *
 * Role Scoping:
 *   moderator          → content actions, report queue, user suspend
 *   senior_moderator   → + user ban, creator demonetize, appeal resolve
 *   trust_safety       → + trust score override, coordinated abuse
 *   finance_reviewer   → payout approve/reject/force-complete
 *   advertiser_manager → ad campaign review, advertiser suspend
 *   school_operator    → school verify, school-scoped content
 *   admin              → all actions
 *
 * Migration note:
 *   On NestJS: each operation category becomes its own microservice.
 *   This module becomes a thin orchestration client (API gateway calls).
 *   Real-time health metrics via Prometheus + Grafana dashboard.
 *   Admin UI becomes a separate Next.js app with server-side rendering.
 */

import { base44 } from '@/api/base44Client';
import adminAudit from './admin.audit.service';
import trustSafety from './trust.safety.service';
import notificationService from '@/services/notifications/notification.service';
import securityEvents from '@/services/auth/security-events.service';

// ─── User Management ──────────────────────────────────────────────────────────

export async function suspendUser(targetProfileId, actorId, actorRole, reason) {
  if (!reason) throw new Error('Suspension reason is required.');
  const profile = await base44.entities.UserProfile.filter({ id: targetProfileId }).then(r => r[0]);
  if (!profile) throw new Error('User not found.');

  return adminAudit.logAndExecute({
    actorId, actorRole,
    action: 'user_suspend',
    entityType: 'user',
    entityId: targetProfileId,
    beforeState: { account_status: profile.account_status },
    reason,
    execute: async () => {
      await base44.entities.UserProfile.update(targetProfileId, { account_status: 'suspended' });
      await securityEvents.accountSuspended(targetProfileId, reason).catch(() => {});
      await trustSafety.refreshTrustScore(targetProfileId, actorId, actorRole).catch(() => {});
      return { afterState: { account_status: 'suspended' } };
    },
  });
}

export async function banUser(targetProfileId, actorId, actorRole, reason, confirmedBy) {
  if (!reason) throw new Error('Ban reason is required.');
  const profile = await base44.entities.UserProfile.filter({ id: targetProfileId }).then(r => r[0]);

  return adminAudit.logAndExecute({
    actorId, actorRole,
    action: 'user_ban',
    entityType: 'user',
    entityId: targetProfileId,
    beforeState: { account_status: profile?.account_status },
    reason,
    confirmedBy, // Required for ban
    execute: async () => {
      await base44.entities.UserProfile.update(targetProfileId, { account_status: 'banned' });
      await notificationService.createNotification({
        recipient_id: targetProfileId,
        type: 'moderation_action',
        title: 'Account Permanently Banned',
        body: 'Your account has been permanently banned for violating our community guidelines.',
      }).catch(() => {});
      return { afterState: { account_status: 'banned' } };
    },
  });
}

export async function unsuspendUser(targetProfileId, actorId, actorRole, reason) {
  return adminAudit.logAndExecute({
    actorId, actorRole,
    action: 'user_unsuspend',
    entityType: 'user',
    entityId: targetProfileId,
    beforeState: { account_status: 'suspended' },
    reason: reason || 'Appeal approved',
    execute: async () => {
      await base44.entities.UserProfile.update(targetProfileId, { account_status: 'active' });
      await notificationService.createNotification({
        recipient_id: targetProfileId,
        type: 'system_alert',
        title: 'Account Reinstated',
        body: 'Your account has been reinstated. Welcome back.',
      }).catch(() => {});
      return { afterState: { account_status: 'active' } };
    },
  });
}

export async function changeUserRole(targetProfileId, newRole, actorId, actorRole, reason, confirmedBy) {
  const profile = await base44.entities.UserProfile.filter({ id: targetProfileId }).then(r => r[0]);

  return adminAudit.logAndExecute({
    actorId, actorRole,
    action: 'user_role_change',
    entityType: 'user',
    entityId: targetProfileId,
    beforeState: { role: profile?.role },
    reason,
    confirmedBy, // Sensitive: requires senior confirmation
    execute: async () => {
      await base44.entities.UserProfile.update(targetProfileId, { role: newRole });
      return { afterState: { role: newRole } };
    },
  });
}

// ─── Creator Governance ───────────────────────────────────────────────────────

export async function verifyCreator(creatorProfileId, actorId, actorRole) {
  const creator = await base44.entities.CreatorProfile.filter({ user_id: creatorProfileId }).then(r => r[0]);
  if (!creator) throw new Error('Creator profile not found.');

  return adminAudit.logAndExecute({
    actorId, actorRole,
    action: 'creator_verify',
    entityType: 'creator_profile',
    entityId: creator.id,
    beforeState: { verification_status: creator.verification_status },
    reason: 'Creator verification approved',
    execute: async () => {
      await base44.entities.CreatorProfile.update(creator.id, { verification_status: 'verified' });
      await base44.entities.UserProfile.update(creatorProfileId, { verification_status: 'id_verified' });
      await notificationService.createNotification({
        recipient_id: creatorProfileId,
        type: 'system_alert',
        title: 'Creator Verified ✓',
        body: 'Congratulations! Your creator account is now verified on StudentOS.',
      }).catch(() => {});
      return { afterState: { verification_status: 'verified' } };
    },
  });
}

export async function demonetizeCreator(creatorProfileId, actorId, actorRole, reason, confirmedBy) {
  const creator = await base44.entities.CreatorProfile.filter({ user_id: creatorProfileId }).then(r => r[0]);

  return adminAudit.logAndExecute({
    actorId, actorRole,
    action: 'creator_demonetize',
    entityType: 'creator_profile',
    entityId: creator?.id || creatorProfileId,
    beforeState: { monetization_enabled: creator?.monetization_enabled },
    reason,
    confirmedBy,
    execute: async () => {
      if (creator) {
        await base44.entities.CreatorProfile.update(creator.id, {
          monetization_enabled: false,
          tips_enabled: false,
          paid_content_enabled: false,
        });
      }
      await notificationService.createNotification({
        recipient_id: creatorProfileId,
        type: 'moderation_action',
        title: 'Monetization Suspended',
        body: `Your creator monetization has been suspended. Reason: ${reason}. You may appeal this decision.`,
      }).catch(() => {});
      return { afterState: { monetization_enabled: false } };
    },
  });
}

// ─── School Governance ────────────────────────────────────────────────────────

export async function verifySchool(schoolId, actorId, actorRole) {
  return adminAudit.logAndExecute({
    actorId, actorRole,
    action: 'school_verify',
    entityType: 'school',
    entityId: schoolId,
    beforeState: { verification_status: 'pending' },
    reason: 'School verification approved',
    execute: async () => {
      await base44.entities.School.update(schoolId, { verification_status: 'verified' });
      return { afterState: { verification_status: 'verified' } };
    },
  });
}

export async function suspendSchool(schoolId, actorId, actorRole, reason) {
  return adminAudit.logAndExecute({
    actorId, actorRole,
    action: 'school_suspend',
    entityType: 'school',
    entityId: schoolId,
    beforeState: { status: 'active' },
    reason,
    execute: async () => {
      await base44.entities.School.update(schoolId, { status: 'suspended' });
      return { afterState: { status: 'suspended' } };
    },
  });
}

// ─── Platform Health Dashboard ─────────────────────────────────────────────────

export async function getPlatformHealthSnapshot() {
  const [
    pendingReports,
    openFraudSignals,
    openAlerts,
    pendingPayouts,
    pendingAppeals,
    pendingAds,
  ] = await Promise.all([
    base44.entities.ModerationReport.filter({ status: 'pending' }, '-created_date', 200).catch(() => []),
    base44.entities.FraudSignal.filter({ status: 'open' }, '-created_date', 100).catch(() => []),
    base44.entities.PlatformAlert.filter({ status: 'open' }, '-created_date', 50).catch(() => []),
    base44.entities.PayoutRequest.filter({ status: 'pending' }, '-created_date', 100).catch(() => []),
    base44.entities.AppealRequest.filter({ status: 'pending' }, '-created_date', 50).catch(() => []),
    base44.entities.AdCampaign.filter({ status: 'pending_review' }, '-created_date', 50).catch(() => []),
  ]);

  const criticalAlerts = openAlerts.filter(a => a.severity === 'critical');
  const urgentPayouts = pendingPayouts.filter(p => p.amount > 50000 * 100); // > ₦50,000

  return {
    timestamp: new Date().toISOString(),
    queues: {
      moderation: { pending: pendingReports.length, backlogged: pendingReports.length > 50 },
      fraud: { open: openFraudSignals.length, critical: openFraudSignals.filter(s => s.severity === 'critical').length },
      payouts: { pending: pendingPayouts.length, urgent: urgentPayouts.length },
      appeals: { pending: pendingAppeals.length, high_priority: pendingAppeals.filter(a => a.priority === 'high').length },
      ads: { pending_review: pendingAds.length },
    },
    alerts: {
      total_open: openAlerts.length,
      critical: criticalAlerts.length,
      recent: openAlerts.slice(0, 5),
    },
    health_status: criticalAlerts.length > 0 ? 'critical'
      : pendingReports.length > 100 || openFraudSignals.length > 20 ? 'degraded'
      : 'healthy',
  };
}

// ─── Moderation Queue Management ──────────────────────────────────────────────

export async function getModerationQueue({ priority = 'all', entityType = 'all', limit = 30 } = {}) {
  const filter = { status: 'pending' };
  if (entityType !== 'all') filter.entity_type = entityType;

  const reports = await base44.entities.ModerationReport.filter(filter, '-created_date', limit).catch(() => []);

  // Enrich with severity from metadata
  return reports.map(r => ({
    ...r,
    severity: r.metadata?.severity || 'low',
    queue: trustSafety.getEscalationQueue(r).queue,
  }));
}

export async function getFraudReviewQueue({ limit = 50 } = {}) {
  return base44.entities.FraudSignal.filter(
    { status: 'open' }, '-created_date', limit
  ).catch(() => []);
}

export async function getPayoutReviewQueue({ limit = 50 } = {}) {
  return base44.entities.PayoutRequest.filter(
    { status: 'under_review' }, '-created_date', limit
  ).catch(() => []);
}

// ─── Operational Analytics ────────────────────────────────────────────────────

export async function getModerationAnalytics({ days = 30 } = {}) {
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const reports = await base44.entities.ModerationReport.filter({}, '-created_date', 500).catch(() => []);
  const recent = reports.filter(r => r.created_date >= since);

  const byStatus = recent.reduce((acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc; }, {});
  const byReason = recent.reduce((acc, r) => { acc[r.reason] = (acc[r.reason] || 0) + 1; return acc; }, {});
  const actionedReports = recent.filter(r => r.status === 'resolved_action_taken');
  const avgResolutionTime = actionedReports.length > 0
    ? actionedReports.reduce((s, r) => s + (r.reviewed_at ? new Date(r.reviewed_at) - new Date(r.created_date) : 0), 0) / actionedReports.length
    : 0;

  return {
    period: { days, since },
    totals: {
      submitted: recent.length,
      resolved: (byStatus.resolved_action_taken || 0) + (byStatus.resolved_no_action || 0),
      pending: byStatus.pending || 0,
      dismissed: byStatus.dismissed || 0,
    },
    byReason,
    byStatus,
    avgResolutionHours: parseFloat((avgResolutionTime / 3600000).toFixed(1)),
    actionRate: recent.length > 0 ? parseFloat(((byStatus.resolved_action_taken || 0) / recent.length).toFixed(3)) : 0,
  };
}

export default {
  suspendUser,
  banUser,
  unsuspendUser,
  changeUserRole,
  verifyCreator,
  demonetizeCreator,
  verifySchool,
  suspendSchool,
  getPlatformHealthSnapshot,
  getModerationQueue,
  getFraudReviewQueue,
  getPayoutReviewQueue,
  getModerationAnalytics,
};