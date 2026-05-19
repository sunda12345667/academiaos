import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

const STATUS_COLORS = {
  pending: 'bg-amber-100 text-amber-700',
  under_review: 'bg-blue-100 text-blue-700',
  approved: 'bg-emerald-100 text-emerald-700',
  processing: 'bg-primary/10 text-primary',
  completed: 'bg-emerald-100 text-emerald-700',
  failed: 'bg-destructive/10 text-destructive',
  rejected: 'bg-destructive/10 text-destructive',
};

export default function AdminPayouts() {
  const queryClient = useQueryClient();

  const { data: payouts = [], isLoading } = useQuery({
    queryKey: ['admin-payouts'],
    queryFn: () => base44.entities.PayoutRequest.list('-created_date', 50),
  });

  const approveMutation = useMutation({
    mutationFn: (id) => base44.entities.PayoutRequest.update(id, { status: 'approved' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-payouts'] }),
  });

  const rejectMutation = useMutation({
    mutationFn: (id) => base44.entities.PayoutRequest.update(id, { status: 'rejected' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-payouts'] }),
  });

  const pending = payouts.filter(p => p.status === 'pending' || p.status === 'under_review');

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold font-jakarta">Payout Requests</h1>
        <p className="text-sm text-muted-foreground mt-1">{pending.length} pending review</p>
      </div>

      <div className="bg-white rounded-2xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 border-b border-border">
            <tr>
              {['User', 'Amount', 'Bank', 'Account', 'Risk', 'Status', 'Actions'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              [1,2,3].map(i => (
                <tr key={i}><td colSpan={7} className="px-4 py-3"><Skeleton className="h-6 w-full" /></td></tr>
              ))
            ) : payouts.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">No payout requests</td></tr>
            ) : payouts.map(p => (
              <tr key={p.id} className="hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{p.user_id?.slice(0,8)}…</td>
                <td className="px-4 py-3 font-semibold text-foreground">₦{((p.amount || 0) / 100).toLocaleString()}</td>
                <td className="px-4 py-3 text-muted-foreground">{p.bank_name || p.bank_code}</td>
                <td className="px-4 py-3 text-muted-foreground">{p.account_name}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-bold ${(p.risk_score || 0) > 60 ? 'text-destructive' : (p.risk_score || 0) > 30 ? 'text-amber-600' : 'text-emerald-600'}`}>
                    {p.risk_score ?? 0}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_COLORS[p.status] || 'bg-secondary text-secondary-foreground'}`}>
                    {p.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {(p.status === 'pending' || p.status === 'under_review') && (
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => rejectMutation.mutate(p.id)}>Reject</Button>
                      <Button size="sm" className="h-7 text-xs" onClick={() => approveMutation.mutate(p.id)}>Approve</Button>
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