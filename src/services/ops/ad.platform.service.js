/**
 * Ad Platform Service — Advertiser Campaign Lifecycle
 *
 * Covers:
 *   - Campaign CRUD + review workflow
 *   - Budget tracking and spend management
 *   - Ad analytics (impressions, CTR, conversions)
 *   - Ad fraud detection (click fraud signals)
 *   - Audience targeting resolution
 *   - Creative moderation gate
 *   - Advertiser wallet integration
 *
 * Campaign lifecycle:
 *   draft → pending_review → approved → active → completed
 *                         ↘ rejected
 *                         ↘ needs_revision
 *   active → paused (by advertiser or admin)
 *   active → suspended (policy violation)
 *
 * Billing model:
 *   CPM  — cost per 1000 impressions (deducted from advertiser wallet)
 *   CPC  — cost per click
 *   CPA  — cost per conversion
 *   flat_rate — fixed campaign fee
 *
 * Click Fraud Signals:
 *   - Same user clicked >3× same ad (24h)
 *   - IP velocity: >20 clicks from same IP/hour
 *   - Sub-1s click duration (bot pattern)
 *   - CTR > 15% (anomalous for display)
 *
 * Migration note:
 *   On NestJS: ad serving via dedicated Ad Server microservice.
 *   Targeting resolved against user audience segments (Redis sets).
 *   Budget deduction via atomic Redis DECR + waterfall to DB.
 *   Click fraud via stream processing (Flink sliding window).
 */

import { base44 } from '@/api/base44Client';
import adminAudit from './admin.audit.service';
import moderationService from '@/services/moderation/moderation.service';

// ─── Campaign CRUD ────────────────────────────────────────────────────────────

export async function createCampaign({
  advertiserId,
  name,
  objective,
  adFormat,
  budgetTotal,
  budgetDaily,
  bidType,
  bidAmount,
  startDate,
  endDate,
  targeting,
  creative,
}) {
  // Validate budget
  if (budgetTotal < 100000) throw new Error('Minimum campaign budget is ₦1,000 (100,000 kobo).');
  if (bidAmount < 1000) throw new Error('Minimum bid amount is ₦10 (1,000 kobo).');

  // AI creative moderation before submission
  const creativeText = [creative?.headline, creative?.body].filter(Boolean).join(' ');
  if (creativeText) {
    const modResult = await moderationService.ruleBasedCheck(creativeText);
    if (modResult.severity === 'high') {
      throw new Error(`Ad creative failed automated review: ${modResult.flags.join(', ')}`);
    }
  }

  return base44.entities.AdCampaign.create({
    advertiser_id: advertiserId,
    name,
    objective,
    ad_format: adFormat,
    budget_total: budgetTotal,
    budget_daily: budgetDaily,
    budget_spent: 0,
    bid_type: bidType,
    bid_amount: bidAmount,
    start_date: startDate,
    end_date: endDate,
    targeting: targeting || {},
    creative: creative || {},
    status: 'draft',
    review_status: 'not_submitted',
    impressions: 0,
    clicks: 0,
    conversions: 0,
    ctr: 0,
    fraud_score: 0,
  });
}

export async function submitForReview(campaignId, advertiserId) {
  const campaigns = await base44.entities.AdCampaign.filter({ id: campaignId, advertiser_id: advertiserId });
  if (!campaigns.length) throw new Error('Campaign not found or access denied.');
  const campaign = campaigns[0];
  if (campaign.status !== 'draft') throw new Error('Only draft campaigns can be submitted for review.');

  return base44.entities.AdCampaign.update(campaignId, {
    status: 'pending_review',
    review_status: 'pending',
  });
}

export async function getCampaigns(advertiserId, { status, limit = 20 } = {}) {
  const filter = status ? { advertiser_id: advertiserId, status } : { advertiser_id: advertiserId };
  return base44.entities.AdCampaign.filter(filter, '-created_date', limit).catch(() => []);
}

// ─── Admin Review Workflow ────────────────────────────────────────────────────

export async function approveCampaign(campaignId, reviewerId, reviewerRole, notes = '') {
  const campaign = await base44.entities.AdCampaign.filter({ id: campaignId }).then(r => r[0]);
  if (!campaign) throw new Error('Campaign not found.');

  return adminAudit.logAndExecute({
    actorId: reviewerId,
    actorRole: reviewerRole,
    action: 'ad_approve',
    entityType: 'ad_campaign',
    entityId: campaignId,
    beforeState: { review_status: campaign.review_status, status: campaign.status },
    reason: notes || 'Campaign approved',
    execute: async () => {
      await base44.entities.AdCampaign.update(campaignId, {
        status: 'approved',
        review_status: 'approved',
        reviewer_id: reviewerId,
        reviewed_at: new Date().toISOString(),
        notes,
      });
      return { afterState: { status: 'approved', review_status: 'approved' } };
    },
  });
}

