/**
 * Ledger Service — Double-Entry Immutable Financial Ledger
 *
 * Every financial event produces TWO LedgerEntry records:
 *   debit one account  → reduces that account
 *   credit another     → increases that account
 *
 * This ensures:
 *   - Complete audit trail (every kobo accounted for)
 *   - Reconciliation: sum of all debits == sum of all credits (per transaction)
 *   - Reversal without deletion: reverse = new opposite entries
 *   - Regulatory compliance readiness
 *
 * Account types (account_type field):
 *   user_available    → spendable balance
 *   user_locked       → funds held pending completion
 *   user_bonus        → promo/bonus balance (non-withdrawable until unlocked)
 *   creator_earnings  → earnings from content/gifts/courses
 *   platform_revenue  → platform fee income
 *   platform_escrow   → marketplace escrow holds
 *   payout_pending    → balance in-flight to bank
 *   gift_pool         → coin pool pre-gifting
 *
 * Migration note:
 *   On PostgreSQL: this becomes a proper ledger table with SERIALIZABLE isolation.
 *   All writes use SELECT FOR UPDATE + INSERT in one transaction.
 *   Redis caches running balances per wallet_id + account_type (30s TTL).
 */

import { base44 } from '@/api/base44Client';

// ─── Core Double-Entry Writer ─────────────────────────────────────────────────

/**
 * Write a balanced ledger entry pair for a transaction.
 * debitAccount is reduced, creditAccount is increased.
 *
 * @param {object} params
 * @param {string} params.transactionId - Parent transaction ID
 * @param {string} params.walletId      - Wallet being affected (for user accounts)
 * @param {string} params.userId
 * @param {string} params.debitAccount  - account_type to debit
 * @param {string} params.creditAccount - account_type to credit
 * @param {number} params.amount        - Amount in kobo (always positive)
 * @param {string} params.currency
 * @param {string} params.reference     - Transaction reference
 * @param {string} params.description
 * @param {object} params.metadata
 */
async function writeEntry({
  transactionId,
  walletId,
  userId,
  debitAccount,
  creditAccount,
  amount,
  currency = 'NGN',
  reference,
  description = '',
  metadata = {},
}) {
  const [debitEntry, creditEntry] = await Promise.all([
    base44.entities.LedgerEntry.create({
      transaction_id: transactionId,
      wallet_id: walletId,
      user_id: userId,
      entry_type: 'debit',
      account_type: debitAccount,
      amount,
      currency,
      description,
      reference,
      metadata,
    }),
    base44.entities.LedgerEntry.create({
      transaction_id: transactionId,
      wallet_id: walletId,
      user_id: userId,
      entry_type: 'credit',
      account_type: creditAccount,
      amount,
      currency,
      description,
      reference,
      metadata,
    }),
  ]);

  return { debitEntry, creditEntry };
}

/**
 * Write a reversal entry pair. Links back to original entries.
 * Does NOT modify any balance — creates new entries that offset the originals.
 */
async function writeReversal({ originalTransactionId, walletId, userId, amount, currency = 'NGN', reference, description, metadata = {} }) {
  // Fetch original entries to flip debit/credit
  const originals = await base44.entities.LedgerEntry.filter({ transaction_id: originalTransactionId });
  if (!originals.length) throw new Error(`No ledger entries for transaction ${originalTransactionId}`);

  const reversals = await Promise.all(originals.map(entry =>
    base44.entities.LedgerEntry.create({
      transaction_id: reference, // new transaction id
      wallet_id: walletId,
      user_id: userId,
      entry_type: entry.entry_type === 'debit' ? 'credit' : 'debit', // flip
      account_type: entry.account_type,
      amount,
      currency,
      description: description || `Reversal of ${entry.description}`,
      reference,
      is_reversal: true,
      reversed_entry_id: entry.id,
      metadata,
    })
  ));

  return reversals;
}

/**
 * Get ledger entries for a transaction (useful for audit view)
 */
async function getEntriesForTransaction(transactionId) {
  return base44.entities.LedgerEntry.filter({ transaction_id: transactionId });
}

/**
 * Get full ledger history for a wallet (chronological audit trail)
 */
async function getWalletLedger(walletId, { limit = 50 } = {}) {
  return base44.entities.LedgerEntry.filter({ wallet_id: walletId }, '-created_date', limit);
}

/**
 * Get ledger entries for a specific account type on a wallet
 */
async function getAccountLedger(walletId, accountType, { limit = 50 } = {}) {
  return base44.entities.LedgerEntry.filter(
    { wallet_id: walletId, account_type: accountType },
    '-created_date',
    limit
  );
}

export default {
  writeEntry,
  writeReversal,
  getEntriesForTransaction,
  getWalletLedger,
  getAccountLedger,
};