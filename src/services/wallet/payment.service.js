/**
 * Payment Service — Gateway Integration Architecture
 *
 * Supported gateways (in order of priority):
 *   1. Paystack   — primary NGN payment (cards, bank transfer, USSD, mobile money)
 *   2. Flutterwave — secondary (broader African coverage)
 *   3. Stripe      — international USD/GBP (future)
 *
 * Payment flow:
 *   1. Client calls initiatePayment() → creates PaymentIntent record
 *   2. Returns { checkoutUrl, reference } → client redirects/opens popup
 *   3. Gateway redirects back / fires webhook
 *   4. verifyPayment() called by webhook handler or polling
 *   5. On success: creditWallet() + update PaymentIntent status='completed'
 *   6. On failure: update status='failed', no wallet mutation
 *
 * Idempotency:
 *   - PaymentIntent.idempotency_key ensures no duplicate payment intents
 *   - verifyPayment() is idempotent (re-verify already completed = no-op)
 *   - Webhook handler must check PaymentIntent.status before crediting
 *
 * Retry safety:
 *   - verifyPayment() increments verification_attempts counter
 *   - After 5 failed verifications → status='expired'
 *   - Gateway webhooks are the source of truth; polling is backup
 *
 * Security:
 *   - All webhook payloads verified via HMAC signature (Paystack: x-paystack-signature)
 *   - Payment intent expires after 30 minutes
 *   - IP address logged on every payment intent
 *
 * Migration note:
 *   On NestJS: actual Paystack API calls made from backend (never expose secret key).
 *   Webhook endpoint at /webhooks/paystack validates HMAC then enqueues job.
 *   In Base44 MVP: PaymentIntent created + gateway call stubbed.
 *   Add PAYSTACK_SECRET_KEY as backend function secret for full integration.
 */

import { base44 } from '@/api/base44Client';
import walletService from './wallet.service';

// ─── Initiate Payment (Gateway-Agnostic) ─────────────────────────────────────

/**
 * Create a PaymentIntent and return checkout URL.
 * Actual Paystack/Flutterwave initialization happens in the backend function.
 *
 * @returns { paymentIntent, checkoutUrl, reference }
 */
async function initiatePayment(userId, {
  amount,
  purpose,
  relatedEntityType,
  relatedEntityId,
  gateway = 'paystack',
  idempotencyKey,
  ipAddress,
  metadata = {},
}) {
  if (amount < walletService.LIMITS.MIN_DEPOSIT_KOBO) {
    throw new Error(`Minimum payment is ₦${walletService.LIMITS.MIN_DEPOSIT_KOBO / 100}`);
  }

  // Idempotency guard
  if (idempotencyKey) {
    const existing = await base44.entities.PaymentIntent.filter({ idempotency_key: idempotencyKey });
    if (existing.length && existing[0].status !== 'expired') {
      return { paymentIntent: existing[0], checkoutUrl: existing[0].checkout_url, reference: existing[0].gateway_reference, idempotent: true };
    }
  }

  const wallet = await walletService.getOrCreateWallet(userId);
  const reference = walletService.generateReference('PAY');
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30min

  const paymentIntent = await base44.entities.PaymentIntent.create({
    user_id: userId,
    wallet_id: wallet.id,
    amount,
    currency: 'NGN',
    purpose,
    related_entity_type: relatedEntityType,
    related_entity_id: relatedEntityId,
    gateway,
    gateway_reference: reference,
    status: 'created',
    verification_attempts: 0,
    idempotency_key: idempotencyKey,
    expires_at: expiresAt,
    ip_address: ipAddress,
    metadata,
  });

  // In production: call Paystack initialize API from backend function
  // const { data } = await paystackClient.transaction.initialize({ email, amount, reference });
  // checkoutUrl = data.authorization_url
  // gateway_access_code = data.access_code

  return {
    paymentIntent,
    reference,
    checkoutUrl: null, // populated by backend function in production
  };
}

/**
 * Verify a payment (called by webhook or client-side callback).
 * Idempotent: re-verifying a completed payment is a no-op.
 *
 * @param {string} reference - Gateway reference
 * @param {object} gatewayResponse - Raw gateway verification response
 * @param {boolean} success - Whether gateway reports success
 */
