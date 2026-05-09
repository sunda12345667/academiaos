/**
 * useNotifications — Thin hook that reads from NotificationProvider
 *
 * This hook no longer creates its own subscription or fetches data.
 * It simply reads from the centralized NotificationProvider.
 *
 * This means: NavBadge, notification pages, and any other consumer
 * all share the same data — no duplicate fetches or subscriptions.
 */
export { useNotificationStore as useNotifications } from '@/providers/NotificationProvider';
export default null;