/**
 * Wallet — Financial hub matching design reference
 */
import { useState } from 'react';
import { useWallet } from '@/hooks/useWallet';
import { Smartphone, Gift, CreditCard, ShoppingCart, ArrowDownLeft, ArrowUpRight, CheckCircle, Clock, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';

const NETWORKS = [
  { label: 'MTN', color: 'bg-yellow-400', text: 'text-yellow-900' },
  { label: 'Airtel', color: 'bg-red-500', text: 'text-white' },
  { label: 'Glo', color: 'bg-green-500', text: 'text-white' },
  { label: '9mobile', color: 'bg-green-700', text: 'text-white' },
];

const AMOUNTS = [100, 200, 500, 1000];

const TX_ICON = {
  deposit: <CreditCard className="w-4 h-4" />,
  tip: <Gift className="w-4 h-4" />,
  marketplace_purchase: <ShoppingCart className="w-4 h-4" />,
  course_purchase: <ShoppingCart className="w-4 h-4" />,
  withdrawal: <ArrowUpRight className="w-4 h-4" />,
};

const TX_LABEL = {
  deposit: 'Recharge', tip: 'Gift Sent', marketplace_purchase: 'Purchase',
  course_purchase: 'Purchase', withdrawal: 'Withdrawal', tip_received: 'Gift Received',
};

const STATUS_CONFIG = {
  completed: { label: 'SUCCESS', cls: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
  pending:   { label: 'PENDING', cls: 'bg-amber-50 text-amber-600 border-amber-200' },
  failed:    { label: 'FAILED',  cls: 'bg-red-50 text-red-600 border-red-200' },
};

export default function Wallet() {
  const { wallet, balance, transactions, loading, formatAmount } = useWallet();
  const [selectedNetwork, setSelectedNetwork] = useState(0);
  const [selectedAmount, setSelectedAmount] = useState(200);
  const [phone, setPhone] = useState('0801 234 5678');
  const [giftRecipient, setGiftRecipient] = useState('');
  const [giftAmount, setGiftAmount] = useState('');

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto w-full">
      {/* Balance Card */}
      <div className="bg-white border border-border rounded-2xl p-6 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Available Balance</p>
          {loading ? (
            <Skeleton className="h-10 w-40 mb-4" />
          ) : (
            <p className="font-jakarta font-bold text-4xl text-foreground mb-4">
              {formatAmount(balance.available)}
            </p>
          )}
          <div className="flex gap-3">
            <Button className="gradient-brand text-white rounded-xl gap-2 px-5">
              <CreditCard className="w-4 h-4" /> Fund Wallet
            </Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl gap-2 px-5">
              <Gift className="w-4 h-4" /> Send / Gift
            </Button>
          </div>
        </div>
        <div className="hidden md:flex w-24 h-24 rounded-2xl bg-muted items-center justify-center">
          <CreditCard className="w-10 h-10 text-muted-foreground/30" />
        </div>
      </div>

      {/* Quick Actions + Main Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Recharge Airtime */}
        <div className="bg-white border border-border rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Smartphone className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-foreground">Recharge Airtime</h3>
              <p className="text-xs text-muted-foreground">Instant top-up for any network</p>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Select Network</p>
            <div className="flex gap-2">
              {NETWORKS.map((n, i) => (
                <button
                  key={n.label}
                  onClick={() => setSelectedNetwork(i)}
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold transition-all border-2 ${n.color} ${n.text} ${selectedNetwork === i ? 'border-primary scale-110 shadow-md' : 'border-transparent'}`}
                >
                  {n.label.slice(0, 1)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Phone Number</p>
            <div className="relative">
              <Smartphone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input value={phone} onChange={e => setPhone(e.target.value)} className="pl-9 rounded-xl" placeholder="080X XXX XXXX" />
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Amount Selection</p>
            <div className="flex gap-2">
              {AMOUNTS.map(amt => (
                <button
                  key={amt}
                  onClick={() => setSelectedAmount(amt)}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-all ${selectedAmount === amt ? 'bg-primary text-white border-primary' : 'bg-white text-foreground border-border hover:border-primary/50'}`}
                >
                  ₦{amt}
                </button>
              ))}
            </div>
          </div>

          <Button className="w-full gradient-brand text-white rounded-xl font-semibold py-5">
            Recharge Now
          </Button>
        </div>

        {/* Gift Credits */}
        <div className="bg-white border border-border rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <Gift className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-foreground">Gift Credits</h3>
              <p className="text-xs text-muted-foreground">Send wallet balance to a student</p>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Recipient Search</p>
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <Input value={giftRecipient} onChange={e => setGiftRecipient(e.target.value)} className="pl-9 rounded-xl" placeholder="Search by name or @username" />
            </div>
          </div>

          {/* Suggested recipient */}
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl">
            <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary">A</div>
            <div>
              <p className="text-sm font-medium text-foreground">Aiden Pearce</p>
              <p className="text-xs text-muted-foreground">@aiden_studyhub</p>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Gift Amount</p>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium text-sm">₦</span>
              <Input value={giftAmount} onChange={e => setGiftAmount(e.target.value)} className="pl-7 rounded-xl" placeholder="Enter amount" />
            </div>
          </div>

          <div>
            <Input className="rounded-xl" placeholder="Add a Note (Optional) — Happy studying! Here's a..." />
          </div>

          <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold py-5">
            Send Gift
          </Button>
        </div>
      </div>

      {/* Transaction History */}
      <div className="bg-white border border-border rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="font-jakarta font-semibold text-base text-foreground">Transaction History</h2>
        </div>
        {loading ? (
          <div className="p-4 space-y-3">
            {Array(4).fill(0).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="w-10 h-10 rounded-xl" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-3.5 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        ) : transactions.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-muted-foreground text-sm">No transactions yet</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide px-6 py-3">Type</th>
                <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide px-6 py-3">Transaction ID</th>
                <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide px-6 py-3">Date</th>
                <th className="text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide px-6 py-3">Amount</th>
                <th className="text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide px-6 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map(tx => {
                const isCredit = tx.direction === 'credit';
                const statusCfg = STATUS_CONFIG[tx.status] || STATUS_CONFIG.pending;
                return (
                  <tr key={tx.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center text-muted-foreground">
                          {TX_ICON[tx.type] || <CreditCard className="w-4 h-4" />}
                        </div>
                        <span className="text-sm font-medium text-foreground">{TX_LABEL[tx.type] || tx.type}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs text-muted-foreground font-mono">#{tx.id?.slice(0, 12) || 'TXN-000000'}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-muted-foreground">{format(new Date(tx.created_date), 'MMM d, yyyy')}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className={`text-sm font-bold ${isCredit ? 'text-emerald-600' : 'text-foreground'}`}>
                        {isCredit ? '' : ''}{formatAmount(tx.amount, tx.currency)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border ${statusCfg.cls}`}>
                        {statusCfg.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}