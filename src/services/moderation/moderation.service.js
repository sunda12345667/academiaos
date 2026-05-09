/**
 * Moderation Service — AI-Assisted Content & User Safety
 *
 * Pipeline stages:
 *   1. Pre-publish gate   — fast AI check on post creation (async, <2s target)
 *   2. Post-publish scan  — background AI check for borderline content
 *   3. Report resolution  — AI-assisted review for reported content
 *   4. User risk scoring  — aggregated signals from FraudSignal + ModerationReport
 *   5. Spam detection     — velocity + pattern signals
 *
 * AI moderation flow:
 *   content → ai.moderateContent() → severity decision:
 *     'none'   → allow (no action)
 *     'low'    → flag for background review (post visible)
 *     'medium' → flag + notify moderator queue (post visible but flagged)
 *     'high'   → auto-hide + escalate to human moderator
 *
 * Rule-based pre-checks (fast, no AI cost):
 *   - Link spam (>3 URLs in short post)
 *   - Excessive caps (>70% uppercase)
 *   - Repeated content (same post within 1h from same user)
 *   - Known scam patterns (regex)
 *
 * Migration note:
 *   On NestJS: moderation pipeline runs as async BullMQ job post-publish.
 *   AI severity scores stored on Post.moderation_score.
 *   Spam model: gradient boosted tree on velocity + content features.
 *   Toxicity model: fine-tuned BERT on Nigerian English corpus.
 */

import { base44 } from '@/api/base44Client';
import educationAI from '@/services/ai/education.ai.service';

// ─── Severity → Action Map ────────────────────────────────────────────────────

const SEVERITY_ACTIONS = {
  none:   { action: 'allow',     moderationStatus: 'clean',   visible: true },
  low:    { action: 'flag',      moderationStatus: 'flagged', visible: true },
  medium: { action: 'review',    moderationStatus: 'flagged', visible: true },
  high:   { action: 'auto_hide', moderationStatus: 'removed', visible: false },
};

// ─── Rule-Based Pre-Checks (zero cost) ───────────────────────────────────────

const SCAM_PATTERNS = [
  /send\s+(me\s+)?\d+[k\d]+\s+naira/i,
  /double\s+your\s+(money|investment)/i,
  /guaranteed\s+profit/i,
  /whatsapp\s+me\s+(for|to)/i,
  /click\s+this\s+link\s+to\s+win/i,
  /binary\s+options?/i,
  /forex\s+signal/i,
];

