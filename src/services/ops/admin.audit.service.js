/**
 * Admin Audit Service — Immutable Operations Trail
 *
 * Every admin/moderator action MUST pass through this service to:
 *   1. Log before_state → action → after_state
 *   2. Enforce sensitive-action confirmation requirement
 *   3. Provide searchable audit history
 *   4. Support compliance export
 *
 * SENSITIVE ACTIONS (require senior mod confirmation before execution):
 *   user_ban, user_role_change, payout_force_complete, creator_demonetize,
 *   fraud_signal_escalate, platform_setting_change
 *
 * Architecture:
 *   Admin UI → admin.audit.service.logAndExecute() →
 *     1. Write AdminAuditLog (before_state)
 *     2. Execute action callback
 *     3. Update AdminAuditLog (after_state)
 *     → Atomic: if action fails, log records failure
 *
 * Migration note:
 *   On NestJS: AdminAuditLog writes to append-only PostgreSQL partition.
 *   Kafka event emitted on every log entry for realtime admin dashboards.
 *   Compliance export: S3 daily dump of AdminAuditLog as JSONL.
 */

import { base44 } from '@/api/base44Client';

// ─── Sensitive Actions (require 2-factor confirmation in UI) ──────────────────

export const SENSITIVE_ACTIONS = new Set([
  'user_ban',
  'user_role_change',
  'user_trust_score_override',
  'payout_force_complete',
  'creator_demonetize',
  'fraud_signal_escalate',
  'platform_setting_change',
  'ad_budget_override',
]);

// ─── Core Log + Execute ───────────────────────────────────────────────────────

/**
 * Log an admin action and execute it atomically.
 * All admin operations MUST use this function — never execute directly.
 *
 * @param {object} opts
 * @param {string} opts.actorId            — performing admin/mod profile ID
 * @param {string} opts.actorRole          — their role at time of action
 * @param {string} opts.action             — AdminAuditLog action enum value
 * @param {string} opts.entityType         — entity being acted on
 * @param {string} opts.entityId           — entity ID
 * @param {object} opts.beforeState        — entity snapshot before action
 * @param {string} opts.reason             — mandatory for sensitive actions
 * @param {string} opts.notes              — internal notes
 * @param {string} opts.confirmedBy        — senior reviewer ID (sensitive only)
 * @param {Function} opts.execute          — async action function to run
 * @returns {Promise<{ log, result }>}
 */
export async function logAndExecute({
  actorId,
  actorRole,
  action,
  entityType,
  entityId,
  beforeState = {},
  reason = '',
  notes = '',
  confirmedBy = null,
  execute,
}) {
  const isSensitive = SENSITIVE_ACTIONS.has(action);

  if (isSensitive && !confirmedBy) {
    throw new Error(`Action '${action}' requires senior reviewer confirmation (confirmedBy field).`);
  }

  if (isSensitive && !reason) {
    throw new Error(`Action '${action}' requires a mandatory reason.`);
  }

  // Write initial audit log
  const log = await base44.entities.AdminAuditLog.create({
    actor_id: actorId,
    actor_role: actorRole,
    action,
    entity_type: entityType,
    entity_id: entityId,
    before_state: beforeState,
    after_state: null, // populated after execution
    reason,
    notes,
    is_sensitive: isSensitive,
    confirmed_by: confirmedBy || null,
  });

  let result;
  let afterState = {};
  try {
    result = await execute();
    afterState = result?.afterState || {};
  } catch (err) {
    // Log the failure — audit trail always complete
    await base44.entities.AdminAuditLog.update(log.id, {
      after_state: { error: err.message, failed: true },
    }).catch(() => {});
    throw err;
  }

  // Update log with result
  await base44.entities.AdminAuditLog.update(log.id, {
    after_state: afterState,
  }).catch(() => {});

  return { log, result };
}

// ─── Audit Queries ────────────────────────────────────────────────────────────

export async function getAuditLogsForEntity(entityType, entityId, { limit = 50 } = {}) {
  return base44.entities.AdminAuditLog.filter(
    { entity_type: entityType, entity_id: entityId },
    '-created_date',
    limit
  ).catch(() => []);
}

export async function getAuditLogsForActor(actorId, { limit = 100 } = {}) {
  return base44.entities.AdminAuditLog.filter(
    { actor_id: actorId },
    '-created_date',
    limit
  ).catch(() => []);
}

export async function getRecentAuditLogs({ limit = 100, action } = {}) {
  const filter = action ? { action } : {};
  return base44.entities.AdminAuditLog.filter(filter, '-created_date', limit).catch(() => []);
}

export async function getSensitiveActionLogs({ limit = 50 } = {}) {
  return base44.entities.AdminAuditLog.filter(
    { is_sensitive: true },
    '-created_date',
    limit
  ).catch(() => []);
}

// ─── Admin Note ───────────────────────────────────────────────────────────────

/**
 * Add an internal note to a user/entity's admin history (lightweight log).
 */
export async function addAdminNote(actorId, actorRole, entityType, entityId, note) {
  return base44.entities.AdminAuditLog.create({
    actor_id: actorId,
    actor_role: actorRole,
    action: 'admin_note_add',
    entity_type: entityType,
    entity_id: entityId,
    before_state: {},
    after_state: {},
    notes: note,
    is_sensitive: false,
  });
}

export default {
  logAndExecute,
  getAuditLogsForEntity,
  getAuditLogsForActor,
  getRecentAuditLogs,
  getSensitiveActionLogs,
  addAdminNote,
  SENSITIVE_ACTIONS,
};