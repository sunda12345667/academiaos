/**
 * Search — Global search with tab results
 */
import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Search as SearchIcon, Users, BookOpen, Hash } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Link } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useDebouncedCallback } from '@/hooks/useDebounce';

const TABS = ['All', 'People', 'Groups', 'Courses'];

export default function Search() {
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState('All');
  const [results, setResults] = useState({ users: [], groups: [], courses: [] });
  const [loading, setLoading] = useState(false);

  const doSearch = useCallback(async (q) => {
    if (!q.trim()) { setResults({ users: [], groups: [], courses: [] }); return; }
    setLoading(true);
    const [users, groups, courses] = await Promise.all([
      tab === 'Groups' || tab === 'Courses' ? [] : base44.entities.UserProfile.filter({ username: q }, '-follower_count', 5).catch(() => []),
      tab === 'People' || tab === 'Courses' ? [] : base44.entities.Group.filter({ status: 'active' }, '-member_count', 5).catch(() => []),
      tab === 'People' || tab === 'Groups' ? [] : base44.entities.Course.filter({ status: 'published' }, '-enrollment_count', 5).catch(() => []),
    ]);
    setResults({ users, groups, courses });
    setLoading(false);
  }, [tab]);

  const debouncedSearch = useDebouncedCallback(doSearch, 350);

  useEffect(() => { debouncedSearch(query); }, [query, tab]);

  const hasResults = results.users.length + results.groups.length + results.courses.length > 0;

  return (
    <div className="max-w-2xl mx-auto w-full pb-20 lg:pb-6">
      <div className="px-4 pt-4 pb-2 sticky top-0 bg-background/95 backdrop-blur-sm z-20">
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            autoFocus
            placeholder="Search people, groups, courses..."
            className="pl-9"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-1 mt-3 overflow-x-auto scrollbar-hide pb-1">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={cn('flex-shrink-0 text-xs font-medium px-3 py-1.5 rounded-full transition-colors',
                tab === t ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              )}
            >{t}</button>
          ))}
        </div>
      </div>

      <div className="px-4 space-y-4">
        {loading && (
          <div className="space-y-3 mt-2">
            {Array(4).fill(0).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="w-10 h-10 rounded-full" />
                <div className="space-y-1.5"><Skeleton className="h-3 w-28" /><Skeleton className="h-2.5 w-20" /></div>
              </div>
            ))}
          </div>
        )}

        {!loading && query && !hasResults && (
          <p className="text-center text-sm text-muted-foreground py-12">No results for "{query}"</p>
        )}

        {/* Users */}
        {results.users.length > 0 && (
          <section>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">People</h3>
            <div className="space-y-2">
              {results.users.map(u => (
                <Link key={u.id} to={`/profile/${u.username}`} className="flex items-center gap-3 p-2 rounded-xl hover:bg-muted transition-colors">
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={u.avatar_url} />
                    <AvatarFallback className="text-xs font-bold bg-primary/10 text-primary">{u.display_name?.[0]}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{u.display_name}</p>
                    <p className="text-xs text-muted-foreground">@{u.username} · {u.follower_count?.toLocaleString()} followers</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Groups */}
        {results.groups.length > 0 && (
          <section>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Groups</h3>
            <div className="space-y-2">
              {results.groups.map(g => (
                <Link key={g.id} to={`/groups/${g.id}`} className="flex items-center gap-3 p-2 rounded-xl hover:bg-muted transition-colors">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Users className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{g.name}</p>
                    <p className="text-xs text-muted-foreground">{g.member_count?.toLocaleString()} members</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Courses */}
        {results.courses.length > 0 && (
          <section>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Courses</h3>
            <div className="space-y-2">
              {results.courses.map(c => (
                <Link key={c.id} to={`/learn/${c.id}`} className="flex items-center gap-3 p-2 rounded-xl hover:bg-muted transition-colors">
                  <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
                    <BookOpen className="w-4 h-4 text-accent" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{c.title}</p>
                    <p className="text-xs text-muted-foreground">{c.enrollment_count?.toLocaleString()} enrolled</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}