/**
 * WalletProvider — Realtime Financial State Management
 *
 * Single source of truth for wallet balance and recent transactions.
 * All wallet mutations go through walletService — never direct entity calls.
 *
 * Realtime:
 *   Subscribes to Transaction entity via RealtimeBus.
 *   On new transaction: balance is updated + transaction prepended to list.
 *   On update (e.g. status change from pending→completed): list reconciled.
 *
 * Usage:
 *   const { wallet, balance, transactions, loading, refresh } = useWalletStore();
 *
 * Provider placement: inside AppShell (below UserProvider)
 */

import {
  createContext, useContext, useState, useEffect,
  useCallback, useRef, useMemo
} from 'react';
import RealtimeBus from '@/lib/realtime/RealtimeBus';
import walletService from '@/services/wallet/wallet.service';
import { useCurrentUser } from '@/hooks/useCurrentUser';

const WalletContext = createContext(null);

const NULL_STATE = {
  wallet: null,
  balance: { available: 0, locked: 0, total: 0, currency: 'NGN' },
  transactions: [],
  loading: true,
  error: null,
  refresh: () => Promise.resolve(),
  refreshTransactions: () => Promise.resolve(),
};

export function WalletProvider({ children }) {
  const { profile } = useCurrentUser();
  const profileId = profile?.id;

  const [wallet, setWallet] = useState(null);
  const [balance, setBalance] = useState({ available: 0, locked: 0, total: 0, currency: 'NGN' });
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const walletIdRef = useRef(null);

  // ─── Initial Load ────────────────────────────────────────────────────────────

  const loadWallet = useCallback(async () => {
    if (!profileId) return;
    try {
      setLoading(true);
      setError(null);
      const bal = await walletService.getBalance(profileId);
      setWallet(bal.wallet);
      walletIdRef.current = bal.wallet?.id;
      setBalance({
        available: bal.available,
        locked: bal.locked,
        total: bal.total,
        currency: bal.currency,
        kyc_level: bal.kyc_level,
      });
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  const loadTransactions = useCallback(async (limit = 30) => {
    if (!profileId) return;
    const { transactions: txns } = await walletService.getTransactionHistory(profileId, { limit });
    setTransactions(txns);
  }, [profileId]);

  useEffect(() => {
    if (!profileId) return;
    loadWallet();
    loadTransactions();
  }, [profileId, loadWallet, loadTransactions]);

  // ─── Realtime Transaction Subscription ──────────────────────────────────────

  useEffect(() => {
    if (!profileId) return;

    return RealtimeBus.subscribe('Transaction', '*', (event) => {
      const tx = event.data;
      if (!tx || tx.user_id !== profileId) return;

      if (event.type === 'create') {
        setTransactions(prev => {
          if (prev.some(t => t.id === tx.id)) return prev;
          return [tx, ...prev].slice(0, 50); // cap at 50 in memory
        });

        // Update balance from transaction record (balance_after is the source of truth)
        if (tx.status === 'completed') {
          setBalance(prev => ({
            ...prev,
            available: tx.balance_after,
            total: tx.balance_after + (wallet?.locked_balance || 0),
          }));
        }
      }

      if (event.type === 'update') {
        setTransactions(prev => prev.map(t => t.id === tx.id ? tx : t));

        // Re-read balance on any transaction update (e.g., pending→completed)
        walletService.getBalance(profileId).then(bal => {
          setBalance({
            available: bal.available,
            locked: bal.locked,
            total: bal.total,
            currency: bal.currency,
            kyc_level: bal.kyc_level,
          });
          setWallet(bal.wallet);
        }).catch(() => {});
      }
    });
  }, [profileId, wallet?.locked_balance]);

  const value = useMemo(() => ({
    wallet,
    balance,
    transactions,
    loading,
    error,
    refresh: loadWallet,
    refreshTransactions: loadTransactions,
    // Formatting utilities
    formatAmount: (kobo, currency = 'NGN') =>
      new Intl.NumberFormat('en-NG', {
        style: 'currency',
        currency,
        minimumFractionDigits: 2,
      }).format(kobo / 100),
  }), [wallet, balance, transactions, loading, error, loadWallet, loadTransactions]);

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWalletStore() {
  const ctx = useContext(WalletContext);
  return ctx || NULL_STATE;
}