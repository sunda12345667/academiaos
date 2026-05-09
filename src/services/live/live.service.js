/**
 * Live Session Service
 *
 * Manages live teaching sessions: scheduling, start/end lifecycle,
 * viewer tracking, moderation, Q&A, reactions, and replay pipeline.
 *
 * Architecture:
 *   LiveSession    — persistent session metadata (scheduled → live → ended)
 *   Message        — live chat messages (conversation_id linked to session)
 *   Notification   — session start alerts to followers/group members
 *
 * Realtime flow:
 *   LiveSession entity subscription → LiveSessionProvider updates viewer UI
 *   Message entity subscription (scoped to session conversation) → live chat
 *
 * Stream providers (future):
 *   Agora    — low-latency interactive live (education, Q&A)
 *   LiveKit  — open-source WebRTC (co-host, breakout rooms)
 *   Mux      — HLS broadcast (large audiences, replay-first)
 *   100ms    — conferencing (classroom sessions)
 *
 * Migration note:
 *   viewer_count updates → Redis INCR with periodic flush to DB (not per-join write)
 *   Live chat → dedicated WS channel, NOT base44 Message entity
 *   Reactions → ephemeral Redis pub/sub, never persisted
 *   Recording → Mux/Cloudflare Stream webhook → replay_url update
 */

import { base44 } from '@/api/base44Client';
import notificationService from '@/services/notifications/notification.service';
import conversationService from '@/services/messaging/conversation.service';

// ─── Session Lifecycle ────────────────────────────────────────────────────────

export async function scheduleLiveSession({
  hostProfileId,
  hostUsername,
  hostAvatarUrl,
  title,
  description,
  type,
  visibility,
  scheduledAt,
  groupId,
  courseId,
  schoolId,
  subjectTags,
  thumbnailUrl,
  isMonetized,
  ticketPrice,
}) {
  const session = await base44.entities.LiveSession.create({
    host_id: hostProfileId,
    host_username: hostUsername,
    host_avatar_url: hostAvatarUrl,
    title,
    description,
    type: type || 'broadcast',
    visibility: visibility || 'public',
    status: 'scheduled',
    scheduled_at: scheduledAt,
    group_id: groupId,
    course_id: courseId,
    school_id: schoolId,
    subject_tags: subjectTags || [],
    thumbnail_url: thumbnailUrl,
    is_monetized: isMonetized || false,
    ticket_price: ticketPrice,
    current_viewer_count: 0,
    peak_viewer_count: 0,
    total_viewer_count: 0,
    allow_questions: true,
    allow_reactions: true,
    moderation_mode: 'open',
    stream_provider: 'internal',
  });

  return session;
}

export async function startLiveSession(sessionId, hostProfileId) {
  const sessions = await base44.entities.LiveSession.filter({ id: sessionId });
  if (!sessions.length) throw new Error('Session not found');
  const session = sessions[0];

  if (session.host_id !== hostProfileId) throw new Error('Only the host can start this session');
  if (session.status === 'live') return session;

  const started = await base44.entities.LiveSession.update(sessionId, {
    status: 'live',
    started_at: new Date().toISOString(),
  });

  // Create a linked conversation for live chat (if not exists)
  const chatConv = await conversationService.createGroupConversation({
    name: `${session.title} — Live Chat`,
    participantIds: [hostProfileId],
    createdById: hostProfileId,
    groupId: sessionId, // repurpose group_id field to link session
  }).catch(() => null);

  // Notify followers about the live session
  _notifyFollowers(hostProfileId, session).catch(() => {});

  return { session: started, chatConversationId: chatConv?.id };
}

export async function endLiveSession(sessionId, hostProfileId) {
  const sessions = await base44.entities.LiveSession.filter({ id: sessionId });
  if (!sessions.length) throw new Error('Session not found');
  const session = sessions[0];

  if (session.host_id !== hostProfileId) throw new Error('Unauthorized');
  if (session.status === 'ended') return session;

  const now = new Date();
  const startedAt = session.started_at ? new Date(session.started_at) : now;
  const durationSeconds = Math.round((now - startedAt) / 1000);

  return await base44.entities.LiveSession.update(sessionId, {
    status: 'ended',
    ended_at: now.toISOString(),
    duration_seconds: durationSeconds,
    current_viewer_count: 0,
  });
}

export async function cancelLiveSession(sessionId, hostProfileId) {
  const sessions = await base44.entities.LiveSession.filter({ id: sessionId });
  if (!sessions.length) throw new Error('Session not found');
  if (sessions[0].host_id !== hostProfileId) throw new Error('Unauthorized');

  return await base44.entities.LiveSession.update(sessionId, { status: 'cancelled' });
}

// ─── Viewer Management ────────────────────────────────────────────────────────

/**
 * Record viewer join. Bumps current + total counts, updates peak.
 * Future: Redis INCR per session, periodic flush to DB.
 */
export async function viewerJoin(sessionId) {
  const sessions = await base44.entities.LiveSession.filter({ id: sessionId });
  if (!sessions.length) return;
  const s = sessions[0];

  const newCurrent = (s.current_viewer_count || 0) + 1;
  const newTotal   = (s.total_viewer_count   || 0) + 1;
  const newPeak    = Math.max(s.peak_viewer_count || 0, newCurrent);

  await base44.entities.LiveSession.update(sessionId, {
    current_viewer_count: newCurrent,
    total_viewer_count:   newTotal,
    peak_viewer_count:    newPeak,
  });
}

