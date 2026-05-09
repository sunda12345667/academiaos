/**
 * MessagingProvider — Centralized messaging realtime orchestration
 *
 * Architecture:
 *   - ONE subscription to Message entity via RealtimeBus (shared across all consumers)
 *   - ONE subscription to Conversation entity for metadata updates
 *   - Registry pattern: individual conversation views register listeners
 *   - Typing indicators are ephemeral — NOT stored, NOT persisted
 *
 * Provider hierarchy (inside AppShell):
 *   MessagingProvider
 *     └── ConversationList (uses useMessagingStore)
 *     └── ConversationView (registers as listener via useConversationRealtime)
 *
 * Future:
 *   - WebSocket gateway replaces RealtimeBus for messaging
 *   - Typing indicators via dedicated WS channel (never DB)
 *   - Message delivery ACK via WS, not polling
 */

import {
  createContext, useContext, useState, useEffect,
  useRef, useCallback, useMemo
} from 'react';
import RealtimeBus from '@/lib/realtime/RealtimeBus';
import conversationService from '@/services/messaging/conversation.service';
import { useCurrentUser } from '@/hooks/useCurrentUser';

const MessagingContext = createContext(null);

export function MessagingProvider({ children }) {
  const { profile } = useCurrentUser();
  const profileId = profile?.id;

  const [conversations, setConversations] = useState([]);
  const [totalUnread, setTotalUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Registry: conversationId → Set<callback>
  // Each active ConversationView registers here to receive message events
  const messageListeners = useRef(new Map());

  // Typing state: conversationId → Map<profileId, timestamp>
  // Ephemeral — never written to DB
  const typingState = useRef(new Map());
  const [typingUpdates, setTypingUpdates] = useState(0); // tick to trigger re-reads

  // ─── Initial Load ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!profileId) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const convs = await conversationService.getConversationsForUser(profileId);
        if (cancelled) return;
        setConversations(convs);
        const unread = convs.reduce((sum, c) => sum + ((c.unread_counts || {})[profileId] || 0), 0);
        setTotalUnread(unread);
        setInitialized(true);
      } catch (e) {
        console.warn('[MessagingProvider] load error', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [profileId]);

  // ─── Conversation Realtime ───────────────────────────────────────────────────

  useEffect(() => {
    if (!profileId) return;

    // Listen for conversation metadata changes (new conv, unread count, last message)
    return RealtimeBus.subscribe('Conversation', '*', (event) => {
      const conv = event.data;
      if (!conv || !(conv.participants || []).includes(profileId)) return;

      if (event.type === 'create') {
        setConversations(prev => {
          if (prev.some(c => c.id === conv.id)) return prev;
          return [conv, ...prev];
        });
      } else if (event.type === 'update') {
        setConversations(prev =>
          prev.map(c => c.id === conv.id ? conv : c)
            .sort((a, b) => new Date(b.last_message_at || b.created_date) - new Date(a.last_message_at || a.created_date))
        );
        // Recompute total unread
        setConversations(prev => {
          const unread = prev.reduce((sum, c) => sum + ((c.unread_counts || {})[profileId] || 0), 0);
          setTotalUnread(unread);
          return prev;
        });
      }
    });
  }, [profileId]);

  // ─── Message Realtime ────────────────────────────────────────────────────────

  useEffect(() => {
    if (!profileId) return;

    return RealtimeBus.subscribe('Message', '*', (event) => {
      const msg = event.data;
      if (!msg) return;

      // Dispatch to registered conversation listeners
      const listeners = messageListeners.current.get(msg.conversation_id);
      if (listeners) {
        listeners.forEach(cb => {
          try { cb(event); } catch {}
        });
      }

      // Bump total unread if message is from someone else and we're not in that conversation
      if (event.type === 'create' && msg.sender_id !== profileId) {
        // Listeners present = that conversation is open = already marked read by ConversationView
        if (!listeners || listeners.size === 0) {
          setTotalUnread(prev => prev + 1);
        }
      }
    });
  }, [profileId]);

  // ─── Listener Registration (for ConversationView) ────────────────────────────

  const registerConversationListener = useCallback((conversationId, callback) => {
    if (!messageListeners.current.has(conversationId)) {
      messageListeners.current.set(conversationId, new Set());
    }
    messageListeners.current.get(conversationId).add(callback);

    return () => {
      const listeners = messageListeners.current.get(conversationId);
      if (listeners) {
        listeners.delete(callback);
        if (!listeners.size) messageListeners.current.delete(conversationId);
      }
    };
  }, []);

  // ─── Typing Indicators (ephemeral) ───────────────────────────────────────────

  const TYPING_TTL_MS = 3000;

  const setTyping = useCallback((conversationId, typingProfileId, isTyping) => {
    const conv = typingState.current.get(conversationId) ?? new Map();

    if (isTyping) {
      conv.set(typingProfileId, Date.now());
    } else {
      conv.delete(typingProfileId);
    }

    typingState.current.set(conversationId, conv);
    setTypingUpdates(n => n + 1);
  }, []);

  const getTypingUsers = useCallback((conversationId) => {
    const now = Date.now();
    const conv = typingState.current.get(conversationId) ?? new Map();
    const active = [];
    conv.forEach((timestamp, uid) => {
      if (now - timestamp < TYPING_TTL_MS && uid !== profileId) active.push(uid);
    });
    return active;
  }, [profileId, typingUpdates]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Conversation Actions ────────────────────────────────────────────────────

  const resetUnread = useCallback((conversationId) => {
    setConversations(prev => {
      const updated = prev.map(c => {
        if (c.id !== conversationId) return c;
        const unread_counts = { ...(c.unread_counts || {}), [profileId]: 0 };
        return { ...c, unread_counts };
      });
      const unread = updated.reduce((sum, c) => sum + ((c.unread_counts || {})[profileId] || 0), 0);
      setTotalUnread(unread);
      return updated;
    });
  }, [profileId]);

  const refresh = useCallback(async () => {
    if (!profileId) return;
    const convs = await conversationService.getConversationsForUser(profileId);
    setConversations(convs);
    const unread = convs.reduce((sum, c) => sum + ((c.unread_counts || {})[profileId] || 0), 0);
    setTotalUnread(unread);
  }, [profileId]);

  const value = useMemo(() => ({
    conversations,
    totalUnread,
    loading,
    initialized,
    registerConversationListener,
    setTyping,
    getTypingUsers,
    resetUnread,
    refresh,
  }), [
    conversations, totalUnread, loading, initialized,
    registerConversationListener, setTyping, getTypingUsers, resetUnread, refresh,
  ]);

  return (
    <MessagingContext.Provider value={value}>
      {children}
    </MessagingContext.Provider>
  );
}

export function useMessagingStore() {
  const ctx = useContext(MessagingContext);
  if (!ctx) return {
    conversations: [],
    totalUnread: 0,
    loading: false,
    initialized: false,
    registerConversationListener: () => () => {},
    setTyping: () => {},
    getTypingUsers: () => [],
    resetUnread: () => {},
    refresh: () => Promise.resolve(),
  };
  return ctx;
}