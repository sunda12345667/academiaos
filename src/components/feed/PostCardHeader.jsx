/**
 * PostCardHeader — Author info + timestamp + action menu
 */
import { Link } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import PostActionMenu from './PostActionMenu';
import { CheckCircle2, Globe, Users, Lock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const ROLE_BADGE = {
  educator: { label: 'Educator', class: 'bg-brand-emerald/10 text-brand-emerald border-brand-emerald/20' },
  creator: { label: 'Creator', class: 'bg-brand-violet/10 text-brand-violet border-brand-violet/20' },
  school_admin: { label: 'Admin', class: 'bg-brand-amber/10 text-brand-amber border-brand-amber/20' },
};

const VISIBILITY_ICON = {
  public: Globe,
  group: Users,
  private: Lock,
  followers: Users,
};

export default function PostCardHeader({ post, currentProfile }) {
  const badge = ROLE_BADGE[post.author_role];
  const VisIcon = VISIBILITY_ICON[post.visibility] || Globe;
  const timeAgo = post.created_date
    ? formatDistanceToNow(new Date(post.created_date), { addSuffix: true })
    : '';

  return (
    <div className="flex items-start justify-between px-4 pt-4 pb-3">
      <Link to={`/profile/${post.author_username}`} className="flex items-center gap-3 group">
        <Avatar className="w-10 h-10 flex-shrink-0">
          <AvatarImage src={post.author_avatar_url} />
          <AvatarFallback className="bg-primary/10 text-primary font-semibold text-sm">
            {post.author_display_name?.[0] || '?'}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors truncate">
              {post.author_display_name}
            </span>
            {post.author_role && post.author_role !== 'student' && badge && (
              <Badge variant="outline" className={`text-[9px] px-1.5 py-0 h-4 font-semibold ${badge.class}`}>
                {badge.label}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1 mt-0.5">
            <span className="text-xs text-muted-foreground">@{post.author_username}</span>
            <span className="text-muted-foreground/40 text-xs">·</span>
            <span className="text-xs text-muted-foreground">{timeAgo}</span>
            <VisIcon className="w-3 h-3 text-muted-foreground/60 ml-0.5" />
          </div>
        </div>
      </Link>
      <PostActionMenu post={post} currentProfile={currentProfile} />
    </div>
  );
}