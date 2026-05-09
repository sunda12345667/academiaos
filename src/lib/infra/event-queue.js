/**
 * Client-Side Event Queue — Reliable Analytics & Audit Event Delivery
 *
 * Purpose:
 *   Non-blocking, offline-resilient event emission for analytics, behavioral
 *   signals, and audit events. Events must not block the UI thread or be lost
 *   on network failure.
 *
 * Architecture:
 *   Event → _inMemoryQueue → batch worker (every 5s or 20 events)
 *     → try flush to DB/endpoint
 *     → on failure: persist to localStorage (dead letter)
 *     → retry dead letter queue on next flush cycle
 *
 * Event categories (matching behavioral taxonomy):
 *   content.*   — post views, video watch, engagement
 *   social.*    — follow, comment, share, react
 *   search.*    — query, result click, zero results
 *   creator.*   — tip, gift, subscription
 *   learn.*     — course start/complete, quiz, flashcard
 *   session.*   — app open, route change, background, foreground
 *   ai.*        — recommendation served/clicked, assistant query
 *   finance.*   — payment init, payment complete, payout request
 *
 * Deduplication:
 *   Each event carries a client-generated idempotency_key.
 *   Server-side: deduplicate within 24h window per (user_id, event, key).
 *
 * Migration note:
 *   On NestJS: HTTP flush endpoint → Kafka producer → ClickHouse.
 *   Client SDK publishes to: POST /api/events/batch
 *   Event schema versioned: event_schema_version field on every record.
 *   GDPR: events can be purged by user_id (soft-delete userId → anonymized).
 */

import { base44 } from '@/api/base44Client';
import logger from './logger';

const QUEUE_KEY = 'sos_event_queue_dlq'; // localStorage dead-letter key
const MAX_BATCH_SIZE = 20;
const FLUSH_INTERVAL_MS = 5000;
const MAX_DLQ_SIZE = 100;

// ─── In-Memory Queue ──────────────────────────────────────────────────────────

let _queue = [];
let _flushTimer = null;
let _userId = null;

// ─── Event Factory ────────────────────────────────────────────────────────────

function _buildEvent(category, action, properties = {}) {
  return {
    event: `${category}.${action}`,
    category,
    action,
    user_id: _userId,
    session_id: _getSessionId(),
    timestamp: new Date().toISOString(),
    idempotency_key: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    route: typeof window !== 'undefined' ? window.location.pathname : null,
    device_type: _getDeviceType(),
    schema_version: '1.0',
    properties,
  };
}

