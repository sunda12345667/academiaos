/**
 * Retry, Circuit Breaker & Resilience Utilities
 *
 * Provides production-grade reliability primitives:
 *
 * 1. retry()           — exponential backoff with jitter for transient failures
 * 2. CircuitBreaker    — open/half-open/closed state machine per service
 * 3. withTimeout()     — abort-signal based timeout wrapper
 * 4. withFallback()    — execute primary, fall back to secondary on failure
 * 5. rateLimiter()     — client-side token bucket per operation
 * 6. deduplicator()    — in-flight request deduplication (promise coalescing)
 *
 * Architecture principles:
 *   - Never let a single provider failure cascade across the system
 *   - Circuit breaker prevents thundering herd on recovered services
 *   - All utilities are side-effect-free — composable and testable
 *
 * Migration note:
 *   On NestJS: retry() becomes @nestjs/bull job retry config.
 *   CircuitBreaker becomes opossum library (express circuit breaker).
 *   Rate limiting: Redis sliding window (ioredis + lua script).
 */

import logger from './logger';

// ─── 1. Retry with Exponential Backoff ────────────────────────────────────────

/**
 * Retry an async function with exponential backoff + jitter.
 *
 * @param {Function} fn              — async function to execute
 * @param {object}   opts
 * @param {number}   opts.maxAttempts — default 3
 * @param {number}   opts.baseDelayMs — initial delay (default 500ms)
 * @param {number}   opts.maxDelayMs  — cap on delay (default 10000ms)
 * @param {number}   opts.jitterMs    — random jitter added (default 200ms)
 * @param {Function} opts.shouldRetry — (error, attempt) => bool, default: retry on 5xx + network
 * @param {string}   opts.operationId — label for logging
 */
export async function retry(fn, {
  maxAttempts = 3,
  baseDelayMs = 500,
  maxDelayMs = 10000,
  jitterMs = 200,
  shouldRetry = defaultShouldRetry,
  operationId = 'unknown',
} = {}) {
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      if (attempt === maxAttempts || !shouldRetry(err, attempt)) {
        logger.warn('retry.exhausted', { operationId, attempt, maxAttempts, error: err.message });
        throw err;
      }

      const delay = Math.min(
        baseDelayMs * Math.pow(2, attempt - 1) + Math.random() * jitterMs,
        maxDelayMs
      );

      logger.debug('retry.attempt', { operationId, attempt, nextDelayMs: Math.round(delay) });
      await _sleep(delay);
    }
  }

  throw lastError;
}

function defaultShouldRetry(error, attempt) {
  // Never retry client errors (4xx)
  if (error?.status >= 400 && error?.status < 500) return false;
  // Never retry explicit non-retryable errors
  if (error?.retryable === false) return false;
  // Retry network errors and 5xx
  return true;
}

function _sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── 2. Circuit Breaker ───────────────────────────────────────────────────────

const CIRCUIT_STATE = { CLOSED: 'closed', OPEN: 'open', HALF_OPEN: 'half_open' };

/**
 * Circuit breaker — prevents cascading failures from a degraded service.
 *
 * State machine:
 *   CLOSED → failures exceed threshold → OPEN (reject all calls)
 *   OPEN → after resetTimeoutMs → HALF_OPEN (allow 1 probe call)
 *   HALF_OPEN → probe succeeds → CLOSED | probe fails → OPEN
 */
export class CircuitBreaker {
  constructor({
    name = 'unnamed',
    failureThreshold = 5,
    successThreshold = 2,
    resetTimeoutMs = 30000,
    monitorWindowMs = 60000,
  } = {}) {
    this.name = name;
    this.failureThreshold = failureThreshold;
    this.successThreshold = successThreshold;
    this.resetTimeoutMs = resetTimeoutMs;
    this.monitorWindowMs = monitorWindowMs;

    this._state = CIRCUIT_STATE.CLOSED;
    this._failures = 0;
    this._successes = 0;
    this._lastFailureTime = null;
    this._nextAttemptTime = null;
  }

  get state() { return this._state; }
  get isOpen() { return this._state === CIRCUIT_STATE.OPEN; }

  async execute(fn) {
    if (this._state === CIRCUIT_STATE.OPEN) {
      if (Date.now() < this._nextAttemptTime) {
        const err = new Error(`Circuit breaker '${this.name}' is OPEN. Service unavailable.`);
        err.circuitOpen = true;
        throw err;
      }
      // Transition to half-open for probe
      this._state = CIRCUIT_STATE.HALF_OPEN;
      this._successes = 0;
    }

    try {
      const result = await fn();
      this._onSuccess();
      return result;
    } catch (err) {
      this._onFailure(err);
      throw err;
    }
  }

  _onSuccess() {
    this._failures = 0;
    if (this._state === CIRCUIT_STATE.HALF_OPEN) {
      this._successes++;
      if (this._successes >= this.successThreshold) {
        this._state = CIRCUIT_STATE.CLOSED;
        logger.info('circuit_breaker.closed', { name: this.name });
      }
    }
  }

