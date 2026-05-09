/**
 * useCurrentUser Hook + UserProvider
 *
 * Single source of truth for authenticated user + profile.
 *
 * Stability hardening:
 * - Context value is memoized — no cascade rerenders on unrelated state changes
 * - Safe hook returns null-safe fallback instead of throwing during Suspense
 * - useCurrentUserStrict() throws only when explicitly required
 */
import { useState, useEffect, createContext, useContext, useMemo, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import userService from '@/services/user/user.service';
import { hasPermission, roleAtLeast } from '@/services/auth/permissions';

const UserContext = createContext(null);

export function UserProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => { initUser(); }, []);

  async function initUser() {
    try {
      setLoading(true);
      setError(null);
      const authUser = await base44.auth.me();
      setUser(authUser);
      if (authUser) {
        let userProfile = await userService.getProfileByUserId(authUser.id);
        if (!userProfile) {
          userProfile = await userService.createProfile(authUser.id, {
            full_name: authUser.full_name,
            email: authUser.email,
          });
        }
        setProfile(userProfile);
      }
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    const updated = await userService.getProfileByUserId(user.id);
    setProfile(updated);
    return updated;
  }, [user]);

  const updateProfile = useCallback(async (updates) => {
    if (!profile) throw new Error('No profile loaded');
    const updated = await userService.updateProfile(profile.id, updates, user.id);
    setProfile(updated);
    return updated;
  }, [profile, user]);

  const can = useCallback((permission) => {
    if (!profile) return false;
    return hasPermission(profile.role, permission);
  }, [profile]);

  const isRole = useCallback((role) => profile?.role === role, [profile]);

  const isAtLeastRole = useCallback((role) => {
    if (!profile) return false;
    return roleAtLeast(profile.role, role);
  }, [profile]);

  // Memoized context value — only re-renders consumers when data actually changes
  const value = useMemo(() => ({
    user,
    profile,
    loading,
    error,
    refreshProfile,
    updateProfile,
    can,
    isRole,
    isAtLeastRole,
    isAuthenticated: !!user,
    isProfileComplete: !!profile,
  }), [user, profile, loading, error, refreshProfile, updateProfile, can, isRole, isAtLeastRole]);

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
}

/**
 * Safe hook — returns null-safe defaults when used outside provider or during Suspense.
 * Use this in most components.
 */
export function useCurrentUser() {
  const context = useContext(UserContext);
  if (!context) {
    // Safe fallback — prevents crash during lazy-load, Suspense, or error boundary resets
    return {
      user: null,
      profile: null,
      loading: true,
      error: null,
      refreshProfile: () => Promise.resolve(),
      updateProfile: () => Promise.resolve(),
      can: () => false,
      isRole: () => false,
      isAtLeastRole: () => false,
      isAuthenticated: false,
      isProfileComplete: false,
    };
  }
  return context;
}

/**
 * Strict hook — throws if used outside provider.
 * Use only in components that are guaranteed to be inside UserProvider.
 */
export function useCurrentUserStrict() {
  const context = useContext(UserContext);
  if (!context) throw new Error('useCurrentUserStrict must be used inside UserProvider');
  return context;
}

export default useCurrentUser;