/**
 * Social Notification Events
 *
 * Standardized event dispatch for all social interactions.
 * Centralizes the "what triggers a notification" contract so
 * individual services only call dispatchXxx() without knowing
 * the notification schema.
 *
 * Event propagation strategy:
 *   1. User action triggers service call (e.g., commentService.create)
 *   2. Service calls dispatchXxx() — fire-and-forget (.catch(() => {}))
 *   3. createNotification() deduplicates within 60s window
 *   4. RealtimeBus delivers to recipient's NotificationProvider
 *   5. Future: FCM/APNs push via separate worker for mobile
 *
 * Notification deep_link format:
 *   /profile/:username         — user actions (follows, mentions)
 *   /posts/:postId             — post actions (likes, comments)
 *   /groups/:groupId           — group events
 *   /messages/:conversationId  — new messages
 *   /wallet                    — wallet events
 */

import notificationService from '@/services/notifications/notification.service';

// ─── Social Graph Events ──────────────────────────────────────────────────────

export async function onUserFollowed(actorProfile, recipientProfileId) {
  return notificationService.createNotification({
    recipient_id: recipientProfileId,
    actor_id: actorProfile.id,
    actor_username: actorProfile.username,
    actor_avatar_url: actorProfile.avatar_url,
    type: 'new_follower',
    title: `${actorProfile.display_name} started following you`,
    entity_type: 'user',
    entity_id: actorProfile.id,
    deep_link: `/profile/${actorProfile.username}`,
  });
}

// ─── Post Events ──────────────────────────────────────────────────────────────

export async function onPostLiked(actorProfile, postAuthorProfileId, postId) {
  if (actorProfile.id === postAuthorProfileId) return;
  return notificationService.createNotification({
    recipient_id: postAuthorProfileId,
    actor_id: actorProfile.id,
    actor_username: actorProfile.username,
    actor_avatar_url: actorProfile.avatar_url,
    type: 'post_like',
    title: `${actorProfile.display_name} liked your post`,
    entity_type: 'post',
    entity_id: postId,
    deep_link: `/posts/${postId}`,
  });
}

export async function onPostCommented(actorProfile, postAuthorProfileId, postId, commentPreview) {
  if (actorProfile.id === postAuthorProfileId) return;
  return notificationService.createNotification({
    recipient_id: postAuthorProfileId,
    actor_id: actorProfile.id,
    actor_username: actorProfile.username,
    actor_avatar_url: actorProfile.avatar_url,
    type: 'post_comment',
    title: `${actorProfile.display_name} commented on your post`,
    body: commentPreview?.slice(0, 80),
    entity_type: 'post',
    entity_id: postId,
    deep_link: `/posts/${postId}`,
  });
}

export async function onCommentReplied(actorProfile, parentCommentAuthorProfileId, postId, replyPreview) {
  if (actorProfile.id === parentCommentAuthorProfileId) return;
  return notificationService.createNotification({
    recipient_id: parentCommentAuthorProfileId,
    actor_id: actorProfile.id,
    actor_username: actorProfile.username,
    actor_avatar_url: actorProfile.avatar_url,
    type: 'comment_reply',
    title: `${actorProfile.display_name} replied to your comment`,
    body: replyPreview?.slice(0, 80),
    entity_type: 'post',
    entity_id: postId,
    deep_link: `/posts/${postId}`,
  });
}

export async function onPostShared(actorProfile, postAuthorProfileId, postId) {
  if (actorProfile.id === postAuthorProfileId) return;
  return notificationService.createNotification({
    recipient_id: postAuthorProfileId,
    actor_id: actorProfile.id,
    actor_username: actorProfile.username,
    actor_avatar_url: actorProfile.avatar_url,
    type: 'post_share',
    title: `${actorProfile.display_name} shared your post`,
    entity_type: 'post',
    entity_id: postId,
    deep_link: `/posts/${postId}`,
  });
}

// ─── Mention Events ───────────────────────────────────────────────────────────

/**
 * Parse @mentions from content string and dispatch notifications.
 * Future: Replace with server-side mention extraction to prevent client spoofing.
 */