export async function viewerLeave(sessionId) {
  const sessions = await base44.entities.LiveSession.filter({ id: sessionId });
  if (!sessions.length) return;
  const s = sessions[0];

  await base44.entities.LiveSession.update(sessionId, {
    current_viewer_count: Math.max(0, (s.current_viewer_count || 0) - 1),
  });
}

// ─── Moderation Controls ──────────────────────────────────────────────────────

export async function setModerationMode(sessionId, hostProfileId, mode) {
  const sessions = await base44.entities.LiveSession.filter({ id: sessionId });
  if (!sessions.length) throw new Error('Session not found');
  if (sessions[0].host_id !== hostProfileId) throw new Error('Unauthorized');

  const validModes = ['open', 'slow', 'subscribers_only', 'locked'];
  if (!validModes.includes(mode)) throw new Error('Invalid moderation mode');

  return await base44.entities.LiveSession.update(sessionId, { moderation_mode: mode });
}

export async function pinComment(sessionId, hostProfileId, messageId) {
  const sessions = await base44.entities.LiveSession.filter({ id: sessionId });
  if (!sessions.length) throw new Error('Session not found');
  if (sessions[0].host_id !== hostProfileId) throw new Error('Unauthorized');

  return await base44.entities.LiveSession.update(sessionId, { pinned_comment_id: messageId });
}

export async function addCoHost(sessionId, hostProfileId, coHostProfileId) {
  const sessions = await base44.entities.LiveSession.filter({ id: sessionId });
  if (!sessions.length) throw new Error('Session not found');
  if (sessions[0].host_id !== hostProfileId) throw new Error('Unauthorized');

  const coHosts = [...(sessions[0].co_host_ids || [])];
  if (!coHosts.includes(coHostProfileId)) coHosts.push(coHostProfileId);

  return await base44.entities.LiveSession.update(sessionId, { co_host_ids: coHosts });
}

// ─── Replay Pipeline ──────────────────────────────────────────────────────────

/**
 * Publish a live session as a replay post.
 * Future: Triggered by stream provider webhook (Mux/Cloudflare) when recording is ready.
 */
export async function publishReplay(sessionId, replayUrl, hostProfileId) {
  const sessions = await base44.entities.LiveSession.filter({ id: sessionId });
  if (!sessions.length) throw new Error('Session not found');
  const session = sessions[0];
  if (session.host_id !== hostProfileId) throw new Error('Unauthorized');

  // Create a video post linking to the replay
  const post = await base44.entities.Post.create({
    author_id: hostProfileId,
    type: 'video',
    content: `🎓 Replay: ${session.title}`,
    media_urls: [replayUrl],
    thumbnail_url: session.thumbnail_url,
    video_duration: session.duration_seconds,
    subject_tags: session.subject_tags,
    visibility: session.visibility,
    status: 'published',
    moderation_status: 'clean',
    school_id: session.school_id,
  });

  await base44.entities.LiveSession.update(sessionId, {
    replay_url: replayUrl,
    replay_post_id: post.id,
  });

  return post;
}

// ─── Discovery ────────────────────────────────────────────────────────────────

export async function getScheduledSessions({ schoolId, groupId, limit = 20 } = {}) {
  const filter = { status: 'scheduled' };
  if (schoolId) filter.school_id = schoolId;
  if (groupId) filter.group_id = groupId;

  return await base44.entities.LiveSession.filter(filter, 'scheduled_at', limit);
}

export async function getLiveSessions({ schoolId, limit = 10 } = {}) {
  const filter = { status: 'live' };
  if (schoolId) filter.school_id = schoolId;

  return await base44.entities.LiveSession.filter(filter, '-current_viewer_count', limit);
}

export async function getSessionById(sessionId) {
  const sessions = await base44.entities.LiveSession.filter({ id: sessionId });
  return sessions[0] ?? null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function _notifyFollowers(hostProfileId, session) {
  const follows = await base44.entities.Follow.filter(
    { following_id: hostProfileId, status: 'active', notification_preference: 'all' },
    '-created_date',
    500
  );

  // Batch notify — capped at 200 to prevent notification flood
  const recipients = follows.slice(0, 200);
  const ops = recipients.map(f =>
    notificationService.createNotification({
      recipient_id: f.follower_id,
      actor_id: hostProfileId,
      actor_username: session.host_username,
      actor_avatar_url: session.host_avatar_url,
      type: 'live_starting',
      title: `${session.host_username} is live now`,
      body: session.title,
      entity_type: 'live_session',
      entity_id: session.id,
      deep_link: `/live/${session.id}`,
    }).catch(() => {})
  );

  await Promise.allSettled(ops);
}

const liveService = {
  scheduleLiveSession,
  startLiveSession,
  endLiveSession,
  cancelLiveSession,
  viewerJoin,
  viewerLeave,
  setModerationMode,
  pinComment,
  addCoHost,
  publishReplay,
  getScheduledSessions,
  getLiveSessions,
  getSessionById,
};

export default liveService;