import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { FileText } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';

export default function AdminAuditLog() {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['admin-audit'],
    queryFn: () => base44.entities.AdminAuditLog.list('-created_date', 100),
  });

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold font-jakarta">Audit Log</h1>
        <p className="text-sm text-muted-foreground mt-1">Immutable record of all admin actions</p>
      </div>

      <div className="bg-white rounded-2xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 border-b border-border">
            <tr>
              {['Time', 'Actor', 'Action', 'Entity', 'Sensitive'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              [1,2,3,4,5].map(i => (
                <tr key={i}><td colSpan={5} className="px-4 py-3"><Skeleton className="h-6 w-full" /></td></tr>
              ))
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-12">
                  <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground">No audit logs yet</p>
                </td>
              </tr>
            ) : logs.map(log => (
              <tr key={log.id} className="hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                  {log.created_date ? format(new Date(log.created_date), 'MMM d, HH:mm') : '—'}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{log.actor_id?.slice(0,8)}…</td>
                <td className="px-4 py-3 font-medium text-foreground capitalize">{log.action?.replace(/_/g, ' ')}</td>
                <td className="px-4 py-3 text-muted-foreground capitalize">{log.entity_type} · {log.entity_id?.slice(0,8)}…</td>
                <td className="px-4 py-3">
                  {log.is_sensitive
                    ? <span className="text-xs font-bold text-destructive">⚠ Sensitive</span>
                    : <span className="text-xs text-muted-foreground">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}