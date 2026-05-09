/**
 * PostCardActions — Like, Comment, Share, Save engagement bar
 * TikTok-inspired interaction density
 */
import { useState } from 'react';
import { Heart, MessageCircle, Share2, Bookmark, BarChart2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';

export default function PostCardActions({ post, liked, saved, likeCount, onLike, onSave }) {
  const [justLiked, setJustLiked] = useState(false);

  function handleLike() {
    setJustLiked(true);
    onLike();
    setTimeout(() => setJustLiked(false), 400);
  }

  return (
    <div className="flex items-center justify-between px-4 py-2.5 border-t border-border/40">
      <div className="flex items-center gap-1">
        {/* Like */}
        <button
          onClick={handleLike}
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 active:scale-95',
            liked
              ? 'text-brand-rose bg-brand-rose/10'
              : 'text-muted-foreground hover:text-brand-rose hover:bg-brand-rose/10'
          )}
        >
          <Heart
            className={cn('w-4.5 h-4.5 transition-all', liked && 'fill-current', justLiked && 'scale-125')}
            style={{ width: '18px', height: '18px' }}
          />
          <span className="text-xs">{likeCount > 0 ? likeCount : ''}</span>
        </button>

        {/* Comment */}
        <Link
          to={`/post/${post.id}`}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all duration-150"
        >
          <MessageCircle style={{ width: '18px', height: '18px' }} />
          <span className="text-xs">{post.comment_count > 0 ? post.comment_count : ''}</span>
        </Link>

        {/* Share */}
        <button className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all duration-150 active:scale-95">
          <Share2 style={{ width: '18px', height: '18px' }} />
          <span className="text-xs">{post.share_count > 0 ? post.share_count : ''}</span>
        </button>
      </div>

      <div className="flex items-center gap-1">
        {/* Views */}
        {post.view_count > 0 && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground/60 mr-1">
            <BarChart2 style={{ width: '13px', height: '13px' }} />
            {post.view_count >= 1000
              ? `${(post.view_count / 1000).toFixed(1)}k`
              : post.view_count}
          </span>
        )}
        {/* Save */}
        <button
          onClick={onSave}
          className={cn(
            'p-1.5 rounded-lg transition-all duration-150 active:scale-95',
            saved
              ? 'text-primary bg-primary/10'
              : 'text-muted-foreground hover:text-primary hover:bg-primary/10'
          )}
        >
          <Bookmark
            style={{ width: '18px', height: '18px' }}
            className={cn(saved && 'fill-current')}
          />
        </button>
      </div>
    </div>
  );
}