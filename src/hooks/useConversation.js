/**
 * useConversation Hook
 *
 * Manages state for a single open conversation:
 *   - Message history with pagination
 *   - Optimistic sends
 *   - Realtime updates via MessagingProvider registry
 *   - Read marking on open
 *   - Typing indicator emission
 *
 * Usage:
 *   const { messages, sendMessage, loadMore, isLoading, hasMore } = useConversation(conversationId);
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import messageService from '@/services/messaging/message.service';
import conversationService from '@/services/messaging/conversation.service';
import { useMessagingStore } from '@/providers/MessagingProvider';
import { useCurrentUser } from '@/hooks/useCurrentUser';

export function useConversation(conversationId) {
  const { profile } = useCurrentUser();
  const { registerConversationListener, setTyping, resetUnread } = useMessagingStore();

  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState(null);
  const [sending, setSending] = useState(false);

  const pageRef = useRef(1);
  const optimisticCounter = useRef(0);

  // ─── Initial Message Load ────────────────────────────────────────────────────

  useEffect(() => {
    if (!conversationId) return;
    setMessages([]);
    pageRef.current = 1;
    setHasMore(false);
    setError(null);
    loadMessages(true);
  }, [conversationId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadMessages(reset = false) {
    if (isLoading) return;
    setIsLoading(true);
    try {
      const { messages: fetched, hasMore: more } = await messageService.getMessages(
        conversationId,
        { page: reset ? 1 : pageRef.current }
      );

      setMessages(prev => {
        if (reset) return fetched;
        // Prepend older messages, deduplicate by id
        const existingIds = new Set(prev.map(m => m.id));
        const newOnes = fetched.filter(m => !existingIds.has(m.id));
        return [...newOnes, ...prev];
      });

      setHasMore(more);
      if (!reset) pageRef.current += 1;
    } catch (e) {
      setError(e);
    } finally {
      setIsLoading(false);
    }
  }

  // ─── Mark Read on Open ───────────────────────────────────────────────────────

  useEffect(() => {
    if (!conversationId || !profile?.id) return;
    conversationService.markConversationRead(conversationId, profile.id).catch(() => {});
    resetUnread(conversationId);
  }, [conversationId, profile?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Realtime Subscription ───────────────────────────────────────────────────

  useEffect(() => {
    if (!conversationId) return;

    return registerConversationListener(conversationId, (event) => {
      const msg = event.data;
      if (!msg) return;

      if (event.type === 'create') {
        setMessages(prev => {
          // Replace optimistic message if exists, else append
          const optimisticIndex = prev.findIndex(m => m._optimistic && m.content === msg.content && m.sender_id === msg.sender_id);
          if (optimisticIndex >= 0) {
            const next = [...prev];
            next[optimisticIndex] = msg;
            return next;
          }
          if (prev.some(m => m.id === msg.id)) return prev;
          return [...prev, msg];
        });

        // Auto-mark read if this is the open conversation
        if (msg.sender_id !== profile?.id) {
          conversationService.markConversationRead(conversationId, profile.id).catch(() => {});
        }
      }

      if (event.type === 'update') {
        setMessages(prev => prev.map(m => m.id === msg.id ? msg : m));
      }

      if (event.type === 'delete') {
        setMessages(prev => prev.map(m =>
          m.id === event.id ? { ...m, status: 'deleted', content: '' } : m
        ));
      }
    });
  }, [conversationId, profile?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Send ────────────────────────────────────────────────────────────────────

  const sendMessage = useCallback(async ({
    type, content, mediaUrl, fileName, fileSize, sharedPostId, replyToMessageId
  }) => {
    if (!profile || !conversationId) return;
    if (sending) return;

    setSending(true);

    // Build optimistic message for instant UI
    const tempId = `optimistic_${++optimisticCounter.current}`;
    const optimistic = messageService.buildOptimisticMessage({
      tempId,
      conversationId,
      senderProfileId: profile.id,
      senderUsername: profile.username,
      senderAvatarUrl: profile.avatar_url,
      type,
      content,
      mediaUrl,
      replyToMessageId,
    });

    setMessages(prev => [...prev, optimistic]);

    try {
      const sent = await messageService.sendMessage({
        conversationId,
        senderProfileId: profile.id,
        senderUsername: profile.username,
        senderAvatarUrl: profile.avatar_url,
        type,
        content,
        mediaUrl,
        fileName,
        fileSize,
        sharedPostId,
        replyToMessageId,
      });

      // Replace optimistic with real message
      setMessages(prev => prev.map(m => m.id === tempId ? sent : m));
      return sent;
    } catch (e) {
      // Remove failed optimistic message
      setMessages(prev => prev.filter(m => m.id !== tempId));
      throw e;
    } finally {
      setSending(false);
    }
  }, [profile, conversationId, sending]);

  // ─── Reactions ───────────────────────────────────────────────────────────────

  const toggleReaction = useCallback(async (messageId, emoji) => {
    if (!profile?.id) return;

    // Optimistic update
    setMessages(prev => prev.map(m => {
      if (m.id !== messageId) return m;
      const reactions = { ...(m.reactions || {}) };
      const current = reactions[emoji] || [];
      if (current.includes(profile.id)) {
        reactions[emoji] = current.filter(id => id !== profile.id);
        if (!reactions[emoji].length) delete reactions[emoji];
      } else {
        reactions[emoji] = [...current, profile.id];
      }
      return { ...m, reactions };
    }));

    await messageService.toggleReaction(messageId, profile.id, emoji);
  }, [profile?.id]);

  // ─── Typing ──────────────────────────────────────────────────────────────────

  const typingTimeout = useRef(null);

  const onTyping = useCallback(() => {
    if (!profile?.id || !conversationId) return;
    setTyping(conversationId, profile.id, true);
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => {
      setTyping(conversationId, profile.id, false);
    }, 2500);
  }, [profile?.id, conversationId, setTyping]);

  // ─── Load More ───────────────────────────────────────────────────────────────

  const loadMore = useCallback(() => {
    if (!hasMore || isLoading) return;
    pageRef.current += 1;
    loadMessages(false);
  }, [hasMore, isLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    messages,
    isLoading,
    hasMore,
    error,
    sending,
    sendMessage,
    toggleReaction,
    onTyping,
    loadMore,
    refresh: () => loadMessages(true),
  };
}

export default useConversation;