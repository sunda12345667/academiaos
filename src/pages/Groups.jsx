/**
 * Groups — Community discovery and management hub
 */
import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { Search, Users, Lock, Globe, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

const TYPES = ['All', 'Study', 'Department', 'Course', 'Community', 'Club'];

export default function Groups() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeType, setActiveType] = useState('All');

  useEffect(() => {
    base44.entities.Group.filter({ status: 'active' }, '-member_count', 30)
      .then(setGroups)
      .finally(() => setLoading(false));
  }, []);

  const filtered = groups.filter(g => {
    const matchSearch = !search || g.name.toLowerCase().includes(search.toLowerCase());
    const typeMap = { Study: 'study_group', Department: 'department', Course: 'course', Community: 'community', Club: 'school_club' };
    const matchType = activeType === 'All' || g.type === typeMap[activeType];
    return matchSearch && matchType;
  });

  return (
    <div className="max-w-2xl mx-auto w-full p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-jakarta font-bold text-2xl text-foreground">Groups</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Join communities, study together</p>
        </div>
        <Button size="sm" className="gap-1.5">
          <Plus className="w-4 h-4" /> Create
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search groups..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
        {TYPES.map(t => (
          <button key={t} onClick={() => setActiveType(t)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${activeType === t ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array(5).fill(0).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3 feed-card">
              <Skeleton className="w-12 h-12 rounded-xl flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(g => <GroupCard key={g.id} group={g} />)}
          {filtered.length === 0 && (
            <div className="text-center py-16">
              <Users className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">No groups found</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function GroupCard({ group }) {
  const PrivacyIcon = group.privacy === 'public' ? Globe : Lock;
  return (
    <Link to={`/groups/${group.id}`} className="flex items-center gap-3 p-3 feed-card group">
      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
        {group.avatar_url
          ? <img src={group.avatar_url} alt={group.name} className="w-full h-full object-cover" />
          : <Users className="w-6 h-6 text-primary" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <h3 className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors truncate">{group.name}</h3>
          <PrivacyIcon className="w-3 h-3 text-muted-foreground flex-shrink-0" />
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{group.description}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{group.member_count?.toLocaleString()} members</p>
      </div>
      <Button variant="outline" size="sm" className="flex-shrink-0 text-xs">Join</Button>
    </Link>
  );
}