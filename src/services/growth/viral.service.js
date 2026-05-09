/**
 * Viral Loop & Referral Architecture
 *
 * Drives organic platform growth through:
 *   1. Referral system (code-based with attribution tracking)
 *   2. Content sharing loops (share → land → follow → stay)
 *   3. Creator invitation system (invite collab creators)
 *   4. Campus expansion (school-specific viral loops)
 *   5. Group invite mechanics (join → invite classmates)
 *   6. Livestream sharing (share → watch → follow → create)
 *
 * Referral Mechanics:
 *   - Every user gets a unique referral code on registration
 *   - Referral code embedded in share links: /join?ref=CODE
 *   - Referrer reward: XP + badge + gift coins on referee activation
 *   - Referee reward: XP bonus + suggested follow = referrer
 *   - Attribution window: 30 days (last-touch)
 *
 * K-Factor Optimization:
 *   k = invites_sent × conversion_rate
 *   Target: k > 1.0 for exponential growth
 *   Levers: invite prompt timing, reward size, friction reduction
 *
 * Share Destinations:
 *   WhatsApp (primary — Nigeria dominant), Twitter/X, Copy Link, Instagram Story
 *
 * Campus Loop (highest k-factor):
 *   Student joins → completes school_match step →
 *   Platform shows "X students from [School] already here" →
 *   Student invites classmates via WhatsApp group link →
 *   Classmates join with school pre-filled → school group bootstrapped
 *
 * Migration note:
 *   Referral tracking → dedicated referral_events table (ClickHouse)
 *   Share links → dynamic OG tags per content (Next.js ISR pages)
 *   K-factor computation → daily Flink aggregation
 *   Attribution → server-side cookie + utm_params on first landing
 */

import { base44 } from '@/api/base44Client';
import { eventQueue } from '@/lib/infra/event-queue';
import notificationService from '@/services/notifications/notification.service';

// ─── Referral Code Management ─────────────────────────────────────────────────

/**
 * Generate or retrieve a user's referral code.
 * Code format: [username_prefix][4-char-hash] e.g. "ada1x3f"
 */
export async function getReferralCode(userProfileId) {
  const profiles = await base44.entities.UserProfile.filter({ id: userProfileId });
  const profile = profiles[0];
  if (!profile) return null;

  if (profile.referral_code) return profile.referral_code;

  // Generate deterministic code from profile ID
  const code = _generateReferralCode(profile.username || userProfileId);
  await base44.entities.UserProfile.update(userProfileId, { referral_code: code });
  return code;
}

function _generateReferralCode(seed) {
  const prefix = seed.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().slice(0, 4);
  const hash = Math.abs(_djb2Hash(seed)).toString(36).slice(0, 4);
  return `${prefix}${hash}`;
}

function _djb2Hash(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return hash;
}

/**
 * Look up a referral code to find the referrer profile.
 */
export async function resolveReferralCode(code) {
  const profiles = await base44.entities.UserProfile.filter({ referral_code: code }).catch(() => []);
  return profiles[0] || null;
}

/**
 * Attribute a referral on new user registration.
 * Awards XP to both referrer and referee.
 */
export async function attributeReferral(newUserProfileId, referralCode) {
  if (!referralCode) return null;

  const referrer = await resolveReferralCode(referralCode);
  if (!referrer) return null;
  if (referrer.id === newUserProfileId) return null; // Self-referral guard

  // Store attribution on new user
  await base44.entities.UserProfile.update(newUserProfileId, {
    referred_by: referrer.id,
    referral_code_used: referralCode,
  });

  // Track event
  eventQueue.track('viral', 'referral_attributed', {
    referrerId: referrer.id,
    refereeId: newUserProfileId,
    code: referralCode,
  });

  // Reward referrer (XP + notification — actual XP stored on profile.total_xp)
  const referrerXp = (referrer.total_xp || 0) + 200;
  await base44.entities.UserProfile.update(referrer.id, {
    total_xp: referrerXp,
    referral_count: (referrer.referral_count || 0) + 1,
  });

  await notificationService.createNotification({
    recipient_id: referrer.id,
    type: 'system_alert',
    title: '🎉 Someone joined via your referral!',
    body: 'You earned 200 XP. Keep sharing — more rewards await.',
    metadata: { refereeId: newUserProfileId },
  }).catch(() => {});

  return { referrerId: referrer.id, xpAwarded: 200 };
}

/**
 * Activate a referral (referee completes first significant action).
 * Triggers final reward to referrer (gift coins in future).
 */
