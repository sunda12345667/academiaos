/**
 * User Profile Service
 * 
 * Handles profile management, follow graph, and user discovery.
 * 
 * Migration note: Becomes UserModule + FollowModule in NestJS.
 * Follow graph scales via a dedicated graph query with PostgreSQL recursive CTEs.
 * At 10M+ users, migrate follow graph to Neo4j or dedicated graph service.
 */

import { base44 } from '@/api/base44Client';
import notificationService from '@/services/notifications/notification.service';

/**
 * Get a user profile by ID
 */
async function getProfileById(profileId) {
  const profiles = await base44.entities.UserProfile.filter({ id: profileId });
  if (!profiles.length) throw new Error('Profile not found');
  return profiles[0];
}

/**
 * Get a user profile by username
 */
async function getProfileByUsername(username) {
  const profiles = await base44.entities.UserProfile.filter({ username });
  if (!profiles.length) throw new Error('Profile not found');
  return profiles[0];
}

/**
 * Get a user profile by base44 user_id
 */
async function getProfileByUserId(userId) {
  const profiles = await base44.entities.UserProfile.filter({ user_id: userId });
  return profiles.length ? profiles[0] : null;
}

/**
 * Create a new user profile on first login
 */
async function createProfile(userId, userData) {
  const existingProfile = await getProfileByUserId(userId);
  if (existingProfile) return existingProfile;

  const username = generateUsername(userData.email || userData.full_name);

  const profile = await base44.entities.UserProfile.create({
    user_id: userId,
    username,
    display_name: userData.full_name || username,
    role: 'student',
    account_status: 'active',
    verification_status: 'unverified',
    follower_count: 0,
    following_count: 0,
    post_count: 0,
    is_creator: false,
    creator_tier: 'none',
  });

  // Future: Emit user.created event for onboarding workflow
  return profile;
}

/**
 * Update user profile
 */
async function updateProfile(profileId, updates, requestingUserId) {
  const profile = await getProfileById(profileId);
  if (profile.user_id !== requestingUserId) throw new Error('Unauthorized');

  // Sanitize — prevent privilege escalation from client
  const allowedFields = ['display_name', 'bio', 'avatar_url', 'cover_url',
    'social_links', 'preferences', 'country', 'timezone'];
  const sanitized = {};
  allowedFields.forEach(field => {
    if (updates[field] !== undefined) sanitized[field] = updates[field];
  });

  return await base44.entities.UserProfile.update(profileId, sanitized);
}

/**
 * Follow a user
 */
async function followUser(followerId, followingId) {
  if (followerId === followingId) throw new Error('Cannot follow yourself');

  const existing = await base44.entities.Follow.filter({ follower_id: followerId, following_id: followingId });
  if (existing.length) {
    if (existing[0].status === 'active') return { alreadyFollowing: true };
    // Reactivate unfollowed
    await base44.entities.Follow.update(existing[0].id, { status: 'active' });
  } else {
    await base44.entities.Follow.create({
      follower_id: followerId,
      following_id: followingId,
      status: 'active',
      notification_preference: 'all',
    });
  }

  // Update denormalized counters
  const [followerProfile, followingProfile] = await Promise.all([
    getProfileById(followerId),
    getProfileById(followingId),
  ]);

  await Promise.all([
    base44.entities.UserProfile.update(followerId, {
      following_count: (followerProfile.following_count || 0) + 1,
    }),
    base44.entities.UserProfile.update(followingId, {
      follower_count: (followingProfile.follower_count || 0) + 1,
    }),
  ]);

  notificationService.createNotification({
    recipient_id: followingId,
    actor_id: followerId,
    actor_username: followerProfile.username,
    actor_avatar_url: followerProfile.avatar_url,
    type: 'new_follower',
    entity_type: 'user',
    entity_id: followerId,
    deep_link: `/profile/${followerProfile.username}`,
  }).catch(() => {});

  return { following: true };
}

/**
 * Unfollow a user
 */
async function unfollowUser(followerId, followingId) {
  const existing = await base44.entities.Follow.filter({
    follower_id: followerId,
    following_id: followingId,
    status: 'active',
  });
  if (!existing.length) return { following: false };

  await base44.entities.Follow.update(existing[0].id, { status: 'left' });

  const [followerProfile, followingProfile] = await Promise.all([
    getProfileById(followerId),
    getProfileById(followingId),
  ]);

  await Promise.all([
    base44.entities.UserProfile.update(followerId, {
      following_count: Math.max(0, (followerProfile.following_count || 0) - 1),
    }),
    base44.entities.UserProfile.update(followingId, {
      follower_count: Math.max(0, (followingProfile.follower_count || 0) - 1),
    }),
  ]);

  return { following: false };
}

/**
 * Check if a user follows another
 */
async function isFollowing(followerId, followingId) {
  const follows = await base44.entities.Follow.filter({
    follower_id: followerId,
    following_id: followingId,
    status: 'active',
  });
  return follows.length > 0;
}

/**
 * Block a user
 */
async function blockUser(blockerId, blockedId) {
  const existing = await base44.entities.Follow.filter({
    follower_id: blockerId,
    following_id: blockedId,
  });

  if (existing.length) {
    await base44.entities.Follow.update(existing[0].id, { status: 'blocked' });
  } else {
    await base44.entities.Follow.create({
      follower_id: blockerId,
      following_id: blockedId,
      status: 'blocked',
    });
  }

  return { blocked: true };
}

/**
 * Search users by username or display name
 * Future: Elasticsearch-powered full-text search
 */
async function searchUsers(query, { limit = 20 } = {}) {
  const all = await base44.entities.UserProfile.list('-follower_count', 100);
  const q = query.toLowerCase();
  return all
    .filter(p =>
      p.account_status === 'active' &&
      (p.username?.toLowerCase().includes(q) || p.display_name?.toLowerCase().includes(q))
    )
    .slice(0, limit);
}

// ─── Internal Helpers ─────────────────────────────────────────────────────────

function generateUsername(emailOrName = '') {
  const base = emailOrName.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '_');
  const suffix = Math.floor(Math.random() * 9999);
  return `${base}_${suffix}`;
}

export default {
  getProfileById,
  getProfileByUsername,
  getProfileByUserId,
  createProfile,
  updateProfile,
  followUser,
  unfollowUser,
  isFollowing,
  blockUser,
  searchUsers,
};