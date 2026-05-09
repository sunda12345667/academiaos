/**
 * RealtimeBus — Centralized event bus for all realtime subscriptions
 *
 * Architecture:
 * - ONE subscription per entity type, shared across all consumers
 * - Typed event routing via subscriber map
 * - Automatic cleanup when subscriber count drops to zero
 * - Reconnect-safe: subscriptions restart on re-mount
 *
 * Usage:
 *   const unsub = RealtimeBus.subscribe('Post', 'update', (event) => { ... });
 *   unsub(); // cleanup
 */

import { base44 } from '@/api/base44Client';

// Map<entityName, unsubscribeFn>
const activeSubscriptions = new Map();
// Map<entityName, Map<eventType, Set<callback>>>
const subscribers = new Map();

/**
 * Get or create the entity-level subscription.
 * Only one base44 subscription per entity type is ever open.
 */
function ensureSubscription(entityName) {
  if (activeSubscriptions.has(entityName)) return;

  const entity = base44.entities[entityName];
  if (!entity?.subscribe) return;

  const unsubscribe = entity.subscribe((event) => {
    const entitySubs = subscribers.get(entityName);
    if (!entitySubs) return;

    // Route to type-specific subscribers
    const typeSubs = entitySubs.get(event.type);
    if (typeSubs) {
      typeSubs.forEach(cb => {
        try { cb(event); } catch (e) { console.warn(`[RealtimeBus] ${entityName}:${event.type} handler error`, e); }
      });
    }

    // Route to wildcard subscribers
    const wildcardSubs = entitySubs.get('*');
    if (wildcardSubs) {
      wildcardSubs.forEach(cb => {
        try { cb(event); } catch (e) { console.warn(`[RealtimeBus] ${entityName}:* handler error`, e); }
      });
    }
  });

  activeSubscriptions.set(entityName, unsubscribe);
}

/**
 * Tear down entity subscription if no subscribers remain
 */
function cleanupIfEmpty(entityName) {
  const entitySubs = subscribers.get(entityName);
  if (!entitySubs) return;

  const totalSubs = [...entitySubs.values()].reduce((sum, set) => sum + set.size, 0);
  if (totalSubs === 0) {
    const unsubscribe = activeSubscriptions.get(entityName);
    if (unsubscribe) {
      unsubscribe();
      activeSubscriptions.delete(entityName);
    }
    subscribers.delete(entityName);
  }
}

/**
 * Subscribe to realtime events for an entity
 * @param {string} entityName - e.g. 'Post', 'Notification'
 * @param {string} eventType  - 'create' | 'update' | 'delete' | '*'
 * @param {function} callback - receives base44 event object
 * @returns {function} unsubscribe
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

  ensureSubscription(entityName);

  return () => {
    const subs = subscribers.get(entityName)?.get(eventType);
    if (subs) {
      subs.delete(callback);
      cleanupIfEmpty(entityName);
    }
  };
}

/**
 * Convenience: subscribe to all events for an entity
 */
function subscribeAll(entityName, callback) {
  return subscribe(entityName, '*', callback);
}

const RealtimeBus = { subscribe, subscribeAll };
export default RealtimeBus;