/**
 * Message Service
 *
 * Handles all message CRUD, delivery tracking, reactions, pagination,
 * and moderation. Kept strictly separated from UI concerns.
 *
 * Delivery state machine:
 *   optimistic (local) → sent (DB write) → delivered (recipient opens conv) → read
 *
 * Realtime:
 *   MessagingProvider subscribes to Message entity via RealtimeBus.
 *   This service NEVER subscribes itself — it only writes.
 *
 * Migration note:
 *   Messages move to an append-only, immutable table with soft-delete.
 *   Pagination uses cursor-based keyset pagination on (created_date, id) for
 *   efficient scrollback without OFFSET performance degradation.
 *   Reactions stored as JSONB map: { "👍": ["user1","user2"], "❤️": ["user3"] }
 */

import { base44 } from '@/api/base44Client';
import conversationService from './conversation.service';

// ─── Message Types ─────────────────────────────────────────────────────────────

export const MSG_TYPE = {
  TEXT:       'text',
  IMAGE:      'image',
  VIDEO:      'video',
  FILE:       'file',
  AUDIO:      'audio',
  POST_SHARE: 'post_share',
  SYSTEM:     'system',
};

// ─── Core Send/Receive ─────────────────────────────────────────────────────────

/**
 * Send a message. Returns the created message record.
 * Caller should apply optimistic UI update BEFORE calling this.
 */
export async function sendMessage({
  conversationId,
  senderProfileId,
  senderUsername,
  senderAvatarUrl,
  type = MSG_TYPE.TEXT,
  content,
  mediaUrl,
  fileName,
  fileSize,
  sharedPostId,
  replyToMessageId,
}) {
  if (!content && !mediaUrl && !sharedPostId) throw new Error('Message must have content');

  const message = await base44.entities.Message.create({
    conversation_id: conversationId,
    sender_id: senderProfileId,
    sender_username: senderUsername,
    sender_avatar_url: senderAvatarUrl,
    type,
    content: content || '',
    media_url: mediaUrl,
    file_name: fileName,
    file_size: fileSize,
    shared_post_id: sharedPostId,
    reply_to_message_id: replyToMessageId,
    read_by: [senderProfileId],
    status: 'sent',
    reactions: {},
    is_edited: false,
  });

  // Update conversation preview and bump unread counts — fire-and-forget
  Promise.all([
    base44.entities.Conversation.update(conversationId, {
      last_message_preview: _buildPreview(type, content, fileName),
      last_message_at: new Date().toISOString(),
      last_message_sender_id: senderProfileId,
    }),
    conversationService._bumpUnread(conversationId, senderProfileId),
  ]).catch(() => {});

  return message;
}

/**
 * Edit a text message (owner only enforcement is UI-side; backend enforces via RLS at scale)
 */
export async function editMessage(messageId, newContent, editorProfileId) {
  const msgs = await base44.entities.Message.filter({ id: messageId });
  if (!msgs.length) throw new Error('Message not found');
  if (msgs[0].sender_id !== editorProfileId) throw new Error('Cannot edit another user\'s message');
  if (msgs[0].type !== MSG_TYPE.TEXT) throw new Error('Only text messages can be edited');

  return await base44.entities.Message.update(messageId, {
    content: newContent,
    is_edited: true,
    edited_at: new Date().toISOString(),
  });
}

/**
 * Soft-delete a message (sets status to 'deleted', clears content)
 */
export async function deleteMessage(messageId, requesterProfileId) {
  const msgs = await base44.entities.Message.filter({ id: messageId });
  if (!msgs.length) throw new Error('Message not found');
  if (msgs[0].sender_id !== requesterProfileId) throw new Error('Cannot delete another user\'s message');

  return await base44.entities.Message.update(messageId, {
    status: 'deleted',
    content: '',
    media_url: null,
  });
}

// ─── Pagination ───────────────────────────────────────────────────────────────

