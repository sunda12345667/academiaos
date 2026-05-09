/**
 * useCurrentUser Hook + UserProvider
 *
 * Single source of truth for authenticated user + profile.
 * All components use this — never call auth/profile directly.
 *
 * Migration note: On NestJS migration, the auth source changes
 * but this hook interface remains identical.
 */

import { useState, useEffect, createContext, useContext } from 'react';
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

  async function refreshProfile() {
    if (!user) return;
    const updated = await userService.getProfileByUserId(user.id);
    setProfile(updated);
    return updated;
  }

  async function updateProfile(updates) {
    if (!profile) throw new Error('No profile loaded');
    const updated = await userService.updateProfile(profile.id, updates, user.id);
    setProfile(updated);
    return updated;
  }

  function can(permission) {
    if (!profile) return false;
    return hasPermission(profile.role, permission);
  }

  function isRole(role) {
    return profile?.role === role;
  }

  function isAtLeastRole(role) {
    if (!profile) return false;
    return roleAtLeast(profile.role, role);
  }

  return (
    <UserContext.Provider value={{
      user, profile, loading, error,
      refreshProfile, updateProfile,
      can, isRole, isAtLeastRole,
      isAuthenticated: !!user,
      isProfileComplete: !!profile,
    }}>
      {children}
    </UserContext.Provider>
  );
}

export function useCurrentUser() {
  const context = useContext(UserContext);
  if (!context) throw new Error('useCurrentUser must be used inside UserProvider');
  return context;
}

export default useCurrentUser;