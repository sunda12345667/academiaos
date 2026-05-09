/**
 * PostCardMedia — Handles image grids, video previews
 * Lazy loads, aspect-ratio locked, tap-to-expand ready
 */
import { useState } from 'react';
import { Play } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function PostCardMedia({ mediaUrls, type, thumbnailUrl }) {
  const [imgErrors, setImgErrors] = useState({});
  const count = mediaUrls.length;

  if (type === 'video' || type === 'short_video') {
    return (
      <div className="relative w-full bg-black overflow-hidden" style={{ aspectRatio: type === 'short_video' ? '9/16' : '16/9', maxHeight: type === 'short_video' ? '480px' : 'auto' }}>
        <img
          src={thumbnailUrl || mediaUrls[0]}
          alt="Video thumbnail"
          className="w-full h-full object-cover"
          loading="lazy"
        />
        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
          <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30">
            <Play className="w-6 h-6 text-white fill-white ml-1" />
          </div>
        </div>
      </div>
    );
  }

  // Image grid layouts
  const gridClass = {
    1: 'grid-cols-1',
    2: 'grid-cols-2',
    3: 'grid-cols-2',
    4: 'grid-cols-2',
  }[Math.min(count, 4)] || 'grid-cols-2';

  return (
    <div className={cn('grid gap-0.5 overflow-hidden', count === 1 ? '' : 'rounded-none', gridClass)}>
      {mediaUrls.slice(0, 4).map((url, i) => {
        const isLast = i === 3 && count > 4;
        const spanFull = count === 3 && i === 0;
        return (
          <div
            key={i}
            className={cn(
              'relative overflow-hidden bg-muted',
              spanFull && 'col-span-2',
              count === 1 ? 'max-h-[400px]' : 'aspect-square'
            )}
          >
            {!imgErrors[i] ? (
              <img
                src={url}
                alt=""
                className="w-full h-full object-cover"
                loading="lazy"
                onError={() => setImgErrors(e => ({ ...e, [i]: true }))}
              />
            ) : (
              <div className="w-full h-full bg-muted flex items-center justify-center text-muted-foreground text-xs">
                Image unavailable
              </div>
            )}
            {isLast && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                <span className="text-white font-bold text-xl">+{count - 3}</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}