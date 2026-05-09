/**
 * Profile — User profile page (own + others via /profile/:username)
 */
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { base44 } from '@/api/base44Client';
import { useFeed } from '@/hooks/useFeed';
import FeedContainer from '@/components/feed/FeedContainer';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle2, MapPin, Link2, GraduationCap, Grid3x3, List } from 'lucide-react';

export default function Profile() {
  const { username } = useParams();
  const { profile: currentProfile } = useCurrentUser();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('list');

  const isOwn = !username || username === currentProfile?.username;
  const targetProfile = isOwn ? currentProfile : profile;

  useEffect(() => {
    if (isOwn) { setLoading(false); return; }
    base44.entities.UserProfile.filter({ username })
      .then(results => setProfile(results[0] || null))
      .finally(() => setLoading(false));
  }, [username, isOwn]);

  const { posts, loading: feedLoading, initialLoading, hasMore, loadMore } =
    useFeed('profile', { userId: targetProfile?.id });

  if (loading) return <ProfileSkeleton />;
  if (!targetProfile) return (
    <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
      <p>User not found</p>
    </div>
  );

  const isVerified = targetProfile.verification_status === 'id_verified' || targetProfile.verification_status === 'educator_verified';

  return (
    <div className="max-w-2xl mx-auto w-full">
      {/* Cover */}
      <div className="relative h-36 bg-gradient-to-br from-primary/30 to-accent/30 overflow-hidden">
        {targetProfile.cover_url && (
          <img src={targetProfile.cover_url} alt="Cover" className="w-full h-full object-cover" />
        )}
      </div>

      {/* Profile header */}
      <div className="px-4 pb-4 border-b border-border/40">
        <div className="flex items-end justify-between -mt-10 mb-3">
          <Avatar className="w-20 h-20 border-4 border-background">
            <AvatarImage src={targetProfile.avatar_url} />
            <AvatarFallback className="bg-primary/20 text-primary font-bold text-2xl">
              {targetProfile.display_name?.[0] || '?'}
            </AvatarFallback>
          </Avatar>
          {isOwn ? (
            <Button variant="outline" size="sm">Edit Profile</Button>
          ) : (
            <Button size="sm" className="gap-1.5">Follow</Button>
          )}
        </div>

        <div className="space-y-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h1 className="font-jakarta font-bold text-xl text-foreground">{targetProfile.display_name}</h1>
            {isVerified && <CheckCircle2 className="w-5 h-5 text-primary" />}
            {targetProfile.role && targetProfile.role !== 'student' && (
              <Badge variant="secondary" className="text-xs capitalize">{targetProfile.role}</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">@{targetProfile.username}</p>
          {targetProfile.bio && <p className="text-sm text-foreground mt-2 leading-relaxed">{targetProfile.bio}</p>}

          <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
            {targetProfile.country && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{targetProfile.country}</span>}
            {targetProfile.social_links?.website && (
              <a href={targetProfile.social_links.website} className="flex items-center gap-1 text-primary hover:underline">
                <Link2 className="w-3 h-3" /> Website
              </a>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-6 mt-4">
          {[
            { label: 'Posts', value: targetProfile.post_count || 0 },
            { label: 'Followers', value: targetProfile.follower_count || 0 },
            { label: 'Following', value: targetProfile.following_count || 0 },
          ].map(({ label, value }) => (
            <div key={label} className="text-center">
              <p className="font-jakarta font-bold text-base text-foreground">{value.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Posts */}
      <FeedContainer
        posts={posts}
        loading={feedLoading}
        initialLoading={initialLoading}
        hasMore={hasMore}
        onLoadMore={loadMore}
        emptyMessage="No posts yet"
      />
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="max-w-2xl mx-auto w-full">
      <Skeleton className="h-36 w-full" />
      <div className="px-4 pt-2 space-y-3">
        <div className="flex items-end justify-between -mt-10 mb-3">
          <Skeleton className="w-20 h-20 rounded-full border-4 border-background" />
          <Skeleton className="h-8 w-24 rounded-lg" />
        </div>
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
      </div>
    </div>
  );
}