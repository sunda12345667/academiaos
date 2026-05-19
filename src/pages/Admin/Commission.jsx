import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, ShoppingBag, BookOpen, Gift, CreditCard } from 'lucide-react';
import { format } from 'date-fns';

const COMMISSION_RATES = {
  marketplace_sale: 0.10,   // 10%
  course_sale: 0.20,        // 20%
  tip_received: 0.30,       // 30%
  subscription_revenue: 0.20,
};

const TYPE_META = {
  marketplace_sale:      { label: 'Marketplace',   icon: ShoppingBag, color: 'bg-amber-500',  rate: '10%' },
  course_sale:           { label: 'Course',         icon: BookOpen,    color: 'bg-primary',    rate: '20%' },
  tip_received:          { label: 'Tip / Gift',     icon: Gift,        color: 'bg-pink-500',   rate: '30%' },
  subscription_revenue:  { label: 'Subscription',  icon: CreditCard,  color: 'bg-purple-500', rate: '20%' },
};

function StatCard({ icon: Icon, label, value, sub, color, loading }) {
  return (
    <div className="bg-white rounded-2xl border border-border p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-muted-foreground font-medium">{label}</p>
        <div className={`w-9 h-9 rounded-xl ${color} flex items-center justify-center`}>
          <Icon className="w-4 h-4 text-white" />
        </div>
      </div>
      {loading ? <Skeleton className="h-8 w-32" /> : (
        <>
          <p className="text-3xl font-bold font-jakarta text-foreground">{value}</p>
          {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
        </>
      )}
    </div>
  );
}

function fmt(kobo) {
  return '₦' + (kobo / 100).toLocaleString('en-NG', { minimumFractionDigits: 0 });
}

export default function AdminCommission() {
  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ['admin-commission-txns'],
    queryFn: () => base44.entities.Transaction.list('-created_date', 200),
  });

  // Only revenue-generating transactions
  const revTxns = transactions.filter(t =>
    t.status === 'completed' && COMMISSION_RATES[t.type]
  );

  // Compute platform commission per transaction
  const withCommission = revTxns.map(t => ({
    ...t,
    commission: Math.round((t.amount || 0) * (COMMISSION_RATES[t.type] || 0)),
  }));

  const totalRevenue = withCommission.reduce((s, t) => s + t.amount, 0);
  const totalCommission = withCommission.reduce((s, t) => s + t.commission, 0);

  // Breakdown by type
  const breakdown = Object.entries(TYPE_META).map(([type, meta]) => {
    const items = withCommission.filter(t => t.type === type);
    return {
      ...meta,
      type,
      count: items.length,
      gross: items.reduce((s, t) => s + t.amount, 0),
      commission: items.reduce((s, t) => s + t.commission, 0),
    };
  });

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold font-jakarta">Platform Commission</h1>
        <p className="text-sm text-muted-foreground mt-1">Revenue earned from marketplace, courses, tips & subscriptions</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon={TrendingUp}  label="Total Commission"  value={fmt(totalCommission)}  color="bg-emerald-500" loading={isLoading} />
        <StatCard icon={ShoppingBag} label="Marketplace (10%)" value={fmt(breakdown[0].commission)} sub={`${breakdown[0].count} sales`} color="bg-amber-500"   loading={isLoading} />
        <StatCard icon={BookOpen}    label="Courses (20%)"     value={fmt(breakdown[1].commission)} sub={`${breakdown[1].count} sales`} color="bg-primary"     loading={isLoading} />
        <StatCard icon={Gift}        label="Tips / Gifts (30%)"value={fmt(breakdown[2].commission)} sub={`${breakdown[2].count} tips`}  color="bg-pink-500"    loading={isLoading} />
      </div>

      {/* Breakdown table */}
      <div className="bg-white rounded-2xl border border-border p-6 mb-6">
        <h2 className="font-semibold font-jakarta text-base mb-4">Commission Breakdown by Type</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {['Category', 'Rate', 'Transactions', 'Gross Volume', 'Platform Commission'].map(h => (
                <th key={h} className="text-left pb-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              [1,2,3,4].map(i => <tr key={i}><td colSpan={5} className="py-3"><Skeleton className="h-5 w-full" /></td></tr>)
            ) : breakdown.map(row => (
              <tr key={row.type} className="hover:bg-muted/20 transition-colors">
                <td className="py-3 flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-lg ${row.color} flex items-center justify-center`}>
                    <row.icon className="w-3.5 h-3.5 text-white" />
                  </div>
                  <span className="font-medium text-foreground">{row.label}</span>
                </td>
                <td className="py-3 text-muted-foreground font-semibold">{row.rate}</td>
                <td className="py-3 text-muted-foreground">{row.count}</td>
                <td className="py-3 text-foreground">{fmt(row.gross)}</td>
                <td className="py-3 font-bold text-emerald-600">{fmt(row.commission)}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-border font-bold">
              <td className="pt-3 text-foreground" colSpan={2}>Total</td>
              <td className="pt-3 text-muted-foreground">{withCommission.length}</td>
              <td className="pt-3 text-foreground">{fmt(totalRevenue)}</td>
              <td className="pt-3 text-emerald-600 text-base">{fmt(totalCommission)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Recent commission transactions */}
      <div className="bg-white rounded-2xl border border-border overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="font-semibold font-jakarta text-base">Recent Transactions</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-muted/40 border-b border-border">
            <tr>
              {['Date', 'Type', 'User', 'Gross', 'Commission'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              [1,2,3,4,5].map(i => <tr key={i}><td colSpan={5} className="px-4 py-3"><Skeleton className="h-5 w-full" /></td></tr>)
            ) : withCommission.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-12 text-muted-foreground">No commission-generating transactions yet</td></tr>
            ) : withCommission.slice(0, 20).map(t => {
              const meta = TYPE_META[t.type];
              return (
                <tr key={t.id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                    {t.created_date ? format(new Date(t.created_date), 'MMM d, HH:mm') : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-medium text-foreground">{meta?.label || t.type}</span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{t.user_id?.slice(0,8)}…</td>
                  <td className="px-4 py-3 text-foreground">{fmt(t.amount)}</td>
                  <td className="px-4 py-3 font-bold text-emerald-600">{fmt(t.commission)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}