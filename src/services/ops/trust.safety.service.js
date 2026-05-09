/**
 * Trust & Safety Service
 *
 * Orchestrates all trust, risk, and safety operations across:
 *   - User trust score management
 *   - Appeal workflows
 *   - Escalation routing (severity → reviewer tier)
 *   - Coordinated abuse detection
 *   - Platform alert generation
 *   - Moderator queue management
 *
 * Reviewer Tier Routing:
 *   Severity LOW    → junior moderator queue
 *   Severity MEDIUM → senior moderator queue
 *   Severity HIGH   → trust & safety team
 *   Financial       → finance reviewer (separate queue)
 *   Advertiser      → advertiser manager queue
 *
 * Trust Score Mechanics (0–100):
 *   +30  account age (days/30, max 30)
 *   +20  verification status (email=5, id=12, educator=20)
 *   +25  engagement quality (content reported rate)
 *   +10  payment history
 *   +15  community contribution (helpful flags, reports)
 *   -30  suspension history (-10 per offense)
 *   -20  fraud signals (severity-weighted)
 *   -15  chargeback/payout issues
 *
 * Migration note:
 *   On NestJS: trust scores computed nightly via cron job.
 *   Stored on UserProfile.trust_score, updated incrementally on events.
 *   Coordinated abuse detection via graph clustering (PyGCN, future).
 */

import { base44 } from '@/api/base44Client';
import notificationService from '@/services/notifications/notification.service';
import adminAudit from './admin.audit.service';

// ─── Trust Score Computation ──────────────────────────────────────────────────

/**
 * Compute a full trust score for a user profile.
 * Returns 0–100 integer.
 */
