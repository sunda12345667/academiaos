/**
 * Conversation Service
 *
 * Manages conversation lifecycle: DMs, group chats, academic rooms,
 * broadcast channels, and announcement feeds.
 *
 * Architecture:
 *   Conversation  ─ metadata + participant list + unread map
 *   Message       ─ immutable content records (soft-delete only)
 *
 * Delivery states:  sent → delivered → read
 * Realtime:         MessagingProvider owns the single Message subscription via RealtimeBus
 *
 * Migration note:
 *   DMs → PostgreSQL with row-level security per participant
 *   Group chats → fan-out write (copies to each participant's inbox) at scale
 *   Unread counts → Redis INCR/DECR per (conversation_id, user_id)
 *   Typing indicators → ephemeral Redis pub/sub, never persisted to DB
 */

import { base44 } from '@/api/base44Client';

// ─── Conversation Types ────────────────────────────────────────────────────────

export const CONV_TYPE = {
  DIRECT:       'direct',
  GROUP:        'group',
};

// ─── Conversation Lifecycle ────────────────────────────────────────────────────

/**
 * Get or create a DM conversation between two participants.
 * Idempotent: returns existing if found.
 */
export async function getOrCreateDM(participantAId, participantBId) {
  // Sorted pair for canonical lookup
  const pair = [participantAId, participantBId].sort();

  // Fetch all DM conversations for participantA, then filter
  // Future: DB-level query on JSONB participants array
  const existing = await base44.entities.Conversation.filter({
    type: CONV_TYPE.DIRECT,
  }, '-created_date', 200);

  const found = existing.find(c => {
    const parts = c.participants ?? [];
    return parts.length === 2 &&
      parts.includes(pair[0]) && parts.includes(pair[1]);
  });

  if (found) return found;

  return await base44.entities.Conversation.create({
    type: CONV_TYPE.DIRECT,
    participants: pair,
    unread_counts: { [participantAId]: 0, [participantBId]: 0 },
    status: 'active',
  });
}

/**
 * Create a group conversation
 */
export async function createGroupConversation({ name, participantIds, createdById, avatarUrl, groupId } = {}) {
  const unread_counts = Object.fromEntries(participantIds.map(id => [id, 0]));

  return await base44.entities.Conversation.create({
    type: CONV_TYPE.GROUP,
    name,
    participants: participantIds,
    created_by: createdById,
    avatar_url: avatarUrl,
    group_id: groupId,
    unread_counts,
    status: 'active',
  });
}

/**
 * Add a participant to a group conversation
 */
export async function addParticipant(conversationId, profileId) {
  const convs = await base44.entities.Conversation.filter({ id: conversationId });
  if (!convs.length) throw new Error('Conversation not found');
  const conv = convs[0];

  if (conv.participants.includes(profileId)) return conv;

  const updated = await base44.entities.Conversation.update(conversationId, {
    participants: [...conv.participants, profileId],
    unread_counts: { ...(conv.unread_counts || {}), [profileId]: 0 },
  });
  return updated;
}

/**
 * Remove a participant (leave / kick)
 */
export async function removeParticipant(conversationId, profileId) {
  const convs = await base44.entities.Conversation.filter({ id: conversationId });
  if (!convs.length) throw new Error('Conversation not found');
  const conv = convs[0];

  const participants = (conv.participants || []).filter(id => id !== profileId);
  const unread_counts = { ...(conv.unread_counts || {}) };
  delete unread_counts[profileId];

  return await base44.entities.Conversation.update(conversationId, {
    participants,
    unread_counts,
  });
}

/**
 * Get all conversations for a user (sorted by last message)
 */
export async function getConversationsForUser(profileId, { limit = 30 } = {}) {
  // Fetches all conversations, then client-filters by participation.
  // Future: DB query: SELECT * FROM conversations WHERE $profileId = ANY(participants)
  const all = await base44.entities.Conversation.list('-last_message_at', 200);
  return all
    .filter(c => c.status !== 'archived' && (c.participants || []).includes(profileId))
    .slice(0, limit);
}

/**
 * Get a single conversation by ID (access check included)
 */
export async function getConversation(conversationId, profileId) {
  const convs = await base44.entities.Conversation.filter({ id: conversationId });
  if (!convs.length) throw new Error('Conversation not found');
  const conv = convs[0];
  if (!(conv.participants || []).includes(profileId)) throw new Error('Access denied');
  return conv;
}

/**
 * Archive / mute a conversation for a user
 * (Stored at the Conversation level; future: per-participant preference table)
 */
export async function archiveConversation(conversationId) {
  return await base44.entities.Conversation.update(conversationId, { status: 'archived' });
}

// ─── Unread Tracking ──────────────────────────────────────────────────────────

/**
 * Mark all messages in a conversation as read for a user.
 * Resets their unread count to 0.
 */
export async function markConversationRead(conversationId, profileId) {
  const convs = await base44.entities.Conversation.filter({ id: conversationId });
  if (!convs.length) return;

  const unread_counts = {
    ...(convs[0].unread_counts || {}),
    [profileId]: 0,
  };

  await base44.entities.Conversation.update(conversationId, { unread_counts });

  // Mark all unread messages as read
  // Future: Batch DB update: UPDATE messages SET read_by = array_append(read_by, profileId)
  const unreadMessages = await base44.entities.Message.filter({
    conversation_id: conversationId,
    status: 'sent',
  });

  const readOps = unreadMessages
    .filter(m => !(m.read_by || []).includes(profileId))
    .map(m => base44.entities.Message.update(m.id, {
      read_by: [...(m.read_by || []), profileId],
      status: m.read_by?.length >= 1 ? 'read' : 'delivered',
    }));

  await Promise.allSettled(readOps);
}

/**
 * Get total unread count across all conversations
 */
export async function getTotalUnreadCount(profileId) {
  const conversations = await getConversationsForUser(profileId);
  return conversations.reduce((sum, c) => sum + ((c.unread_counts || {})[profileId] || 0), 0);
}

/**
 * Bump unread count for all participants except the sender
 */
export async function _bumpUnread(conversationId, senderProfileId) {
  const convs = await base44.entities.Conversation.filter({ id: conversationId });
  if (!convs.length) return;

  const conv = convs[0];
  const unread_counts = { ...(conv.unread_counts || {}) };

  (conv.participants || []).forEach(pid => {
    if (pid !== senderProfileId) {
      unread_counts[pid] = (unread_counts[pid] || 0) + 1;
    }
  });

  await base44.entities.Conversation.update(conversationId, { unread_counts });
}

const conversationService = {
  CONV_TYPE,
  getOrCreateDM,
  createGroupConversation,
  addParticipant,
  removeParticipant,
  getConversationsForUser,
  getConversation,
  archiveConversation,
  markConversationRead,
  getTotalUnreadCount,
  _bumpUnread,
};

export default conversationService;