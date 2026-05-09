/**
 * Feature Flag System — Runtime-Safe Feature Gating
 *
 * Three flag sources (evaluated in priority order):
 *   1. URL override: ?flag_ai_feed=true (dev + QA use)
 *   2. User segment: A/B test bucketing by userId hash
 *   3. Environment config: VITE_FEATURE_* env vars (CI/CD controlled)
 *
 * Flag namespacing:
 *   FEED_*        — feed algorithm experiments
 *   AI_*          — AI feature rollouts
 *   CREATOR_*     — creator economy features
 *   PAYMENT_*     — payment/wallet features
 *   LIVE_*        — livestream features
 *   MODERATION_*  — moderation system features
 *   INFRA_*       — infrastructure experiments
 *
 * Usage:
 *   import flags from '@/lib/infra/feature-flags';
 *   if (flags.isEnabled('AI_SMART_FEED', userId)) { ... }
 *
 * Canary rollout:
 *   flags.rollout('NEW_COMPOSER', userId, 0.10) → true for 10% of users
 *
 * Migration note:
 *   On NestJS: replace env var layer with LaunchDarkly / Unleash SDK.
 *   Flag evaluations tracked in analytics for A/B result measurement.
 *   Flag changes deploy instantly without code deployments.
 */

// ─── Flag Registry ────────────────────────────────────────────────────────────
// Default state: false (off by default, enabled progressively)

const FLAG_REGISTRY = {
  // Feed experiments
  AI_SMART_FEED:          { default: false, description: 'AI-personalized feed re-ranking' },
  FEED_INFINITE_SCROLL:   { default: true,  description: 'Virtualized infinite scroll' },
  FEED_PRELOAD_NEXT:      { default: false, description: 'Preload next page on near-bottom' },

  // AI features
  AI_STUDY_ASSISTANT:     { default: true,  description: 'In-feed study assistant widget' },
  AI_CONTENT_MODERATION:  { default: true,  description: 'AI pre-publish content check' },
  AI_RECOMMENDATION_V2:   { default: false, description: 'Multi-strategy recommendation engine v2' },
  AI_SEARCH_SEMANTIC:     { default: false, description: 'Semantic search with embedding fallback' },

  // Creator features
  CREATOR_TIPPING:        { default: true,  description: 'In-app tipping for creators' },
  CREATOR_LIVE_MONETIZE:  { default: false, description: 'Paid live session tickets' },
  CREATOR_ANALYTICS_V2:   { default: false, description: 'Enhanced creator analytics dashboard' },

  // Payment features
  PAYMENT_FLUTTERWAVE:    { default: false, description: 'Flutterwave as secondary payment gateway' },
  PAYMENT_BANK_VERIFY:    { default: true,  description: 'Real-time bank account verification' },
  PAYOUT_INSTANT:         { default: false, description: 'Instant payout (vs T+1) for trusted creators' },

  // Live features
  LIVE_CO_HOST:           { default: true,  description: 'Co-hosting in live sessions' },
  LIVE_GIFTS:             { default: true,  description: 'Gift animations in live sessions' },
  LIVE_RECORDING:         { default: false, description: 'Auto-recording live sessions' },

  // Moderation
  MOD_AI_ASSIST:          { default: true,  description: 'AI-assisted moderation queue prioritization' },
  MOD_BULK_ACTIONS:       { default: false, description: 'Bulk moderation actions in admin' },

  // Infrastructure
  INFRA_PERF_MONITOR:     { default: false, description: 'Client-side performance monitoring' },
  INFRA_LOG_REMOTE:       { default: false, description: 'Remote log drain enabled' },
  INFRA_REALTIME_DEBUG:   { default: false, description: 'RealtimeBus debug overlay' },
};

// ─── URL Override Parser ──────────────────────────────────────────────────────
// Allows QA/dev to enable specific flags via URL: ?flag_AI_SMART_FEED=true

function _parseUrlOverrides() {
  if (typeof window === 'undefined') return {};
  const params = new URLSearchParams(window.location.search);
  const overrides = {};
  for (const [key, value] of params.entries()) {
    if (key.startsWith('flag_')) {
      const flagName = key.replace('flag_', '').toUpperCase();
      overrides[flagName] = value === 'true' || value === '1';
    }
  }
  return overrides;
}

// ─── Environment Config ───────────────────────────────────────────────────────
// VITE_FEATURE_AI_SMART_FEED=true in .env files

function _parseEnvFlags() {
  const env = {};
  Object.keys(FLAG_REGISTRY).forEach(flagName => {
    const envKey = `VITE_FEATURE_${flagName}`;
    const val = import.meta.env[envKey];
    if (val !== undefined) env[flagName] = val === 'true' || val === '1';
  });
  return env;
}

// ─── Deterministic User Bucketing ─────────────────────────────────────────────
// Hash userId to 0–1 float for consistent A/B assignment across sessions.

function _hashUserId(userId) {
  if (!userId) return Math.random(); // unauthenticated — random bucket
  let hash = 5381;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) + hash) + userId.charCodeAt(i);
    hash = hash & hash; // 32-bit int
  }
  return Math.abs(hash) / 2147483647; // normalize to 0–1
}

// ─── Flag Evaluator ───────────────────────────────────────────────────────────

const _urlOverrides = _parseUrlOverrides();
const _envFlags = _parseEnvFlags();

const flags = {
  /**
   * Check if a flag is enabled.
   * @param {string} flagName    — from FLAG_REGISTRY
   * @param {string} userId      — for A/B bucketing (optional)
   * @returns {boolean}
   */
  isEnabled(flagName, userId = null) {
    const upper = flagName.toUpperCase();

    // Priority 1: URL override (dev/QA)
    if (upper in _urlOverrides) return _urlOverrides[upper];

    // Priority 2: Environment config (CI/CD)
    if (upper in _envFlags) return _envFlags[upper];

    // Priority 3: Registry default
    return FLAG_REGISTRY[upper]?.default ?? false;
  },

  /**
   * Canary/gradual rollout: enable for X% of users.
   * Bucketing is deterministic — same user always gets same result.
   *
   * @param {string} flagName
   * @param {string} userId
   * @param {number} rolloutPercent — 0.0 to 1.0 (e.g. 0.10 = 10%)
   */
  rollout(flagName, userId, rolloutPercent = 0) {
    // URL override takes priority even in rollouts
    const upper = flagName.toUpperCase();
    if (upper in _urlOverrides) return _urlOverrides[upper];

    return _hashUserId(userId) < rolloutPercent;
  },

  /**
   * Get all flag states for the current user (useful for analytics/debugging)
   */
  getAll(userId = null) {
    return Object.fromEntries(
      Object.keys(FLAG_REGISTRY).map(name => [name, flags.isEnabled(name, userId)])
    );
  },

  /**
   * Get flag metadata (description, default state)
   */
  getMeta(flagName) {
    return FLAG_REGISTRY[flagName.toUpperCase()] || null;
  },

  /**
   * List flags by namespace prefix
   */
  getByNamespace(prefix) {
    return Object.entries(FLAG_REGISTRY)
      .filter(([name]) => name.startsWith(prefix.toUpperCase()))
      .map(([name, meta]) => ({ name, ...meta, enabled: flags.isEnabled(name) }));
  },
};

export default flags;