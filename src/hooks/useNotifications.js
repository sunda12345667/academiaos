/**
 * useNotifications Hook
 * 
 * Real-time notification badge + feed.
 */

import { useState, useEffect } from 'react';
import notificationService from '@/services/notifications/notification.service';

export function useNotifications(userId) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    loadNotifications();

    // Real-time subscription
    const unsubscribe = notificationService.subscribeToNotifications(userId, (newNotification) => {
      setNotifications(prev => [newNotification, ...prev]);
      setUnreadCount(prev => prev + 1);
    });

    return unsubscribe;
  }, [userId]);

  async function loadNotifications() {
    setLoading(true);
    const { notifications: notifs } = await notificationService.getNotifications(userId);
    setNotifications(notifs);
    setUnreadCount(notifs.filter(n => !n.is_read).length);
    setLoading(false);
  }

  async function markRead(notificationId) {
    await notificationService.markAsRead(notificationId);
    setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
  }

  async function markAllRead() {
    await notificationService.markAllAsRead(userId);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
  }

  return { notifications, unreadCount, loading, markRead, markAllRead, refresh: loadNotifications };
}

export default useNotifications;