/**
 * PostCardPoll — Interactive poll renderer
 */
import { useState } from 'react';
import { cn } from '@/lib/utils';

export default function PostCardPoll({ post, profile }) {
  const [voted, setVoted] = useState(null);

  const total = post.poll_options?.reduce((s, o) => s + (o.votes || 0), 0) || 0;

  function handleVote(idx) {
    if (voted !== null || !profile) return;
    setVoted(idx);
    // Future: call postService.votePoll(post.id, idx, profile.id)
  }

  return (
    <div className="space-y-2">
      {post.poll_options?.map((opt, i) => {
        const pct = total > 0 ? Math.round(((opt.votes || 0) / total) * 100) : 0;
        const isVoted = voted === i;
        const showResults = voted !== null;

        return (
          <button
            key={i}
            onClick={() => handleVote(i)}
            disabled={voted !== null}
            className={cn(
              'w-full relative rounded-xl border px-4 py-2.5 text-left overflow-hidden transition-all duration-200',
              isVoted ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/50',
              voted !== null && 'cursor-default'
            )}
          >
            {showResults && (
              <div
                className={cn('absolute inset-0 transition-all duration-500', isVoted ? 'bg-primary/10' : 'bg-muted/40')}
                style={{ width: `${pct}%` }}
              />
            )}
            <div className="relative flex items-center justify-between">
              <span className={cn('text-sm font-medium', isVoted ? 'text-primary' : 'text-foreground')}>
                {opt.text}
              </span>
              {showResults && (
                <span className={cn('text-xs font-bold', isVoted ? 'text-primary' : 'text-muted-foreground')}>
                  {pct}%
                </span>
              )}
            </div>
          </button>
        );
      })}
      <p className="text-xs text-muted-foreground">{total} votes</p>
    </div>
  );
}