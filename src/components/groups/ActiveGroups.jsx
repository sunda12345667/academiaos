/**
 * ActiveGroups — Right panel widget showing joined groups
 */
import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { Users } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export default function ActiveGroups() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.entities.Group.filter({ status: 'active' }, '-member_count', 4)
      .then(setGroups)
      .finally(() => setLoading(false));
  }, []);

  if (!loading && groups.length === 0) return null;

  return (
    <div className="bg-card rounded-2xl border border-border/60 p-4">
      <h3 className="font-jakarta font-semibold text-sm text-foreground mb-3">Active Groups</h3>
      <div className="space-y-2">
        {loading
          ? Array(3).fill(0).map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <Skeleton className="w-7 h-7 rounded-lg" />
              <Skeleton className="h-3 w-32" />
            </div>
          ))
          : groups.map(g => (
            <Link
              key={g.id}
              to={`/groups/${g.id}`}
              className="flex items-center gap-2 py-1 group"
            >
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                {g.avatar_url
                  ? <img src={g.avatar_url} className="w-7 h-7 rounded-lg object-cover" alt={g.name} />
                  : <Users className="w-3.5 h-3.5 text-primary" />
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate group-hover:text-primary transition-colors">
                  {g.name}
                </p>
                <p className="text-[10px] text-muted-foreground">{g.member_count?.toLocaleString()} members</p>
              </div>
            </Link>
          ))
        }
      </div>
    </div>
  );
}