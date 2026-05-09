/**
 * Social Graph Service
 *
 * Manages all relationship types in the StudentOS social graph:
 *   follow/unfollow, block/unblock, mute, classmates, course-mates,
 *   mutual detection, recommendation readiness.
 *
 * Graph topology:
 *   UserProfile → (Follow) → UserProfile          [directed]
 *   UserProfile → (GroupMembership) → Group        [bidirectional via entity]
 *   UserProfile → (AcademicIdentity) → School      [affiliation edge]
 *
 * Migration note:
 *   At scale, Follow edges move to a dedicated graph store (Neo4j / Amazon Neptune).
 *   Mutual detection and 2nd-degree connections use Cypher / Gremlin queries.
 *   Recommendation engine (collaborative filtering) plugs in via a separate ML service.
 */

import { base44 } from '@/api/base44Client';
import notificationService from '@/services/notifications/notification.service';

// ─── Relationship Types ───────────────────────────────────────────────────────

export const RELATIONSHIP = {
  FOLLOWING: 'active',
  PENDING:   'pending',
  BLOCKED:   'blocked',
  MUTED:     'muted',
  LEFT:      'left',
};

// ─── Core Follow Graph ────────────────────────────────────────────────────────

/**
 * Get the full relationship status between two users.
 * Returns a normalized edge descriptor for UI decision making.
 */
export async function getRelationship(viewerProfileId, targetProfileId) {
  if (viewerProfileId === targetProfileId) {
    return { isSelf: true, isFollowing: false, isFollowedBy: false, isMutual: false, isBlocked: false, isMuted: false };
  }

  const [outgoing, incoming] = await Promise.all([
    base44.entities.Follow.filter({ follower_id: viewerProfileId, following_id: targetProfileId }),
    base44.entities.Follow.filter({ follower_id: targetProfileId, following_id: viewerProfileId }),
  ]);

  const out = outgoing[0] ?? null;
  const inc = incoming[0] ?? null;

  return {
    isSelf: false,
    isFollowing:  out?.status === RELATIONSHIP.FOLLOWING,
    isFollowedBy: inc?.status === RELATIONSHIP.FOLLOWING,
    isMutual:     out?.status === RELATIONSHIP.FOLLOWING && inc?.status === RELATIONSHIP.FOLLOWING,
    isPending:    out?.status === RELATIONSHIP.PENDING,
    isBlocked:    out?.status === RELATIONSHIP.BLOCKED,
    isMuted:      out?.status === RELATIONSHIP.MUTED,
    outEdgeId:    out?.id,
    inEdgeId:     inc?.id,
    notificationPref: out?.notification_preference ?? 'all',
  };
}

/**
 * Follow a user. Handles reactivation of soft-deleted edges.
 */
export async function followUser(followerProfileId, followingProfileId) {
  if (followerProfileId === followingProfileId) throw new Error('Cannot follow yourself');

  const existing = await base44.entities.Follow.filter({
    follower_id: followerProfileId,
    following_id: followingProfileId,
  });

  if (existing.length) {
    const edge = existing[0];
    if (edge.status === RELATIONSHIP.FOLLOWING) return { alreadyFollowing: true };
    if (edge.status === RELATIONSHIP.BLOCKED) throw new Error('Cannot follow a blocked user');
    await base44.entities.Follow.update(edge.id, { status: RELATIONSHIP.FOLLOWING });
  } else {
    await base44.entities.Follow.create({
      follower_id: followerProfileId,
      following_id: followingProfileId,
      status: RELATIONSHIP.FOLLOWING,
      notification_preference: 'all',
    });
  }

  // Denormalized counter update — future: background job
  await _bumpCounters(followerProfileId, followingProfileId, +1);

  // Notification — fire-and-forget
  _emitFollowNotification(followerProfileId, followingProfileId).catch(() => {});

  return { following: true };
}

export async function unfollowUser(followerProfileId, followingProfileId) {
  const existing = await base44.entities.Follow.filter({
    follower_id: followerProfileId,
    following_id: followingProfileId,
    status: RELATIONSHIP.FOLLOWING,
  });
  if (!existing.length) return { following: false };

  await base44.entities.Follow.update(existing[0].id, { status: RELATIONSHIP.LEFT });
  await _bumpCounters(followerProfileId, followingProfileId, -1);

  return { following: false };
}

