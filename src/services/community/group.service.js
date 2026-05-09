/**
 * Group / Community Service
 *
 * Manages study groups, school communities, departments, project teams,
 * and monetized communities.
 *
 * Architecture:
 *   Group          — metadata, settings, moderation config
 *   GroupMembership — role + status per user per group
 *   Post           — linked to group_id for content feed
 *   Conversation   — linked to group_id for chat channel
 *
 * Role hierarchy (descending privilege):
 *   owner → admin → moderator → member → guest
 *
 * Migration note:
 *   Member counts → Redis INCR. Active groups use materialized views.
 *   Group feed uses same PostgreSQL feed table as global feed, partitioned by group_id.
 *   Invite codes → short-lived tokens in Redis, not stored in DB.
 */

import { base44 } from '@/api/base44Client';
import notificationService from '@/services/notifications/notification.service';

// ─── Role Hierarchy ────────────────────────────────────────────────────────────

export const GROUP_ROLE = {
  OWNER:     'owner',
  ADMIN:     'admin',
  MODERATOR: 'moderator',
  MEMBER:    'member',
  GUEST:     'guest',
};

const ROLE_RANK = {
  owner: 4,
  admin: 3,
  moderator: 2,
  member: 1,
  guest: 0,
};

export function roleAtLeast(userRole, required) {
  return (ROLE_RANK[userRole] ?? -1) >= (ROLE_RANK[required] ?? 0);
}

// ─── Group Lifecycle ───────────────────────────────────────────────────────────

export async function createGroup({
  name, description, type, privacy,
  ownerProfileId, schoolId, subjectTags, avatarUrl, coverUrl,
}) {
  const slug = _slugify(name);

  const group = await base44.entities.Group.create({
    name,
    slug,
    description,
    type: type || 'community',
    privacy: privacy || 'public',
    owner_id: ownerProfileId,
    school_id: schoolId,
    subject_tags: subjectTags || [],
    avatar_url: avatarUrl,
    cover_url: coverUrl,
    member_count: 1,
    post_count: 0,
    status: 'active',
    allow_member_posts: true,
    require_post_approval: false,
    is_monetized: false,
    invite_code: _generateInviteCode(),
  });

  // Creator auto-joins as owner
  await base44.entities.GroupMembership.create({
    group_id: group.id,
    user_id: ownerProfileId,
    role: GROUP_ROLE.OWNER,
    status: 'active',
    joined_at: new Date().toISOString(),
    notifications_enabled: true,
    is_muted: false,
  });

  return group;
}

export async function updateGroup(groupId, updates, requestingProfileId) {
  const membership = await getMembership(groupId, requestingProfileId);
  if (!membership || !roleAtLeast(membership.role, GROUP_ROLE.ADMIN)) {
    throw new Error('Insufficient permissions');
  }

  const allowedFields = ['name', 'description', 'cover_url', 'avatar_url',
    'rules', 'subject_tags', 'allow_member_posts', 'require_post_approval'];
  const sanitized = {};
  allowedFields.forEach(f => { if (updates[f] !== undefined) sanitized[f] = updates[f]; });

  return await base44.entities.Group.update(groupId, sanitized);
}

export async function archiveGroup(groupId, requestingProfileId) {
  const membership = await getMembership(groupId, requestingProfileId);
  if (!membership || membership.role !== GROUP_ROLE.OWNER) throw new Error('Only owner can archive');

  return await base44.entities.Group.update(groupId, { status: 'archived' });
}

// ─── Membership Lifecycle ──────────────────────────────────────────────────────

export async function joinGroup(groupId, profileId) {
  const groups = await base44.entities.Group.filter({ id: groupId });
  if (!groups.length) throw new Error('Group not found');
  const group = groups[0];

  if (group.status !== 'active') throw new Error('Group is not active');

  const existing = await getMembership(groupId, profileId);
  if (existing?.status === 'active') return { alreadyMember: true };
  if (existing?.status === 'banned') throw new Error('You are banned from this group');

  const status = group.require_post_approval ? 'pending' : 'active';

  if (existing) {
    await base44.entities.GroupMembership.update(existing.id, {
      status,
      joined_at: new Date().toISOString(),
    });
  } else {
    await base44.entities.GroupMembership.create({
      group_id: groupId,
      user_id: profileId,
      role: GROUP_ROLE.MEMBER,
      status,
      joined_at: new Date().toISOString(),
      notifications_enabled: true,
      is_muted: false,
    });
  }

  if (status === 'active') {
    await _bumpMemberCount(groupId, +1);
    // Notify owner of new member
    _notifyGroupOwner(groupId, profileId, group.owner_id).catch(() => {});
  }

  return { status, joined: status === 'active', pending: status === 'pending' };
}

