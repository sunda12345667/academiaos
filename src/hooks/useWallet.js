/**
 * useWallet Hook
 *
 * Reactive wallet hook for components. Delegates to WalletProvider for
 * realtime state, exposes action methods (send gift, request payout, top-up).
 *
 * Usage:
 *   const { balance, transactions, sendGift, requestPayout } = useWallet();
 *
 * Design:
 *   - All write operations return { success, error, data } — never throw to UI
 *   - Optimistic UI is NOT used for financial data (accuracy > speed)
 *   - After every mutation, provider's realtime subscription auto-updates state
 */

import { useState, useCallback } from 'react';
import { useWalletStore } from '@/providers/WalletProvider';
import walletService from '@/services/wallet/wallet.service';
import giftingService from '@/services/wallet/gifting.service';
import payoutService from '@/services/wallet/payout.service';
import paymentService from '@/services/wallet/payment.service';
import { useCurrentUser } from '@/hooks/useCurrentUser';

export function useWallet() {
  const store = useWalletStore();
  const { profile } = useCurrentUser();

  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState(null);

  const profileId = profile?.id;

  const withAction = useCallback(async (fn) => {
    setActionLoading(true);
    setActionError(null);
    try {
      const result = await fn();
      return { success: true, data: result };
    } catch (err) {
      setActionError(err.message);
      return { success: false, error: err.message };
    } finally {
      setActionLoading(false);
    }
  }, []);

  // ─── Payment (Top-up) ─────────────────────────────────────────────────────

  const initiateTopUp = useCallback((amount, opts = {}) =>
    withAction(() => paymentService.initiatePayment(profileId, {
      amount,
      purpose: 'wallet_topup',
      ...opts,
    })),
  [profileId, withAction]);

  // ─── Gifting ──────────────────────────────────────────────────────────────

  const sendGift = useCallback((params) =>
    withAction(() => giftingService.sendGift({ senderId: profileId, ...params })),
  [profileId, withAction]);

  const getGiftCatalog = useCallback((filters) =>
    giftingService.getGiftCatalog(filters),
  []);

  // ─── Payout (Withdrawal) ──────────────────────────────────────────────────

  const requestPayout = useCallback((params) =>
    withAction(() => payoutService.requestPayout(profileId, params)),
  [profileId, withAction]);

  const getUserPayouts = useCallback((opts) =>
    payoutService.getUserPayouts(profileId, opts),
  [profileId]);

  // ─── Transfer ─────────────────────────────────────────────────────────────

  const transfer = useCallback((toUserId, amount, opts) =>
    withAction(() => walletService.transferBetweenWallets(profileId, toUserId, amount, opts)),
  [profileId, withAction]);

  return {
    // State from WalletProvider
    ...store,
    // Action state
    actionLoading,
    actionError,
    // Actions
    initiateTopUp,
    sendGift,
    getGiftCatalog,
    requestPayout,
    getUserPayouts,
    transfer,
  };
}

export default useWallet;