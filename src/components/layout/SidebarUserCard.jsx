/**
 * SidebarUserCard — Compact user identity footer in sidebar
 */
import { Link } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { CheckCircle2 } from 'lucide-react';

export default function SidebarUserCard({ profile }) {
  const initials = profile.display_name
    ?.split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || '?';

  return (
    <Link to="/profile" className="flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-sidebar-accent transition-colors mt-2">
      <Avatar className="w-8 h-8 flex-shrink-0">
        <AvatarImage src={profile.avatar_url} />
        <AvatarFallback className="text-xs bg-primary/20 text-primary font-semibold">
          {initials}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <p className="text-xs font-semibold text-sidebar-foreground truncate">
            {profile.display_name}
          </p>
          {profile.verification_status === 'id_verified' && (
            <CheckCircle2 className="w-3 h-3 text-sidebar-primary flex-shrink-0" />
          )}
        </div>
        <p className="text-[10px] text-sidebar-foreground/50 truncate">@{profile.username}</p>
      </div>
    </Link>
  );
}