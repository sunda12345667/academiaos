/**
 * RBAC Permission System
 * 
 * Migration note: This module defines the permission contract.
 * On migration to NestJS, this becomes a Guards/Decorators system.
 * The UI-facing API remains identical.
 */

// ─── Role Hierarchy ───────────────────────────────────────────────────────────
export const ROLES = {
  STUDENT:     'student',
  EDUCATOR:    'educator',
  CREATOR:     'creator',
  ADVERTISER:  'advertiser',
  SCHOOL_ADMIN:'school_admin',
  MODERATOR:   'moderator',
  ADMIN:       'admin',
};

/**
 * Higher index = higher privilege level.
 * ADVERTISER sits alongside CREATOR — neither inherits from the other.
 * Both are below SCHOOL_ADMIN for platform trust purposes.
 */
const ROLE_HIERARCHY = [
  ROLES.STUDENT,
  ROLES.EDUCATOR,
  ROLES.CREATOR,
  ROLES.ADVERTISER,
  ROLES.SCHOOL_ADMIN,
  ROLES.MODERATOR,
  ROLES.ADMIN,
];

// ─── Permission Definitions ───────────────────────────────────────────────────
export const PERMISSIONS = {
  // Post permissions
  POST_CREATE: 'post:create',
  POST_EDIT_OWN: 'post:edit:own',
  POST_DELETE_OWN: 'post:delete:own',
  POST_DELETE_ANY: 'post:delete:any',
  POST_FEATURE: 'post:feature',
  POST_PIN: 'post:pin',

  // Comment permissions
  COMMENT_CREATE: 'comment:create',
  COMMENT_DELETE_OWN: 'comment:delete:own',
  COMMENT_DELETE_ANY: 'comment:delete:any',

  // Group permissions
  GROUP_CREATE: 'group:create',
  GROUP_MANAGE_OWN: 'group:manage:own',
  GROUP_MANAGE_ANY: 'group:manage:any',
  GROUP_BAN_MEMBER: 'group:ban_member',

  // Course permissions
  COURSE_CREATE: 'course:create',
  COURSE_PUBLISH: 'course:publish',
  COURSE_MANAGE_OWN: 'course:manage:own',

  // Marketplace permissions
  MARKETPLACE_LIST: 'marketplace:list',
  MARKETPLACE_PURCHASE: 'marketplace:purchase',

  // Wallet permissions
  WALLET_VIEW_OWN: 'wallet:view:own',
  WALLET_WITHDRAW: 'wallet:withdraw',
  WALLET_VIEW_ANY: 'wallet:view:any',

  // Moderation permissions
  REPORT_CREATE: 'report:create',
  REPORT_REVIEW: 'report:review',
  USER_SUSPEND: 'user:suspend',
  USER_BAN: 'user:ban',
  CONTENT_REMOVE: 'content:remove',

  // Advertiser permissions
  ADS_CREATE: 'ads:create',
  ADS_MANAGE_OWN: 'ads:manage:own',
  ADS_VIEW_ANALYTICS: 'ads:view:analytics',

  // Creator-specific permissions
  LIVE_STREAM: 'live:stream',
  PAID_CONTENT_CREATE: 'paid_content:create',
  TIP_RECEIVE: 'tip:receive',

  // Identity & verification permissions
  VERIFICATION_REQUEST: 'verification:request',
  VERIFICATION_REVIEW: 'verification:review',
  TRUST_SCORE_VIEW: 'trust_score:view',

  // Admin permissions
  ADMIN_DASHBOARD: 'admin:dashboard',
  SCHOOL_MANAGE: 'school:manage',
  PLATFORM_SETTINGS: 'platform:settings',
  ADS_MANAGE_ANY: 'ads:manage:any',
  LIVE_MANAGE_ANY: 'live:manage:any',
};