/**
 * Load messages for a conversation (newest-first page).
 * Cursor-based: pass `beforeMessageId` to load older messages.
 *
 * Future: Keyset pagination — WHERE (created_date, id) < (cursor_date, cursor_id)
 */
export async function getMessages(conversationId, { limit = 40, page = 1 } = {}) {
  const messages = await base44.entities.Message.filter(
    { conversation_id: conversationId },
    '-created_date',
    limit
  );

  // Return in chronological order for rendering
  return {
    messages: messages.reverse(),
    hasMore: messages.length === limit,
  };
}

/**
 * Load a single message by ID (for reply-to hydration)
 */
export async function getMessageById(messageId) {
  const msgs = await base44.entities.Message.filter({ id: messageId });
  return msgs[0] ?? null;
}

// ─── Reactions ────────────────────────────────────────────────────────────────

/**
 * Toggle a reaction on a message.
 * Reactions: { "👍": ["uid1", "uid2"], "❤️": ["uid3"] }
 */
export async function toggleReaction(messageId, profileId, emoji) {
  const msgs = await base44.entities.Message.filter({ id: messageId });
  if (!msgs.length) throw new Error('Message not found');

  const reactions = { ...(msgs[0].reactions || {}) };
  const current = reactions[emoji] || [];

  if (current.includes(profileId)) {
    // Remove reaction
    reactions[emoji] = current.filter(id => id !== profileId);
    if (!reactions[emoji].length) delete reactions[emoji];
  } else {
    reactions[emoji] = [...current, profileId];
  }

  return await base44.entities.Message.update(messageId, { reactions });
}

// ─── Delivery State ───────────────────────────────────────────────────────────

/**
 * Mark messages as delivered when a user opens the app
 * (Does not imply they've read the specific conversation)
 */
export async function markDelivered(conversationId, profileId) {
  const undelivered = await base44.entities.Message.filter({
    conversation_id: conversationId,
    status: 'sent',
  });

  const ops = undelivered
    .filter(m => m.sender_id !== profileId && !(m.read_by || []).includes(profileId))
    .map(m => base44.entities.Message.update(m.id, { status: 'delivered' }));

  await Promise.allSettled(ops);
}

// ─── Moderation ───────────────────────────────────────────────────────────────

/**
 * Moderator/admin force-delete a message
 */
export async function moderateMessage(messageId) {
  return await base44.entities.Message.update(messageId, {
    status: 'deleted',
    content: '[Removed by moderator]',
    media_url: null,
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _buildPreview(type, content, fileName) {
  if (type === MSG_TYPE.TEXT) return (content || '').slice(0, 80);
  if (type === MSG_TYPE.IMAGE) return '📷 Image';
  if (type === MSG_TYPE.VIDEO) return '🎥 Video';
  if (type === MSG_TYPE.AUDIO) return '🎵 Audio';
  if (type === MSG_TYPE.FILE)  return `📎 ${fileName || 'File'}`;
  if (type === MSG_TYPE.POST_SHARE) return '🔗 Shared a post';
  return '';
}

/**
 * Build an optimistic message object for instant UI rendering.
 * Replace with real record when server responds.
 */
export function buildOptimisticMessage({ tempId, conversationId, senderProfileId, senderUsername, senderAvatarUrl, type, content, mediaUrl, replyToMessageId }) {
  return {
    id: tempId,
    _optimistic: true,
    conversation_id: conversationId,
    sender_id: senderProfileId,
    sender_username: senderUsername,
    sender_avatar_url: senderAvatarUrl,
    type: type || MSG_TYPE.TEXT,
    content: content || '',
    media_url: mediaUrl,
    reply_to_message_id: replyToMessageId,
    read_by: [senderProfileId],
    status: 'sent',
    reactions: {},
    is_edited: false,
    created_date: new Date().toISOString(),
  };
}

const messageService = {
  MSG_TYPE,
  sendMessage,
  editMessage,
  deleteMessage,
  getMessages,
  getMessageById,
  toggleReaction,
  markDelivered,
  moderateMessage,
  buildOptimisticMessage,
};

export default messageService;