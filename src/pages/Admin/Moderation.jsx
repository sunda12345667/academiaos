import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

const SEVERITY_COLORS = {
  low: 'bg-secondary text-secondary-foreground',
  medium: 'bg-amber-100 text-amber-700',
  high: 'bg-orange-100 text-orange-700',
  critical: 'bg-destructive/10 text-destructive',
};

export default function AdminModeration() {
  const queryClient = useQueryClient();

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['admin-moderation'],
    queryFn: () => base44.entities.ModerationReport.list('-created_date', 50),
  });

  const resolveMutation = useMutation({
    mutationFn: (id) => base44.entities.ModerationReport.update(id, { status: 'resolved' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-moderation'] }),
  });

  const dismissMutation = useMutation({
    mutationFn: (id) => base44.entities.ModerationReport.update(id, { status: 'dismissed' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-moderation'] }),
  });

  const open = reports.filter(r => r.status === 'open' || r.status === 'pending');

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold font-jakarta">Moderation Queue</h1>
        <p className="text-sm text-muted-foreground mt-1">{open.length} open reports</p>
      </div>

      <div className="space-y-3">
        {isLoading ? (
          [1,2,3].map(i => <Skeleton key={i} className="h-20 w-full rounded-2xl" />)
        ) : open.length === 0 ? (
          <div className="bg-white rounded-2xl border border-border p-12 text-center">
            <ShieldAlert className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">Queue is clear — no open reports</p>
          </div>
        ) : open.map(report => (
          <div key={report.id} className="bg-white rounded-2xl border border-border p-5 flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${SEVERITY_COLORS[report.severity] || SEVERITY_COLORS.medium}`}>
                  {report.severity || 'medium'}
                </span>
                <span className="text-xs text-muted-foreground capitalize">{report.report_type || report.reason_category}</span>
              </div>
              <p className="text-sm font-medium text-foreground">{report.description || 'No description'}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Entity: {report.entity_type} · Reporter: {report.reporter_id?.slice(0, 8)}…
              </p>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <Button size="sm" variant="outline" onClick={() => dismissMutation.mutate(report.id)} disabled={dismissMutation.isPending}>
                Dismiss
              </Button>
              <Button size="sm" onClick={() => resolveMutation.mutate(report.id)} disabled={resolveMutation.isPending}>
                Resolve
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}