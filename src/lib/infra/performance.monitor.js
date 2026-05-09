/**
 * Performance Monitor — Client-Side Observability
 *
 * Tracks:
 *   - Feed load time (TTI: time-to-interactive)
 *   - Route transition duration
 *   - API call latency (p50, p95, p99)
 *   - RealtimeBus event lag
 *   - Long task detection (> 50ms blocking)
 *   - Memory usage trends
 *   - Core Web Vitals (LCP, FID, CLS)
 *   - Media load performance
 *
 * Flush strategy: metrics batched in-memory, flushed every 30s
 * or on page unload via sendBeacon (non-blocking).
 *
 * Production integration:
 *   - Datadog RUM: window.DD_RUM.addTiming()
 *   - Sentry Performance: Sentry.startTransaction()
 *   - Custom VITE_METRICS_URL endpoint → ClickHouse timeseries
 *
 * Migration note:
 *   On NestJS: server-side spans added via OpenTelemetry SDK.
 *   APM trace correlation: X-Trace-Id header maps to client correlation_id.
 *   SLO tracking: p99 feed load < 3s, p99 API < 1s, error rate < 0.1%
 */

import logger from './logger';

// ─── Metric Store ─────────────────────────────────────────────────────────────

const _timings = new Map();    // operationId → [durationMs, ...]
const _marks = new Map();      // markId → startTime
const _counters = new Map();   // metricName → count
let _flushTimer = null;

// ─── Timing API ───────────────────────────────────────────────────────────────

export const perf = {
  /**
   * Mark start of an operation.
   * @param {string} markId — e.g. 'feed.home.load'
   */
  mark(markId) {
    _marks.set(markId, performance.now());
    return markId;
  },

  /**
   * Measure duration from mark to now. Stores result + logs if slow.
   * @param {string} markId
   * @param {object} context — extra fields for the log entry
   * @param {number} sloMs   — SLO threshold (logs warn if exceeded)
   * @returns {number} durationMs
   */
  measure(markId, context = {}, sloMs = null) {
    const start = _marks.get(markId);
    if (!start) return 0;

    const durationMs = Math.round(performance.now() - start);
    _marks.delete(markId);

    // Store for percentile computation
    if (!_timings.has(markId)) _timings.set(markId, []);
    const arr = _timings.get(markId);
    arr.push(durationMs);
    if (arr.length > 100) arr.shift(); // rolling window

    const level = sloMs && durationMs > sloMs ? 'warn' : 'debug';
    logger[level](`perf.${markId}`, { durationMs, ...context, ...(sloMs ? { sloMs, sloBreach: durationMs > sloMs } : {}) });

    // Report to Datadog RUM if available
    if (typeof window !== 'undefined' && window.DD_RUM) {
      window.DD_RUM.addTiming(markId, durationMs);
    }

    _scheduleFlush();
    return durationMs;
  },

  /**
   * Wrap an async function with automatic mark+measure.
   */
  async trace(markId, fn, context = {}, sloMs = null) {
    perf.mark(markId);
    try {
      const result = await fn();
      perf.measure(markId, { ...context, status: 'ok' }, sloMs);
      return result;
    } catch (err) {
      perf.measure(markId, { ...context, status: 'error', error: err.message }, sloMs);
      throw err;
    }
  },

  // ─── Counters ──────────────────────────────────────────────────────────────

  increment(metric, amount = 1) {
    _counters.set(metric, (_counters.get(metric) || 0) + amount);
    _scheduleFlush();
  },

  // ─── Percentile Queries ───────────────────────────────────────────────────

  /**
   * Get percentile of recorded timings for an operation.
   * @param {string} markId
   * @param {number} percentile — 0–100, e.g. 95 for p95
   */
  getPercentile(markId, percentile = 95) {
    const timings = _timings.get(markId);
    if (!timings || !timings.length) return null;
    const sorted = [...timings].sort((a, b) => a - b);
    const idx = Math.floor((percentile / 100) * sorted.length);
    return sorted[Math.min(idx, sorted.length - 1)];
  },

  /**
   * Get performance report for all tracked operations.
   */
  getReport() {
    const report = { timings: {}, counters: {} };

    _timings.forEach((values, key) => {
      if (!values.length) return;
      const sorted = [...values].sort((a, b) => a - b);
      report.timings[key] = {
        count: values.length,
        p50: sorted[Math.floor(sorted.length * 0.5)],
        p95: sorted[Math.floor(sorted.length * 0.95)],
        p99: sorted[Math.floor(sorted.length * 0.99)],
        avg: Math.round(values.reduce((s, v) => s + v, 0) / values.length),
        min: sorted[0],
        max: sorted[sorted.length - 1],
      };
    });

    _counters.forEach((count, key) => { report.counters[key] = count; });

    return report;
  },

  // ─── Core Web Vitals (via PerformanceObserver) ────────────────────────────

  observeWebVitals() {
    if (typeof PerformanceObserver === 'undefined') return;

    // Largest Contentful Paint
    try {
      const lcpObserver = new PerformanceObserver((list) => {
        const entry = list.getEntries().at(-1);
        if (entry) {
          const lcp = Math.round(entry.startTime);
          logger.info('web_vital.lcp', { lcp, rating: lcp < 2500 ? 'good' : lcp < 4000 ? 'needs_improvement' : 'poor' });
          perf.increment('web_vital.lcp.good', lcp < 2500 ? 1 : 0);
          perf.increment('web_vital.lcp.poor', lcp >= 4000 ? 1 : 0);
        }
      });
      lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
    } catch {}

    // Cumulative Layout Shift
    try {
      let clsScore = 0;
      const clsObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) clsScore += entry.value;
        }
      });
      clsObserver.observe({ type: 'layout-shift', buffered: true });

      // Report CLS on page hide
      window.addEventListener('pagehide', () => {
        logger.info('web_vital.cls', { cls: parseFloat(clsScore.toFixed(4)), rating: clsScore < 0.1 ? 'good' : clsScore < 0.25 ? 'needs_improvement' : 'poor' });
      }, { once: true });
    } catch {}

    // Long Tasks (> 50ms main thread blocking)
    try {
      const longTaskObserver = new PerformanceObserver((list) => {
        list.getEntries().forEach(entry => {
          logger.warn('perf.long_task', { durationMs: Math.round(entry.duration), startMs: Math.round(entry.startTime) });
          perf.increment('perf.long_tasks');
        });
      });
      longTaskObserver.observe({ type: 'longtask' });
    } catch {}
  },

  // ─── Memory Monitoring ────────────────────────────────────────────────────

  snapshotMemory() {
    if (typeof performance === 'undefined' || !performance.memory) return null;
    const mem = performance.memory;
    return {
      usedJsHeapMB: Math.round(mem.usedJSHeapSize / 1048576),
      totalJsHeapMB: Math.round(mem.totalJSHeapSize / 1048576),
      heapLimitMB: Math.round(mem.jsHeapSizeLimit / 1048576),
      utilizationPct: parseFloat((mem.usedJSHeapSize / mem.jsHeapSizeLimit * 100).toFixed(1)),
    };
  },
};

