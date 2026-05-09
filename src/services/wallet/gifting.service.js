/**
 * Gifting Service — Creator Economy Gift Infrastructure
 *
 * Architecture:
 *   Gifts flow through a COIN layer (not direct NGN):
 *     User buys coins (NGN → coins via PaymentIntent)
 *     User sends gift (coins → gift → creator NGN credit)
 *
 *   This provides:
 *     - Impulse purchase friction reduction (already have coins)
 *     - Revenue recognition timing control
 *     - Anti-chargeback buffer (coins are non-refundable once purchased)
 *     - Platform rate control (can adjust coin/NGN ratio without UI changes)
 *
 * Revenue split:
 *   Creator gets 70% of gift naira value → creditWallet(creator)
 *   Platform keeps 30% → recorded as platform_fee transaction
 *
 * Realtime propagation:
 *   Gift write → FraudSignal check → Wallet credits → Gift status='delivered'
 *   UI layer subscribes to Gift entity for animation trigger
 *
 * Anti-abuse:
 *   - riskEngine.evaluateGift() called before every gift
 *   - Self-gifting blocked at risk engine level
 *   - Velocity limits enforced (max 20 gifts/hour)
 *   - High-value gifts (>₦2,000) trigger FraudSignal
 *
 * Migration note:
 *   On NestJS: gift processing becomes a queue job (Bull/BullMQ).
 *   Coin balance stored in Redis with Lua atomic scripts.
 *   Gift animation events pushed via WebSocket to live session room.
 */

import { base44 } from '@/api/base44Client';
import walletService from './wallet.service';
import riskEngine from './risk.engine';

// ─── Gift Catalog ─────────────────────────────────────────────────────────────

async function getGiftCatalog({ category, tier } = {}) {
  const filter = { is_active: true };
  if (category) filter.category = category;
  if (tier) filter.tier = tier;
  return base44.entities.GiftCatalogItem.filter(filter, 'sort_order', 50);
}

async function getGiftItem(giftItemId) {
  const items = await base44.entities.GiftCatalogItem.filter({ id: giftItemId });
  return items[0] || null;
}

// ─── Send Gift ────────────────────────────────────────────────────────────────

/**
 * Send a gift from sender to creator.
 *
 * Flow:
 *   1. Validate gift item + sender balance
 *   2. Risk evaluation (self-gifting, velocity, value)
 *   3. Create Gift record (status=pending)
 *   4. Debit sender wallet (coins converted → naira debit)
 *   5. Credit creator wallet (naira_value × creator_share)
 *   6. Record platform fee
 *   7. Update Gift status=delivered
 *   8. Update CreatorProfile.total_earnings
 *
 * Returns { gift, senderTx, creatorTx, animationData }
 */
