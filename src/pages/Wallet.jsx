/**
 * Wallet Page — Financial Hub
 * Reads from WalletProvider (realtime) via useWallet hook.
 * All balance/transaction state is live — no local fetch needed.
 */
import { useState } from 'react';
import { useWallet } from '@/hooks/useWallet';
import {
  Wallet as WalletIcon, ArrowDownLeft, ArrowUpRight,
  Plus, Send, CreditCard, TrendingUp, RefreshCw, ShieldCheck
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';

const TX_TYPE_LABEL = {
  deposit: 'Wallet Top-up',
  withdrawal: 'Bank Transfer',
  course_purchase: 'Course Purchase',
  course_sale: 'Course Sale',
  marketplace_purchase: 'Purchase',
  marketplace_sale: 'Sale',
  subscription_payment: 'Subscription',
  subscription_revenue: 'Subscription Revenue',
  tip: 'Gift Sent',
  tip_received: 'Gift Received',
  refund: 'Refund',
  platform_fee: 'Platform Fee',
  bonus: 'Bonus',
  penalty: 'Penalty',
};

const STATUS_COLOR = {
  completed: 'bg-emerald-500/10 text-emerald-600',
  pending: 'bg-amber-500/10 text-amber-600',
  failed: 'bg-destructive/10 text-destructive',
  reversed: 'bg-muted text-muted-foreground',
};

export default function Wallet() {
  const { wallet, balance, transactions, loading, refresh, formatAmount } = useWallet();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const kycLabel = { none: 'Unverified', basic: 'Basic KYC', enhanced: 'Enhanced KYC' };

  return (
    <div className="max-w-2xl mx-auto w-full p-4 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="font-jakarta font-bold text-2xl text-foreground">Wallet</h1>
        <Button variant="ghost" size="icon" onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Balance Card */}
      <div className="rounded-2xl p-6 gradient-brand text-white shadow-lg shadow-primary/25 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <div className="absolute -top-4 -right-4 w-32 h-32 rounded-full bg-white" />
          <div className="absolute -bottom-8 -left-4 w-40 h-40 rounded-full bg-white" />
        </div>
        <div className="relative space-y-3">
          <div>
            <p className="text-white/70 text-sm font-medium mb-1">Available Balance</p>
            {loading ? (
              <Skeleton className="h-10 w-44 bg-white/20" />
            ) : (
              <p className="text-3xl font-jakarta font-bold tracking-tight">
                {formatAmount(balance.available)}
              </p>
            )}
          </div>

          {balance.locked > 0 && (
            <p className="text-white/60 text-xs">
              + {formatAmount(balance.locked)} locked (pending payout)
            </p>
          )}

          <div className="flex items-center gap-2 pt-1">
            <ShieldCheck className="w-3.5 h-3.5 text-white/60" />
            <span className="text-white/60 text-xs">
              {balance.currency} · {kycLabel[balance.kyc_level || 'none']}
            </span>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { icon: Plus,       label: 'Add Money',  color: 'text-emerald-600 bg-emerald-500/10' },
          { icon: Send,       label: 'Transfer',   color: 'text-primary bg-primary/10' },
          { icon: ArrowUpRight, label: 'Withdraw', color: 'text-amber-600 bg-amber-500/10' },
          { icon: TrendingUp, label: 'Earnings',   color: 'text-accent bg-accent/10' },
        ].map(({ icon: Icon, label, color }) => (
          <button
            key={label}
            className="flex flex-col items-center gap-2 p-3 feed-card active:scale-95 transition-transform"
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
              <Icon className="w-5 h-5" />
            </div>
            <span className="text-xs font-medium text-foreground text-center leading-tight">{label}</span>
          </button>
        ))}
      </div>

      {/* Creator Earnings Summary (if any earnings) */}
      {wallet?.total_earned > 0 && (
        <div className="feed-card p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium">Total Earned</p>
            <p className="text-base font-jakarta font-bold text-foreground">{formatAmount(wallet.total_earned)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground font-medium">Total Withdrawn</p>
            <p className="text-base font-jakarta font-bold text-foreground">{formatAmount(wallet.total_withdrawn || 0)}</p>
          </div>
          <TrendingUp className="w-5 h-5 text-accent" />
        </div>
      )}

      {/* Transaction History */}
      <div>
        <h2 className="font-jakarta font-semibold text-base text-foreground mb-3">Recent Transactions</h2>
        {loading ? (
          <div className="space-y-2">
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
            <p className="text-xs text-muted-foreground/60 mt-1">Add money to get started</p>
          </div>
        ) : (
          <div className="space-y-2">
            {transactions.map(tx => (
              <TransactionRow key={tx.id} tx={tx} formatAmount={formatAmount} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TransactionRow({ tx, formatAmount }) {
  const isCredit = tx.direction === 'credit';
  const label = TX_TYPE_LABEL[tx.type] || tx.type?.replace(/_/g, ' ');

  return (
    <div className="flex items-center gap-3 p-3 feed-card">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isCredit ? 'bg-emerald-500/10' : 'bg-destructive/10'}`}>
        {isCredit
          ? <ArrowDownLeft className="w-5 h-5 text-emerald-600" />
          : <ArrowUpRight className="w-5 h-5 text-destructive" />
        }
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">
          {tx.description || label}
        </p>
        <p className="text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(tx.created_date), { addSuffix: true })}
        </p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className={`text-sm font-bold ${isCredit ? 'text-emerald-600' : 'text-destructive'}`}>
          {isCredit ? '+' : '-'}{formatAmount(tx.amount, tx.currency)}
        </p>
        <Badge variant="outline" className={`text-[9px] px-1.5 py-0 h-4 mt-0.5 ${STATUS_COLOR[tx.status] || ''}`}>
          {tx.status}
        </Badge>
      </div>
    </div>
  );
}