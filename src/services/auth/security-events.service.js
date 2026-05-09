/**
 * Security Events Service
 *
 * Centralizes all platform security notifications:
 * — Login alerts
 * — Suspicious activity signals
 * — Moderation action notifications
 * — Account status change alerts
 * — Verification lifecycle events
 *
 * Architecture:
 * - All events write a Notification record (picked up by NotificationProvider realtime)
 * - Future: Also emit to a SecurityEvent entity for audit log
 * - Future: Trigger FCM push for critical alerts (login from new device, ban)
 *
 * Migration note:
 * On NestJS, each function becomes an event handler in SecurityEventsModule,
 * triggered by EventEmitter2 domain events. The Notification write stays identical.
 */

import notificationService from '@/services/notifications/notification.service';

/**
 * Notify user of a login from a new or unrecognized context.
 * Future: enrich with device fingerprint, IP, geolocation.
 *
 * @param {string} recipientId — UserProfile ID
 * @param {object} context     — { device?: string, location?: string }
 */
async function loginAlert(recipientId, context = {}) {
  const device = context.device || 'Unknown device';
  const location = context.location || 'Unknown location';

  return notificationService.createNotification({
    recipient_id: recipientId,
    type: 'system_alert',
    title: 'New sign-in detected',
    body: `Your account was accessed from ${device}${location !== 'Unknown location' ? ` in ${location}` : ''}. If this wasn't you, secure your account immediately.`,
    entity_type: 'user',
    entity_id: recipientId,
    deep_link: '/settings/security',
    metadata: { event: 'login_alert', ...context },
  });
}

/**
 * Notify user that their account has been suspended.
 *
 * @param {string} recipientId — UserProfile ID
 * @param {string} reason      — Human-readable reason
 */
async function accountSuspended(recipientId, reason = '') {
  return notificationService.createNotification({
    recipient_id: recipientId,
    type: 'moderation_action',
    title: 'Your account has been suspended',
    body: reason || 'Your account has been temporarily suspended due to a violation of our community guidelines.',
    entity_type: 'user',
    entity_id: recipientId,
    deep_link: '/support',
    metadata: { event: 'account_suspended', reason },
  });
}

/**
 * Notify user that their account suspension has been lifted.
 */
async function accountUnsuspended(recipientId) {
  return notificationService.createNotification({
    recipient_id: recipientId,
    type: 'system_alert',
    title: 'Account restored',
    body: 'Your account suspension has been lifted. Welcome back!',
    entity_type: 'user',
    entity_id: recipientId,
    deep_link: '/',
    metadata: { event: 'account_unsuspended' },
  });
}

/**
 * Notify user of a content removal moderation action.
 *
 * @param {string} recipientId  — UserProfile ID
 * @param {string} contentType  — 'post' | 'comment' | 'listing'
 * @param {string} reason       — Reason for removal
 */
async function contentRemoved(recipientId, contentType = 'content', reason = '') {
  return notificationService.createNotification({
    recipient_id: recipientId,
    type: 'moderation_action',
    title: `Your ${contentType} was removed`,
    body: reason || `Your ${contentType} was removed for violating our community guidelines.`,
    entity_type: contentType,
    entity_id: recipientId,
    deep_link: '/support',
    metadata: { event: 'content_removed', contentType, reason },
  });
}

/**
 * Notify user that their verification was approved.
 *
 * @param {string} recipientId       — UserProfile ID
 * @param {string} verificationType  — 'email' | 'identity' | 'educator' | 'school'
 */
async function verificationApproved(recipientId, verificationType) {
  const labels = {
    email:    'Email',
    identity: 'Identity',
    educator: 'Educator',
    school:   'School',
  };
  const label = labels[verificationType] || 'Account';

  return notificationService.createNotification({
    recipient_id: recipientId,
    type: 'system_alert',
    title: `${label} verification approved`,
    body: `Your ${label.toLowerCase()} verification has been approved. Your account now has enhanced trust status.`,
    entity_type: 'user',
    entity_id: recipientId,
    deep_link: '/profile',
    metadata: { event: 'verification_approved', verificationType },
  });
}

/**
 * Notify user that their verification was rejected.
 */
async function verificationRejected(recipientId, verificationType, reason = '') {
  const labels = { email: 'Email', identity: 'Identity', educator: 'Educator', school: 'School' };
  const label = labels[verificationType] || 'Account';

  return notificationService.createNotification({
    recipient_id: recipientId,
    type: 'system_alert',
    title: `${label} verification unsuccessful`,
    body: reason || `Your ${label.toLowerCase()} verification could not be completed. Please review your submission and try again.`,
    entity_type: 'user',
    entity_id: recipientId,
    deep_link: '/settings/verification',
    metadata: { event: 'verification_rejected', verificationType, reason },
  });
}

/**
 * Issue a formal warning to a user (below suspension threshold).
 */
async function accountWarning(recipientId, reason = '') {
  return notificationService.createNotification({
    recipient_id: recipientId,
    type: 'moderation_action',
    title: 'Account warning',
    body: reason || 'Your account has received a warning. Continued violations may result in suspension.',
    entity_type: 'user',
    entity_id: recipientId,
    deep_link: '/support',
    metadata: { event: 'account_warning', reason },
  });
}

/**
 * Notify user that a wallet transaction was flagged for review.
 * Future: Integrates with fraud detection pipeline.
 */
async function transactionFlagged(recipientId, transactionId, reason = '') {
  return notificationService.createNotification({
    recipient_id: recipientId,
    type: 'wallet_debit',
    title: 'Transaction flagged for review',
    body: reason || 'A recent transaction on your account has been flagged for security review.',
    entity_type: 'transaction',
    entity_id: transactionId,
    deep_link: '/wallet',
    metadata: { event: 'transaction_flagged', transactionId, reason },
  });
}

export default {
  loginAlert,
  accountSuspended,
  accountUnsuspended,
  contentRemoved,
  verificationApproved,
  verificationRejected,
  accountWarning,
  transactionFlagged,
};