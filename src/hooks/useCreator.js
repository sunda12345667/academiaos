/**
 * useCreator Hook
 *
 * Reactive hook for creator profile and dashboard data.
 * Provides creator analytics, tier status, monetization state,
 * and badge display for the current user's creator context.
 *
 * Usage:
 *   const { creatorProfile, dashboard, isCreator, tier, badges, enableTips } = useCreator();
 *
 * Use on:
 *   - Creator dashboard page
 *   - Profile page (own profile)
 *   - Post creation modal (tier-gated features)
 */

import { useState, useEffect, useCallback } from 'react';
import creatorService from '@/services/creator/creator.service';
import { useCurrentUser } from '@/hooks/useCurrentUser';

export function useCreator() {
  const { profile } = useCurrentUser();
  const profileId = profile?.id;

  const [creatorProfile, setCreatorProfile] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!profileId) return;
    let cancelled = false;

    setLoading(true);
    creatorService.getCreatorProfile(profileId)
      .then(cp => { if (!cancelled) setCreatorProfile(cp); })
      .catch(e => { if (!cancelled) setError(e); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [profileId]);

  const loadDashboard = useCallback(async () => {
    if (!profileId) return;
    setDashboardLoading(true);
    try {
      const data = await creatorService.getCreatorDashboard(profileId);
      setDashboard(data);
      return data;
    } finally {
      setDashboardLoading(false);
    }
  }, [profileId]);

  const initCreatorProfile = useCallback(async () => {
    if (!profileId) return;
    const cp = await creatorService.getOrCreateCreatorProfile(profileId);
    setCreatorProfile(cp);
    return cp;
  }, [profileId]);

  const refreshAnalytics = useCallback(async () => {
    if (!profileId) return;
    const updated = await creatorService.refreshCreatorAnalytics(profileId);
    setCreatorProfile(updated);
    return updated;
  }, [profileId]);

  const enableTips = useCallback(async () => {
    if (!profileId) return;
    await creatorService.enableTips(profileId);
    setCreatorProfile(prev => prev ? { ...prev, tips_enabled: true } : prev);
  }, [profileId]);

  const enableMonetization = useCallback(async () => {
    if (!profileId) return;
    await creatorService.enableMonetization(profileId);
    setCreatorProfile(prev => prev ? { ...prev, monetization_enabled: true, paid_content_enabled: true } : prev);
  }, [profileId]);

  const updateProfile = useCallback(async (updates) => {
    if (!profileId) return;
    const updated = await creatorService.updateCreatorProfile(profileId, updates);
    setCreatorProfile(updated);
    return updated;
  }, [profileId]);

  // Computed tier metadata
  const tierMeta = _getTierMeta(creatorProfile?.tier);

  return {
    creatorProfile,
    dashboard,
    loading,
    dashboardLoading,
    error,
    // Computed state
    isCreator: !!creatorProfile,
    tier: creatorProfile?.tier ?? 'none',
    tierMeta,
    badges: creatorProfile?.badges ?? [],
    trustScore: creatorProfile?.trust_score ?? 0,
    isMonetized: creatorProfile?.monetization_enabled ?? false,
    tipsEnabled: creatorProfile?.tips_enabled ?? false,
    engagementRate: creatorProfile?.avg_engagement_rate ?? 0,
    // Actions
    initCreatorProfile,
    loadDashboard,
    refreshAnalytics,
    updateProfile,
    enableTips,
    enableMonetization,
  };
}

/**
 * useCreatorProfile — View another user's creator profile (read-only)
 */
export function useCreatorProfile(userProfileId) {
  const [creatorProfile, setCreatorProfile] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userProfileId) return;
    let cancelled = false;
    setLoading(true);

    creatorService.getCreatorProfile(userProfileId)
      .then(cp => { if (!cancelled) setCreatorProfile(cp); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [userProfileId]);

  return {
    creatorProfile,
    loading,
    tier: creatorProfile?.tier ?? 'none',
    badges: creatorProfile?.badges ?? [],
    trustScore: creatorProfile?.trust_score ?? 0,
    isVerified: creatorProfile?.verification_status === 'verified',
    tierMeta: _getTierMeta(creatorProfile?.tier),
  };
}

// ─── Tier Metadata ────────────────────────────────────────────────────────────

function _getTierMeta(tier) {
  const meta = {
    none:     { label: 'Creator',          color: 'text-muted-foreground', badge: null },
    basic:    { label: 'Basic Creator',    color: 'text-primary',          badge: '⭐' },
    pro:      { label: 'Pro Creator',      color: 'text-accent',           badge: '🔥' },
    verified: { label: 'Verified Creator', color: 'text-brand-emerald',    badge: '✓' },
    elite:    { label: 'Elite Creator',    color: 'text-brand-amber',      badge: '👑' },
  };
  return meta[tier] ?? meta.none;
}

export default useCreator;