import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

const STATUS_COLORS = {
  draft: 'bg-secondary text-secondary-foreground',
  pending_review: 'bg-amber-100 text-amber-700',
  approved: 'bg-emerald-100 text-emerald-700',
  active: 'bg-primary/10 text-primary',
  paused: 'bg-secondary text-secondary-foreground',
  rejected: 'bg-destructive/10 text-destructive',
  suspended: 'bg-destructive/10 text-destructive',
};

export default function AdminAdCampaigns() {
  const queryClient = useQueryClient();

  const { data: campaigns = [], isLoading } = useQuery({
    queryKey: ['admin-ads'],
    queryFn: () => base44.entities.AdCampaign.list('-created_date', 50),
  });

  const approveMutation = useMutation({
    mutationFn: (id) => base44.entities.AdCampaign.update(id, { status: 'approved', review_status: 'approved' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-ads'] }),
  });

  const rejectMutation = useMutation({
    mutationFn: (id) => base44.entities.AdCampaign.update(id, { status: 'rejected', review_status: 'rejected' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-ads'] }),
  });

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold font-jakarta">Ad Campaigns</h1>
        <p className="text-sm text-muted-foreground mt-1">{campaigns.filter(c => c.review_status === 'pending').length} pending review</p>
      </div>

      <div className="bg-white rounded-2xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 border-b border-border">
            <tr>
              {['Campaign', 'Format', 'Budget', 'Objective', 'Status', 'Actions'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              [1,2,3].map(i => (
                <tr key={i}><td colSpan={6} className="px-4 py-3"><Skeleton className="h-6 w-full" /></td></tr>
              ))
            ) : campaigns.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">No campaigns yet</td></tr>
            ) : campaigns.map(c => (
              <tr key={c.id} className="hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3 font-medium text-foreground">{c.name}</td>
                <td className="px-4 py-3 text-muted-foreground capitalize">{c.ad_format?.replace('_', ' ')}</td>
                <td className="px-4 py-3 font-semibold">₦{((c.budget_total || 0) / 100).toLocaleString()}</td>
                <td className="px-4 py-3 text-muted-foreground capitalize">{c.objective}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_COLORS[c.status] || 'bg-secondary text-secondary-foreground'}`}>
                    {c.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {c.review_status === 'pending' && (
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => rejectMutation.mutate(c.id)}>Reject</Button>
                      <Button size="sm" className="h-7 text-xs" onClick={() => approveMutation.mutate(c.id)}>Approve</Button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}