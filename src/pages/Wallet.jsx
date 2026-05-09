/**
 * Wallet — Financial hub for platform economy
 */
import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Wallet as WalletIcon, ArrowDownLeft, ArrowUpRight, Plus, Send, CreditCard, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';

export default function Wallet() {
  const { profile } = useCurrentUser();
  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.wallet_id) { setLoading(false); return; }
    Promise.all([
      base44.entities.Wallet.filter({ id: profile.wallet_id }),
      base44.entities.Transaction.filter({ user_id: profile.id }, '-created_date', 20),
    ]).then(([wallets, txns]) => {
      setWallet(wallets[0] || null);
      setTransactions(txns);
    }).finally(() => setLoading(false));
  }, [profile]);

  const balance = wallet?.balance || 0;
  const formattedBalance = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 2 }).format(balance / 100);

  return (
    <div className="max-w-2xl mx-auto w-full p-4 space-y-4">
      <h1 className="font-jakarta font-bold text-2xl text-foreground">Wallet</h1>

      {/* Balance Card */}
      <div className="rounded-2xl p-6 gradient-brand text-white shadow-lg shadow-primary/25 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute -top-4 -right-4 w-32 h-32 rounded-full bg-white" />
          <div className="absolute -bottom-8 -left-4 w-40 h-40 rounded-full bg-white" />
        </div>
        <div className="relative">
          <p className="text-white/70 text-sm font-medium mb-1">Available Balance</p>
          {loading ? (
            <Skeleton className="h-10 w-40 bg-white/20 mb-1" />
          ) : (
            <p className="text-3xl font-jakarta font-bold tracking-tight">{formattedBalance}</p>
          )}
          <p className="text-white/60 text-xs mt-1">
            {wallet?.currency || 'NGN'} · KYC: {wallet?.kyc_level || 'none'}
          </p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { icon: Plus, label: 'Add Money', color: 'text-brand-emerald bg-brand-emerald/10' },
          { icon: Send, label: 'Transfer', color: 'text-primary bg-primary/10' },
          { icon: ArrowUpRight, label: 'Withdraw', color: 'text-brand-amber bg-brand-amber/10' },
          { icon: CreditCard, label: 'Pay', color: 'text-brand-violet bg-brand-violet/10' },
        ].map(({ icon: Icon, label, color }) => (
          <button key={label} className="flex flex-col items-center gap-2 p-3 feed-card active:scale-95 transition-transform">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
              <Icon className="w-5 h-5" />
            </div>
            <span className="text-xs font-medium text-foreground text-center">{label}</span>
          </button>
        ))}
      </div>

      {/* Transactions */}
      <div>
        <h2 className="font-jakarta font-semibold text-base text-foreground mb-3">Recent Transactions</h2>
        {loading ? (
          <div className="space-y-3">
            {Array(5).fill(0).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3 feed-card">
                <Skeleton className="w-10 h-10 rounded-xl flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-center py-12 feed-card">
            <WalletIcon className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No transactions yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {transactions.map(tx => <TransactionRow key={tx.id} tx={tx} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function TransactionRow({ tx }) {
  const isCredit = tx.direction === 'credit';
  const amount = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 2 }).format(tx.amount / 100);
  const STATUS_COLOR = { completed: 'bg-brand-emerald/10 text-brand-emerald', pending: 'bg-brand-amber/10 text-brand-amber', failed: 'bg-destructive/10 text-destructive' };

  return (
    <div className="flex items-center gap-3 p-3 feed-card">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isCredit ? 'bg-brand-emerald/10' : 'bg-destructive/10'}`}>
        {isCredit ? <ArrowDownLeft className="w-5 h-5 text-brand-emerald" /> : <ArrowUpRight className="w-5 h-5 text-destructive" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{tx.description || tx.type.replace(/_/g, ' ')}</p>
        <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(tx.created_date), { addSuffix: true })}</p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className={`text-sm font-bold ${isCredit ? 'text-brand-emerald' : 'text-destructive'}`}>
          {isCredit ? '+' : '-'}{amount}
        </p>
        <Badge variant="outline" className={`text-[9px] px-1.5 py-0 h-4 mt-0.5 ${STATUS_COLOR[tx.status] || ''}`}>
          {tx.status}
        </Badge>
      </div>
    </div>
  );
}