// ─── SLO Thresholds ───────────────────────────────────────────────────────────
// Reference these in perf.trace() calls for automatic SLO breach logging.

export const SLO = {
  FEED_LOAD:       2000, // ms — feed TTI < 2s
  ROUTE_CHANGE:    500,  // ms — route transition < 500ms
  API_CALL:        1000, // ms — API p95 < 1s
  SEARCH:          800,  // ms — search results < 800ms
  PAYMENT_INIT:    3000, // ms — payment modal < 3s
  MEDIA_UPLOAD:    5000, // ms — media upload start < 5s
  AI_RESPONSE:     4000, // ms — AI feature response < 4s
  REALTIME_LAG:    500,  // ms — realtime event delivery < 500ms
};

// ─── Flush to Remote Metrics Endpoint ────────────────────────────────────────

function _scheduleFlush() {
  if (_flushTimer) return;
  _flushTimer = setTimeout(_flushMetrics, 30000);
}

function _flushMetrics() {
  clearTimeout(_flushTimer);
  _flushTimer = null;

  const metricsUrl = import.meta.env.VITE_METRICS_URL;
  if (!metricsUrl) return;

  const report = perf.getReport();
  const memory = perf.snapshotMemory();
  const payload = {
    timestamp: new Date().toISOString(),
    correlation_id: logger.getCorrelationId(),
    route: typeof window !== 'undefined' ? window.location.pathname : null,
    ...report,
    memory,
  };

  if (navigator.sendBeacon) {
    navigator.sendBeacon(metricsUrl, JSON.stringify(payload));
  }
}

// Flush on unload via sendBeacon (survives page close)
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', _flushMetrics);
  window.addEventListener('beforeunload', _flushMetrics);
}

export default perf;