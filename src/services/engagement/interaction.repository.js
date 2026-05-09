/**
 * Interaction Repository — Batch Interaction Lookup
 *
 * Resolves DEBT-005: PostInteraction N+1 on feed load.
 *
 * Instead of 1 query per post (called from each PostCard),
 * this batch-fetches all interactions for a user across multiple posts
 * in a SINGLE query, then groups by post_id in memory.
 *
 * Usage (in feed hooks or PostCard parent):
 *   const interactionMap = await batchGetUserInteractions(postIds, profileId);
 *   // interactionMap.get(postId) → { liked, saved, voted, pollChoice, shared }
 *
 * react-query cache key: ['interactions', profileId, ...sortedPostIds]
 * staleTime: 5 minutes (interactions don't change that fast in a feed session)
 *
 * Migration note:
 *   On PostgreSQL: single `WHERE post_id = ANY($1) AND user_id = $2` query.
 *   No change needed to calling code — same Map<postId, interactions> contract.
 */

import { base44 } from '@/api/base44Client';

/**
 * Batch-fetch interactions for a user across multiple posts.
 * Returns Map<postId, {liked, saved, voted, pollChoice, shared}>
 *
 * @param {string[]} postIds
 * @param {string} profileId
 * @returns {Promise<Map<string, object>>}
 */
export async function batchGetUserInteractions(postIds, profileId) {
  if (!postIds.length || !profileId) return new Map();

  // Single query for ALL interactions by this user
  // Base44 filter doesn't support $in, so we fetch all recent user interactions
  // and filter by the known postId set in memory — still 1 query instead of N
  const interactions = await base44.entities.PostInteraction.filter(
    { user_id: profileId },
    '-created_date',
    Math.min(postIds.length * 5 + 50, 500) // generous bound: each post could have up to ~5 interaction types
  );

  const postIdSet = new Set(postIds);
  const result = new Map();

  // Initialize all posts with default state (no interactions)
  postIds.forEach(id => {
    result.set(id, { liked: false, saved: false, voted: false, shared: false, pollChoice: null });
  });

  // Group by post_id
  interactions.forEach(interaction => {
    if (!postIdSet.has(interaction.post_id)) return;

    const current = result.get(interaction.post_id);
    if (!current) return;

    const type = interaction.type;
    if (['like', 'love', 'insightful'].includes(type)) current.liked = true;
    if (type === 'save') current.saved = true;
    if (type === 'poll_vote') { current.voted = true; current.pollChoice = interaction.poll_choice; }
    if (type === 'share') current.shared = true;
  });

  return result;
}

/**
 * Single-post interaction lookup — kept for compatibility.
 * Prefer batchGetUserInteractions for feed contexts.
 */
export async function getUserInteractionForPost(postId, profileId) {
  const map = await batchGetUserInteractions([postId], profileId);
  return map.get(postId) ?? { liked: false, saved: false, voted: false, shared: false, pollChoice: null };
}

export default { batchGetUserInteractions, getUserInteractionForPost };