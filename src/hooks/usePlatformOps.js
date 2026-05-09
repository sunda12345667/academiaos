/**
 * usePlatformOps — Admin operations hook with permission gating
 *
 * Exposes all platform.ops.service functions with:
 *   - Role-based access check before every action
 *   - Sensitive action confirmation flow
 *   - Loading + error state management
 *   - Audit trail passthrough
 *
 * Only usable by users with ADMIN_DASHBOARD permission.
 * Each action checks specific required permission before calling service.
 *
 * Usage:
 *   const { suspendUser, healthSnapshot, moderationQueue } = usePlatformOps();
 */
import { useState, useEffect, useCallback } from 'react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { usePermission } from '@/hooks/usePermission';
import { PERMISSIONS } from '@/services/auth/permissions';
import platformOps from '@/services/ops/platform.ops.service';
import trustSafety from '@/services/ops/trust.safety.service';
import adPlatform from '@/services/ops/ad.platform.service';

export function usePlatformOps() {
  const { profile } = useCurrentUser();
  const { can } = usePermission();

  const [healthSnapshot, setHealthSnapshot] = useState(null);
  const [moderationQueue, setModerationQueue] = useState([]);
  const [fraudQueue, setFraudQueue] = useState([]);
  const [payoutQueue, setPayoutQueue] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const actorId = profile?.id;
  const actorRole = profile?.role;

  const isAdmin = can(PERMISSIONS.ADMIN_DASHBOARD);

  // ─── Load health snapshot ─────────────────────────────────────────────────

  const loadHealthSnapshot = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      const [health, modQ, fraudQ, payoutQ] = await Promise.all([
        platformOps.getPlatformHealthSnapshot(),
        platformOps.getModerationQueue({ limit: 30 }),
        platformOps.getFraudReviewQueue({ limit: 30 }),
        platformOps.getPayoutReviewQueue({ limit: 30 }),
      ]);
      setHealthSnapshot(health);
      setModerationQueue(modQ);
      setFraudQueue(fraudQ);
      setPayoutQueue(payoutQ);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin) loadHealthSnapshot();
  }, [isAdmin, loadHealthSnapshot]);

  // ─── User actions ─────────────────────────────────────────────────────────

  const suspendUser = useCallback(async (targetId, reason) => {
    if (!can(PERMISSIONS.USER_SUSPEND)) throw new Error('Insufficient permissions.');
    return platformOps.suspendUser(targetId, actorId, actorRole, reason);
  }, [actorId, actorRole, can]);

  const banUser = useCallback(async (targetId, reason, confirmedBy) => {
    if (!can(PERMISSIONS.USER_BAN)) throw new Error('Insufficient permissions.');
    return platformOps.banUser(targetId, actorId, actorRole, reason, confirmedBy);
  }, [actorId, actorRole, can]);

  const unsuspendUser = useCallback(async (targetId, reason) => {
    if (!can(PERMISSIONS.USER_SUSPEND)) throw new Error('Insufficient permissions.');
    return platformOps.unsuspendUser(targetId, actorId, actorRole, reason);
  }, [actorId, actorRole, can]);

  const changeRole = useCallback(async (targetId, newRole, reason, confirmedBy) => {
    if (!can(PERMISSIONS.USER_ROLE_CHANGE)) throw new Error('Insufficient permissions.');
    return platformOps.changeUserRole(targetId, newRole, actorId, actorRole, reason, confirmedBy);
  }, [actorId, actorRole, can]);

  // ─── Creator actions ──────────────────────────────────────────────────────

  const verifyCreator = useCallback(async (creatorProfileId) => {
    if (!can(PERMISSIONS.CREATOR_VERIFY)) throw new Error('Insufficient permissions.');
    return platformOps.verifyCreator(creatorProfileId, actorId, actorRole);
  }, [actorId, actorRole, can]);

  const demonetizeCreator = useCallback(async (creatorProfileId, reason, confirmedBy) => {
    if (!can(PERMISSIONS.CREATOR_DEMONETIZE)) throw new Error('Insufficient permissions.');
    return platformOps.demonetizeCreator(creatorProfileId, actorId, actorRole, reason, confirmedBy);
  }, [actorId, actorRole, can]);

  // ─── School actions ───────────────────────────────────────────────────────

  const verifySchool = useCallback(async (schoolId) => {
    if (!can(PERMISSIONS.SCHOOL_VERIFY)) throw new Error('Insufficient permissions.');
    return platformOps.verifySchool(schoolId, actorId, actorRole);
  }, [actorId, actorRole, can]);

  // ─── Ad management ────────────────────────────────────────────────────────

  const approveAd = useCallback(async (campaignId, notes) => {
    if (!can(PERMISSIONS.ADS_MANAGE_ANY)) throw new Error('Insufficient permissions.');
    return adPlatform.approveCampaign(campaignId, actorId, actorRole, notes);
  }, [actorId, actorRole, can]);

  const rejectAd = useCallback(async (campaignId, reason) => {
    if (!can(PERMISSIONS.ADS_MANAGE_ANY)) throw new Error('Insufficient permissions.');
    return adPlatform.rejectCampaign(campaignId, actorId, actorRole, reason);
  }, [actorId, actorRole, can]);

  // ─── Trust score ──────────────────────────────────────────────────────────

  const computeTrustScore = useCallback(async (userProfileId) => {
    if (!can(PERMISSIONS.TRUST_SCORE_VIEW)) throw new Error('Insufficient permissions.');
    return trustSafety.computeTrustScore(userProfileId);
  }, [can]);

  return {
    // State
    healthSnapshot,
    moderationQueue,
    fraudQueue,
    payoutQueue,
    loading,
    error,
    isAdmin,
    // Loaders
    refresh: loadHealthSnapshot,
    // User actions
    suspendUser,
    banUser,
    unsuspendUser,
    changeRole,
    // Creator actions
    verifyCreator,
    demonetizeCreator,
    // School actions
    verifySchool,
    // Ad actions
    approveAd,
    rejectAd,
    // Trust
    computeTrustScore,
    getModerationAnalytics: platformOps.getModerationAnalytics,
    getAdvertiserDashboard: adPlatform.getAdvertiserDashboard,
  };
}

export default usePlatformOps;