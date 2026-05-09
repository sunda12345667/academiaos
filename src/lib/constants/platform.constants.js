/**
 * Platform Constants — Single Source of Truth
 *
 * All business-rule numbers, thresholds, and limits live here.
 * Never hardcode these values in services or UI components.
 *
 * Import pattern:
 *   import { CREATOR, WALLET, TRUST, ONBOARDING } from '@/lib/constants/platform.constants';
 */

// ─── Creator Economy ──────────────────────────────────────────────────────────

export const CREATOR = {
  // Tier thresholds
  TIER_BASIC_FOLLOWERS:    50,
  TIER_BASIC_TRUST:        20,
  TIER_PRO_FOLLOWERS:      500,
  TIER_PRO_TRUST:          50,
  TIER_VERIFIED_FOLLOWERS: 2000,
  TIER_VERIFIED_TRUST:     70,
  TIER_ELITE_FOLLOWERS:    10000,
  TIER_ELITE_TRUST:        85,

  // Monetization gates
  TIPS_MIN_TRUST:          40,
  MONETIZATION_MIN_TRUST:  60,
  MONETIZATION_MIN_FOLLOWERS: 500,

  // Analytics
  ANALYTICS_DEBOUNCE_MS:   300_000,  // 5 minutes — DEBT-013 fix
  DASHBOARD_POST_LIMIT:    20,

  // Badge thresholds
  BADGE_POPULAR_FOLLOWERS: 1000,
  BADGE_HIGH_ENGAGEMENT:   5,        // engagement rate %
  BADGE_STREAK_CONSISTENT: 7,        // days
  BADGE_STREAK_MASTER:     30,       // days
  BADGE_TRUSTED_SCORE:     80,

  // Referral XP rewards
  XP_REFERRAL_ATTRIBUTED:  200,
  XP_REFERRAL_ACTIVATED:   300,
};

// ─── Trust Scoring ────────────────────────────────────────────────────────────

export const TRUST = {
  BASELINE:                30,
  MAX_AGE_BONUS:           10,      // +10 max for account age
  AGE_DAYS_PER_POINT:      30,      // 1 point per 30 days
  EDUCATOR_VERIFIED_BONUS: 20,
  ID_VERIFIED_BONUS:       15,
  EMAIL_VERIFIED_BONUS:    8,
  MAX_ENGAGEMENT_BONUS:    25,
  ENGAGEMENT_MULTIPLIER:   3,       // engagement_rate × 3
  MAX_STREAK_BONUS:        10,
  STREAK_MULTIPLIER:       2,       // streak_days × 2
  SUSPENSION_PENALTY:      30,
  MAX_SPAM_PENALTY:        10,
  SPAM_PENALTY_DIVISOR:    0.1,     // spam_score × 0.1
};

// ─── Wallet / Fintech ─────────────────────────────────────────────────────────

export const WALLET = {
  // Kobo amounts (₦1 = 100 kobo)
  MIN_WITHDRAWAL:          100_000,   // ₦1,000
  MAX_WITHDRAWAL_DAILY:    5_000_000, // ₦50,000 (KYC enhanced)
  MIN_DEPOSIT:             10_000,    // ₦100
  GIFT_MIN:                500,       // ₦5
  GIFT_MAX_SINGLE:         1_000_000, // ₦10,000
  KYC_BASIC_DAILY:         500_000,   // ₦5,000
  KYC_ENHANCED_DAILY:      5_000_000, // ₦50,000
  REVIEW_THRESHOLD:        300_000,   // ₦3,000 — triggers manual review
  HIGH_VALUE_GIFT:         200_000,   // ₦2,000 — triggers fraud signal

  // Platform fees
  PLATFORM_FEE_PERCENT:    0.10,      // 10% on content sales
  GIFT_CREATOR_SHARE:      0.70,      // 70% to creator
  GIFT_PLATFORM_SHARE:     0.30,      // 30% to platform
  MARKETPLACE_ESCROW:      0.05,      // 5% marketplace fee
  WITHDRAWAL_FLAT_FEE:     10_000,    // ₦100 flat fee
  SUBSCRIPTION_PLATFORM:   0.20,      // 20% on subscriptions

  // Idempotency
  INTENT_EXPIRY_MINUTES:   30,
};

