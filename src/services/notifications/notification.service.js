/**
 * Notification Service
 * 
 * Centralized notification dispatch with preference checking.
 * 
 * Migration note: Becomes a NestJS NotificationsModule backed by
 * a dedicated notifications table + Redis pub/sub for realtime delivery.
 * Push notifications via Firebase Cloud Messaging (FCM) on mobile.
 */

import { base44 } from '@/api/base44Client';

/**
 * Create a notification record
 * All notification creation flows through this function
 */
async function createNotification(data) {
  // Deduplicate: don't spam the same notification type within 60s
  // Future: Redis-based deduplication with TTL
  const recentCheck = await base44.entities.Notification.filter({
    recipient_id: data.recipient_id,
    actor_id: data.actor_id,
    type: data.type,
    entity_id: data.entity_id,
  });

  if (recentCheck.length) {
    const last = recentCheck[recentCheck.length - 1];
    const ageSeconds = (Date.now() - new Date(last.created_date).getTime()) / 1000;
    if (ageSeconds < 60) return null; // Deduplicated
  }

  const notification = await base44.entities.Notification.create({
    is_read: false,
    is_pushed: false,
    ...data,
  });

  return notification;
}

/**
 * Get unread notifications for a user
 */
async function getUnreadNotifications(userId, { limit = 20 } = {}) {
  const notifications = await base44.entities.Notification.filter(
    { recipient_id: userId, is_read: false },
    '-created_date',
    limit
  );
  return notifications;
}

/**
 * Get all notifications for a user (paginated)
 */
async function getNotifications(userId, { page = 1, limit = 20 } = {}) {
  const notifications = await base44.entities.Notification.filter(
    { recipient_id: userId },
    '-created_date',
    limit
  );
  return { notifications, hasMore: notifications.length === limit, page };
}

/**
 * Mark a notification as read
 */
async function markAsRead(notificationId) {
  await base44.entities.Notification.update(notificationId, { is_read: true });
}

/**
 * Mark all notifications as read for a user
 */
async function markAllAsRead(userId) {
  const unread = await base44.entities.Notification.filter({
    recipient_id: userId,
    is_read: false,
  });
  await Promise.all(unread.map(n => base44.entities.Notification.update(n.id, { is_read: true })));
}

/**
 * Get unread notification count
 */
async function getUnreadCount(userId) {
  const unread = await base44.entities.Notification.filter({
    recipient_id: userId,
    is_read: false,
  });
  return unread.length;
}

export default {
  createNotification,
  getUnreadNotifications,
  getNotifications,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
  // NOTE: Realtime subscription is handled exclusively via RealtimeBus in NotificationProvider.
  // Do NOT add raw base44.entities.Notification.subscribe() calls anywhere in the app.
};