export async function blockUser(blockerProfileId, targetProfileId) {
  // Ensure we also remove any active follow in either direction
  const [outgoing, incoming] = await Promise.all([
    base44.entities.Follow.filter({ follower_id: blockerProfileId, following_id: targetProfileId }),
    base44.entities.Follow.filter({ follower_id: targetProfileId, following_id: blockerProfileId }),
  ]);

  const ops = [];

  if (outgoing.length) {
    ops.push(base44.entities.Follow.update(outgoing[0].id, { status: RELATIONSHIP.BLOCKED }));
  } else {
    ops.push(base44.entities.Follow.create({
      follower_id: blockerProfileId,
      following_id: targetProfileId,
      status: RELATIONSHIP.BLOCKED,
    }));
  }

  // Remove reverse follow (block always wins)
  if (incoming.length && incoming[0].status === RELATIONSHIP.FOLLOWING) {
    ops.push(base44.entities.Follow.update(incoming[0].id, { status: RELATIONSHIP.LEFT }));
    ops.push(_bumpCounters(targetProfileId, blockerProfileId, -1));
  }

  await Promise.all(ops);
  return { blocked: true };
}

export async function unblockUser(blockerProfileId, targetProfileId) {
  const existing = await base44.entities.Follow.filter({
    follower_id: blockerProfileId,
    following_id: targetProfileId,
    status: RELATIONSHIP.BLOCKED,
  });
  if (!existing.length) return { unblocked: false };

  await base44.entities.Follow.update(existing[0].id, { status: RELATIONSHIP.LEFT });
  return { unblocked: true };
}

export async function muteUser(muterProfileId, targetProfileId) {
  const existing = await base44.entities.Follow.filter({
    follower_id: muterProfileId,
    following_id: targetProfileId,
  });
  if (existing.length) {
    await base44.entities.Follow.update(existing[0].id, { status: RELATIONSHIP.MUTED });
  } else {
    await base44.entities.Follow.create({
      follower_id: muterProfileId,
      following_id: targetProfileId,
      status: RELATIONSHIP.MUTED,
    });
  }
  return { muted: true };
}

export async function unmuteUser(muterProfileId, targetProfileId) {
  const existing = await base44.entities.Follow.filter({
    follower_id: muterProfileId,
    following_id: targetProfileId,
    status: RELATIONSHIP.MUTED,
  });
  if (!existing.length) return;
  await base44.entities.Follow.update(existing[0].id, { status: RELATIONSHIP.LEFT });
  return { muted: false };
}

/**
 * Update notification preference for a follow edge
 */
export async function setFollowNotificationPref(followerProfileId, followingProfileId, preference) {
  const existing = await base44.entities.Follow.filter({
    follower_id: followerProfileId,
    following_id: followingProfileId,
    status: RELATIONSHIP.FOLLOWING,
  });
  if (!existing.length) throw new Error('Not following');
  await base44.entities.Follow.update(existing[0].id, { notification_preference: preference });
}

// ─── Graph Queries ────────────────────────────────────────────────────────────

/**
 * Get list of profiles a user is following
 */
export async function getFollowing(profileId, { limit = 50 } = {}) {
  const follows = await base44.entities.Follow.filter(
    { follower_id: profileId, status: RELATIONSHIP.FOLLOWING },
    '-created_date',
    limit
  );
  return follows.map(f => f.following_id);
}

/**
 * Get list of profiles following a user
 */
export async function getFollowers(profileId, { limit = 50 } = {}) {
  const follows = await base44.entities.Follow.filter(
    { following_id: profileId, status: RELATIONSHIP.FOLLOWING },
    '-created_date',
    limit
  );
  return follows.map(f => f.follower_id);
}

/**
 * Get mutual followers (people who follow each other)
 * Future: Single Cypher MATCH (a)-[:FOLLOWS]->(b)-[:FOLLOWS]->(a)
 */
export async function getMutualFollowers(profileIdA, profileIdB) {
  const [aFollowing, bFollowing] = await Promise.all([
    getFollowing(profileIdA),
    getFollowing(profileIdB),
  ]);
  const aSet = new Set(aFollowing);
  return bFollowing.filter(id => aSet.has(id));
}

/**
 * Get blocked user IDs — used for feed filtering
 */
export async function getBlockedIds(profileId) {
  const blocked = await base44.entities.Follow.filter({
    follower_id: profileId,
    status: RELATIONSHIP.BLOCKED,
  });
  return new Set(blocked.map(f => f.following_id));
}

/**
 * Get muted user IDs — used for feed soft-filtering (still fetched, just hidden)
 */
export async function getMutedIds(profileId) {
  const muted = await base44.entities.Follow.filter({
    follower_id: profileId,
    status: RELATIONSHIP.MUTED,
  });
  return new Set(muted.map(f => f.following_id));
}

/**
 * Batch-check follow status for a list of target IDs
 * Avoids N+1 individual calls for profile lists
 * Future: Replace with a single graph traversal
 */
