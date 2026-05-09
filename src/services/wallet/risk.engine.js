/**
 * Risk Engine — Fraud Prevention & Transaction Risk Assessment
 *
 * Called before high-value financial operations to:
 *   1. Compute a composite risk score (0–100)
 *   2. Determine auto-action: allow / flag / block
 *   3. Write FraudSignal records for compliance
 *
 * Risk signals evaluated:
 *   - Transaction velocity (how many txns in last 24h)
 *   - Withdrawal velocity (withdrawals per 7 days)
 *   - KYC level vs transaction amount
 *   - New bank account + high withdrawal (classic fraud pattern)
 *   - Self-gifting detection (sender == recipient)
 *   - High-value single gift
 *   - Account age (new accounts = higher risk)
 *   - Coordinated gift abuse (many senders same recipient same session)
 *
 * Risk actions:
 *   allow         → proceed normally
 *   flag          → proceed but write FraudSignal (review queue)
 *   review        → block + create FraudSignal(severity=high) + notify admin
 *   block         → hard block, freeze wallet if critical
 *
 * Migration note:
 *   On NestJS: Risk engine becomes a separate microservice.
 *   ML model trained on FraudSignal outcomes feeds into score computation.
 *   Real-time IP/device scoring via device fingerprint provider (e.g. FingerprintJS).
 */

import { base44 } from '@/api/base44Client';
import { LIMITS } from './wallet.service';

// ─── Risk Thresholds ──────────────────────────────────────────────────────────

const RISK_THRESHOLDS = {
  ALLOW:  30,   // score <= 30: allow
  FLAG:   50,   // score 31–50: allow + write signal
  REVIEW: 70,   // score 51–70: block + manual review
  BLOCK:  100,  // score > 70: hard block + potential freeze
};

// ─── Score Components ─────────────────────────────────────────────────────────

async function computeWithdrawalRisk(userId, walletId, amount) {
  const signals = [];
  let score = 0;

  const [wallet, recentWithdrawals, recentTransactions, userProfile] = await Promise.all([
    base44.entities.Wallet.filter({ id: walletId }).then(r => r[0]),
    base44.entities.Transaction.filter({ user_id: userId, type: 'withdrawal' }, '-created_date', 20),
    base44.entities.Transaction.filter({ user_id: userId }, '-created_date', 50),
    base44.entities.UserProfile.filter({ id: userId }).then(r => r[0]),
  ]);

  // KYC level check
  if (!wallet?.kyc_level || wallet.kyc_level === 'none') {
    score += 20;
    signals.push('kyc_none');
  }

  // High value vs KYC
  if (amount >= LIMITS.REVIEW_THRESHOLD_KOBO) {
    score += 15;
    signals.push('unusual_withdrawal');
  }

  // Daily withdrawal velocity
  const todayWithdrawals = recentWithdrawals.filter(tx => {
    const txDate = new Date(tx.created_date);
    return (Date.now() - txDate.getTime()) < 86400000; // 24h
  });
  const dailyTotal = todayWithdrawals.reduce((sum, tx) => sum + tx.amount, 0) + amount;
  if (dailyTotal > LIMITS.MAX_WITHDRAWAL_DAILY_KOBO) {
    score += 30;
    signals.push('withdrawal_velocity');
  }

  // New bank account check (no prior successful withdrawal)
  const successfulWithdrawals = recentWithdrawals.filter(tx => tx.status === 'completed');
  if (!successfulWithdrawals.length && amount > 50000) { // First withdrawal > ₦500
    score += 15;
    signals.push('new_bank_account_withdrawal');
  }

  // Transaction velocity in last hour
  const lastHour = recentTransactions.filter(tx =>
    (Date.now() - new Date(tx.created_date).getTime()) < 3600000
  );
  if (lastHour.length > 10) {
    score += 20;
    signals.push('velocity_spike');
  }

  // Account age
  if (userProfile?.created_date) {
    const agedays = (Date.now() - new Date(userProfile.created_date).getTime()) / 86400000;
    if (agedays < 7) {
      score += 20;
      signals.push('new_account');
    } else if (agedays < 30) {
      score += 10;
    }
  }

  return { score: Math.min(score, 100), signals };
}

