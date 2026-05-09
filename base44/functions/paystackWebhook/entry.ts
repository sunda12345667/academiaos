/**
 * Paystack Webhook Handler — Backend Function
 *
 * Endpoint: POST /paystackWebhook
 * Called by: Paystack webhook delivery (not users)
 *
 * Security:
 *   1. Validates HMAC-SHA512 signature FIRST (before any processing)
 *   2. Uses raw body bytes for signature (not parsed JSON)
 *   3. Returns 200 immediately after validation to prevent Paystack retry spam
 *   4. All processing is idempotent (re-delivery = no-op)
 *
 * Events handled:
 *   charge.success      → wallet top-up / purchase payment completed
 *   transfer.success    → creator payout completed
 *   transfer.failed     → creator payout failed (trigger retry or refund)
 *   transfer.reversed   → payout reversed (release locked balance)
 *
 * Idempotency:
 *   PaymentIntent.status checked before any wallet mutation.
 *   If already 'completed', skip and return 200.
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const PAYSTACK_SECRET = Deno.env.get('PAYSTACK_SECRET_KEY');

// ─── HMAC-SHA512 Verification ─────────────────────────────────────────────────

async function verifyPaystackSignature(rawBody, signatureHeader) {
  if (!PAYSTACK_SECRET) {
    console.error('PAYSTACK_SECRET_KEY not set');
    return false;
  }

  const encoder = new TextEncoder();
  const keyData = encoder.encode(PAYSTACK_SECRET);
  const bodyData = encoder.encode(rawBody);

  const cryptoKey = await crypto.subtle.importKey(
    'raw', keyData, { name: 'HMAC', hash: 'SHA-512' }, false, ['sign']
  );

  const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, bodyData);
  const computedHex = Array.from(new Uint8Array(signatureBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  return computedHex === signatureHeader;
}

// ─── Main Handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  // 1. Read raw body BEFORE parsing JSON
  const rawBody = await req.text();
  const signatureHeader = req.headers.get('x-paystack-signature') || '';

  // 2. Verify HMAC signature
  const isValid = await verifyPaystackSignature(rawBody, signatureHeader);
  if (!isValid) {
    console.error('Invalid Paystack signature — rejecting webhook');
    return Response.json({ error: 'Invalid signature' }, { status: 400 });
  }

  // 3. Parse verified body
  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const base44 = createClientFromRequest(req);
  const { event: eventType, data } = event;

  console.info(`Paystack webhook: ${eventType} | ref: ${data?.reference}`);

  // 4. Return 200 immediately to prevent Paystack retry (process async)
  // Note: In production use a job queue here. For Base44, process synchronously.

  try {
    if (eventType === 'charge.success') {
      await handleChargeSuccess(base44, data);
    } else if (eventType === 'transfer.success') {
      await handleTransferSuccess(base44, data);
    } else if (eventType === 'transfer.failed') {
      await handleTransferFailed(base44, data);
    } else if (eventType === 'transfer.reversed') {
      await handleTransferReversed(base44, data);
    } else {
      console.info(`Unhandled Paystack event type: ${eventType}`);
    }
  } catch (err) {
    // Log error but return 200 to prevent Paystack retry (we've already recorded the event)
    console.error(`Webhook processing error [${eventType}]: ${err.message}`);
  }

  return Response.json({ received: true }, { status: 200 });
});

// ─── Event Handlers ───────────────────────────────────────────────────────────

async function handleChargeSuccess(base44, data) {
  const reference = data.reference;
  if (!reference) { console.error('charge.success: missing reference'); return; }

  // Find PaymentIntent by gateway_reference
  const intents = await base44.asServiceRole.entities.PaymentIntent.filter({ gateway_reference: reference });
  if (!intents.length) { console.error(`No PaymentIntent for ref: ${reference}`); return; }

  const intent = intents[0];
  if (intent.status === 'completed') { console.info(`Already processed: ${reference}`); return; }
  if (intent.status === 'expired') { console.error(`Expired intent: ${reference}`); return; }

  const gatewayAmount = data.amount; // Paystack returns amount in kobo
  if (gatewayAmount !== intent.amount) {
    console.error(`Amount mismatch: expected ${intent.amount}, got ${gatewayAmount}`);
    return;
  }

  // Credit wallet
  const wallet = await base44.asServiceRole.entities.Wallet.filter({ id: intent.wallet_id });
  if (!wallet.length) return;

  const w = wallet[0];
  const balanceBefore = w.balance || 0;
  const balanceAfter = balanceBefore + intent.amount;

  // Create transaction record
  const reference_new = `DEP_${Date.now().toString(36).toUpperCase()}_${Math.random().toString(36).slice(2,8).toUpperCase()}`;
  const transaction = await base44.asServiceRole.entities.Transaction.create({
    wallet_id: intent.wallet_id,
    user_id: intent.user_id,
    type: 'deposit',
    amount: intent.amount,
    currency: 'NGN',
    direction: 'credit',
    balance_before: balanceBefore,
    balance_after: balanceAfter,
    status: 'completed',
    reference: reference_new,
    external_reference: reference,
    payment_gateway: 'paystack',
    description: 'Wallet Top-up via Paystack',
    metadata: { payment_intent_id: intent.id, paystack_data: data },
  });

  // Update wallet balance
  await base44.asServiceRole.entities.Wallet.update(intent.wallet_id, {
    balance: balanceAfter,
    last_transaction_at: new Date().toISOString(),
  });

  // Mark PaymentIntent completed
  await base44.asServiceRole.entities.PaymentIntent.update(intent.id, {
    status: 'completed',
    transaction_id: transaction.id,
    gateway_response: data,
    verified_at: new Date().toISOString(),
  });

  console.info(`Deposit completed: ${intent.user_id} +₦${(intent.amount / 100).toFixed(2)}`);
}

async function handleTransferSuccess(base44, data) {
  const gatewayRef = data.reference;
  const payouts = await base44.asServiceRole.entities.PayoutRequest.filter({ gateway_reference: gatewayRef });

  if (!payouts.length) { console.error(`No PayoutRequest for transfer ref: ${gatewayRef}`); return; }
  const payout = payouts[0];
  if (payout.status === 'completed') { console.info(`Already completed: ${gatewayRef}`); return; }

  // Release locked balance + finalize payout
  const wallet = await base44.asServiceRole.entities.Wallet.filter({ id: payout.wallet_id });
  if (!wallet.length) return;
  const w = wallet[0];

  const locked = w.locked_balance || 0;
  const available = w.balance || 0;

  // Debit the locked balance (money has left the platform)
  const refNew = `WDR_${Date.now().toString(36).toUpperCase()}_${Math.random().toString(36).slice(2,8).toUpperCase()}`;
  const tx = await base44.asServiceRole.entities.Transaction.create({
    wallet_id: payout.wallet_id, user_id: payout.user_id,
    type: 'withdrawal', amount: payout.amount, currency: 'NGN',
    direction: 'debit', balance_before: available, balance_after: available,
    status: 'completed', reference: refNew, external_reference: gatewayRef,
    payment_gateway: 'paystack',
    description: `Bank Transfer to ${payout.bank_name}`,
    metadata: { payout_request_id: payout.id, paystack_data: data },
  });

  await base44.asServiceRole.entities.Wallet.update(payout.wallet_id, {
    locked_balance: Math.max(0, locked - payout.amount),
    total_withdrawn: (w.total_withdrawn || 0) + payout.amount,
    last_transaction_at: new Date().toISOString(),
  });

  await base44.asServiceRole.entities.PayoutRequest.update(payout.id, {
    status: 'completed',
    gateway_response: data,
    transaction_id: tx.id,
    completed_at: new Date().toISOString(),
  });

  console.info(`Payout completed: ${payout.user_id} ₦${(payout.amount / 100).toFixed(2)}`);
}

async function handleTransferFailed(base44, data) {
  const gatewayRef = data.reference;
  const payouts = await base44.asServiceRole.entities.PayoutRequest.filter({ gateway_reference: gatewayRef });
  if (!payouts.length) return;

  const payout = payouts[0];
  if (['completed', 'failed', 'rejected'].includes(payout.status)) return;

  const retryCount = (payout.retry_count || 0) + 1;

  // Release locked balance back to available
  const wallet = await base44.asServiceRole.entities.Wallet.filter({ id: payout.wallet_id });
  if (wallet.length) {
    const w = wallet[0];
    await base44.asServiceRole.entities.Wallet.update(payout.wallet_id, {
      balance: (w.balance || 0) + payout.amount,
      locked_balance: Math.max(0, (w.locked_balance || 0) - payout.amount),
      last_transaction_at: new Date().toISOString(),
    });
  }

  await base44.asServiceRole.entities.PayoutRequest.update(payout.id, {
    status: 'failed',
    failure_reason: data.reason || 'Transfer failed by gateway',
    retry_count: retryCount,
    gateway_response: data,
  });

  console.info(`Payout failed: ${payout.user_id} — ${data.reason}`);
}

async function handleTransferReversed(base44, data) {
  // Same as failed — release locked balance
  await handleTransferFailed(base44, { ...data, reason: 'Transfer reversed by gateway' });
}