export async function leaveGroup(groupId, profileId) {
  const membership = await getMembership(groupId, profileId);
  if (!membership) return;
  if (membership.role === GROUP_ROLE.OWNER) throw new Error('Owner must transfer ownership before leaving');

  await base44.entities.GroupMembership.update(membership.id, { status: 'left' });
  if (membership.status === 'active') {
    await _bumpMemberCount(groupId, -1);
  }
}

export async function inviteToGroup(groupId, inviterProfileId, targetProfileId) {
  const inviterMembership = await getMembership(groupId, inviterProfileId);
  if (!inviterMembership || !roleAtLeast(inviterMembership.role, GROUP_ROLE.MEMBER)) {
    throw new Error('Must be a member to invite');
  }

  const existing = await getMembership(groupId, targetProfileId);
  if (existing?.status === 'active') return { alreadyMember: true };

  // Auto-approve invite from admins/owners; others create pending
  const status = roleAtLeast(inviterMembership.role, GROUP_ROLE.ADMIN) ? 'active' : 'pending';

  if (existing) {
    await base44.entities.GroupMembership.update(existing.id, { status, invited_by: inviterProfileId });
  } else {
    await base44.entities.GroupMembership.create({
      group_id: groupId,
      user_id: targetProfileId,
      role: GROUP_ROLE.MEMBER,
      status,
      invited_by: inviterProfileId,
      joined_at: status === 'active' ? new Date().toISOString() : null,
      notifications_enabled: true,
      is_muted: false,
    });
  }

  if (status === 'active') await _bumpMemberCount(groupId, +1);

  // Notify invitee
  notificationService.createNotification({
    recipient_id: targetProfileId,
    actor_id: inviterProfileId,
    type: 'group_invite',
    entity_type: 'group',
    entity_id: groupId,
    deep_link: `/groups/${groupId}`,
  }).catch(() => {});

  return { status, invited: true };
}

export async function approveJoinRequest(groupId, moderatorProfileId, targetProfileId) {
  const moderatorMembership = await getMembership(groupId, moderatorProfileId);
  if (!moderatorMembership || !roleAtLeast(moderatorMembership.role, GROUP_ROLE.MODERATOR)) {
    throw new Error('Insufficient permissions');
  }

  const pending = await getMembership(groupId, targetProfileId);
  if (!pending || pending.status !== 'pending') throw new Error('No pending request found');

  await base44.entities.GroupMembership.update(pending.id, {
    status: 'active',
    joined_at: new Date().toISOString(),
  });
  await _bumpMemberCount(groupId, +1);

  notificationService.createNotification({
    recipient_id: targetProfileId,
    actor_id: moderatorProfileId,
    type: 'group_join_approved',
    entity_type: 'group',
    entity_id: groupId,
    deep_link: `/groups/${groupId}`,
  }).catch(() => {});
}

export async function banMember(groupId, moderatorProfileId, targetProfileId) {
  const modMembership = await getMembership(groupId, moderatorProfileId);
  if (!modMembership || !roleAtLeast(modMembership.role, GROUP_ROLE.MODERATOR)) {
    throw new Error('Insufficient permissions');
  }

  const target = await getMembership(groupId, targetProfileId);
  if (!target) throw new Error('User is not a member');
  if (roleAtLeast(target.role, modMembership.role)) throw new Error('Cannot ban a higher-ranked member');

  await base44.entities.GroupMembership.update(target.id, { status: 'banned' });
  if (target.status === 'active') await _bumpMemberCount(groupId, -1);
}