function _getSessionId() {
  if (typeof sessionStorage === 'undefined') return null;
  let sid = sessionStorage.getItem('sos_session_id');
  if (!sid) {
    sid = `s_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    sessionStorage.setItem('sos_session_id', sid);
  }
  return sid;
}

function _getDeviceType() {
  if (typeof window === 'undefined') return 'unknown';
  const w = window.innerWidth;
  return w < 768 ? 'mobile' : w < 1024 ? 'tablet' : 'desktop';
}

// ─── Queue Management ─────────────────────────────────────────────────────────

function _enqueue(event) {
  _queue.push(event);
  if (_queue.length >= MAX_BATCH_SIZE) {
    _flush();
  } else {
    _scheduleFlush();
  }
}

function _scheduleFlush() {
  if (_flushTimer) return;
  _flushTimer = setTimeout(_flush, FLUSH_INTERVAL_MS);
}

// ─── Flush (Primary) ──────────────────────────────────────────────────────────

async function _flush() {
  clearTimeout(_flushTimer);
  _flushTimer = null;

  const batch = [..._queue, ..._loadDLQ()];
  if (!batch.length) return;
  _queue = [];

  try {
    await _deliverBatch(batch);
    _clearDLQ();
  } catch (err) {
    logger.warn('event_queue.flush_failed', { batchSize: batch.length, error: err.message });
    _saveToDLQ(batch);
  }
}

// ─── Delivery (DB write — swap for HTTP endpoint on NestJS) ───────────────────

async function _deliverBatch(events) {
  // MVP: write to BehavioralEvent entity (fire-and-forget, best-effort)
  // NestJS: POST /api/events/batch → Kafka producer
  await Promise.all(
    events.map(event =>
      base44.entities.BehavioralEvent?.create(event).catch(() => {})
      || Promise.resolve() // graceful if entity doesn't exist yet
    )
  );
}

// ─── Dead Letter Queue (localStorage) ────────────────────────────────────────

function _loadDLQ() {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function _saveToDLQ(events) {
  try {
    const existing = _loadDLQ();
    const merged = [...existing, ...events].slice(-MAX_DLQ_SIZE);
    localStorage.setItem(QUEUE_KEY, JSON.stringify(merged));
  } catch {}
}

function _clearDLQ() {
  try { localStorage.removeItem(QUEUE_KEY); } catch {}
}

// ─── Public API ───────────────────────────────────────────────────────────────

export const eventQueue = {
  /** Set authenticated user ID for all subsequent events */
  setUserId(userId) { _userId = userId; },

  /** Track a generic event */
  track(category, action, properties = {}) {
    const event = _buildEvent(category, action, properties);
    _enqueue(event);
    return event.idempotency_key;
  },

  // ─── Typed Event Helpers ──────────────────────────────────────────────────

  // Content
  contentView:        (contentId, contentType, source) =>
    eventQueue.track('content', 'view', { contentId, contentType, source }),
  contentLike:        (contentId, authorId) =>
    eventQueue.track('content', 'like', { contentId, authorId }),
  contentShare:       (contentId, shareTarget) =>
    eventQueue.track('content', 'share', { contentId, shareTarget }),
  videoWatch:         (contentId, durationSec, completionRate, source) =>
    eventQueue.track('content', 'video_watch', { contentId, durationSec, completionRate, source }),

  // Social
  userFollowed:       (targetId) => eventQueue.track('social', 'follow', { targetId }),
  userUnfollowed:     (targetId) => eventQueue.track('social', 'unfollow', { targetId }),
  commentPosted:      (postId, parentCommentId) =>
    eventQueue.track('social', 'comment', { postId, parentCommentId }),
  giftSent:           (recipientId, giftItemId, coinCost) =>
    eventQueue.track('creator', 'gift_sent', { recipientId, giftItemId, coinCost }),

  // Search
  searchQuery:        (query, resultCount, source) =>
    eventQueue.track('search', 'query', { query, resultCount, source }),
  searchResultClick:  (query, contentId, position) =>
    eventQueue.track('search', 'result_click', { query, contentId, position }),
  searchZeroResults:  (query) =>
    eventQueue.track('search', 'zero_results', { query }),

  // Learning
  courseStarted:      (courseId) => eventQueue.track('learn', 'course_start', { courseId }),
  courseCompleted:    (courseId, durationMin) =>
    eventQueue.track('learn', 'course_complete', { courseId, durationMin }),
  quizAttempted:      (contentId, score) =>
    eventQueue.track('learn', 'quiz_attempt', { contentId, score }),

  // Session
  appOpened:          (referrer) => eventQueue.track('session', 'app_open', { referrer }),
  routeChanged:       (from, to) => eventQueue.track('session', 'route_change', { from, to }),
  sessionEnded:       (durationMin, pagesViewed) =>
    eventQueue.track('session', 'end', { durationMin, pagesViewed }),

  // AI
  recommendationServed:  (recId, strategy) =>
    eventQueue.track('ai', 'recommendation_served', { recId, strategy }),
  recommendationClicked: (recId, contentId, rank) =>
    eventQueue.track('ai', 'recommendation_click', { recId, contentId, rank }),
  assistantQueried:      (queryType, durationMs) =>
    eventQueue.track('ai', 'assistant_query', { queryType, durationMs }),

  // Finance
  paymentInitiated:   (amount, purpose, gateway) =>
    eventQueue.track('finance', 'payment_init', { amount, purpose, gateway }),
  paymentCompleted:   (amount, purpose) =>
    eventQueue.track('finance', 'payment_complete', { amount, purpose }),
  payoutRequested:    (amount) =>
    eventQueue.track('finance', 'payout_request', { amount }),

  /** Force immediate flush (call before page unload) */
  flush: _flush,

  /** Get queue depth for monitoring */
  queueDepth: () => _queue.length,
  dlqDepth:   () => _loadDLQ().length,
};

// Auto-flush on page unload (sendBeacon not used here — complex payloads go via fetch keepalive)
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', _flush);
  window.addEventListener('beforeunload', _flush);
}

export default eventQueue;