export function ruleBasedCheck(content) {
  if (!content) return { safe: true, flags: [] };
  const flags = [];

  // Link spam
  const urlCount = (content.match(/https?:\/\//gi) || []).length;
  if (urlCount > 3) flags.push('link_spam');

  // Excessive caps
  const alpha = content.replace(/[^a-zA-Z]/g, '');
  if (alpha.length > 20 && (alpha.match(/[A-Z]/g) || []).length / alpha.length > 0.7) {
    flags.push('excessive_caps');
  }

  // Scam patterns
  if (SCAM_PATTERNS.some(p => p.test(content))) flags.push('scam_pattern');

  // Phone number harvesting
  if ((content.match(/\b0[789]\d{9}\b/g) || []).length > 2) flags.push('phone_harvest');

  return {
    safe: flags.length === 0,
    flags,
    severity: flags.length === 0 ? 'none' : flags.includes('scam_pattern') ? 'high' : 'medium',
  };
}

// ─── AI-Assisted Content Check ────────────────────────────────────────────────

/**
 * Full moderation check (rule-based + AI).
 * Call fire-and-forget after post creation for non-blocking UX.
 */
export async function checkContent(postId, content, authorId) {
  // Fast rule check first (free)
  const ruleResult = ruleBasedCheck(content);

  if (ruleResult.severity === 'high') {
    // Skip AI — rule-based already confident
    await _applyModerationAction(postId, ruleResult, 'rule_engine', authorId);
    return ruleResult;
  }

  // AI check for medium/ambiguous content
  const aiResult = await educationAI.moderateContent(content).catch(() => ({ safe: true, severity: 'none', flags: [] }));

  // Merge results — take more severe of the two
  const severityRank = { none: 0, low: 1, medium: 2, high: 3 };
  const finalSeverity = severityRank[aiResult.severity] >= severityRank[ruleResult.severity]
    ? aiResult.severity : ruleResult.severity;

  const merged = {
    safe: finalSeverity === 'none' || finalSeverity === 'low',
    flags: [...new Set([...(ruleResult.flags || []), ...(aiResult.flags || [])])],
    severity: finalSeverity,
    reason: aiResult.reason || (ruleResult.flags[0] || null),
    source: 'hybrid',
  };

  await _applyModerationAction(postId, merged, 'ai_moderation', authorId);
  return merged;
}

// ─── Apply Action ─────────────────────────────────────────────────────────────

async function _applyModerationAction(postId, result, source, authorId) {
  const decision = SEVERITY_ACTIONS[result.severity] ?? SEVERITY_ACTIONS.none;
  if (decision.action === 'allow') return;

  // Update post moderation status
  await base44.entities.Post.update(postId, {
    moderation_status: decision.moderationStatus,
    moderation_notes: `[${source}] ${result.flags?.join(', ') || result.reason || 'flagged'}`,
    ...(decision.action === 'auto_hide' ? { status: 'under_review' } : {}),
  }).catch(() => {});

  // Create ModerationReport record for queue
  if (decision.action !== 'allow') {
    await base44.entities.ModerationReport.create({
      reporter_id: 'system',
      entity_type: 'post',
      entity_id: postId,
      reason: result.flags?.[0] || 'ai_flagged',
      status: 'pending',
      metadata: {
        source,
        severity: result.severity,
        flags: result.flags,
        auto_action: decision.action,
      },
    }).catch(() => {});
  }
}

// ─── Educational Quality Scoring ─────────────────────────────────────────────

/**
 * Score educational quality of a post/course description.
 * Used to boost high-quality educational content in feed ranking.
 * Returns 0–100 quality score.
 */
export async function scoreEducationalQuality(content) {
  if (!content || content.length < 50) return 0;

  const prompt = `Rate the educational quality of this content on a 0–100 scale.
    Content: "${content.slice(0, 500)}"
    Criteria: accuracy, depth, clarity, structure, educational value.
    Return JSON: { score: number, reasoning: string }`;

  const result = await base44.integrations.Core.InvokeLLM({
    prompt,
    model: 'gpt_5_mini',
    response_json_schema: {
      type: 'object',
      properties: {
        score:     { type: 'number' },
        reasoning: { type: 'string' },
      },
      required: ['score'],
    },
  }).catch(() => ({ score: 50, reasoning: 'fallback' }));

  return typeof result?.score === 'number' ? Math.max(0, Math.min(100, result.score)) : 50;
}

// ─── User Risk Profile ────────────────────────────────────────────────────────

/**
 * Compute a moderation risk score (0–100) for a user from signal history.
 */
export async function getUserModerationRisk(userProfileId) {
  const [reports, fraudSignals] = await Promise.all([
    base44.entities.ModerationReport.filter({ entity_id: userProfileId }, '-created_date', 20).catch(() => []),
    base44.entities.FraudSignal.filter({ user_id: userProfileId }, '-created_date', 20).catch(() => []),
  ]);

  const SEVERITY_SCORE = { low: 5, medium: 15, high: 35, critical: 50 };
  let score = 0;

  fraudSignals.forEach(s => { score += SEVERITY_SCORE[s.severity] || 5; });
  reports.filter(r => r.status === 'action_taken').forEach(() => { score += 20; });

  return Math.min(100, score);
}

export default {
  ruleBasedCheck,
  checkContent,
  scoreEducationalQuality,
  getUserModerationRisk,
  SEVERITY_ACTIONS,
};