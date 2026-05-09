/**
 * useIdentity — Academic & platform identity layer
 *
 * Surfaces the richly-structured identity data for the current user:
 * - Academic affiliation (school, department, level)
 * - Verification tiers (email, ID, educator)
 * - Creator status and tier
 * - Trust tier (for badges, gating, moderation signals)
 * - Account health
 *
 * Future: Integrates with trust_score computed field and KYC provider.
 *
 * Usage:
 *   const { isVerifiedEducator, schoolId, trustTier, creatorTier } = useIdentity();
 */
import { useMemo } from 'react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { getTrustTier, checkAccountAccess, isMonetizationEligible, ROLES } from '@/services/auth/permissions';

export function useIdentity() {
  const { profile, user } = useCurrentUser();

  const identity = useMemo(() => {
    if (!profile) {
      return {
        isReady: false,
        isVerified: false,
        isEmailVerified: false,
        isIdVerified: false,
        isVerifiedEducator: false,
        isCreator: false,
        creatorTier: 'none',
        isAdvertiser: false,
        isModerator: false,
        isSchoolAdmin: false,
        isAdmin: false,
        schoolId: null,
        accountStatus: null,
        isActive: false,
        isSuspended: false,
        isBanned: false,
        trustTier: 'unknown',
        accountAccess: { allowed: false, reason: 'unauthenticated' },
        isMonetizationEligible: false,
        // Future fields (server-computed)
        trustScore: null,     // 0–100 numeric score
        kycLevel: 'none',     // 'none' | 'basic' | 'enhanced'
      };
    }

    const verificationStatus = profile.verification_status || 'unverified';
    const accountStatus = profile.account_status || 'active';

    return {
      isReady: true,

      // ── Verification ──────────────────────────────────────────────────────
      isEmailVerified:    verificationStatus !== 'unverified',
      isIdVerified:       verificationStatus === 'id_verified' || verificationStatus === 'educator_verified',
      isVerifiedEducator: verificationStatus === 'educator_verified',
      isVerified:         verificationStatus !== 'unverified',
      verificationStatus,

      // ── Role flags ────────────────────────────────────────────────────────
      isCreator:     profile.is_creator === true || profile.role === ROLES.CREATOR,
      isAdvertiser:  profile.role === ROLES.ADVERTISER,
      isModerator:   profile.role === ROLES.MODERATOR || profile.role === ROLES.ADMIN,
      isSchoolAdmin: profile.role === ROLES.SCHOOL_ADMIN || profile.role === ROLES.ADMIN,
      isAdmin:       profile.role === ROLES.ADMIN,
      isEducator:    profile.role === ROLES.EDUCATOR || verificationStatus === 'educator_verified',
      creatorTier:   profile.creator_tier || 'none',

      // ── School identity ───────────────────────────────────────────────────
      schoolId: profile.school_id || null,
      hasSchoolAffiliation: !!profile.school_id,

      // ── Account health ────────────────────────────────────────────────────
      accountStatus,
      isActive:    accountStatus === 'active',
      isSuspended: accountStatus === 'suspended',
      isBanned:    accountStatus === 'banned',
      accountAccess: checkAccountAccess(profile),

      // ── Trust ─────────────────────────────────────────────────────────────
      trustTier: getTrustTier(profile),

      // ── Monetization ──────────────────────────────────────────────────────
      isMonetizationEligible: isMonetizationEligible(profile),

      // ── Future server-computed fields (placeholders) ──────────────────────
      // When NestJS computes trust_score, swap these for profile.trust_score etc.
      trustScore: profile.trust_score ?? null,
      kycLevel:   profile.kyc_level   ?? 'none',
    };
  }, [profile]);

  return identity;
}

export default useIdentity;