/**
 * NotificationProvider — Centralized notification state + realtime
 *
 * Architecture:
 * - Single source of truth for unread count + notification list
 * - ONE subscription via RealtimeBus (not per-component)
 * - Stable context value via useMemo to prevent cascade rerenders
 * - Accessible via useNotificationStore() hook
 *
 * This replaces per-component useNotifications() subscriptions.
 */
import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import RealtimeBus from '@/lib/realtime/RealtimeBus';
import notificationService from '@/services/notifications/notification.service';

const NotificationContext = createContext(null);

export function NotificationProvider({ profileId, children }) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Initial load
  useEffect(() => {
    if (!profileId) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const { notifications: notifs } = await notificationService.getNotifications(profileId);
        if (cancelled) return;
        setNotifications(notifs);
        setUnreadCount(notifs.filter(n => !n.is_read).length);
        setInitialized(true);
      } catch (e) {
        console.warn('[NotificationProvider] load error', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [profileId]);

  // Single realtime subscription via the shared bus
  useEffect(() => {
    if (!profileId) return;

    return RealtimeBus.subscribe('Notification', 'create', (event) => {
      if (event.data?.recipient_id !== profileId) return;
      setNotifications(prev => {
        // Deduplicate by ID
        if (prev.some(n => n.id === event.data.id)) return prev;
        return [event.data, ...prev];
      });
      setUnreadCount(prev => prev + 1);
    });
  }, [profileId]);

  const markRead = useCallback(async (notificationId) => {
    // Optimistic
    setNotifications(prev =>
      prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
    try {
      await notificationService.markAsRead(notificationId);
    } catch {
      // Revert
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, is_read: false } : n)
      );
      setUnreadCount(prev => prev + 1);
    }
  }, []);

  const markAllRead = useCallback(async () => {
    const prevNotifications = notifications;
    const prevCount = unreadCount;
    // Optimistic
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
    try {
      await notificationService.markAllAsRead(profileId);
    } catch {
      setNotifications(prevNotifications);
      setUnreadCount(prevCount);
    }
  }, [profileId, notifications, unreadCount]);

  const refresh = useCallback(async () => {
    if (!profileId) return;
    const { notifications: notifs } = await notificationService.getNotifications(profileId);
    setNotifications(notifs);
    setUnreadCount(notifs.filter(n => !n.is_read).length);
  }, [profileId]);

  // Stable value object — only changes when data changes, not on every render
  const value = useMemo(() => ({
    notifications,
    unreadCount,
    loading,
    initialized,
    markRead,
    markAllRead,
    refresh,
  }), [notifications, unreadCount, loading, initialized, markRead, markAllRead, refresh]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotificationStore() {
  const ctx = useContext(NotificationContext);
  // Safe fallback — returns zero state if used outside provider (e.g., during Suspense)
  if (!ctx) return {
    notifications: [],
    unreadCount: 0,
    loading: false,
    initialized: false,
    markRead: () => {},
    markAllRead: () => {},
    refresh: () => {},
  };
  return ctx;
}