// ─── Engagement ───────────────────────────────────────────────────────────────

export const ENGAGEMENT = {
  SCORE_WEIGHTS: {
    view:       1,
    like:       3,
    love:       4,
    insightful: 5,
    comment:    6,
    share:      8,
    save:       4,
    poll_vote:  2,
  },
  HALF_LIFE_HOURS: 6,
  DEDUP_TYPES: ['like', 'love', 'insightful', 'save', 'poll_vote'],
};

// ─── Notification Intelligence ────────────────────────────────────────────────

export const NOTIFICATION = {
  QUIET_HOURS_START:       23,    // 23:00 WAT
  QUIET_HOURS_END:         7,     // 07:00 WAT
  DEDUP_WINDOW_SECONDS:    60,
  DAILY_CAPS: {
    0: Infinity,   // CRITICAL
    1: 10,         // HIGH
    2: 5,          // MEDIUM
    3: 2,          // LOW
    4: 1,          // SYSTEM
  },
  FLOOD_WINDOW_HOURS:      4,
  FLOOD_MAX_IN_WINDOW:     2,
  STREAK_RESCUE_HOUR:      18,    // 18h since last post → send rescue
};

// ─── Feed & Ranking ───────────────────────────────────────────────────────────

export const FEED = {
  HOME_FOLLOWING_WEIGHT:   0.50,
  HOME_DISCOVER_WEIGHT:    0.30,
  HOME_TRENDING_WEIGHT:    0.20,
  DEFAULT_PAGE_SIZE:       20,
  MAX_FOLLOWING_FAN_OUT:   8,     // max authors to fetch from in one home feed load
  TRENDING_POOL_MULTIPLIER: 2,    // fetch 2× limit then re-rank
  DIVERSITY_SAME_AUTHOR_PENALTY: 0.5,
  VIDEO_COMPLETION_THRESHOLD: 0.85,  // % watched to count as "fully watched"
};

// ─── Onboarding ───────────────────────────────────────────────────────────────

export const ONBOARDING = {
  ACTIVATION_WINDOW_DAYS:  7,     // must activate within 7 days of signup
  REFERRAL_ATTRIBUTION_DAYS: 30,  // last-touch attribution window
  SUGGESTION_POOL_SIZE:    30,    // # candidates to score for follow suggestions
  GROUP_SUGGESTION_LIMIT:  5,
  FOLLOW_SUGGESTION_LIMIT: 8,
};

// ─── Moderation ───────────────────────────────────────────────────────────────

export const MODERATION = {
  POST_RATE_LIMIT_PER_HOUR: 10,
  MESSAGE_RATE_LIMIT_PER_MIN: 5,
  TRUST_THRESHOLD_FAST_PASS: 70,  // high-trust users skip AI moderation
  SPAM_SCORE_AUTO_REMOVE:    80,
  REPORT_SPAM_THRESHOLD:     5,   // 5 reports → auto-escalate
};

// ─── Growth / Retention ───────────────────────────────────────────────────────

export const RETENTION = {
  STREAK_RESCUE_HOURS:     18,    // hours since last post to trigger rescue
  STREAK_RESCUE_WINDOW:    30,    // window (hours) in which streak can still be saved
  RETURN_TRIGGERS_DAYS:    [1, 3, 7, 14],
  ACHIEVEMENT_XP: {
    first_post:    100,
    first_follower: 50,
    streak_7:      200,
    streak_30:     750,
    streak_100:    2000,
    first_live:    200,
    first_tip:     300,
    monetized:     500,
  },
};

export default {
  CREATOR,
  TRUST,
  WALLET,
  ENGAGEMENT,
  NOTIFICATION,
  FEED,
  ONBOARDING,
  MODERATION,
  RETENTION,
};