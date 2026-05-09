/**
 * Search — Intelligent multi-entity search powered by search.service.js
 * Personalization boost applied when taste profile is available.
 * Behavioral events fired for funnel analytics.
 */
import { useState, useEffect, useCallback } from 'react';
import { Search as SearchIcon, Users, BookOpen, Hash, Layers, Zap, TrendingUp } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Link } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useDebouncedCallback } from '@/hooks/useDebounce';
import searchService from '@/services/ai/search.service';
import BehavioralEvents from '@/services/analytics/behavioral.events';
import { usePersonalization } from '@/hooks/usePersonalization';

const TABS = [
  { key: 'All',       label: 'All',       icon: Layers },
  { key: 'People',    label: 'People',    icon: Users },
  { key: 'Courses',   label: 'Courses',   icon: BookOpen },
  { key: 'Groups',    label: 'Groups',    icon: Hash },
  { key: 'Creators',  label: 'Creators',  icon: Zap },
];

const TAB_ENTITY_MAP = {
  All:      ['users', 'courses', 'groups', 'creators'],
  People:   ['users'],
  Courses:  ['courses'],
  Groups:   ['groups'],
  Creators: ['creators'],
};

export default function Search() {
  const [query, setQuery]       = useState('');
  const [tab, setTab]           = useState('All');
  const [results, setResults]   = useState({});
  const [trending, setTrending] = useState([]);
  const [loading, setLoading]   = useState(false);
  const { tasteProfile }        = usePersonalization();

  // Load trending searches on mount
  useEffect(() => {
    const t = searchService.getTrendingSearches(6);
    setTrending(t.map(s => s.query));
  }, []);

  const doSearch = useCallback(async (q) => {
    if (!q.trim()) { setResults({}); return; }
    setLoading(true);
    searchService.recordSearch(q);
    BehavioralEvents.search.query(q, 0);

    const tabs = TAB_ENTITY_MAP[tab] || TAB_ENTITY_MAP.All;
    const res = await searchService.universalSearch(q, { tabs, tasteProfile, limit: 6 });

    const total = ['users', 'courses', 'groups', 'creators', 'posts']
      .reduce((s, k) => s + (res[k]?.length || 0), 0);
    BehavioralEvents.search.query(q, total);
    if (total === 0) BehavioralEvents.search.zeroResults(q);

    setResults(res);
    setLoading(false);
  }, [tab, tasteProfile]);

  const debouncedSearch = useDebouncedCallback(doSearch, 350);
  useEffect(() => { debouncedSearch(query); }, [query, tab]);

  const handleResultClick = (entityType, entityId) => {
    BehavioralEvents.search.resultClick(query, entityType, entityId);
  };

  const hasResults = ['users', 'courses', 'groups', 'creators', 'posts']
    .some(k => results[k]?.length > 0);

  return (
    <div className="max-w-2xl mx-auto w-full pb-20 lg:pb-6">
      {/* Sticky search bar */}
      <div className="px-4 pt-4 pb-2 sticky top-0 bg-background/95 backdrop-blur-sm z-20 space-y-3">
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            autoFocus
            placeholder="Search people, courses, groups, creators…"
            className="pl-9"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>

        {/* Tabs */}
        <div className="flex gap-1 overflow-x-auto scrollbar-hide pb-0.5">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setTab(key)}
              className={cn(
                'flex-shrink-0 flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full transition-colors',
                tab === key
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              )}
            >
              <Icon className="w-3 h-3" />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 space-y-5 mt-1">
        {/* Trending searches (empty state) */}
        {!query && trending.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <TrendingUp className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Trending</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {trending.map(q => (
                <button key={q} onClick={() => setQuery(q)}
                  className="text-xs px-3 py-1.5 rounded-full bg-secondary hover:bg-secondary/80 text-secondary-foreground transition-colors">
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="space-y-3">
            {Array(5).fill(0).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />
                <div className="space-y-1.5 flex-1">
                  <Skeleton className="h-3.5 w-36" />
                  <Skeleton className="h-2.5 w-24" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* No results */}
        {!loading && query && !hasResults && (
          <div className="text-center py-12">
            <p className="text-sm text-muted-foreground">No results for "{query}"</p>
            {results._semanticSuggestion && (
              <p className="text-xs text-muted-foreground/70 mt-2 max-w-xs mx-auto">
                {results._semanticSuggestion.answer}
              </p>
            )}
          </div>
        )}

        {/* People */}
        {!loading && results.users?.length > 0 && (
          <ResultSection title="People" icon={Users}>
            {results.users.map(u => (
              <Link key={u.id} to={`/profile/${u.username}`}
                onClick={() => handleResultClick('user', u.id)}
                className="flex items-center gap-3 p-2 rounded-xl hover:bg-muted transition-colors">
                <Avatar className="w-10 h-10 flex-shrink-0">
                  <AvatarImage src={u.avatar_url} />
                  <AvatarFallback className="text-xs font-bold bg-primary/10 text-primary">
                    {u.display_name?.[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{u.display_name}</p>
                  <p className="text-xs text-muted-foreground">@{u.username} · {u.follower_count?.toLocaleString() || 0} followers</p>
                </div>
                {u.verification_status === 'verified' && (
                  <span className="ml-auto text-xs text-primary font-medium">Verified</span>
                )}
              </Link>
            ))}
          </ResultSection>
        )}

        {/* Creators */}
        {!loading && results.creators?.length > 0 && (
          <ResultSection title="Creators" icon={Zap}>
            {results.creators.map(c => (
              <Link key={c.id} to={`/profile/${c.user_id}`}
                onClick={() => handleResultClick('creator', c.id)}
                className="flex items-center gap-3 p-2 rounded-xl hover:bg-muted transition-colors">
                <div className="w-10 h-10 rounded-xl gradient-brand flex items-center justify-center flex-shrink-0">
                  <Zap className="w-4 h-4 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{c.display_name}</p>
                  <p className="text-xs text-muted-foreground">{c.total_followers?.toLocaleString() || 0} followers
                    {c.tagline ? ` · ${c.tagline.slice(0, 30)}` : ''}
                  </p>
                </div>
              </Link>
            ))}
          </ResultSection>
        )}

        {/* Courses */}
        {!loading && results.courses?.length > 0 && (
          <ResultSection title="Courses" icon={BookOpen}>
            {results.courses.map(c => (
              <Link key={c.id} to={`/learn/${c.id}`}
                onClick={() => handleResultClick('course', c.id)}
                className="flex items-center gap-3 p-2 rounded-xl hover:bg-muted transition-colors">
                <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
                  <BookOpen className="w-4 h-4 text-accent" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{c.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.enrollment_count?.toLocaleString() || 0} enrolled
                    {c.pricing_type === 'free' ? ' · Free' : c.price ? ` · ₦${c.price?.toLocaleString()}` : ''}
                  </p>
                </div>
              </Link>
            ))}
          </ResultSection>
        )}

        {/* Groups */}
        {!loading && results.groups?.length > 0 && (
          <ResultSection title="Groups" icon={Hash}>
            {results.groups.map(g => (
              <Link key={g.id} to={`/groups/${g.id}`}
                onClick={() => handleResultClick('group', g.id)}
                className="flex items-center gap-3 p-2 rounded-xl hover:bg-muted transition-colors">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Hash className="w-4 h-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{g.name}</p>
                  <p className="text-xs text-muted-foreground">{g.member_count?.toLocaleString() || 0} members · {g.type?.replace(/_/g, ' ')}</p>
                </div>
              </Link>
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
      <div className="flex items-center gap-1.5 mb-2">
        <Icon className="w-3.5 h-3.5 text-muted-foreground" />
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{title}</h3>
      </div>
      <div className="space-y-1">{children}</div>
    </section>
  );
}