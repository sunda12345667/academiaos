/**
 * SuggestedUsers — Right panel widget
 * Future: powered by graph-based recommendations
 */
import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';

export default function SuggestedUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.entities.UserProfile.list('-created_date', 4)
      .then(setUsers)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="bg-card rounded-2xl border border-border/60 p-4">
      <h3 className="font-jakarta font-semibold text-sm text-foreground mb-3">People to follow</h3>
      <div className="space-y-3">
        {loading
          ? Array(3).fill(0).map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <Skeleton className="w-8 h-8 rounded-full" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-2.5 w-16" />
              </div>
            </div>
          ))
          : users.map(u => (
            <div key={u.id} className="flex items-center gap-2">
              <Link to={`/profile/${u.username}`}>
                <Avatar className="w-8 h-8">
                  <AvatarImage src={u.avatar_url} />
                  <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">
                    {u.display_name?.[0] || '?'}
                  </AvatarFallback>
                </Avatar>
              </Link>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground truncate">{u.display_name}</p>
                <p className="text-[10px] text-muted-foreground">@{u.username}</p>
              </div>
              <Button variant="outline" size="sm" className="h-6 text-xs px-2 flex-shrink-0">
                Follow
              </Button>
            </div>
          ))
        }
      </div>
    </div>
  );
}