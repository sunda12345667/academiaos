/**
 * usePermission — Reactive RBAC hook for UI layer
 *
 * Thin wrapper over permissions.js that reads the live profile from UserProvider.
 * Use this in components to show/hide UI elements based on role.
 *
 * Usage:
 *   const { can, isRole, isAtLeastRole, canAny, canAll } = usePermission();
 *   {can(PERMISSIONS.COURSE_CREATE) && <CreateCourseButton />}
 *   {isAtLeastRole(ROLES.MODERATOR) && <ModerationPanel />}
 */
import { useCurrentUser } from '@/hooks/useCurrentUser';
import {
  hasPermission,
  hasAllPermissions,
  hasAnyPermission,
  roleAtLeast,
  canPerformAction,
  checkAccountAccess,
  hasVerification,
  isMonetizationEligible,
  getTrustTier,
  PERMISSIONS,
  ROLES,
} from '@/services/auth/permissions';

export function usePermission() {
  const { profile } = useCurrentUser();
  const role = profile?.role ?? null;

  return {
    /** Check a single permission */
    can: (permission) => role ? hasPermission(role, permission) : false,

    /** Check ALL permissions must be held */
    canAll: (permissions) => role ? hasAllPermissions(role, permissions) : false,

    /** Check ANY of the permissions is held */
    canAny: (permissions) => role ? hasAnyPermission(role, permissions) : false,

    /** Check if user has exact role */
    isRole: (r) => role === r,

    /** Check if user is at or above a minimum role tier */
    isAtLeastRole: (minimumRole) => role ? roleAtLeast(role, minimumRole) : false,

    /**
     * Ownership-aware permission check.
     * Falls back to :own variant if user owns the resource.
     */
    canOnResource: (permission, resourceOwnerId) => {
      if (!profile) return false;
      return canPerformAction(role, profile.user_id, permission, resourceOwnerId);
    },

    /** Account health — { allowed, reason } */
    accountAccess: checkAccountAccess(profile),

    /** Trust tier for UI badges: 'basic' | 'standard' | 'verified' | 'verified_educator' | 'restricted' */
    trustTier: getTrustTier(profile),

    /** Is this account monetization-eligible (has wallet:withdraw) */
    isMonetizationEligible: isMonetizationEligible(profile),

    /** Check if user meets a verification level requirement */
    hasVerification: (level) => hasVerification(profile, level),

    // Re-export constants for convenience
    PERMISSIONS,
    ROLES,
  };
}

export { PERMISSIONS, ROLES };
export default usePermission;