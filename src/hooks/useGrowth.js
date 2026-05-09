/**
 * useGrowth — Growth systems hook
 *
 * Unified access point for:
 *   - Onboarding state + step completion
 *   - Referral code + share URL generation
 *   - Achievement checking
 *   - Streak risk detection
 *   - Return trigger computation
 *
 * Used by:
 *   - Onboarding flow components
 *   - Profile pages (referral widget)
 *   - Creator dashboard (achievements, milestones)
 *   - Post composer (share tracking)
 */
import { useState, useEffect, useCallback } from 'react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import onboardingService from '@/services/growth/onboarding.service';
import retentionService from '@/services/growth/retention.service';
import viralService from '@/services/growth/viral.service';
import notificationIntelligence from '@/services/growth/notification.intelligence';
import { eventQueue } from '@/lib/infra/event-queue';

export function useOnboarding() {
  const { profile } = useCurrentUser();
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);

  const profileId = profile?.id;

  useEffect(() => {
    if (!profileId) { setLoading(false); return; }
    onboardingService.getOnboardingState(profileId)
      .then(setState)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [profileId]);

  const completeStep = useCallback(async (stepId) => {
    if (!profileId) return;
    const result = await onboardingService.completeStep(profileId, stepId);
    // Refresh state
    const updated = await onboardingService.getOnboardingState(profileId);
    setState(updated);
    return result;
  }, [profileId]);

  const getSuggestions = useCallback(() =>
    profileId ? onboardingService.getOnboardingSuggestions(profileId) : Promise.resolve([]),
  [profileId]);

  const getGroupSuggestions = useCallback(() =>
    profileId ? onboardingService.getOnboardingGroupSuggestions(profileId) : Promise.resolve([]),
  [profileId]);

  const saveInterests = useCallback((interests, schoolId) =>
    profileId ? onboardingService.saveInterestSelection(profileId, interests, schoolId) : null,
  [profileId]);

  return {
    state,
    loading,
    isComplete: state?.isComplete ?? false,
    isActivated: state?.isActivated ?? false,
    currentStep: state?.currentStep ?? null,
    progressPercent: state?.progressPercent ?? 0,
    completeStep,
    getSuggestions,
    getGroupSuggestions,
    saveInterests,
  };
}

export function useReferral() {
  const { profile } = useCurrentUser();
  const [referralCode, setReferralCode] = useState(profile?.referral_code || null);
  const [stats, setStats] = useState(null);

  const profileId = profile?.id;

  useEffect(() => {
    if (!profileId) return;
    viralService.getReferralCode(profileId).then(setReferralCode).catch(() => {});
    viralService.getReferralStats(profileId).then(setStats).catch(() => {});
  }, [profileId]);

  const buildShareUrl = useCallback((contentType, contentId, destination = 'copy') =>
    viralService.buildShareUrl(contentType, contentId, profileId, destination),
  [profileId]);

  const trackShare = useCallback((contentType, contentId, destination) => {
    viralService.trackShare(contentType, contentId, profileId, destination);
    eventQueue.contentShare(contentId, destination);
  }, [profileId]);

  const getReferralLink = useCallback(() => {
    if (!referralCode) return null;
    const base = typeof window !== 'undefined' ? window.location.origin : '';
    return `${base}/join?ref=${referralCode}`;
  }, [referralCode]);

  return {
    referralCode,
    referralLink: getReferralLink(),
    stats,
    buildShareUrl,
    trackShare,
  };
}

export function useAchievements() {
  const { profile } = useCurrentUser();
  const earned = profile?.achievements_earned || [];
  const totalXp = profile?.total_xp || 0;

  const checkAchievements = useCallback(async (context = {}) => {
    if (!profile?.id) return [];
    return retentionService.checkAndUnlockAchievements(profile.id, context);
  }, [profile?.id]);

  const getEarnedAchievements = useCallback(() =>
    earned.map(id => retentionService.ACHIEVEMENTS[id]).filter(Boolean),
  [earned]);

  const getNextAchievements = useCallback(() =>
    Object.values(retentionService.ACHIEVEMENTS)
      .filter(a => !earned.includes(a.id))
      .slice(0, 5),
  [earned]);

  return {
    earned,
    totalXp,
    earnedAchievements: getEarnedAchievements(),
    nextAchievements: getNextAchievements(),
    checkAchievements,
    allAchievements: retentionService.ACHIEVEMENTS,
  };
}

export default { useOnboarding, useReferral, useAchievements };