  _onFailure(err) {
    this._failures++;
    this._lastFailureTime = Date.now();

    if (this._state === CIRCUIT_STATE.HALF_OPEN || this._failures >= this.failureThreshold) {
      this._state = CIRCUIT_STATE.OPEN;
      this._nextAttemptTime = Date.now() + this.resetTimeoutMs;
      logger.warn('circuit_breaker.opened', {
        name: this.name,
        failures: this._failures,
        resetAt: new Date(this._nextAttemptTime).toISOString(),
        error: err.message,
      });
    }
  }

  /** Force reset (admin/debug use only) */
  reset() {
    this._state = CIRCUIT_STATE.CLOSED;
    this._failures = 0;
    this._successes = 0;
    this._lastFailureTime = null;
    this._nextAttemptTime = null;
  }

  getStatus() {
    return {
      name: this.name,
      state: this._state,
      failures: this._failures,
      lastFailureTime: this._lastFailureTime,
      nextAttemptTime: this._nextAttemptTime,
    };
  }
}

// ─── Pre-built breakers for key services ─────────────────────────────────────

export const breakers = {
  ai:         new CircuitBreaker({ name: 'ai_gateway',    failureThreshold: 3, resetTimeoutMs: 60000 }),
  payment:    new CircuitBreaker({ name: 'payment_gw',    failureThreshold: 3, resetTimeoutMs: 30000 }),
  media:      new CircuitBreaker({ name: 'media_service', failureThreshold: 5, resetTimeoutMs: 20000 }),
  realtime:   new CircuitBreaker({ name: 'realtime_ws',   failureThreshold: 3, resetTimeoutMs: 15000 }),
  moderation: new CircuitBreaker({ name: 'moderation_ai', failureThreshold: 5, resetTimeoutMs: 45000 }),
};

// ─── 3. Timeout Wrapper ───────────────────────────────────────────────────────

/**
 * Execute an async function with a hard timeout.
 * Uses AbortController for fetch calls — drops gracefully for non-fetch.
 */
export async function withTimeout(fn, timeoutMs = 10000, operationId = 'op') {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    return await fn(controller.signal);
  } catch (err) {
    if (err.name === 'AbortError' || controller.signal.aborted) {
      const timeoutErr = new Error(`Operation '${operationId}' timed out after ${timeoutMs}ms`);
      timeoutErr.isTimeout = true;
      logger.warn('operation.timeout', { operationId, timeoutMs });
      throw timeoutErr;
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// ─── 4. Fallback Executor ─────────────────────────────────────────────────────

/**
 * Execute primary function; fall back to secondary on any failure.
 * Logs the fallback activation for observability.
 */
export async function withFallback(primary, fallback, operationId = 'op') {
  try {
    return await primary();
  } catch (err) {
    logger.warn('fallback.activated', { operationId, primaryError: err.message });
    return fallback(err);
  }
}

// ─── 5. Client-Side Rate Limiter (Token Bucket) ───────────────────────────────

/**
 * Lightweight token bucket rate limiter.
 * Prevents accidental UI-triggered API floods.
 *
 * Usage:
 *   const limiter = createRateLimiter({ capacity: 10, refillRate: 2 });
 *   if (!limiter.consume()) throw new Error('Rate limited');
 */
export function createRateLimiter({ capacity = 10, refillPerSecond = 2 } = {}) {
  let tokens = capacity;
  let lastRefill = Date.now();

  return {
    consume(count = 1) {
      const now = Date.now();
      const elapsed = (now - lastRefill) / 1000;
      tokens = Math.min(capacity, tokens + elapsed * refillPerSecond);
      lastRefill = now;

      if (tokens >= count) {
        tokens -= count;
        return true;
      }
      return false;
    },
    getTokens() { return Math.floor(tokens); },
    reset() { tokens = capacity; lastRefill = Date.now(); },
  };
}

// ─── 6. In-Flight Request Deduplicator ───────────────────────────────────────

/**
 * Coalesce concurrent identical requests into a single in-flight promise.
 * Prevents duplicate API calls from parallel component mounts.
 *
 * Usage:
 *   const dedup = createDeduplicator();
 *   const data = await dedup.execute('profile:123', () => fetchProfile('123'));
 */
export function createDeduplicator() {
  const _inflight = new Map();

  return {
    async execute(key, fn) {
      if (_inflight.has(key)) {
        logger.debug('deduplicator.coalesced', { key });
        return _inflight.get(key);
      }

      const promise = fn().finally(() => _inflight.delete(key));
      _inflight.set(key, promise);
      return promise;
    },
    has: (key) => _inflight.has(key),
    size: () => _inflight.size,
  };
}

// ─── 7. Graceful Degradation Helper ──────────────────────────────────────────

/**
 * Try a service call; return a safe default on failure without throwing.
 * For non-critical paths (recommendations, analytics, etc.)
 *
 * Usage:
 *   const recs = await graceful(() => recommendationService.get(userId), []);
 */
export async function graceful(fn, fallbackValue, operationId = 'op') {
  try {
    return await fn();
  } catch (err) {
    logger.warn('graceful.degraded', { operationId, error: err.message });
    return fallbackValue;
  }
}

export default {
  retry,
  CircuitBreaker,
  breakers,
  withTimeout,
  withFallback,
  createRateLimiter,
  createDeduplicator,
  graceful,
};