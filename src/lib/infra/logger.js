/**
 * Structured Logger — Production-Grade Client-Side Logging
 *
 * Provides structured, correlation-ID-aware logging with:
 *   - Log levels: debug | info | warn | error | fatal
 *   - Automatic context enrichment (userId, sessionId, route, environment)
 *   - Transport routing: dev=console, prod=remote sink
 *   - Correlation ID propagation for distributed tracing
 *   - Error boundary integration hook
 *   - Batched remote transport (non-blocking)
 *
 * Usage:
 *   import logger from '@/lib/infra/logger';
 *   logger.info('feed.load', { feedType: 'home', postCount: 20, durationMs: 450 });
 *   logger.error('payment.failed', { reason: 'gateway_timeout' }, error);
 *
 * Integration points:
 *   - Sentry: logger.fatal() → Sentry.captureException(error, { extra: context })
 *   - Datadog: batched log drain via RUM SDK
 *   - PostHog: logger.event() alias → posthog.capture()
 *
 * Migration: On NestJS, this becomes a Winston/Pino logger with:
 *   - correlation_id propagated via AsyncLocalStorage
 *   - Log rotation: 30-day retention for info, 90-day for error
 *   - JSONL format for ClickHouse ingestion
 */

const ENV = import.meta.env.MODE || 'development';
const IS_DEV = ENV === 'development';
const IS_PROD = ENV === 'production';

// ─── Log Levels ───────────────────────────────────────────────────────────────

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3, fatal: 4 };
const MIN_LEVEL = IS_PROD ? LEVELS.info : LEVELS.debug;

// ─── Global Context ───────────────────────────────────────────────────────────
// Enriched on every log entry. Set via logger.setContext().

let _globalContext = {
  app: 'studentos',
  env: ENV,
  version: import.meta.env.VITE_APP_VERSION || 'dev',
};

let _correlationId = _generateCorrelationId();

function _generateCorrelationId() {
  return `cid_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Remote Transport (prod) ──────────────────────────────────────────────────
// Batches log entries and flushes every 5s or when queue reaches 20 entries.
// In production, point LOG_DRAIN_URL to Datadog/Logtail/Axiom ingest endpoint.

const _batch = [];
let _flushTimer = null;

function _enqueue(entry) {
  if (!IS_PROD) return;
  _batch.push(entry);
  if (_batch.length >= 20) _flush();
  else if (!_flushTimer) {
    _flushTimer = setTimeout(_flush, 5000);
  }
}

function _flush() {
  clearTimeout(_flushTimer);
  _flushTimer = null;
  if (!_batch.length) return;

  const drainUrl = import.meta.env.VITE_LOG_DRAIN_URL;
  if (!drainUrl) { _batch.length = 0; return; }

  const payload = [..._batch];
  _batch.length = 0;

  // Fire-and-forget — never block the UI thread for logging
  fetch(drainUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ logs: payload }),
    keepalive: true, // survives page unload
  }).catch(() => {}); // swallow transport errors silently
}

// Flush on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', _flush);
  window.addEventListener('pagehide', _flush);
}

// ─── Core Log Function ────────────────────────────────────────────────────────

function _log(level, event, context = {}, error = null) {
  if (LEVELS[level] < MIN_LEVEL) return;

  const entry = {
    timestamp: new Date().toISOString(),
    level,
    event,
    correlation_id: _correlationId,
    route: typeof window !== 'undefined' ? window.location.pathname : null,
    ...(_globalContext),
    ...context,
    ...(error ? {
      error: {
        message: error.message,
        name: error.name,
        stack: IS_DEV ? error.stack : error.stack?.split('\n').slice(0, 3).join(' '),
      }
    } : {}),
  };

  // Console output (always in dev, errors always in prod)
  if (IS_DEV || level === 'error' || level === 'fatal') {
    const consoleFn = level === 'debug' ? console.debug
      : level === 'info' ? console.info
      : level === 'warn' ? console.warn
      : console.error;

    consoleFn(`[${level.toUpperCase()}] ${event}`, context, error || '');
  }

  // Remote transport (prod)
  _enqueue(entry);

  // Sentry integration hook (fatal + error in prod)
  if (IS_PROD && (level === 'fatal' || level === 'error')) {
    const sentry = window.__SENTRY__?.hub;
    if (sentry && error) {
      sentry.captureException(error, { extra: context });
    }
  }

  return entry;
}

// ─── Public API ───────────────────────────────────────────────────────────────

const logger = {
  debug: (event, ctx, err) => _log('debug', event, ctx, err),
  info:  (event, ctx, err) => _log('info',  event, ctx, err),
  warn:  (event, ctx, err) => _log('warn',  event, ctx, err),
  error: (event, ctx, err) => _log('error', event, ctx, err),
  fatal: (event, ctx, err) => _log('fatal', event, ctx, err),

  /** Set persistent context attached to all subsequent log entries */
  setContext: (ctx) => { _globalContext = { ..._globalContext, ...ctx }; },

  /** Rotate correlation ID (call on route change for request tracing) */
  newCorrelationId: () => { _correlationId = _generateCorrelationId(); return _correlationId; },

  /** Get current correlation ID (attach to outbound API calls as X-Correlation-ID) */
  getCorrelationId: () => _correlationId,

  /** Measure async function performance and log result */
  measure: async (event, fn, ctx = {}) => {
    const start = performance.now();
    try {
      const result = await fn();
      const durationMs = Math.round(performance.now() - start);
      _log('info', event, { ...ctx, durationMs, status: 'ok' });
      return result;
    } catch (err) {
      const durationMs = Math.round(performance.now() - start);
      _log('error', event, { ...ctx, durationMs, status: 'error' }, err);
      throw err;
    }
  },

  /** Force-flush batch to remote (call before critical navigations) */
  flush: _flush,
};

export default logger;