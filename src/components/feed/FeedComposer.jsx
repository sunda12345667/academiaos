/**
 * FeedComposer — Quick post creation entry on feed
 * Expands into full composer modal
 */
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Image, Video, FileText, HelpCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const QUICK_ACTIONS = [
  { icon: Image, label: 'Photo', type: 'image' },
  { icon: Video, label: 'Video', type: 'video' },
  { icon: FileText, label: 'Article', type: 'article' },
  { icon: HelpCircle, label: 'Question', type: 'question' },
];

export default function FeedComposer() {
  const { profile } = useCurrentUser();
  const navigate = useNavigate();

  if (!profile) return null;

  return (
    <div className="feed-card mx-4 my-3 p-4">
      <div className="flex items-center gap-3 mb-3">
        <Avatar className="w-9 h-9 flex-shrink-0">
          <AvatarImage src={profile.avatar_url} />
          <AvatarFallback className="bg-primary/10 text-primary font-semibold text-sm">
            {profile.display_name?.[0] || '?'}
          </AvatarFallback>
        </Avatar>
        <button
          onClick={() => navigate('/create')}
          className="flex-1 text-left px-4 py-2 bg-muted/60 hover:bg-muted rounded-full text-sm text-muted-foreground transition-colors"
        >
          What's on your mind, {profile.display_name?.split(' ')[0]}?
        </button>
      </div>
      <div className="flex items-center justify-around border-t border-border/40 pt-2">
        {QUICK_ACTIONS.map(({ icon: Icon, label, type }) => (
          <button
            key={type}
            onClick={() => navigate(`/create?type=${type}`)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-150"
          >
            <Icon className="w-4 h-4" />
            <span className="hidden sm:inline text-xs font-medium">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}