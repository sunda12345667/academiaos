/**
 * Payout Service — Creator & User Withdrawal Infrastructure
 *
 * Payout lifecycle:
 *   pending → under_review (if risk flags) → approved → processing → completed
 *                                          → rejected
 *   processing → failed → (retry up to 3x) → manual
 *
 * Risk gates:
 *   All payouts evaluated by riskEngine.evaluateWithdrawal().
 *   score > 70: auto-blocked, written to FraudSignal
 *   score 51–70: placed in under_review queue
 *   score ≤ 50: auto-approved to processing
 *
 * Balance locking:
 *   When payout is requested, amount is moved from available → locked_balance.
 *   On completion: locked released + total_withdrawn updated.
 *   On failure/rejection: locked released back to available.
 *
 * Idempotency:
 *   idempotency_key on PayoutRequest prevents duplicate submissions
 *   (same key = same payout, returns existing record).
 *
 * Migration note:
 *   On NestJS: actual bank transfer via Paystack Transfer API from a backend job.
 *   Status polling via Paystack webhook or cron verification.
 *   In Base44 MVP: PayoutRequest is created + processed manually by admin.
 */

import { base44 } from '@/api/base44Client';
import walletService, { LIMITS } from './wallet.service';
import riskEngine from './risk.engine';

// ─── Initiate Payout ──────────────────────────────────────────────────────────

/**
 * Request a withdrawal.
 * Validates balance, KYC, and risk, then locks funds and creates PayoutRequest.
 */
async function requestPayout(userId, {
  amount,
  bankCode,
  accountNumber,
  accountName,
  bankName,
  idempotencyKey,
  ipAddress,
}) {
  if (amount < LIMITS.MIN_WITHDRAWAL_KOBO) {
    throw new Error(`Minimum withdrawal is ₦${LIMITS.MIN_WITHDRAWAL_KOBO / 100}`);
  }

  // Idempotency check
  if (idempotencyKey) {
    const existing = await base44.entities.PayoutRequest.filter({ idempotency_key: idempotencyKey });
    if (existing.length) return { payoutRequest: existing[0], idempotent: true };
  }

  // Load wallet
  const wallet = await walletService.getOrCreateWallet(userId);
  if (wallet.status !== 'active') throw new Error(`Wallet is ${wallet.status}`);

  const available = wallet.balance || 0;
  if (available < amount) throw new Error(`Insufficient balance. Available: ₦${(available / 100).toFixed(2)}`);

  // Daily limit check
  const dailyUsed = await getDailyWithdrawalTotal(userId);
  const dailyLimit = wallet.kyc_level === 'enhanced'
    ? LIMITS.KYC_ENHANCED_DAILY_KOBO
    : LIMITS.KYC_BASIC_DAILY_KOBO;

  if (dailyUsed + amount > dailyLimit) {
    throw new Error(`Daily withdrawal limit exceeded. Limit: ₦${(dailyLimit / 100).toFixed(2)}, Used: ₦${(dailyUsed / 100).toFixed(2)}`);
  }

  // Risk evaluation
  const { action, score, signals } = await riskEngine.evaluateWithdrawal(userId, wallet.id, amount);
  if (action === 'block') {
    throw new Error('Withdrawal blocked by security system. Please contact support.');
  }

  const withdrawalFee = LIMITS.MIN_WITHDRAWAL_KOBO > 0 ? walletService.FEE.WITHDRAWAL_FLAT_KOBO : 0;
  const netAmount = amount - withdrawalFee;

  // Lock funds while payout is in-flight
  await walletService.lockBalance(userId, {
    amount,
    description: `Payout hold: ₦${(amount / 100).toFixed(2)} to ${bankName}`,
    relatedEntityId: null, // will update after creating request
  });

  const status = action === 'review' ? 'under_review' : 'pending';

  const payoutRequest = await base44.entities.PayoutRequest.create({
    user_id: userId,
    wallet_id: wallet.id,
    amount,
    currency: 'NGN',
    bank_code: bankCode,
    account_number: accountNumber,
    account_name: accountName,
    bank_name: bankName,
    status,
    review_reason: action === 'review' ? `Risk score: ${score}. Flags: ${signals.join(', ')}` : undefined,
    platform_fee: withdrawalFee,
    net_amount: netAmount,
    risk_score: score,
    risk_flags: signals,
    ip_address: ipAddress,
    idempotency_key: idempotencyKey,
    gateway: 'paystack',
  });

  return { payoutRequest, locked: true };
}

// ─── Admin Approval ───────────────────────────────────────────────────────────

async function approvePayout(payoutRequestId, adminUserId) {
  const reqs = await base44.entities.PayoutRequest.filter({ id: payoutRequestId });
  if (!reqs.length) throw new Error('Payout request not found');
  const req = reqs[0];

  if (!['pending', 'under_review'].includes(req.status)) {
    throw new Error(`Cannot approve a payout in '${req.status}' status`);
  }

  await base44.entities.PayoutRequest.update(payoutRequestId, {
    status: 'processing',
    reviewed_by: adminUserId,
    reviewed_at: new Date().toISOString(),
  });

  return { approved: true, payoutRequest: { ...req, status: 'processing' } };
}