async function computeGiftRisk(senderId, recipientId, amount, sessionId) {
  const signals = [];
  let score = 0;

  // Self-gifting detection
  if (senderId === recipientId) {
    score += 90;
    signals.push('self_gifting_detected');
  }

  // High value gift
  if (amount >= LIMITS.HIGH_VALUE_GIFT_KOBO) {
    score += 25;
    signals.push('high_value_gift');
  }

  // Coordinated gift abuse: many senders → same recipient + session
  if (sessionId) {
    const recentSessionGifts = await base44.entities.Gift.filter(
      { recipient_id: recipientId, session_id: sessionId },
      '-created_date',
      100
    ).catch(() => []);

    const uniqueSenders = new Set(recentSessionGifts.map(g => g.sender_id));
    if (uniqueSenders.size < 3 && recentSessionGifts.length > 10) {
      score += 35;
      signals.push('coordinated_gift_abuse');
    }
  }

  // Gift velocity from sender
  const senderGifts = await base44.entities.Gift.filter(
    { sender_id: senderId },
    '-created_date',
    50
  ).catch(() => []);

  const lastHourGifts = senderGifts.filter(g =>
    (Date.now() - new Date(g.created_date).getTime()) < 3600000
  );
  if (lastHourGifts.length > 20) {
    score += 25;
    signals.push('velocity_spike');
  }

  return { score: Math.min(score, 100), signals };
}

// ─── Risk Decision ────────────────────────────────────────────────────────────

/**
 * Evaluate risk for a withdrawal.
 * Returns { action, score, signals }
 */
async function evaluateWithdrawal(userId, walletId, amount) {
  const { score, signals } = await computeWithdrawalRisk(userId, walletId, amount);

  let action;
  if (score <= RISK_THRESHOLDS.ALLOW) action = 'allow';
  else if (score <= RISK_THRESHOLDS.FLAG) action = 'flag';
  else if (score <= RISK_THRESHOLDS.REVIEW) action = 'review';
  else action = 'block';

  // Write fraud signal if flagged or above
  if (action !== 'allow') {
    writeFraudSignal({
      userId,
      signalType: signals[0] || 'unusual_withdrawal',
      severity: action === 'block' ? 'critical' : action === 'review' ? 'high' : 'medium',
      relatedEntityType: 'payout_request',
      data: { amount, score, signals, wallet_id: walletId },
      autoAction: action === 'block' ? 'payout_blocked' : action === 'review' ? 'payout_held_for_review' : undefined,
      riskScore: score,
    });
  }

  return { action, score, signals };
}

/**
 * Evaluate risk for a gift transaction.
 */
async function evaluateGift(senderId, recipientId, amount, sessionId) {
  const { score, signals } = await computeGiftRisk(senderId, recipientId, amount, sessionId);

  let action;
  if (score <= RISK_THRESHOLDS.ALLOW) action = 'allow';
  else if (score <= RISK_THRESHOLDS.FLAG) action = 'flag';
  else if (score <= RISK_THRESHOLDS.REVIEW) action = 'review';
  else action = 'block';

  if (action !== 'allow') {
    writeFraudSignal({
      userId: senderId,
      signalType: signals[0] || 'high_value_gift',
      severity: score > 70 ? 'high' : 'medium',
      relatedEntityType: 'gift',
      data: { amount, score, signals, recipient_id: recipientId, session_id: sessionId },
      autoAction: action === 'block' ? 'gift_blocked' : undefined,
      riskScore: score,
    });
  }

  return { action, score, signals };
}

// ─── Fraud Signal Writer (fire-and-forget) ────────────────────────────────────

function writeFraudSignal({ userId, signalType, severity, relatedEntityType, relatedEntityId, data, autoAction, riskScore }) {
  base44.entities.FraudSignal.create({
    user_id: userId,
    signal_type: signalType,
    severity,
    related_entity_type: relatedEntityType,
    related_entity_id: relatedEntityId,
    data,
    auto_action_taken: autoAction,
    risk_score: riskScore,
    status: 'open',
  }).catch(() => {}); // fire-and-forget — never block tx flow
}

export default {
  evaluateWithdrawal,
  evaluateGift,
  writeFraudSignal,
  RISK_THRESHOLDS,
};