/**
 * PostCard — Core feed content unit
 * Handles all post types: text, image, video, poll, question, resource
 * Optimistic interaction updates, permission-aware actions
 */
import { useState, memo } from 'react';
import { Link } from 'react-router-dom';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import postService from '@/services/social/post.service';
import PostCardHeader from './PostCardHeader';
import PostCardMedia from './PostCardMedia';
import PostCardActions from './PostCardActions';
import PostCardPoll from './PostCardPoll';

const PostCard = memo(function PostCard({ post, onUpdate }) {
  const { profile } = useCurrentUser();
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [likeCount, setLikeCount] = useState(post.like_count || 0);

  async function handleLike() {
    if (!profile) return;
    // Optimistic update
    const wasLiked = liked;
    setLiked(!liked);
    setLikeCount(c => wasLiked ? c - 1 : c + 1);

    try {
      const result = await postService.toggleLike(post.id, profile.id);
      setLiked(result.liked);
      setLikeCount(result.likeCount);
      onUpdate?.(post.id, { like_count: result.likeCount });
    } catch {
      // Revert on error
      setLiked(wasLiked);
      setLikeCount(c => wasLiked ? c + 1 : c - 1);
    }
  }

  async function handleSave() {
    if (!profile) return;
    setSaved(s => !s);
    try {
      await postService.toggleSave(post.id, profile.id);
    } catch {
      setSaved(s => !s);
    }
  }

  return (
    <article className="feed-card mx-4 my-3 overflow-hidden">
      <PostCardHeader post={post} currentProfile={profile} />

      {/* Text content */}
      {post.content && (
        <div className="px-4 pb-2">
          <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap line-clamp-4">
            {post.content}
          </p>
        </div>
      )}

      {/* Media */}
      {post.media_urls?.length > 0 && (
        <PostCardMedia mediaUrls={post.media_urls} type={post.type} thumbnailUrl={post.thumbnail_url} />
      )}

      {/* Poll */}
      {post.type === 'poll' && post.poll_options && (
        <div className="px-4 pb-3">
          <PostCardPoll post={post} profile={profile} />
        </div>
      )}

      {/* Tags */}
      {post.tags?.length > 0 && (
        <div className="px-4 pb-2 flex flex-wrap gap-1.5">
          {post.tags.slice(0, 4).map(tag => (
            <Link
              key={tag}
              to={`/search?tag=${tag}`}
              className="text-xs text-primary font-medium hover:underline"
            >
              #{tag}
            </Link>
          ))}
        </div>
      )}

      <PostCardActions
        post={post}
        liked={liked}
        saved={saved}
        likeCount={likeCount}
        onLike={handleLike}
        onSave={handleSave}
      />
    </article>
  );
});

export default PostCard;