/**
 * useGroup Hook
 *
 * Reactive hook for group membership state and actions.
 * Provides optimistic join/leave with rollback, role checks,
 * and member management for group UIs.
 *
 * Usage:
 *   const { membership, join, leave, isMember, isAdmin, loading } = useGroup(groupId);
 */

import { useState, useEffect, useCallback } from 'react';
import groupService, { roleAtLeast, GROUP_ROLE } from '@/services/community/group.service';
import { useCurrentUser } from '@/hooks/useCurrentUser';

export function useGroup(groupId) {
  const { profile } = useCurrentUser();
  const profileId = profile?.id;

  const [group, setGroup] = useState(null);
  const [membership, setMembership] = useState(null);
  const [members, setMembers] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!groupId || !profileId) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const [groups, memb] = await Promise.all([
          base44.entities.Group.filter({ id: groupId }),
          groupService.getMembership(groupId, profileId),
        ]);
        if (cancelled) return;
        setGroup(groups[0] ?? null);
        setMembership(memb);
      } catch (e) {
        if (!cancelled) setError(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [groupId, profileId]);

  const join = useCallback(async () => {
    if (!groupId || !profileId || actionLoading) return;
    setActionLoading(true);
    try {
      const result = await groupService.joinGroup(groupId, profileId);
      const updated = await groupService.getMembership(groupId, profileId);
      setMembership(updated);
      if (result.joined) {
        setGroup(g => g ? { ...g, member_count: (g.member_count || 0) + 1 } : g);
      }
      return result;
    } finally {
      setActionLoading(false);
    }
  }, [groupId, profileId, actionLoading]);

  const leave = useCallback(async () => {
    if (!groupId || !profileId || actionLoading) return;
    setActionLoading(true);
    try {
      await groupService.leaveGroup(groupId, profileId);
      setMembership(null);
      setGroup(g => g ? { ...g, member_count: Math.max(0, (g.member_count || 0) - 1) } : g);
    } finally {
      setActionLoading(false);
    }
  }, [groupId, profileId, actionLoading]);

  const loadMembers = useCallback(async () => {
    const m = await groupService.getGroupMembers(groupId);
    setMembers(m);
    return m;
  }, [groupId]);

  const loadPendingRequests = useCallback(async () => {
    if (!canModerate) return [];
    const requests = await groupService.getPendingRequests(groupId, profileId);
    setPendingRequests(requests);
    return requests;
  }, [groupId, profileId]); // eslint-disable-line

  const approveRequest = useCallback(async (targetProfileId) => {
    await groupService.approveJoinRequest(groupId, profileId, targetProfileId);
    setPendingRequests(prev => prev.filter(r => r.user_id !== targetProfileId));
    setGroup(g => g ? { ...g, member_count: (g.member_count || 0) + 1 } : g);
  }, [groupId, profileId]);

  const banMember = useCallback(async (targetProfileId) => {
    await groupService.banMember(groupId, profileId, targetProfileId);
    setMembers(prev => prev.filter(m => m.user_id !== targetProfileId));
  }, [groupId, profileId]);

  const promoteMember = useCallback(async (targetProfileId, newRole) => {
    await groupService.promoteMember(groupId, profileId, targetProfileId, newRole);
    setMembers(prev => prev.map(m =>
      m.user_id === targetProfileId ? { ...m, role: newRole } : m
    ));
  }, [groupId, profileId]);

  // ─── Computed Membership State ────────────────────────────────────────────────

  const isMember   = membership?.status === 'active';
  const isPending  = membership?.status === 'pending';
  const isBanned   = membership?.status === 'banned';
  const isOwner    = membership?.role === GROUP_ROLE.OWNER;
  const isAdmin    = isMember && roleAtLeast(membership?.role, GROUP_ROLE.ADMIN);
  const canModerate = isMember && roleAtLeast(membership?.role, GROUP_ROLE.MODERATOR);
  const canPost    = isMember && (!group?.require_post_approval || isAdmin);

  return {
    group,
    membership,
    members,
    pendingRequests,
    loading,
    actionLoading,
    error,
    join,
    leave,
    loadMembers,
    loadPendingRequests,
    approveRequest,
    banMember,
    promoteMember,
    // Computed state
    isMember,
    isPending,
    isBanned,
    isOwner,
    isAdmin,
    canModerate,
    canPost,
    role: membership?.role ?? null,
  };
}

// ─── Missing import fix ───────────────────────────────────────────────────────
import { base44 } from '@/api/base44Client';

export default useGroup;