export async function dispatchMentionNotifications(actorProfile, content, postId, mentionedUserIds = []) {
  const ops = mentionedUserIds
    .filter(uid => uid !== actorProfile.id)
    .map(uid => notificationService.createNotification({
      recipient_id: uid,
      actor_id: actorProfile.id,
      actor_username: actorProfile.username,
      actor_avatar_url: actorProfile.avatar_url,
      type: 'mention',
      title: `${actorProfile.display_name} mentioned you`,
      body: content?.slice(0, 80),
      entity_type: 'post',
      entity_id: postId,
      deep_link: `/posts/${postId}`,
    }).catch(() => {}));

  await Promise.allSettled(ops);
}

// ─── Message Events ───────────────────────────────────────────────────────────

export async function onNewMessage(actorProfile, recipientProfileId, conversationId, preview) {
  if (actorProfile.id === recipientProfileId) return;
  return notificationService.createNotification({
    recipient_id: recipientProfileId,
    actor_id: actorProfile.id,
    actor_username: actorProfile.username,
    actor_avatar_url: actorProfile.avatar_url,
    type: 'new_message',
    title: `New message from ${actorProfile.display_name}`,
    body: preview?.slice(0, 80),
    entity_type: 'conversation',
    entity_id: conversationId,
    deep_link: `/messages/${conversationId}`,
  });
}

// ─── Group Events ─────────────────────────────────────────────────────────────

export async function onGroupInvite(actorProfile, recipientProfileId, groupId, groupName) {
  return notificationService.createNotification({
    recipient_id: recipientProfileId,
    actor_id: actorProfile.id,
    actor_username: actorProfile.username,
    actor_avatar_url: actorProfile.avatar_url,
    type: 'group_invite',
    title: `${actorProfile.display_name} invited you to ${groupName}`,
    entity_type: 'group',
    entity_id: groupId,
    deep_link: `/groups/${groupId}`,
  });
}

export async function onGroupJoinApproved(groupId, groupName, recipientProfileId) {
  return notificationService.createNotification({
    recipient_id: recipientProfileId,
    type: 'group_join_approved',
    title: `Your request to join ${groupName} was approved`,
    entity_type: 'group',
    entity_id: groupId,
    deep_link: `/groups/${groupId}`,
  });
}

// ─── Wallet Events ────────────────────────────────────────────────────────────

export async function onWalletCredit(recipientProfileId, amount, currency, description) {
  return notificationService.createNotification({
    recipient_id: recipientProfileId,
    type: 'wallet_credit',
    title: `You received ${currency} ${(amount / 100).toFixed(2)}`,
    body: description,
    entity_type: 'wallet',
    deep_link: '/wallet',
  });
}

export async function onWalletDebit(recipientProfileId, amount, currency, description) {
  return notificationService.createNotification({
    recipient_id: recipientProfileId,
    type: 'wallet_debit',
    title: `${currency} ${(amount / 100).toFixed(2)} debited from your wallet`,
    body: description,
    entity_type: 'wallet',
    deep_link: '/wallet',
  });
}

// ─── Course Events ────────────────────────────────────────────────────────────

export async function onCourseUpdate(instructorProfile, enrolledProfileIds, courseId, updateMessage) {
  const ops = enrolledProfileIds.map(uid =>
    notificationService.createNotification({
      recipient_id: uid,
      actor_id: instructorProfile.id,
      actor_username: instructorProfile.username,
      actor_avatar_url: instructorProfile.avatar_url,
      type: 'course_update',
      title: updateMessage,
      entity_type: 'course',
      entity_id: courseId,
      deep_link: `/courses/${courseId}`,
    }).catch(() => {})
  );
  await Promise.allSettled(ops);
}

const notificationEvents = {
  onUserFollowed,
  onPostLiked,
  onPostCommented,
  onCommentReplied,
  onPostShared,
  dispatchMentionNotifications,
  onNewMessage,
  onGroupInvite,
  onGroupJoinApproved,
  onWalletCredit,
  onWalletDebit,
  onCourseUpdate,
};

export default notificationEvents;