export async function computeTrustScore(userProfileId) {
  const [profile, reports, fraudSignals, payoutHistory] = await Promise.all([
    base44.entities.UserProfile.filter({ id: userProfileId }).then(r => r[0]).catch(() => null),
    base44.entities.ModerationReport.filter({ entity_id: userProfileId }, '-created_date', 50).catch(() => []),
    base44.entities.FraudSignal.filter({ user_id: userProfileId }, '-created_date', 30).catch(() => []),
    base44.entities.PayoutRequest.filter({ user_id: userProfileId }, '-created_date', 20).catch(() => []),
  ]);

  if (!profile) return 0;

  let score = 0;

  // Account age contribution (max 30)
  const ageDays = (Date.now() - new Date(profile.created_date).getTime()) / 86400000;
  score += Math.min(30, Math.floor(ageDays / 10) * 3);

  // Verification status (max 20)
  const verifScores = { unverified: 0, pending: 2, email_verified: 5, id_verified: 12, educator_verified: 20 };
  score += verifScores[profile.verification_status] || 0;

  // Report quality (max 15) — penalize actioned reports
  const actionedReports = reports.filter(r => r.status === 'resolved_action_taken').length;
  score += Math.max(0, 15 - actionedReports * 5);

  // Payment/payout health (max 10)
  const failedPayouts = payoutHistory.filter(p => p.status === 'failed').length;
  score += Math.max(0, 10 - failedPayouts * 3);

  // Fraud signal penalty
  const FRAUD_PENALTIES = { low: 5, medium: 12, high: 25, critical: 40 };
  const openSignals = fraudSignals.filter(s => s.status === 'open');
  const fraudPenalty = openSignals.reduce((sum, s) => sum + (FRAUD_PENALTIES[s.severity] || 5), 0);
  score -= Math.min(40, fraudPenalty);

  // Account status penalty
  if (profile.account_status === 'suspended') score -= 30;
  if (profile.account_status === 'banned') score = 0;

  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Update trust score on UserProfile (used after significant events).
 */
export async function refreshTrustScore(userProfileId, actorId, actorRole) {
  const score = await computeTrustScore(userProfileId);
  await base44.entities.UserProfile.update(userProfileId, { trust_score: score });
  return score;
}

// ─── Appeal Workflow ──────────────────────────────────────────────────────────

/**
 * Submit an appeal request.
 * Validates: 1 appeal per original action.
 */
export async function submitAppeal({
  appellantId,
  originalAction,
  originalReportId,
  originalEntityType,
  originalEntityId,
  appealReason,
  evidenceUrls = [],
}) {
  if (!appealReason || appealReason.length < 50) {
    throw new Error('Appeal reason must be at least 50 characters.');
  }

  // Check for existing appeal on same action+entity
  const existing = await base44.entities.AppealRequest.filter({
    appellant_id: appellantId,
    original_entity_id: originalEntityId,
    original_action: originalAction,
  }).catch(() => []);

  if (existing.length > 0) {
    throw new Error('An appeal already exists for this action.');
  }

  // Determine priority
  const highPriorityActions = ['account_banned', 'demonetized', 'payout_blocked'];
  const priority = highPriorityActions.includes(originalAction) ? 'high' : 'normal';

  const appeal = await base44.entities.AppealRequest.create({
    appellant_id: appellantId,
    original_action: originalAction,
    original_report_id: originalReportId,
    original_entity_type: originalEntityType,
    original_entity_id: originalEntityId,
    appeal_reason: appealReason,
    evidence_urls: evidenceUrls,
    status: 'pending',
    priority,
    auto_eligible: true,
  });

  // Notify T&S team (system notification)
  await notificationService.createNotification({
    recipient_id: 'system',
    type: 'system_alert',
    title: `New ${priority} priority appeal`,
    body: `User ${appellantId} appealing: ${originalAction}`,
    entity_type: 'appeal',
    entity_id: appeal.id,
  }).catch(() => {});

  return appeal;
}

/**
 * Resolve an appeal request.
 */
export async function resolveAppeal({
  appealId,
  reviewerId,
  reviewerRole,
  outcome,
  reviewNotes,
}) {
  const statusMap = {
    action_reversed: 'approved',
    action_upheld: 'rejected',
    action_modified: 'approved',
    escalated_to_senior: 'escalated',
  };

  const appeal = await base44.entities.AppealRequest.filter({ id: appealId }).then(r => r[0]);
  if (!appeal) throw new Error('Appeal not found.');

  await base44.entities.AppealRequest.update(appealId, {
    status: statusMap[outcome] || 'rejected',
    reviewer_id: reviewerId,
    review_notes: reviewNotes,
    outcome,
    reviewed_at: new Date().toISOString(),
  });

  // Audit log
  await adminAudit.addAdminNote(reviewerId, reviewerRole, 'appeal', appealId, `Appeal resolved: ${outcome}. ${reviewNotes}`);

  // Notify appellant
  const outcomeMessages = {
    action_reversed: 'Good news — your appeal was approved and the action has been reversed.',
    action_upheld: 'After review, the original decision has been upheld.',
    action_modified: 'Your appeal was partially approved. The action has been modified.',
    escalated_to_senior: 'Your appeal has been escalated to our senior review team.',
  };

  await notificationService.createNotification({
    recipient_id: appeal.appellant_id,
    type: 'moderation_action',
    title: 'Appeal Update',
    body: outcomeMessages[outcome] || 'Your appeal has been reviewed.',
    entity_type: 'appeal',
    entity_id: appealId,
  }).catch(() => {});

  return { appeal, outcome };
}

// ─── Escalation Router ────────────────────────────────────────────────────────

/**
 * Route a moderation report to the correct reviewer queue.
 * Returns the queue label and priority level.
 */
export function getEscalationQueue(report) {
  const { entity_type, reason, metadata } = report;
  const severity = metadata?.severity || 'low';

  if (['payout_blocked', 'financial_fraud'].includes(reason)) {
    return { queue: 'finance_review', priority: 'urgent' };
  }
  if (entity_type === 'ad_campaign' || reason?.includes('ad_fraud')) {
    return { queue: 'advertiser_management', priority: 'high' };
  }
  if (severity === 'high' || ['hate_speech', 'csam', 'threat'].includes(reason)) {
    return { queue: 'trust_safety_senior', priority: 'urgent' };
  }
  if (severity === 'medium') {
    return { queue: 'senior_moderator', priority: 'high' };
  }
  return { queue: 'moderator_standard', priority: 'normal' };
}

// ─── Coordinated Abuse Detection ─────────────────────────────────────────────

/**
 * Detect coordinated gift/follow abuse patterns.
 * Heuristic: multiple accounts performing same action on same target within short window.
 */
export async function detectCoordinatedAbuse(targetId, eventType, windowHours = 1) {
  const since = new Date(Date.now() - windowHours * 3600000).toISOString();

  let events = [];
  if (eventType === 'gift') {
    events = await base44.entities.Gift.filter(
      { recipient_id: targetId, status: 'delivered' },
      '-created_date',
      50
    ).then(gifts => gifts.filter(g => g.created_date >= since)).catch(() => []);
  } else if (eventType === 'follow') {
    events = await base44.entities.Follow.filter(
      { following_id: targetId, status: 'active' },
      '-created_date',
      100
    ).then(follows => follows.filter(f => f.created_date >= since)).catch(() => []);
  }

  const THRESHOLDS = { gift: 10, follow: 50 };
  const threshold = THRESHOLDS[eventType] || 20;

  if (events.length >= threshold) {
    // Create fraud signal
    await base44.entities.FraudSignal.create({
      user_id: targetId,
      signal_type: 'coordinated_gift_abuse',
      severity: events.length > threshold * 3 ? 'critical' : 'high',
      description: `${events.length} ${eventType} events in ${windowHours}h window. Potential coordinated abuse.`,
      data: { count: events.length, windowHours, threshold, eventType },
      status: 'open',
    }).catch(() => {});

    // Generate platform alert
    await _createPlatformAlert({
      alertType: 'coordinated_abuse_detected',
      severity: 'critical',
      title: `Coordinated ${eventType} abuse detected`,
      description: `${events.length} ${eventType} events targeting user ${targetId} in ${windowHours}h`,
      data: { targetId, eventType, count: events.length },
    });

    return { detected: true, count: events.length };
  }

  return { detected: false, count: events.length };
}

// ─── Platform Alert Generation ────────────────────────────────────────────────

export async function _createPlatformAlert({ alertType, severity, title, description, data = {} }) {
  return base44.entities.PlatformAlert.create({
    alert_type: alertType,
    severity,
    title,
    description,
    data,
    status: 'open',
    auto_generated: true,
  }).catch(() => {});
}

/**
 * Check moderation queue backlog — alert if too many pending reports.
 */
export async function checkModerationBacklog() {
  const pending = await base44.entities.ModerationReport.filter(
    { status: 'pending' }, '-created_date', 200
  ).catch(() => []);

  const BACKLOG_THRESHOLD = 50;
  if (pending.length > BACKLOG_THRESHOLD) {
    await _createPlatformAlert({
      alertType: 'moderation_queue_backlog',
      severity: pending.length > 100 ? 'critical' : 'warning',
      title: `Moderation queue backlog: ${pending.length} pending reports`,
      description: `Queue exceeds ${BACKLOG_THRESHOLD} reports. Moderator capacity may be insufficient.`,
      data: { pending_count: pending.length, threshold: BACKLOG_THRESHOLD },
    });
  }

  return { pendingCount: pending.length, backlogged: pending.length > BACKLOG_THRESHOLD };
}

export default {
  computeTrustScore,
  refreshTrustScore,
  submitAppeal,
  resolveAppeal,
  getEscalationQueue,
  detectCoordinatedAbuse,
  checkModerationBacklog,
};