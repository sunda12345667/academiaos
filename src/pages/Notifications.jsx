/**
 * Notifications — Notification center
 */
import { useNotificationStore } from '@/providers/NotificationProvider';
import { Link } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Bell, Heart, MessageCircle, UserPlus, Star, CheckCheck } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

const TYPE_ICON = {
  new_follower: { icon: UserPlus, color: 'bg-primary/10 text-primary' },
  post_like: { icon: Heart, color: 'bg-brand-rose/10 text-brand-rose' },
  post_comment: { icon: MessageCircle, color: 'bg-brand-violet/10 text-brand-violet' },
  comment_reply: { icon: MessageCircle, color: 'bg-brand-violet/10 text-brand-violet' },
  course_update: { icon: Star, color: 'bg-brand-amber/10 text-brand-amber' },
};

export default function Notifications() {
  const { notifications, loading, unreadCount, markRead, markAllRead } = useNotificationStore();

  return (
    <div className="max-w-2xl mx-auto w-full">
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm border-b border-border/40 px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="font-jakarta font-bold text-xl text-foreground">Notifications</h1>
          {unreadCount > 0 && <p className="text-xs text-muted-foreground">{unreadCount} unread</p>}
        </div>
        {unreadCount > 0 && (
          <Button variant="ghost" size="sm" onClick={markAllRead} className="gap-1.5 text-xs">
            <CheckCheck className="w-4 h-4" /> Mark all read
          </Button>
        )}
      </div>

      <div className="divide-y divide-border/40">
        {loading ? (
          Array(8).fill(0).map((_, i) => (
            <div key={i} className="flex items-start gap-3 p-4">
              <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-48" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          ))
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <Bell className="w-8 h-8 text-primary" />
            </div>
            <h3 className="font-jakarta font-bold text-lg text-foreground mb-2">All caught up!</h3>
            <p className="text-sm text-muted-foreground">Notifications will appear here when someone interacts with your content.</p>
          </div>
        ) : (
          notifications.map(n => <NotificationRow key={n.id} notification={n} onRead={markRead} />)
        )}
      </div>
    </div>
  );
}

function NotificationRow({ notification: n, onRead }) {
  const config = TYPE_ICON[n.type] || { icon: Bell, color: 'bg-muted text-muted-foreground' };
  const Icon = config.icon;

  return (
    <div
      onClick={() => !n.is_read && onRead(n.id)}
      className={cn(
        'flex items-start gap-3 p-4 cursor-pointer hover:bg-muted/40 transition-colors',
        !n.is_read && 'bg-primary/5'
      )}
    >
      <div className="relative flex-shrink-0">
        <Avatar className="w-10 h-10">
          <AvatarImage src={n.actor_avatar_url} />
          <AvatarFallback className="text-sm bg-muted">{n.actor_username?.[0]?.toUpperCase() || '?'}</AvatarFallback>
        </Avatar>
        <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center ${config.color}`}>
          <Icon className="w-2.5 h-2.5" />
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-foreground">
          <span className="font-semibold">@{n.actor_username}</span>{' '}
          {n.body || n.title}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {n.created_date ? formatDistanceToNow(new Date(n.created_date), { addSuffix: true }) : ''}
        </p>
      </div>
      {!n.is_read && (
        <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-2" />
      )}
    </div>
  );
}