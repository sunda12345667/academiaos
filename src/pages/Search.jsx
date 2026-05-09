/**
 * Search Page — Intelligent Multi-Entity Search
 * Backed by search.service.js with relevance scoring + personalization.
 */
import { useState } from 'react';
import { useSearch } from '@/hooks/useSearch';
import { Search as SearchIcon, Users, BookOpen, Hash, TrendingUp, Flame, Star } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Link } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const TABS = ['All', 'People', 'Groups', 'Courses', 'Posts'];

const TAB_KEYS = {
  All:     ['users', 'courses', 'groups', 'posts'],
  People:  ['users'],
  Groups:  ['groups'],
  Courses: ['courses'],
  Posts:   ['posts'],
};

export default function Search() {
  const [tab, setTab] = useState('All');
  const { query, setQuery, results, loading, trending, hasResults, semanticSuggestion, trackResultClick } = useSearch({
    tabs: TAB_KEYS[tab],
  });

  const showTrending = !query && trending.length > 0;

  return (
    <div className="max-w-2xl mx-auto w-full pb-20 lg:pb-6">
      {/* Sticky search bar + tabs */}
      <div className="px-4 pt-4 pb-2 sticky top-0 bg-background/95 backdrop-blur-sm z-20">
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            autoFocus
            placeholder="Search people, courses, groups, posts..."
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

      <div className="px-4 space-y-5">
        {/* Trending searches */}
        {showTrending && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Flame className="w-4 h-4 text-brand-rose" />
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Trending Searches</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {trending.map(({ query: q }) => (
                <button key={q} onClick={() => setQuery(q)}
                  className="text-xs bg-secondary text-secondary-foreground px-3 py-1.5 rounded-full hover:bg-primary/10 hover:text-primary transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Loading skeletons */}
        {loading && (
          <div className="space-y-3 mt-2">
            {Array(5).fill(0).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />
                <div className="space-y-1.5 flex-1">
                  <Skeleton className="h-3.5 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* No results */}
        {!loading && query && !hasResults && (
          <div className="text-center py-10">
            <SearchIcon className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No results for "{query}"</p>
            {semanticSuggestion?.answer && (
              <div className="mt-4 text-left p-4 bg-primary/5 rounded-xl border border-primary/10">
                <p className="text-xs font-semibold text-primary mb-1 flex items-center gap-1">
                  <Star className="w-3 h-3" /> AI Suggestion
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">{semanticSuggestion.answer}</p>
              </div>
            )}
          </div>
        )}

        {/* Users */}
        {results.users?.length > 0 && (
          <ResultSection title="People" icon={Users}>
            {results.users.map(u => (
              <Link key={u.id} to={`/profile/${u.username}`}
                onClick={() => trackResultClick('user', u.id)}
                className="flex items-center gap-3 p-2 rounded-xl hover:bg-muted transition-colors"
              >
                <Avatar className="w-10 h-10 flex-shrink-0">
                  <AvatarImage src={u.avatar_url} />
                  <AvatarFallback className="text-xs font-bold bg-primary/10 text-primary">{u.display_name?.[0]}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-semibold text-foreground truncate">{u.display_name}</p>
                    {u.verification_status === 'verified' && <span className="text-primary text-xs">✓</span>}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">@{u.username} · {(u.follower_count || 0).toLocaleString()} followers</p>
                </div>
                <Badge variant="outline" className="text-[10px] capitalize flex-shrink-0">{u.role}</Badge>
              </Link>
            ))}
          </ResultSection>
        )}

        {/* Courses */}
        {results.courses?.length > 0 && (
          <ResultSection title="Courses" icon={BookOpen}>
            {results.courses.map(c => (
              <Link key={c.id} to={`/learn`}
                onClick={() => trackResultClick('course', c.id)}
                className="flex items-center gap-3 p-2 rounded-xl hover:bg-muted transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
                  <BookOpen className="w-4 h-4 text-accent" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{c.title}</p>
                  <p className="text-xs text-muted-foreground">{(c.enrollment_count || 0).toLocaleString()} enrolled · {c.level || 'all levels'}</p>
                </div>
                {c.pricing_type === 'free' && (
                  <Badge className="text-[10px] bg-emerald-500/10 text-emerald-600 border-0 flex-shrink-0">Free</Badge>
                )}
              </Link>
            ))}
          </ResultSection>
        )}

        {/* Groups */}
        {results.groups?.length > 0 && (
          <ResultSection title="Groups" icon={Users}>
            {results.groups.map(g => (
              <Link key={g.id} to={`/groups`}
                onClick={() => trackResultClick('group', g.id)}
                className="flex items-center gap-3 p-2 rounded-xl hover:bg-muted transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Users className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{g.name}</p>
                  <p className="text-xs text-muted-foreground">{(g.member_count || 0).toLocaleString()} members · {g.type?.replace(/_/g,' ')}</p>
                </div>
              </Link>
            ))}
          </ResultSection>
        )}

        {/* Posts */}
        {results.posts?.length > 0 && (
          <ResultSection title="Posts" icon={Hash}>
            {results.posts.map(p => (
              <div key={p.id} className="p-3 rounded-xl hover:bg-muted transition-colors cursor-pointer"
                onClick={() => trackResultClick('post', p.id)}
              >
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-xs font-medium text-primary">@{p.author_username}</p>
                  {p.type && <Badge variant="outline" className="text-[9px] capitalize">{p.type.replace(/_/g,' ')}</Badge>}
                </div>
                <p className="text-sm text-foreground line-clamp-2">{p.content}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {(p.view_count || 0).toLocaleString()} views · {(p.like_count || 0).toLocaleString()} likes
                </p>
              </div>
            ))}
          </ResultSection>
        )}
      </div>
    </div>
  );
}

function ResultSection({ title, icon: Icon, children }) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-3.5 h-3.5 text-muted-foreground" />
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{title}</h3>
      </div>
      <div className="space-y-1">{children}</div>
    </section>
  );
}