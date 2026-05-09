/**
 * RightPanel — Desktop utility sidebar
 * Trending topics, suggested users, quick stats
 */
import TrendingTopics from '@/components/feed/TrendingTopics';
import SuggestedUsers from '@/components/social/SuggestedUsers';
import ActiveGroups from '@/components/groups/ActiveGroups';
import ErrorBoundary from '@/lib/errors/ErrorBoundary';

export default function RightPanel() {
  return (
    <div className="flex flex-col h-full bg-background overflow-y-auto scrollbar-hide p-4 space-y-4">
      <ErrorBoundary inline><TrendingTopics /></ErrorBoundary>
      <ErrorBoundary inline><SuggestedUsers /></ErrorBoundary>
      <ErrorBoundary inline><ActiveGroups /></ErrorBoundary>
    </div>
  );
}