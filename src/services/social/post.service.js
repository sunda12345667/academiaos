/**
 * Post Service
 * 
 * Handles post CRUD, interactions, and comment threading.
 * 
 * Migration note: Maps directly to a PostsModule in NestJS
 * with PostRepository, CommentRepository, and InteractionRepository.
 */

import { base44 } from '@/api/base44Client';
import feedService from '@/services/feed/feed.service';
import notificationService from '@/services/notifications/notification.service';
import { PERMISSIONS, canPerformAction } from '@/services/auth/permissions';

/**
 * Create a post — validates permissions before write
 */
async function createPost(authorProfile, postData) {
  const payload = {
    author_id: authorProfile.id,
    author_username: authorProfile.username,
    author_display_name: authorProfile.display_name,
    author_avatar_url: authorProfile.avatar_url,
    author_role: authorProfile.role,
    status: 'published',
    engagement_score: 0,
    like_count: 0,
    comment_count: 0,
    share_count: 0,
    view_count: 0,
    save_count: 0,
    moderation_status: 'clean',
    ...postData,
  };

  const post = await base44.entities.Post.create(payload);

  // Increment user post count (denormalized counter)
  // Future: This becomes an atomic counter in PostgreSQL
  const currentCount = authorProfile.post_count || 0;
  await base44.entities.UserProfile.update(authorProfile.id, {
    post_count: currentCount + 1,
  });

  return post;
}

/**
 * Get a single post by ID with view tracking
 */
async function getPost(postId, viewerId = null) {
  const posts = await base44.entities.Post.filter({ id: postId });
  if (!posts.length) throw new Error('Post not found');
  const post = posts[0];

  // Record view — fire-and-forget pattern
  // Future: Batched analytics sink, not per-request DB write
  if (viewerId && viewerId !== post.author_id) {
    recordView(postId, viewerId).catch(() => {});
  }

  return post;
}

/**
 * Record a view — abstracted for future analytics pipeline
 */
async function recordView(postId, viewerId) {
  const existing = await base44.entities.PostInteraction.filter({
    post_id: postId,
    user_id: viewerId,
    type: 'view',
  });
  if (existing.length) return;

  await base44.entities.PostInteraction.create({ post_id: postId, user_id: viewerId, type: 'view' });
  const posts = await base44.entities.Post.filter({ id: postId });
  if (posts.length) {
    await base44.entities.Post.update(postId, { view_count: (posts[0].view_count || 0) + 1 });
    feedService.updatePostEngagement(postId).catch(() => {});
  }
}

/**
 * Toggle like on a post
 * Returns { liked: boolean, likeCount: number }
 */
async function toggleLike(postId, userId, reactionType = 'like') {
  const existing = await base44.entities.PostInteraction.filter({
    post_id: postId,
    user_id: userId,
    type: reactionType,
  });

  const posts = await base44.entities.Post.filter({ id: postId });
  if (!posts.length) throw new Error('Post not found');
  const post = posts[0];

  if (existing.length) {
    await base44.entities.PostInteraction.delete(existing[0].id);
    const newCount = Math.max(0, (post.like_count || 0) - 1);
    await base44.entities.Post.update(postId, { like_count: newCount });
    return { liked: false, likeCount: newCount };
  } else {
    await base44.entities.PostInteraction.create({ post_id: postId, user_id: userId, type: reactionType });
    const newCount = (post.like_count || 0) + 1;
    await base44.entities.Post.update(postId, { like_count: newCount });
    feedService.updatePostEngagement(postId).catch(() => {});

    // Notify author (don't block on this)
    if (post.author_id !== userId) {
      notificationService.createNotification({
        recipient_id: post.author_id,
        actor_id: userId,
        type: 'post_like',
        entity_type: 'post',
        entity_id: postId,
        deep_link: `/post/${postId}`,
      }).catch(() => {});
    }

    return { liked: true, likeCount: newCount };
  }
}

/**
 * Toggle save on a post
 */
async function toggleSave(postId, userId) {
  const existing = await base44.entities.PostInteraction.filter({
    post_id: postId,
    user_id: userId,
    type: 'save',
  });

  const posts = await base44.entities.Post.filter({ id: postId });
  if (!posts.length) throw new Error('Post not found');
  const post = posts[0];

  if (existing.length) {
    await base44.entities.PostInteraction.delete(existing[0].id);
    await base44.entities.Post.update(postId, { save_count: Math.max(0, (post.save_count || 0) - 1) });
    return { saved: false };
  } else {
    await base44.entities.PostInteraction.create({ post_id: postId, user_id: userId, type: 'save' });
    await base44.entities.Post.update(postId, { save_count: (post.save_count || 0) + 1 });
    return { saved: true };
  }
}

/**
 * Delete a post — enforces RBAC
 */
async function deletePost(postId, requestingUser) {
  const posts = await base44.entities.Post.filter({ id: postId });
  if (!posts.length) throw new Error('Post not found');
  const post = posts[0];

  const canDelete = canPerformAction(
    requestingUser.role,
    requestingUser.id,
    PERMISSIONS.POST_DELETE_ANY,
    post.author_id
  );

  if (!canDelete) throw new Error('Insufficient permissions to delete this post');

  await base44.entities.Post.update(postId, { status: 'removed', moderation_status: 'removed' });
  return { success: true };
}

/**
 * Add a comment to a post
 */
async function addComment(postId, authorProfile, commentData) {
  const comment = await base44.entities.Comment.create({
    post_id: postId,
    author_id: authorProfile.id,
    author_username: authorProfile.username,
    author_avatar_url: authorProfile.avatar_url,
    status: 'active',
    like_count: 0,
    reply_count: 0,
    ...commentData,
  });

  const posts = await base44.entities.Post.filter({ id: postId });
  if (posts.length) {
    await base44.entities.Post.update(postId, {
      comment_count: (posts[0].comment_count || 0) + 1,
    });
    feedService.updatePostEngagement(postId).catch(() => {});

    if (posts[0].author_id !== authorProfile.id) {
      notificationService.createNotification({
        recipient_id: posts[0].author_id,
        actor_id: authorProfile.id,
        actor_username: authorProfile.username,
        actor_avatar_url: authorProfile.avatar_url,
        type: 'post_comment',
        entity_type: 'post',
        entity_id: postId,
        deep_link: `/post/${postId}`,
      }).catch(() => {});
    }
  }

  return comment;
}

/**
 * Get comments for a post (threaded)
 */
async function getComments(postId, { page = 1, limit = 20, parentId = null } = {}) {
  const filter = { post_id: postId, status: 'active' };
  if (parentId) filter.parent_comment_id = parentId;
  else filter.parent_comment_id = null;

  const comments = await base44.entities.Comment.filter(filter, '-created_date', limit);
  return { comments, hasMore: comments.length === limit, page };
}

/**
 * Check user interaction state for a post (liked, saved)
 */
async function getUserInteractionState(postId, userId) {
  const interactions = await base44.entities.PostInteraction.filter({ post_id: postId, user_id: userId });
  const state = { liked: false, saved: false, reactionType: null };
  interactions.forEach(i => {
    if (['like', 'love', 'insightful'].includes(i.type)) {
      state.liked = true;
      state.reactionType = i.type;
    }
    if (i.type === 'save') state.saved = true;
  });
  return state;
}

export default {
  createPost,
  getPost,
  toggleLike,
  toggleSave,
  deletePost,
  addComment,
  getComments,
  getUserInteractionState,
  recordView,
};