async function sendGift({
  senderId,
  recipientId,
  giftItemId,
  sessionId,
  postId,
  message,
  isAnonymous = false,
  context = 'live_session',
}) {
  // 1. Load gift item
  const giftItem = await getGiftItem(giftItemId);
  if (!giftItem) throw new Error('Gift item not found');
  if (!giftItem.is_active) throw new Error('Gift item is not available');

  const nairaValue = giftItem.naira_value; // in kobo
  const creatorCut = Math.floor(nairaValue * (giftItem.creator_share_percent / 100));
  const platformFee = nairaValue - creatorCut;

  // 2. Risk evaluation
  const { action, score, signals } = await riskEngine.evaluateGift(senderId, recipientId, nairaValue, sessionId);
  if (action === 'block') {
    throw new Error('Gift blocked — security policy. Please contact support.');
  }

  // 3. Validate sender balance
  const senderBalance = await walletService.getBalance(senderId);
  if (senderBalance.available < nairaValue) {
    throw new Error(`Insufficient balance. Needed: ₦${(nairaValue / 100).toFixed(2)}, Available: ₦${(senderBalance.available / 100).toFixed(2)}`);
  }

  // 4. Create Gift record (pending)
  const gift = await base44.entities.Gift.create({
    sender_id: senderId,
    recipient_id: recipientId,
    session_id: sessionId,
    post_id: postId,
    gift_item_id: giftItemId,
    gift_name: giftItem.name,
    gift_emoji: giftItem.emoji,
    gift_animation_key: giftItem.animation_key,
    coin_cost: giftItem.coin_cost,
    naira_value: nairaValue,
    creator_naira_credit: creatorCut,
    platform_fee: platformFee,
    context,
    message,
    is_anonymous: isAnonymous,
    status: 'pending',
  });

  // 5. Debit sender wallet
  const { transaction: senderTx } = await walletService.debitWallet(senderId, {
    amount: nairaValue,
    type: 'tip',
    description: `Gift: ${giftItem.name}${sessionId ? ' (live)' : ''}`,
    referencePrefix: 'GFT',
    relatedEntityType: 'gift',
    relatedEntityId: gift.id,
    counterpartyId: recipientId,
    metadata: { gift_item_id: giftItemId, context, risk_score: score, risk_flags: signals },
  });

  // 6. Credit creator
  let creatorTx;
  try {
    const result = await walletService.creditWallet(recipientId, {
      amount: creatorCut,
      type: 'tip_received',
      description: `Gift received: ${giftItem.name}${isAnonymous ? '' : ` from ${senderId}`}`,
      referencePrefix: 'GFR',
      relatedEntityType: 'gift',
      relatedEntityId: gift.id,
      counterpartyId: isAnonymous ? null : senderId,
      metadata: {
        gift_item_id: giftItemId,
        gross_amount: nairaValue,
        platform_fee: platformFee,
        creator_share_percent: giftItem.creator_share_percent,
      },
    });
    creatorTx = result.transaction;
  } catch (err) {
    // Compensation: refund sender
    await walletService.creditWallet(senderId, {
      amount: nairaValue,
      type: 'refund',
      description: `Gift refund: ${giftItem.name} (delivery failed)`,
      referencePrefix: 'REF',
      relatedEntityId: gift.id,
      metadata: { original_tx_id: senderTx.id, reason: err.message },
    });
    await base44.entities.Gift.update(gift.id, { status: 'failed' });
    throw new Error(`Gift delivery failed and was refunded: ${err.message}`);
  }

  // 7. Update gift status + transaction references
  await base44.entities.Gift.update(gift.id, {
    status: 'delivered',
    transaction_id: senderTx.id,
  });

  // 8. Update creator profile earnings (fire-and-forget)
  updateCreatorEarnings(recipientId, creatorCut).catch(() => {});

  return {
    gift: { ...gift, status: 'delivered' },
    senderTx,
    creatorTx,
    animationData: {
      key: giftItem.animation_key,
      emoji: giftItem.emoji,
      name: giftItem.name,
      tier: giftItem.tier,
      senderName: isAnonymous ? 'Anonymous' : senderId,
    },
  };
}

// ─── Gift Analytics ───────────────────────────────────────────────────────────

async function getSessionGiftSummary(sessionId) {
  const gifts = await base44.entities.Gift.filter(
    { session_id: sessionId, status: 'delivered' },
    '-created_date',
    200
  );

  const totalValue = gifts.reduce((sum, g) => sum + g.naira_value, 0);
  const creatorEarnings = gifts.reduce((sum, g) => sum + g.creator_naira_credit, 0);
  const platformEarnings = gifts.reduce((sum, g) => sum + g.platform_fee, 0);

  const topGifters = Object.entries(
    gifts.reduce((acc, g) => {
      acc[g.sender_id] = (acc[g.sender_id] || 0) + g.naira_value;
      return acc;
    }, {})
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([userId, total]) => ({ userId, total }));

  const giftCounts = gifts.reduce((acc, g) => {
    acc[g.gift_name] = (acc[g.gift_name] || 0) + 1;
    return acc;
  }, {});

  return { totalGifts: gifts.length, totalValue, creatorEarnings, platformEarnings, topGifters, giftCounts };
}

async function getCreatorGiftHistory(recipientId, { limit = 50 } = {}) {
  return base44.entities.Gift.filter(
    { recipient_id: recipientId, status: 'delivered' },
    '-created_date',
    limit
  );
}

// ─── Private Helpers ──────────────────────────────────────────────────────────

async function updateCreatorEarnings(creatorProfileId, amount) {
  const profiles = await base44.entities.CreatorProfile.filter({ user_id: creatorProfileId });
  if (!profiles.length) return;
  const cp = profiles[0];
  await base44.entities.CreatorProfile.update(cp.id, {
    total_earnings: (cp.total_earnings || 0) + amount,
  });
}

export default {
  getGiftCatalog,
  getGiftItem,
  sendGift,
  getSessionGiftSummary,
  getCreatorGiftHistory,
};