export async function activateReferral(refereeProfileId) {
  const profiles = await base44.entities.UserProfile.filter({ id: refereeProfileId });
  const profile = profiles[0];
  if (!profile?.referred_by || profile.referral_activated) return null;

  await base44.entities.UserProfile.update(refereeProfileId, { referral_activated: true });

  eventQueue.track('viral', 'referral_activated', {
    referrerId: profile.referred_by,
    refereeId: refereeProfileId,
  });

  // Notify referrer of activation
  await notificationService.createNotification({
    recipient_id: profile.referred_by,
    type: 'system_alert',
    title: '🔥 Your referral is active!',
    body: 'The person you invited just became active on StudentOS. Your network grows!',
  }).catch(() => {});

  return { activated: true, referrerId: profile.referred_by };
}

// ─── Share Link Generation ────────────────────────────────────────────────────

/**
 * Build a trackable share URL for a piece of content.
 * Includes UTM params for attribution tracking.
 */
export function buildShareUrl(contentType, contentId, sharerProfileId, destination = 'copy') {
  const base = typeof window !== 'undefined' ? window.location.origin : 'https://studentos.app';
  const params = new URLSearchParams({
    ref_type: 'content_share',
    ref_id: sharerProfileId,
    utm_source: destination,
    utm_medium: 'social_share',
    utm_campaign: contentType,
  });

  const paths = {
    post: `/post/${contentId}`,
    live: `/live/${contentId}`,
    group: `/groups?join=${contentId}`,
    creator: `/profile/${contentId}`,
    course: `/learn?course=${contentId}`,
  };

  return `${base}${paths[contentType] || '/'}?${params.toString()}`;
}

/**
 * Build a campus invite share URL (school-specific viral loop).
 */
export function buildCampusInviteUrl(inviterProfileId, schoolId) {
  const base = typeof window !== 'undefined' ? window.location.origin : 'https://studentos.app';
  const params = new URLSearchParams({
    ref: '', // filled by getReferralCode call
    school: schoolId,
    utm_source: 'campus_invite',
    utm_medium: 'whatsapp',
    utm_campaign: 'school_expansion',
  });
  return `${base}/join?${params.toString()}`;
}

/**
 * Track when a share event occurs (fire-and-forget).
 */
export function trackShare(contentType, contentId, sharerProfileId, destination) {
  eventQueue.track('viral', 'content_shared', {
    contentType,
    contentId,
    sharerProfileId,
    destination,
  });
}

// ─── Creator Invitation System ────────────────────────────────────────────────

/**
 * Track a creator invitation sent to an external user.
 * Returns invite metadata for follow-up attribution.
 */
export async function trackCreatorInvite(inviterProfileId, inviteeEmail, message) {
  eventQueue.track('viral', 'creator_invited', {
    inviterProfileId,
    inviteeEmailHash: _hashEmail(inviteeEmail), // privacy-safe hash
    hasMessage: !!message,
  });

  return { tracked: true, expectedXpOnJoin: 300 };
}

function _hashEmail(email) {
  // Simple hash for analytics without storing PII
  let h = 0;
  for (let i = 0; i < email.length; i++) { h = (h << 5) - h + email.charCodeAt(i); }
  return Math.abs(h).toString(36);
}

// ─── Campus Expansion Metrics ─────────────────────────────────────────────────

/**
 * Get school adoption metrics for campus viral loop display.
 * Shows "237 students from your school are already here" on onboarding.
 */
export async function getSchoolAdoptionStats(schoolId) {
  if (!schoolId) return { count: 0, school: null };

  const [school, profiles] = await Promise.all([
    base44.entities.School.filter({ id: schoolId }).then(r => r[0]).catch(() => null),
    base44.entities.UserProfile.filter({ school_id: schoolId }, '-created_date', 200).catch(() => []),
  ]);

  return {
    count: profiles.length,
    school,
    recentJoiners: profiles.slice(0, 5).map(p => ({ id: p.id, username: p.username, avatarUrl: p.avatar_url })),
  };
}

// ─── Viral Analytics ─────────────────────────────────────────────────────────

/**
 * Get referral analytics for a user.
 */
export async function getReferralStats(userProfileId) {
  const profiles = await base44.entities.UserProfile.filter({ id: userProfileId });
  const profile = profiles[0];
  if (!profile) return { referralCount: 0, activatedCount: 0, referralCode: null };

  const referees = await base44.entities.UserProfile.filter(
    { referred_by: userProfileId }, '-created_date', 50
  ).catch(() => []);

  const activated = referees.filter(r => r.referral_activated);

  return {
    referralCode: profile.referral_code || null,
    referralCount: referees.length,
    activatedCount: activated.length,
    conversionRate: referees.length > 0 ? parseFloat((activated.length / referees.length).toFixed(2)) : 0,
    xpFromReferrals: referees.length * 200,
    recentReferees: referees.slice(0, 5).map(r => ({ id: r.id, username: r.username, activated: r.referral_activated })),
  };
}

export default {
  getReferralCode,
  resolveReferralCode,
  attributeReferral,
  activateReferral,
  buildShareUrl,
  buildCampusInviteUrl,
  trackShare,
  trackCreatorInvite,
  getSchoolAdoptionStats,
  getReferralStats,
};