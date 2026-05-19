import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

const STATUS_COLORS = {
  active: 'bg-emerald-100 text-emerald-700',
  suspended: 'bg-amber-100 text-amber-700',
  banned: 'bg-destructive/10 text-destructive',
  pending_verification: 'bg-secondary text-secondary-foreground',
};

export default function AdminUsers() {
  const [search, setSearch] = useState('');

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => base44.entities.UserProfile.list(),
  });

  const filtered = users.filter(u =>
    !search ||
    u.display_name?.toLowerCase().includes(search.toLowerCase()) ||
    u.role?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-jakarta">User Management</h1>
          <p className="text-sm text-muted-foreground mt-1">{users.length} total users</p>
        </div>
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search users..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 border-b border-border">
            <tr>
              {['User', 'Role', 'School', 'Level', 'Status', 'Verified'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              [1,2,3,4,5].map(i => (
                <tr key={i}><td colSpan={6} className="px-4 py-3"><Skeleton className="h-6 w-full" /></td></tr>
              ))
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">No users found</td></tr>
            ) : filtered.map(user => (
              <tr key={user.id} className="hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3 font-medium text-foreground">{user.display_name || '—'}</td>
                <td className="px-4 py-3 capitalize text-muted-foreground">{user.role}</td>
                <td className="px-4 py-3 text-muted-foreground">{user.school_id || '—'}</td>
                <td className="px-4 py-3 text-muted-foreground">{user.level || '—'}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_COLORS[user.status] || 'bg-secondary text-secondary-foreground'}`}>
                    {user.status || 'active'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {user.verified
                    ? <span className="text-xs text-emerald-600 font-medium">✓ Verified</span>
                    : <span className="text-xs text-muted-foreground">Unverified</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}