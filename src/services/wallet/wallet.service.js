/**
 * Wallet Service
 * 
 * Handles balance management, transaction ledger, and payment flows.
 * 
 * CRITICAL MIGRATION NOTE:
 * This service is the most important to migrate carefully.
 * All financial operations MUST be atomic (database transactions).
 * In Base44 MVP, we use optimistic updates + audit trail as compensation.
 * On PostgreSQL migration: use SERIALIZABLE transactions + row-level locking.
 * 
 * Future payment gateways: Paystack (primary), Flutterwave (secondary), Stripe (international)
 */

import { base44 } from '@/api/base44Client';

// ─── Constants ────────────────────────────────────────────────────────────────
const PLATFORM_FEE_PERCENT = 0.10; // 10% platform fee on creator transactions
const MIN_WITHDRAWAL_NGN = 1000;   // ₦1,000 minimum withdrawal
const MIN_DEPOSIT_NGN = 100;       // ₦100 minimum deposit

/**
 * Get or create a wallet for a user
 */
async function getOrCreateWallet(userId) {
  const wallets = await base44.entities.Wallet.filter({ user_id: userId });
  if (wallets.length) return wallets[0];

  return await base44.entities.Wallet.create({
    user_id: userId,
    balance: 0,
    locked_balance: 0,
    currency: 'NGN',
    status: 'active',
    kyc_level: 'none',
    total_earned: 0,
    total_withdrawn: 0,
    withdrawal_limit_daily: 50000,
  });
}

/**
 * Get wallet balance for a user
 */
async function getBalance(userId) {
  const wallet = await getOrCreateWallet(userId);
  return {
    available: wallet.balance || 0,
    locked: wallet.locked_balance || 0,
    total: (wallet.balance || 0) + (wallet.locked_balance || 0),
    currency: wallet.currency,
    wallet,
  };
}

/**
 * Credit a wallet — core ledger operation
 * 
 * IMPORTANT: In production PostgreSQL, this MUST be wrapped in a DB transaction
 * with SELECT FOR UPDATE to prevent race conditions.
 */
async function creditWallet(userId, { amount, type, description, referencePrefix, relatedEntityId = null, counterpartyId = null, metadata = {} }) {
  if (amount <= 0) throw new Error('Credit amount must be positive');

  const wallet = await getOrCreateWallet(userId);
  if (wallet.status !== 'active') throw new Error('Wallet is not active');

  const reference = `${referencePrefix || 'CR'}_${Date.now()}_${Math.random().toString(36).slice(2, 9).toUpperCase()}`;
  const balanceBefore = wallet.balance || 0;
  const balanceAfter = balanceBefore + amount;

  // Create transaction record FIRST (audit trail)
  const transaction = await base44.entities.Transaction.create({
    wallet_id: wallet.id,
    user_id: userId,
    type,
    amount,
    currency: wallet.currency,
    direction: 'credit',
    balance_before: balanceBefore,
    balance_after: balanceAfter,
    status: 'completed',
    reference,
    description,
    related_entity_id: relatedEntityId,
    counterparty_id: counterpartyId,
    metadata,
  });

  // Update wallet balance
  await base44.entities.Wallet.update(wallet.id, {
    balance: balanceAfter,
    total_earned: (wallet.total_earned || 0) + amount,
    last_transaction_at: new Date().toISOString(),
  });

  return { transaction, newBalance: balanceAfter };
}

/**
 * Debit a wallet — with balance validation
 */
async function debitWallet(userId, { amount, type, description, referencePrefix, relatedEntityId = null, counterpartyId = null, metadata = {} }) {
  if (amount <= 0) throw new Error('Debit amount must be positive');

  const wallet = await getOrCreateWallet(userId);
  if (wallet.status !== 'active') throw new Error('Wallet is not active');

  const currentBalance = wallet.balance || 0;
  if (currentBalance < amount) throw new Error('Insufficient wallet balance');

  const reference = `${referencePrefix || 'DB'}_${Date.now()}_${Math.random().toString(36).slice(2, 9).toUpperCase()}`;
  const balanceBefore = currentBalance;
  const balanceAfter = currentBalance - amount;

  const transaction = await base44.entities.Transaction.create({
    wallet_id: wallet.id,
    user_id: userId,
    type,
    amount,
    currency: wallet.currency,
    direction: 'debit',
    balance_before: balanceBefore,
    balance_after: balanceAfter,
    status: 'completed',
    reference,
    description,
    related_entity_id: relatedEntityId,
    counterparty_id: counterpartyId,
    metadata,
  });

  await base44.entities.Wallet.update(wallet.id, {
    balance: balanceAfter,
    last_transaction_at: new Date().toISOString(),
  });

  return { transaction, newBalance: balanceAfter };
}

/**
 * Transfer between wallets (e.g., course purchase)
 * Atomic compensation pattern: both credit and debit, rollback if either fails
 */
async function transferBetweenWallets(fromUserId, toUserId, amount, { type, description, relatedEntityId }) {
  const platformFee = Math.floor(amount * PLATFORM_FEE_PERCENT);
  const creatorAmount = amount - platformFee;

  // Debit buyer
  const { transaction: debitTx } = await debitWallet(fromUserId, {
    amount,
    type: `${type}_purchase`,
    description,
    referencePrefix: 'TXD',
    relatedEntityId,
    counterpartyId: toUserId,
  });

  // Credit creator (minus platform fee)
  let creditTx;
  try {
    const result = await creditWallet(toUserId, {
      amount: creatorAmount,
      type: `${type}_sale`,
      description: `${description} (net after 10% fee)`,
      referencePrefix: 'TXC',
      relatedEntityId,
      counterpartyId: fromUserId,
      metadata: { platform_fee: platformFee, gross_amount: amount },
    });
    creditTx = result.transaction;
  } catch (err) {
    // Compensation: refund buyer if creator credit fails
    await creditWallet(fromUserId, {
      amount,
      type: 'refund',
      description: `Refund: ${description}`,
      referencePrefix: 'REF',
      relatedEntityId,
      metadata: { original_reference: debitTx.reference, reason: err.message },
    });
    throw new Error(`Transfer failed and was reversed: ${err.message}`);
  }

  return { debitTransaction: debitTx, creditTransaction: creditTx, platformFee };
}

/**
 * Get transaction history for a user
 */
async function getTransactionHistory(userId, { page = 1, limit = 20 } = {}) {
  const transactions = await base44.entities.Transaction.filter(
    { user_id: userId },
    '-created_date',
    limit
  );
  return { transactions, hasMore: transactions.length === limit, page };
}

export default {
  getOrCreateWallet,
  getBalance,
  creditWallet,
  debitWallet,
  transferBetweenWallets,
  getTransactionHistory,
  PLATFORM_FEE_PERCENT,
};