async function verifyPayment(reference, { gatewayResponse, success, externalReference }) {
  const intents = await base44.entities.PaymentIntent.filter({ gateway_reference: reference });
  if (!intents.length) throw new Error(`No PaymentIntent found for reference: ${reference}`);

  const intent = intents[0];

  // Idempotency: already processed
  if (intent.status === 'completed') return { alreadyProcessed: true, intent };
  if (intent.status === 'expired') throw new Error('Payment intent has expired');

  const attempts = (intent.verification_attempts || 0) + 1;

  if (!success) {
    const newStatus = attempts >= 5 ? 'expired' : 'failed';
    await base44.entities.PaymentIntent.update(intent.id, {
      status: newStatus,
      verification_attempts: attempts,
      gateway_response: gatewayResponse,
    });
    throw new Error('Payment verification failed');
  }

  // Payment succeeded — credit wallet
  const { transaction } = await walletService.creditWallet(intent.user_id, {
    amount: intent.amount,
    type: intent.purpose === 'wallet_topup' ? 'deposit' : 'deposit',
    description: _purposeLabel(intent.purpose),
    referencePrefix: 'DEP',
    relatedEntityType: intent.related_entity_type,
    relatedEntityId: intent.related_entity_id,
    gateway: intent.gateway,
    externalReference: externalReference || reference,
    idempotencyKey: `payment_${intent.id}`, // prevent double credit on retry
    metadata: { payment_intent_id: intent.id, gateway_reference: reference },
  });

  await base44.entities.PaymentIntent.update(intent.id, {
    status: 'completed',
    verification_attempts: attempts,
    gateway_response: gatewayResponse,
    transaction_id: transaction.id,
    verified_at: new Date().toISOString(),
  });

  return { completed: true, intent, transaction };
}

/**
 * Expire stale payment intents (called by scheduled job every 5min)
 */
async function expireStaleIntents() {
  const intents = await base44.entities.PaymentIntent.filter({ status: 'pending' }, 'created_date', 100);
  const stale = intents.filter(i => i.expires_at && new Date(i.expires_at) < new Date());

  await Promise.all(stale.map(i =>
    base44.entities.PaymentIntent.update(i.id, { status: 'expired' })
  ));

  return { expired: stale.length };
}

// ─── Webhook Signature Verification Architecture ──────────────────────────────

/**
 * Verify Paystack webhook signature.
 * In production: called in backend function BEFORE processing.
 *
 * Paystack sends: x-paystack-signature = HMAC-SHA512(body, secretKey)
 * Verification: compute HMAC locally, compare with header value.
 *
 * NOTE: This runs in a backend function (Deno), never on the frontend.
 * See: functions/paystackWebhook.js
 */
function getWebhookVerificationGuide() {
  return {
    paystack: {
      header: 'x-paystack-signature',
      algorithm: 'HMAC-SHA512',
      steps: [
        '1. Read raw body bytes (do NOT parse JSON first)',
        '2. Compute HMAC-SHA512(rawBody, PAYSTACK_SECRET_KEY)',
        '3. Compare hex digest with x-paystack-signature header',
        '4. If mismatch: return 400, do NOT process event',
        '5. Parse JSON body only after signature verified',
        '6. Check event type: charge.success, transfer.success, transfer.failed',
        '7. Extract data.reference, data.amount, data.status',
        '8. Call verifyPayment(reference, { success: true, gatewayResponse: data })',
      ],
      events: {
        'charge.success': 'Deposit completed — call verifyPayment()',
        'transfer.success': 'Payout completed — call completePayout()',
        'transfer.failed': 'Payout failed — call failPayout()',
        'transfer.reversed': 'Payout reversed — call reverseTransaction()',
      },
    },
    flutterwave: {
      header: 'verif-hash',
      algorithm: 'compare with FLW_SECRET_HASH env var',
      steps: [
        '1. Compare verif-hash header with FLW_SECRET_HASH env',
        '2. Parse event, check status === "successful"',
        '3. Verify transaction by calling Flutterwave verify endpoint',
        '4. Call verifyPayment(txRef, { success: true, gatewayResponse })',
      ],
    },
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _purposeLabel(purpose) {
  const labels = {
    wallet_topup: 'Wallet Top-up',
    course_purchase: 'Course Purchase',
    marketplace_purchase: 'Marketplace Purchase',
    subscription: 'Subscription',
    gift_coin_purchase: 'Gift Coins Purchase',
  };
  return labels[purpose] || purpose;
}

export default {
  initiatePayment,
  verifyPayment,
  expireStaleIntents,
  getWebhookVerificationGuide,
};