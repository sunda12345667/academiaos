/**
 * Home — Main feed page
 * TikTok-style algorithmic feed with tab switching
 */
import { useState } from 'react';
import { useFeed } from '@/hooks/useFeed';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import FeedContainer from '@/components/feed/FeedContainer';
import FeedComposer from '@/components/feed/FeedComposer';
import FeedTabs from '@/components/feed/FeedTabs';

export default function Home() {
  const [feedType, setFeedType] = useState('home');
  const { profile } = useCurrentUser();

  const { posts, loading, initialLoading, hasMore, loadMore, refresh, updatePostOptimistic } =
    useFeed(feedType, { userId: profile?.id });

  return (
    <div className="max-w-2xl mx-auto w-full">
      <FeedTabs active={feedType} onChange={(t) => { setFeedType(t); }} />
      <FeedComposer />
      <FeedContainer
        posts={posts}
        loading={loading}
        initialLoading={initialLoading}
        hasMore={hasMore}
        onLoadMore={loadMore}
        onPostUpdate={updatePostOptimistic}
        emptyMessage="Your feed is empty — follow people or explore trending content"
      />
    </div>
  );
}