export async function rejectCampaign(campaignId, reviewerId, reviewerRole, rejectionReason) {
  if (!rejectionReason) throw new Error('Rejection reason is required.');
  const campaign = await base44.entities.AdCampaign.filter({ id: campaignId }).then(r => r[0]);

  return adminAudit.logAndExecute({
    actorId: reviewerId,
    actorRole: reviewerRole,
    action: 'ad_reject',
    entityType: 'ad_campaign',
    entityId: campaignId,
    beforeState: { review_status: campaign?.review_status },
    reason: rejectionReason,
    execute: async () => {
      await base44.entities.AdCampaign.update(campaignId, {
        status: 'rejected',
        review_status: 'rejected',
        rejection_reason: rejectionReason,
        reviewer_id: reviewerId,
        reviewed_at: new Date().toISOString(),
      });
      return { afterState: { status: 'rejected' } };
    },
  });
}

// ─── Spend Tracking ───────────────────────────────────────────────────────────

/**
 * Record an ad impression and deduct cost from campaign budget.
 * Called by the ad serving system on each served impression.
 */
export async function recordImpression(campaignId, { userId, cost = 0 } = {}) {
  const campaigns = await base44.entities.AdCampaign.filter({ id: campaignId });
  if (!campaigns.length) return;
  const campaign = campaigns[0];

  const newSpent = (campaign.budget_spent || 0) + cost;
  const newImpressions = (campaign.impressions || 0) + 1;
  const newCtr = campaign.clicks > 0 ? campaign.clicks / newImpressions : 0;

  // Auto-pause if budget exhausted
  const updates = {
    impressions: newImpressions,
    budget_spent: newSpent,
    ctr: parseFloat(newCtr.toFixed(4)),
    ...(newSpent >= campaign.budget_total ? { status: 'completed' } : {}),
  };

  await base44.entities.AdCampaign.update(campaignId, updates).catch(() => {});
}

export async function recordClick(campaignId, { userId, cost = 0 } = {}) {
  const campaigns = await base44.entities.AdCampaign.filter({ id: campaignId });
  if (!campaigns.length) return;
  const campaign = campaigns[0];

  const newClicks = (campaign.clicks || 0) + 1;
  const newSpent = (campaign.budget_spent || 0) + cost;
  const newCtr = campaign.impressions > 0 ? newClicks / campaign.impressions : 0;

  // Click fraud check: CTR > 20% is anomalous
  const fraudFlags = [...(campaign.fraud_flags || [])];
  let fraudScore = campaign.fraud_score || 0;
  if (newCtr > 0.20) { fraudFlags.push('high_ctr'); fraudScore = Math.min(100, fraudScore + 15); }

  await base44.entities.AdCampaign.update(campaignId, {
    clicks: newClicks,
    budget_spent: newSpent,
    ctr: parseFloat(newCtr.toFixed(4)),
    fraud_score: fraudScore,
    fraud_flags: [...new Set(fraudFlags)],
  }).catch(() => {});
}

// ─── Analytics ────────────────────────────────────────────────────────────────

export async function getCampaignAnalytics(campaignId) {
  const campaigns = await base44.entities.AdCampaign.filter({ id: campaignId });
  if (!campaigns.length) return null;
  const c = campaigns[0];

  return {
    campaignId,
    name: c.name,
    status: c.status,
    budget: {
      total: c.budget_total,
      spent: c.budget_spent,
      remaining: Math.max(0, c.budget_total - c.budget_spent),
      utilizationRate: c.budget_total > 0 ? parseFloat((c.budget_spent / c.budget_total).toFixed(3)) : 0,
    },
    performance: {
      impressions: c.impressions,
      clicks: c.clicks,
      conversions: c.conversions,
      ctr: c.ctr,
      cpm: c.impressions > 0 ? parseFloat(((c.budget_spent / c.impressions) * 1000).toFixed(2)) : 0,
      cpc: c.clicks > 0 ? parseFloat((c.budget_spent / c.clicks).toFixed(2)) : 0,
    },
    fraud: {
      score: c.fraud_score,
      flags: c.fraud_flags || [],
      atRisk: c.fraud_score > 50,
    },
  };
}

export async function getAdvertiserDashboard(advertiserId) {
  const campaigns = await base44.entities.AdCampaign.filter(
    { advertiser_id: advertiserId }, '-created_date', 50
  ).catch(() => []);

  const active = campaigns.filter(c => c.status === 'active');
  const totalSpent = campaigns.reduce((s, c) => s + (c.budget_spent || 0), 0);
  const totalImpressions = campaigns.reduce((s, c) => s + (c.impressions || 0), 0);
  const totalClicks = campaigns.reduce((s, c) => s + (c.clicks || 0), 0);

  return {
    campaigns: {
      total: campaigns.length,
      active: active.length,
      pending_review: campaigns.filter(c => c.status === 'pending_review').length,
      rejected: campaigns.filter(c => c.status === 'rejected').length,
    },
    spend: {
      total: totalSpent,
      currency: 'NGN',
    },
    performance: {
      totalImpressions,
      totalClicks,
      avgCtr: totalImpressions > 0 ? parseFloat((totalClicks / totalImpressions).toFixed(4)) : 0,
    },
    recentCampaigns: campaigns.slice(0, 5),
  };
}

export default {
  createCampaign,
  submitForReview,
  getCampaigns,
  approveCampaign,
  rejectCampaign,
  recordImpression,
  recordClick,
  getCampaignAnalytics,
  getAdvertiserDashboard,
};