// ─── Role → Permission Mapping ────────────────────────────────────────────────
const ROLE_PERMISSIONS = {
  [ROLES.STUDENT]: [
    PERMISSIONS.POST_CREATE,
    PERMISSIONS.POST_EDIT_OWN,
    PERMISSIONS.POST_DELETE_OWN,
    PERMISSIONS.COMMENT_CREATE,
    PERMISSIONS.COMMENT_DELETE_OWN,
    PERMISSIONS.GROUP_CREATE,
    PERMISSIONS.GROUP_MANAGE_OWN,
    PERMISSIONS.MARKETPLACE_LIST,
    PERMISSIONS.MARKETPLACE_PURCHASE,
    PERMISSIONS.WALLET_VIEW_OWN,
    PERMISSIONS.REPORT_CREATE,
  ],
  [ROLES.EDUCATOR]: [
    // Inherits student permissions
    PERMISSIONS.POST_CREATE,
    PERMISSIONS.POST_EDIT_OWN,
    PERMISSIONS.POST_DELETE_OWN,
    PERMISSIONS.COMMENT_CREATE,
    PERMISSIONS.COMMENT_DELETE_OWN,
    PERMISSIONS.GROUP_CREATE,
    PERMISSIONS.GROUP_MANAGE_OWN,
    PERMISSIONS.GROUP_BAN_MEMBER,
    PERMISSIONS.COURSE_CREATE,
    PERMISSIONS.COURSE_PUBLISH,
    PERMISSIONS.COURSE_MANAGE_OWN,
    PERMISSIONS.MARKETPLACE_LIST,
    PERMISSIONS.MARKETPLACE_PURCHASE,
    PERMISSIONS.WALLET_VIEW_OWN,
    PERMISSIONS.WALLET_WITHDRAW,
    PERMISSIONS.REPORT_CREATE,
  ],
  [ROLES.CREATOR]: [
    PERMISSIONS.POST_CREATE,
    PERMISSIONS.POST_EDIT_OWN,
    PERMISSIONS.POST_DELETE_OWN,
    PERMISSIONS.COMMENT_CREATE,
    PERMISSIONS.COMMENT_DELETE_OWN,
    PERMISSIONS.GROUP_CREATE,
    PERMISSIONS.GROUP_MANAGE_OWN,
    PERMISSIONS.COURSE_CREATE,
    PERMISSIONS.COURSE_PUBLISH,
    PERMISSIONS.COURSE_MANAGE_OWN,
    PERMISSIONS.MARKETPLACE_LIST,
    PERMISSIONS.MARKETPLACE_PURCHASE,
    PERMISSIONS.WALLET_VIEW_OWN,
    PERMISSIONS.WALLET_WITHDRAW,
    PERMISSIONS.REPORT_CREATE,
    PERMISSIONS.LIVE_STREAM,
    PERMISSIONS.PAID_CONTENT_CREATE,
    PERMISSIONS.TIP_RECEIVE,
    PERMISSIONS.VERIFICATION_REQUEST,
  ],
  [ROLES.ADVERTISER]: [
    PERMISSIONS.POST_CREATE,
    PERMISSIONS.POST_EDIT_OWN,
    PERMISSIONS.POST_DELETE_OWN,
    PERMISSIONS.COMMENT_CREATE,
    PERMISSIONS.COMMENT_DELETE_OWN,
    PERMISSIONS.MARKETPLACE_LIST,
    PERMISSIONS.MARKETPLACE_PURCHASE,
    PERMISSIONS.WALLET_VIEW_OWN,
    PERMISSIONS.WALLET_WITHDRAW,
    PERMISSIONS.REPORT_CREATE,
    PERMISSIONS.ADS_CREATE,
    PERMISSIONS.ADS_MANAGE_OWN,
    PERMISSIONS.ADS_VIEW_ANALYTICS,
    PERMISSIONS.VERIFICATION_REQUEST,
  ],
  [ROLES.SCHOOL_ADMIN]: [
    PERMISSIONS.POST_CREATE,
    PERMISSIONS.POST_EDIT_OWN,
    PERMISSIONS.POST_DELETE_OWN,
    PERMISSIONS.POST_DELETE_ANY,
    PERMISSIONS.COMMENT_CREATE,
    PERMISSIONS.COMMENT_DELETE_ANY,
    PERMISSIONS.GROUP_CREATE,
    PERMISSIONS.GROUP_MANAGE_OWN,
    PERMISSIONS.GROUP_MANAGE_ANY,
    PERMISSIONS.GROUP_BAN_MEMBER,
    PERMISSIONS.COURSE_CREATE,
    PERMISSIONS.COURSE_PUBLISH,
    PERMISSIONS.COURSE_MANAGE_OWN,
    PERMISSIONS.MARKETPLACE_LIST,
    PERMISSIONS.WALLET_VIEW_OWN,
    PERMISSIONS.REPORT_CREATE,
    PERMISSIONS.REPORT_REVIEW,
    PERMISSIONS.USER_SUSPEND,
    PERMISSIONS.CONTENT_REMOVE,
    PERMISSIONS.SCHOOL_MANAGE,
  ],
  [ROLES.MODERATOR]: [
    PERMISSIONS.POST_CREATE,
    PERMISSIONS.POST_EDIT_OWN,
    PERMISSIONS.POST_DELETE_OWN,
    PERMISSIONS.POST_DELETE_ANY,
    PERMISSIONS.COMMENT_CREATE,
    PERMISSIONS.COMMENT_DELETE_OWN,
    PERMISSIONS.COMMENT_DELETE_ANY,
    PERMISSIONS.GROUP_MANAGE_ANY,
    PERMISSIONS.GROUP_BAN_MEMBER,
    PERMISSIONS.CONTENT_REMOVE,
    PERMISSIONS.REPORT_REVIEW,
    PERMISSIONS.USER_SUSPEND,
    PERMISSIONS.WALLET_VIEW_OWN,
    PERMISSIONS.REPORT_CREATE,
    PERMISSIONS.VERIFICATION_REVIEW,
    PERMISSIONS.TRUST_SCORE_VIEW,
  ],
  [ROLES.ADMIN]: Object.values(PERMISSIONS),
};

