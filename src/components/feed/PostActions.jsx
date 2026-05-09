/**
 * PostActions — Like/Comment/Share/Save bar
 * Optimistic UI: updates instantly, syncs server-side
 */
import { useState } from 'react';
import { Heart, MessageCircle, Share2, Bookmark } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';
import postService from '@/services/social/post.service';
import { useCurrentUser } from '@/hooks/useCurrentUser';

export default function PostActions({ post }) {
  const { profile } = useCurrentUser();
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [likeCount, setLikeCount] = useState(post.like_count || 0);

  async function handleLike() {
    if (!profile) return;
    const next = !liked;
    setLiked(next);
    setLikeCount(c => next ? c + 1 : Math.max(0, c - 1));
    try {
      await postService.toggleLike(post.id, profile.id);
    } catch {
      // Rollback on error
      setLiked(!next);
      setLikeCount(c => next ? Math.max(0, c - 1) : c + 1);
    }
  }

  async function handleSave() {
    if (!profile) return;
    setSaved(s => !s);
    postService.toggleSave(post.id, profile.id).catch(() => setSaved(s => !s));
  }

  const commentCount = post.comment_count || 0;
  const shareCount = post.share_count || 0;

  return (
    <div className="flex items-center justify-between px-4 py-2.5 border-t border-border/40 mt-1">
      <div className="flex items-center gap-4">
        {/* Like */}
        <button
          onClick={handleLike}
          className={cn(
            'flex items-center gap-1.5 text-sm transition-all duration-150',
            liked ? 'text-rose-500' : 'text-muted-foreground hover:text-rose-500'
          )}
        >
          <Heart
            className={cn('w-4.5 h-4.5 transition-transform', liked && 'scale-110')}
            fill={liked ? 'currentColor' : 'none'}
            strokeWidth={liked ? 0 : 2}
          />
          <span className="text-xs font-medium">{likeCount > 0 ? likeCount : ''}</span>
        </button>

        {/* Comment */}
        <Link
          to={`/post/${post.id}`}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
        >
          <MessageCircle className="w-4.5 h-4.5" strokeWidth={1.8} />
          <span className="text-xs font-medium">{commentCount > 0 ? commentCount : ''}</span>
        </Link>

        {/* Share */}
        <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors">
          <Share2 className="w-4.5 h-4.5" strokeWidth={1.8} />
          <span className="text-xs font-medium">{shareCount > 0 ? shareCount : ''}</span>
        </button>
      </div>

      {/* Save */}
      <button
        onClick={handleSave}
        className={cn(
          'transition-colors',
          saved ? 'text-primary' : 'text-muted-foreground hover:text-primary'
        )}
      >
        <Bookmark
          className="w-4.5 h-4.5"
          fill={saved ? 'currentColor' : 'none'}
          strokeWidth={saved ? 0 : 1.8}
        />
      </button>
    </div>
  );
}