export async function batchCheckFollowing(viewerProfileId, targetProfileIds) {
  if (!targetProfileIds.length) return {};

  // Load all outgoing edges from viewer (single query)
  const edges = await base44.entities.Follow.filter(
    { follower_id: viewerProfileId, status: RELATIONSHIP.FOLLOWING },
    '-created_date',
    500
  );

  const followingSet = new Set(edges.map(e => e.following_id));
  return Object.fromEntries(targetProfileIds.map(id => [id, followingSet.has(id)]));
}

// ─── Academic / Community Relationships ──────────────────────────────────────

/**
 * Get classmates: users at the same school with same level/department
 * Future: Optimized with a PostgreSQL compound index on (school_id, department, level)
 */
export async function getClassmates(profileId, { limit = 30 } = {}) {
  const identities = await base44.entities.AcademicIdentity.filter({ user_id: profileId });
  if (!identities.length) return [];

  const { school_id, department, level } = identities[0];
  if (!school_id) return [];

  const peers = await base44.entities.AcademicIdentity.filter(
    { school_id, department, level },
    '-created_date',
    limit + 1
  );
  // Exclude self
  return peers.filter(p => p.user_id !== profileId).slice(0, limit);
}

/**
 * Get school members (same institution)
 */
export async function getSchoolmates(schoolId, { limit = 50 } = {}) {
  const members = await base44.entities.UserProfile.filter(
    { school_id: schoolId, account_status: 'active' },
    '-follower_count',
    limit
  );
  return members;
}

// ─── Suggested Users (Recommendation Readiness) ───────────────────────────────

/**
 * Get suggested users for a profile.
 * MVP: followers-of-followers + school affiliation.
 * Future: Replace with ML collaborative filtering service.
 */
export async function getSuggestedUsers(profileId, { limit = 10 } = {}) {
  const [followingIds, blockedIds] = await Promise.all([
    getFollowing(profileId, { limit: 100 }),
    getBlockedIds(profileId),
  ]);

  const followingSet = new Set([profileId, ...followingIds]);
  const candidates = new Set();

  // 2nd-degree: followers of who I follow (capped to avoid fan-out explosion)
  const slice = followingIds.slice(0, 10);
  const secondDegree = await Promise.all(
    slice.map(id => getFollowing(id, { limit: 20 }).catch(() => []))
  );
  secondDegree.flat().forEach(id => {
    if (!followingSet.has(id) && !blockedIds.has(id)) candidates.add(id);
  });

  const candidateIds = [...candidates].slice(0, limit * 2);
  if (!candidateIds.length) return [];

  // Hydrate profiles — batch filter
  const profiles = await base44.entities.UserProfile.filter(
    { account_status: 'active' },
    '-follower_count',
    100
  );

  return profiles
    .filter(p => candidates.has(p.id) && !blockedIds.has(p.id))
    .slice(0, limit);
}

// ─── Internal Helpers ─────────────────────────────────────────────────────────

async function _bumpCounters(followerId, followingId, delta) {
  const [fProfile, tProfile] = await Promise.all([
    base44.entities.UserProfile.filter({ id: followerId }),
    base44.entities.UserProfile.filter({ id: followingId }),
  ]);
  if (!fProfile.length || !tProfile.length) return;

  await Promise.all([
    base44.entities.UserProfile.update(followerId, {
      following_count: Math.max(0, (fProfile[0].following_count || 0) + delta),
    }),
    base44.entities.UserProfile.update(followingId, {
      follower_count: Math.max(0, (tProfile[0].follower_count || 0) + delta),
    }),
  ]);
}

async function _emitFollowNotification(followerProfileId, followingProfileId) {
  const profiles = await base44.entities.UserProfile.filter({ id: followerProfileId });
  if (!profiles.length) return;
  const actor = profiles[0];

  await notificationService.createNotification({
    recipient_id: followingProfileId,
    actor_id: followerProfileId,
    actor_username: actor.username,
    actor_avatar_url: actor.avatar_url,
    type: 'new_follower',
    entity_type: 'user',
    entity_id: followerProfileId,
    deep_link: `/profile/${actor.username}`,
  });
}

const graphService = {
  getRelationship,
  followUser,
  unfollowUser,
  blockUser,
  unblockUser,
  muteUser,
  unmuteUser,
  setFollowNotificationPref,
  getFollowing,
  getFollowers,
  getMutualFollowers,
  getBlockedIds,
  getMutedIds,
  batchCheckFollowing,
  getClassmates,
  getSchoolmates,
  getSuggestedUsers,
  RELATIONSHIP,
};

export default graphService;