/**
 * usePersonalization — Taste profile + experiment bucketing for the current user.
 *
 * Computed once per session, memoized in module-level cache (24h TTL proxy).
 * No API call if cache is fresh — profile loaded on first render.
 *
 * Usage:
 *   const { tasteProfile, topSubjects, isInExperiment, loading } = usePersonalization();
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import personalizationEngine from '@/services/ai/personalization.engine';

// Module-level cache: profileId → { profile, computedAt }
// Cleared on logout via clearPersonalizationCache() called from UserProvider
const _profileCache = new Map();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 min

/** Called by UserProvider on logout to prevent cross-user data leak (DEBT-007) */
export function clearPersonalizationCache(profileId = null) {
  if (profileId) _profileCache.delete(profileId);
  else _profileCache.clear(); // full clear on logout
}

export function usePersonalization() {
  const { profile } = useCurrentUser();
  const [tasteProfile, setTasteProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const aborted = useRef(false);

  useEffect(() => {
    if (!profile?.id) return;
    aborted.current = false;

    const cached = _profileCache.get(profile.id);
    if (cached && Date.now() - new Date(cached.computedAt).getTime() < CACHE_TTL_MS) {
      setTasteProfile(cached);
      return;
    }

    setLoading(true);
    personalizationEngine.buildTasteProfile(profile.id)
      .then(tp => {
        if (aborted.current) return;
        _profileCache.set(profile.id, tp);
        setTasteProfile(tp);
      })
      .finally(() => { if (!aborted.current) setLoading(false); });

    return () => { aborted.current = true; };
  }, [profile?.id]);

  const topSubjects = tasteProfile
    ? personalizationEngine.getTopSubjects(tasteProfile, 5)
    : [];

  const topCreators = tasteProfile
    ? personalizationEngine.getTopCreators(tasteProfile, 8)
    : [];

  const isInExperiment = useCallback((key) => {
    if (!profile?.id) return false;
    return personalizationEngine.isInExperiment(profile.id, key);
  }, [profile?.id]);

  const invalidate = useCallback(() => {
    if (profile?.id) _profileCache.delete(profile.id);
  }, [profile?.id]);

  return {
    tasteProfile,
    topSubjects,
    topCreators,
    retentionRisk: tasteProfile?.retentionRisk || 'low',
    engagementStyle: tasteProfile?.engagementStyle || 'passive',
    loading,
    isInExperiment,
    invalidate,
  };
}

export default usePersonalization;