// ─── Permission Check Functions ───────────────────────────────────────────────

/**
 * Check if a user role has a specific permission
 */
export function hasPermission(userRole, permission) {
  const rolePermissions = ROLE_PERMISSIONS[userRole] || [];
  return rolePermissions.includes(permission);
}

/**
 * Check if user has ALL specified permissions
 */
export function hasAllPermissions(userRole, permissions) {
  return permissions.every(p => hasPermission(userRole, p));
}

/**
 * Check if user has ANY of the specified permissions
 */
export function hasAnyPermission(userRole, permissions) {
  return permissions.some(p => hasPermission(userRole, p));
}

/**
 * Check if role A is equal to or higher than role B
 */
export function roleAtLeast(userRole, minimumRole) {
  const userIndex = ROLE_HIERARCHY.indexOf(userRole);
  const minIndex = ROLE_HIERARCHY.indexOf(minimumRole);
  return userIndex >= minIndex;
}

/**
 * Check if user can perform action on a resource
 * Handles ownership-scoped permissions
 */
export function canPerformAction(userRole, userId, action, resourceOwnerId = null) {
  // Check direct permission
  if (hasPermission(userRole, action)) return true;

  // Check ownership-scoped fallback
  // e.g. user can delete own post even if they can't delete any post
  if (resourceOwnerId && userId === resourceOwnerId) {
    const ownedVariant = action.replace(':any', ':own');
    if (ownedVariant !== action && hasPermission(userRole, ownedVariant)) return true;
  }

  return false;
}

/**
 * Get all permissions for a role
 */
export function getPermissionsForRole(role) {
  return ROLE_PERMISSIONS[role] || [];
}

/**
 * Check if a profile is allowed to access the platform
 * Returns { allowed: bool, reason: string }
 */
export function checkAccountAccess(profile) {
  if (!profile) return { allowed: false, reason: 'unauthenticated' };
  if (profile.account_status === 'banned')    return { allowed: false, reason: 'banned' };
  if (profile.account_status === 'suspended') return { allowed: false, reason: 'suspended' };
  if (profile.account_status === 'pending_verification') return { allowed: true, reason: 'pending_verification' };
  return { allowed: true, reason: null };
}

/**
 * Check if a profile has a sufficient verification level for a feature
 * Levels: 'none' | 'email' | 'identity' | 'educator' | 'school'
 */
export function hasVerification(profile, requiredLevel) {
  const levels = ['none', 'email_verified', 'id_verified', 'educator_verified'];
  const userLevel = levels.indexOf(profile?.verification_status || 'unverified');
  const required  = levels.indexOf(requiredLevel);
  return userLevel >= required;
}

/**
 * Whether the user is a monetization-eligible account
 * (creator, educator, or advertiser with wallet withdraw permission)
 */
export function isMonetizationEligible(profile) {
  if (!profile) return false;
  return hasPermission(profile.role, PERMISSIONS.WALLET_WITHDRAW);
}

/**
 * Derive trust tier from profile for UI display.
 * Future: Replace with server-computed trust_score field on UserProfile.
 */
export function getTrustTier(profile) {
  if (!profile) return 'unknown';
  if (profile.account_status !== 'active') return 'restricted';
  if (profile.verification_status === 'educator_verified') return 'verified_educator';
  if (profile.verification_status === 'id_verified')       return 'verified';
  if (profile.verification_status === 'email_verified')    return 'standard';
  return 'basic';
}

export default {
  hasPermission,
  hasAllPermissions,
  hasAnyPermission,
  roleAtLeast,
  canPerformAction,
  getPermissionsForRole,
  checkAccountAccess,
  hasVerification,
  isMonetizationEligible,
  getTrustTier,
  ROLES,
  PERMISSIONS,
};