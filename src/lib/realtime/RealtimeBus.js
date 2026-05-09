/**
 * RealtimeBus — Centralized event bus for all realtime subscriptions
 *
 * Architecture:
 * - ONE subscription per entity type, shared across all consumers
 * - Reference-counted: subscription opens on first consumer, closes on last
 * - Reconnect-safe: visibility change listener restarts stale connections
 * - Tab-aware: pauses on hidden, resumes on visible
 *
 * Usage:
 *   const unsub = RealtimeBus.subscribe('Post', 'update', (event) => { ... });
 *   const unsub = RealtimeBus.subscribe('Post', '*', (event) => { ... }); // wildcard
 *   unsub(); // cleanup — automatically tears down if last consumer
 */

import { base44 } from '@/api/base44Client';
import perf from '@/lib/infra/performance.monitor';
import logger from '@/lib/infra/logger';

// Map<entityName, unsubscribeFn> — live base44 subscriptions
const activeSubscriptions = new Map();

// Map<entityName, Map<eventType, Set<callback>>> — all registered consumers
const subscribers = new Map();

// Track last event time per entity for reconnect stale detection
const lastEventTime = new Map();

// ─── Core Dispatch ────────────────────────────────────────────────────────────

function dispatch(entityName, event) {
  const now = Date.now();
  const last = lastEventTime.get(entityName);
  if (last) {
    const lagMs = now - last;
    // Only log lag if it's a real event gap (> 100ms, not immediate consecutive events)
    if (lagMs > 100) perf.increment(`realtime.lag.${entityName}`);
  }
  lastEventTime.set(entityName, now);
  perf.increment(`realtime.event.${entityName}`);
  const entitySubs = subscribers.get(entityName);
  if (!entitySubs) return;

  // Type-specific subscribers
  const typeSubs = entitySubs.get(event.type);
  if (typeSubs) {
    typeSubs.forEach(cb => {
      try { cb(event); } catch (e) {
        console.warn(`[RealtimeBus] ${entityName}:${event.type} handler error`, e);
      }
    });
  }

  // Wildcard subscribers
  const wildcardSubs = entitySubs.get('*');
  if (wildcardSubs) {
    wildcardSubs.forEach(cb => {
      try { cb(event); } catch (e) {
        console.warn(`[RealtimeBus] ${entityName}:* handler error`, e);
      }
    });
  }
}

// ─── Subscription Lifecycle ───────────────────────────────────────────────────

function openSubscription(entityName) {
  const entity = base44.entities[entityName];
  if (!entity?.subscribe) return;

  const unsubscribe = entity.subscribe((event) => dispatch(entityName, event));
  activeSubscriptions.set(entityName, unsubscribe);
}

function ensureSubscription(entityName) {
  if (activeSubscriptions.has(entityName)) return;
  openSubscription(entityName);
}

function closeSubscription(entityName) {
  const unsubscribe = activeSubscriptions.get(entityName);
  if (unsubscribe) {
    try { unsubscribe(); } catch {}
    activeSubscriptions.delete(entityName);
  }
}

function cleanupIfEmpty(entityName) {
  const entitySubs = subscribers.get(entityName);
  if (!entitySubs) return;

  const totalSubs = [...entitySubs.values()].reduce((sum, set) => sum + set.size, 0);
  if (totalSubs === 0) {
    closeSubscription(entityName);
    subscribers.delete(entityName);
    lastEventTime.delete(entityName);
  }
}

// ─── Reconnect Strategy ───────────────────────────────────────────────────────
// When the tab comes back into view, check if any subscription has gone stale
// (no events for > 30s despite being active) and restart it.

const STALE_THRESHOLD_MS = 30_000;

function reconnectStale() {
  const now = Date.now();
  activeSubscriptions.forEach((_, entityName) => {
    const last = lastEventTime.get(entityName) ?? 0;
    // Only restart if we have consumers waiting but subscription may have died
    if (now - last > STALE_THRESHOLD_MS) {
      logger.warn('realtime_bus.stale_reconnect', { entityName });
      closeSubscription(entityName);
      openSubscription(entityName);
    }
  });
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      reconnectStale();
    }
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Subscribe to realtime events for an entity.
 * @param {string} entityName  - e.g. 'Post', 'Notification', 'Message'
 * @param {string} eventType   - 'create' | 'update' | 'delete' | '*'
 * @param {function} callback  - receives base44 event: { type, id, data }
 * @returns {function} unsubscribe — call this in useEffect cleanup
 */
function subscribe(entityName, eventType, callback) {
  if (!subscribers.has(entityName)) {
    subscribers.set(entityName, new Map());
  }
  const entitySubs = subscribers.get(entityName);

  if (!entitySubs.has(eventType)) {
    entitySubs.set(eventType, new Set());
  }
  entitySubs.get(eventType).add(callback);

  // Seed last event time so first visibility check doesn't false-reconnect
  if (!lastEventTime.has(entityName)) {
    lastEventTime.set(entityName, Date.now());
  }

  ensureSubscription(entityName);

  return () => {
    const subs = subscribers.get(entityName)?.get(eventType);
    if (subs) {
      subs.delete(callback);
      cleanupIfEmpty(entityName);
    }
  };
}

/** Subscribe to ALL event types for an entity (create + update + delete) */
function subscribeAll(entityName, callback) {
  return subscribe(entityName, '*', callback);
}

/**
 * Get active subscription entity names — useful for debugging
 */
function getActiveEntities() {
  return [...activeSubscriptions.keys()];
}

const RealtimeBus = { subscribe, subscribeAll, getActiveEntities };
export default RealtimeBus;