async function rejectPayout(payoutRequestId, adminUserId, reason) {
  const reqs = await base44.entities.PayoutRequest.filter({ id: payoutRequestId });
  if (!reqs.length) throw new Error('Payout request not found');
  const req = reqs[0];

  if (!['pending', 'under_review'].includes(req.status)) {
    throw new Error(`Cannot reject a payout in '${req.status}' status`);
  }

  // Release locked balance back to available
  await walletService.releaseLockedBalance(req.user_id, {
    amount: req.amount,
    description: `Payout rejected: ${reason}`,
    relatedEntityId: payoutRequestId,
  });

  await base44.entities.PayoutRequest.update(payoutRequestId, {
    status: 'rejected',
    rejection_reason: reason,
    reviewed_by: adminUserId,
    reviewed_at: new Date().toISOString(),
  });

  return { rejected: true };
}

// ─── Payout Completion (called by webhook handler) ────────────────────────────

async function completePayout(payoutRequestId, { gatewayReference, gatewayResponse }) {
  const reqs = await base44.entities.PayoutRequest.filter({ id: payoutRequestId });
  if (!reqs.length) throw new Error('Payout request not found');
  const req = reqs[0];

  if (req.status === 'completed') return { alreadyCompleted: true };
  if (req.status !== 'processing') throw new Error(`Cannot complete payout in '${req.status}' status`);

  // Release locked balance and debit wallet (money has left the platform)
  await walletService.releaseLockedBalance(req.user_id, {
    amount: req.amount,
    description: `Payout released: ${gatewayReference}`,
    relatedEntityId: payoutRequestId,
  });

  const { transaction } = await walletService.debitWallet(req.user_id, {
    amount: req.amount,
    type: 'withdrawal',
    description: `Bank transfer: ₦${(req.net_amount / 100).toFixed(2)} to ${req.bank_name}`,
    referencePrefix: 'WDR',
    relatedEntityType: 'payout_request',
    relatedEntityId: payoutRequestId,
    metadata: { gateway_reference: gatewayReference, payout_request_id: payoutRequestId },
  });

  // Update wallet total_withdrawn
  const wallet = await walletService.getWalletByUser(req.user_id);
  if (wallet) {
    await base44.entities.Wallet.update(wallet.id, {
      total_withdrawn: (wallet.total_withdrawn || 0) + req.amount,
    });
  }

  await base44.entities.PayoutRequest.update(payoutRequestId, {
    status: 'completed',
    gateway_reference: gatewayReference,
    gateway_response: gatewayResponse,
    transaction_id: transaction.id,
    completed_at: new Date().toISOString(),
    processed_at: new Date().toISOString(),
  });

  return { completed: true, transaction };
}

async function failPayout(payoutRequestId, { reason, gatewayResponse, retry = false }) {
  const reqs = await base44.entities.PayoutRequest.filter({ id: payoutRequestId });
  if (!reqs.length) throw new Error('Payout request not found');
  const req = reqs[0];

  const retryCount = (req.retry_count || 0) + 1;

  if (retry && retryCount <= 3) {
    // Re-queue for retry
    await base44.entities.PayoutRequest.update(payoutRequestId, {
      status: 'processing',
      failure_reason: reason,
      retry_count: retryCount,
      gateway_response: gatewayResponse,
    });
    return { retrying: true, retryCount };
  }

  // Final failure — release locked balance
  await walletService.releaseLockedBalance(req.user_id, {
    amount: req.amount,
    description: `Payout failed: ${reason}`,
    relatedEntityId: payoutRequestId,
  });

  await base44.entities.PayoutRequest.update(payoutRequestId, {
    status: 'failed',
    failure_reason: reason,
    retry_count: retryCount,
    gateway_response: gatewayResponse,
  });

  return { failed: true, refunded: true };
}

// ─── Payout History & Queries ─────────────────────────────────────────────────

async function getUserPayouts(userId, { limit = 20, status } = {}) {
  const filter = { user_id: userId };
  if (status) filter.status = status;
  return base44.entities.PayoutRequest.filter(filter, '-created_date', limit);
}

async function getPendingPayouts({ limit = 50 } = {}) {
  return base44.entities.PayoutRequest.filter({ status: 'pending' }, 'created_date', limit);
}

async function getPayoutsUnderReview({ limit = 50 } = {}) {
  return base44.entities.PayoutRequest.filter({ status: 'under_review' }, 'created_date', limit);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getDailyWithdrawalTotal(userId) {
  const requests = await base44.entities.PayoutRequest.filter({ user_id: userId }, '-created_date', 30);
  const today = requests.filter(r => {
    const age = Date.now() - new Date(r.created_date).getTime();
    return age < 86400000 && ['pending', 'under_review', 'approved', 'processing', 'completed'].includes(r.status);
  });
  return today.reduce((sum, r) => sum + r.amount, 0);
}

export default {
  requestPayout,
  approvePayout,
  rejectPayout,
  completePayout,
  failPayout,
  getUserPayouts,
  getPendingPayouts,
  getPayoutsUnderReview,
};