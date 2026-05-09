/**
 * PostCardSkeleton — Loading placeholder for feed cards
 * Matches exact PostCard dimensions to prevent layout shift
 */
import { Skeleton } from '@/components/ui/skeleton';

export default function PostCardSkeleton() {
  return (
    <div className="feed-card mx-4 my-3 p-4 space-y-3">
      <div className="flex items-center gap-3">
        <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-3.5 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-4/5" />
      <Skeleton className="h-4 w-3/5" />
      <Skeleton className="h-48 w-full rounded-xl" />
      <div className="flex gap-4 pt-1">
        <Skeleton className="h-7 w-16 rounded-lg" />
        <Skeleton className="h-7 w-16 rounded-lg" />
        <Skeleton className="h-7 w-16 rounded-lg" />
      </div>
    </div>
  );
}