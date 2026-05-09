/**
 * App Bootstrap — Infrastructure Initialization
 *
 * Called ONCE on app startup (main.jsx) before React renders.
 * Initializes all infrastructure primitives in the correct order:
 *
 *   1. Structured logger (must be first — all other systems log)
 *   2. Performance monitor (PerformanceObserver setup)
 *   3. Event queue user context (set after auth)
 *   4. Feature flags (URL overrides parsed)
 *   5. Error reporter integration (Sentry/Datadog hooks)
 *   6. Global unhandled error/rejection capture
 *   7. Network status monitoring (online/offline)
 *   8. Route change tracking (correlation ID rotation)
 *
 * This module has ZERO React dependencies — safe to import anywhere.
 */

import logger from './logger';
import perf, { SLO } from './performance.monitor';
import { eventQueue } from './event-queue';
import flags from './feature-flags';

let _bootstrapped = false;

export function bootstrapInfrastructure() {
  if (_bootstrapped) return;
  _bootstrapped = true;

  const start = performance.now();

  // ─── 1. Logger context ──────────────────────────────────────────────────────
  logger.setContext({
    app: 'studentos',
    env: import.meta.env.MODE,
    version: import.meta.env.VITE_APP_VERSION || 'dev',
    build: import.meta.env.VITE_BUILD_SHA || 'local',
  });

  // ─── 2. Performance monitoring ─────────────────────────────────────────────
  if (flags.isEnabled('INFRA_PERF_MONITOR')) {
    perf.observeWebVitals();
    logger.info('infra.perf_monitor.enabled');
  }

  // ─── 3. Global error capture ───────────────────────────────────────────────
  window.addEventListener('error', (event) => {
    logger.fatal('global.uncaught_error', {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
    }, event.error);
    perf.increment('error.uncaught');
  });

  window.addEventListener('unhandledrejection', (event) => {
    logger.error('global.unhandled_rejection', {
      reason: event.reason?.message || String(event.reason),
    }, event.reason instanceof Error ? event.reason : null);
    perf.increment('error.unhandled_rejection');
  });

  // ─── 4. Network status monitoring ─────────────────────────────────────────
  window.addEventListener('online', () => {
    logger.info('network.online');
    eventQueue.track('session', 'network_online', {});
    // RealtimeBus stale check triggered automatically via visibilitychange
  });

  window.addEventListener('offline', () => {
    logger.warn('network.offline');
    eventQueue.track('session', 'network_offline', {});
  });

  // ─── 5. App open event ────────────────────────────────────────────────────
  const referrer = document.referrer;
  eventQueue.appOpened(referrer || 'direct');

  // ─── 6. Route change tracking ─────────────────────────────────────────────
  // Rotate correlation ID on each navigation for distributed trace isolation
  let _lastRoute = window.location.pathname;

  const _routeObserver = new MutationObserver(() => {
    const current = window.location.pathname;
    if (current !== _lastRoute) {
      const from = _lastRoute;
      _lastRoute = current;
      logger.newCorrelationId();
      eventQueue.routeChanged(from, current);
      perf.mark(`route.${current}`);
    }
  });

  _routeObserver.observe(document.body, { subtree: true, childList: true });

  // ─── 7. Session tracking ──────────────────────────────────────────────────
  const _appOpenTime = Date.now();
  let _pagesViewed = 0;

  window.addEventListener('popstate', () => { _pagesViewed++; });

  window.addEventListener('pagehide', () => {
    const durationMin = Math.round((Date.now() - _appOpenTime) / 60000);
    eventQueue.sessionEnded(durationMin, _pagesViewed);
    eventQueue.flush();
    logger.flush();
    perf.getReport(); // snapshot logged internally
  }, { once: true });

  const initMs = Math.round(performance.now() - start);
  logger.info('infra.bootstrap.complete', { initMs, flags: flags.getAll() });
}

/**
 * Set authenticated user context across all infra systems.
 * Call this AFTER successful auth, BEFORE any tracked actions.
 */
export function setInfraUserContext(userId, role, schoolId) {
  logger.setContext({ userId, role, schoolId });
  eventQueue.setUserId(userId);
  logger.info('infra.user_context.set', { userId, role });
}

/**
 * Measure a critical user journey (for SLO reporting).
 * Call mark() before the journey, complete() after.
 */
export const journeyTimer = {
  feedLoad:      () => perf.mark('journey.feed_load'),
  feedLoaded:    (ctx) => perf.measure('journey.feed_load', ctx, SLO.FEED_LOAD),
  routeStart:    (route) => perf.mark(`journey.route.${route}`),
  routeComplete: (route, ctx) => perf.measure(`journey.route.${route}`, ctx, SLO.ROUTE_CHANGE),
  paymentStart:  () => perf.mark('journey.payment'),
  paymentDone:   (ctx) => perf.measure('journey.payment', ctx, SLO.PAYMENT_INIT),
  searchStart:   () => perf.mark('journey.search'),
  searchDone:    (ctx) => perf.measure('journey.search', ctx, SLO.SEARCH),
  aiStart:       (type) => perf.mark(`journey.ai.${type}`),
  aiDone:        (type, ctx) => perf.measure(`journey.ai.${type}`, ctx, SLO.AI_RESPONSE),
};

export default { bootstrapInfrastructure, setInfraUserContext, journeyTimer };