export async function promoteMember(groupId, adminProfileId, targetProfileId, newRole) {
  const adminMembership = await getMembership(groupId, adminProfileId);
  if (!adminMembership || !roleAtLeast(adminMembership.role, GROUP_ROLE.ADMIN)) {
    throw new Error('Insufficient permissions');
  }
  if (!roleAtLeast(adminMembership.role, newRole)) throw new Error('Cannot promote above own rank');

  const target = await getMembership(groupId, targetProfileId);
  if (!target || target.status !== 'active') throw new Error('Target is not an active member');

  await base44.entities.GroupMembership.update(target.id, { role: newRole });
}

// ─── Group Queries ─────────────────────────────────────────────────────────────

export async function getMembership(groupId, profileId) {
  const memberships = await base44.entities.GroupMembership.filter({
    group_id: groupId,
    user_id: profileId,
  });
  return memberships[0] ?? null;
}

export async function getGroupMembers(groupId, { status = 'active', limit = 50 } = {}) {
  return await base44.entities.GroupMembership.filter(
    { group_id: groupId, status },
    '-joined_at',
    limit
  );
}

export async function getGroupsForUser(profileId, { status = 'active' } = {}) {
  return await base44.entities.GroupMembership.filter(
    { user_id: profileId, status },
    '-joined_at',
    100
  );
}

export async function getPendingRequests(groupId, moderatorProfileId) {
  const mod = await getMembership(groupId, moderatorProfileId);
  if (!mod || !roleAtLeast(mod.role, GROUP_ROLE.MODERATOR)) throw new Error('Access denied');

  return await base44.entities.GroupMembership.filter({ group_id: groupId, status: 'pending' });
}

export async function searchGroups(query, { schoolId, type, limit = 20 } = {}) {
  const filter = { status: 'active' };
  if (schoolId) filter.school_id = schoolId;
  if (type) filter.type = type;

  const all = await base44.entities.Group.filter(filter, '-member_count', 100);
  const q = query.toLowerCase();
  return all
    .filter(g =>
      g.privacy !== 'secret' &&
      (g.name?.toLowerCase().includes(q) || g.description?.toLowerCase().includes(q))
    )
    .slice(0, limit);
}

// ─── Invite Code System ───────────────────────────────────────────────────────

export async function joinByInviteCode(inviteCode, profileId) {
  const groups = await base44.entities.Group.filter({ invite_code: inviteCode, status: 'active' });
  if (!groups.length) throw new Error('Invalid invite code');

  return await joinGroup(groups[0].id, profileId);
}

export async function regenerateInviteCode(groupId, adminProfileId) {
  const membership = await getMembership(groupId, adminProfileId);
  if (!membership || !roleAtLeast(membership.role, GROUP_ROLE.ADMIN)) throw new Error('Access denied');

  const newCode = _generateInviteCode();
  await base44.entities.Group.update(groupId, { invite_code: newCode });
  return newCode;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function _bumpMemberCount(groupId, delta) {
  const groups = await base44.entities.Group.filter({ id: groupId });
  if (!groups.length) return;
  await base44.entities.Group.update(groupId, {
    member_count: Math.max(0, (groups[0].member_count || 0) + delta),
  });
}

async function _notifyGroupOwner(groupId, joinerProfileId, ownerProfileId) {
  if (joinerProfileId === ownerProfileId) return;
  await notificationService.createNotification({
    recipient_id: ownerProfileId,
    actor_id: joinerProfileId,
    type: 'group_join_request',
    entity_type: 'group',
    entity_id: groupId,
    deep_link: `/groups/${groupId}`,
  });
}

function _slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function _generateInviteCode() {
  return Math.random().toString(36).substring(2, 9).toUpperCase();
}

const groupService = {
  GROUP_ROLE,
  roleAtLeast,
  createGroup,
  updateGroup,
  archiveGroup,
  joinGroup,
  leaveGroup,
  inviteToGroup,
  approveJoinRequest,
  banMember,
  promoteMember,
  getMembership,
  getGroupMembers,
  getGroupsForUser,
  getPendingRequests,
  searchGroups,
  joinByInviteCode,
  regenerateInviteCode,
};

export default groupService;