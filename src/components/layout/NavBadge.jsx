/**
 * NavBadge — Notification dot/count for nav items
 * Connects to notification store
 */
import { useNotifications } from '@/hooks/useNotifications';

export default function NavBadge({ type }) {
  const { unreadCount } = useNotifications();

  if (type !== 'notifications' || unreadCount === 0) return null;

  return (
    <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-0.5 bg-destructive text-destructive-foreground text-[9px] font-bold rounded-full flex items-center justify-center leading-none">
      {unreadCount > 99 ? '99+' : unreadCount}
    </span>
  );
}