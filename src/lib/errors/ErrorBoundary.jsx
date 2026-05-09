/**
 * ErrorBoundary — Route-level and component-level error isolation
 *
 * Modes:
 *   <ErrorBoundary>                      — full-page fallback (routes, page sections)
 *   <ErrorBoundary inline>               — compact inline fallback (widgets, cards)
 *   <ErrorBoundary fallback={<Custom/>}> — custom fallback component
 *
 * Key-based reset (route transitions):
 *   In AppShell, wrap <Outlet> in <ErrorBoundary key={location.pathname}>
 *   This automatically resets the boundary on every route change.
 *
 * Production error logging:
 *   Pass onError prop to hook into Sentry / Datadog:
 *   <ErrorBoundary onError={(err, info) => Sentry.captureException(err)}>
 */
import { Component } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
    this.handleReset = this.handleReset.bind(this);
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Forward to external error reporter if provided (Sentry, Datadog, etc.)
    if (typeof this.props.onError === 'function') {
      this.props.onError(error, info);
    }
    // Always log locally — replace with structured logger in production
    console.error('[ErrorBoundary]', error?.message, info?.componentStack?.split('\n')[1]?.trim());
  }

  // Called when key prop changes (e.g. route change resets boundary automatically)
  static getDerivedStateFromProps(props, state) {
    // If a resetKey is provided and changed, reset the error state
    if (state.hasError && props.resetKey !== undefined && props.resetKey !== state.lastResetKey) {
      return { hasError: false, error: null, lastResetKey: props.resetKey };
    }
    return null;
  }

  handleReset() {
    this.setState({ hasError: false, error: null });
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    if (this.props.fallback) return this.props.fallback;

    if (this.props.inline) {
      return (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-destructive/10 text-destructive text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span className="flex-1 text-xs">Something went wrong.</span>
          <button
            onClick={this.handleReset}
            className="text-xs underline hover:no-underline flex-shrink-0"
          >
            Retry
          </button>
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-4 p-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center">
          <AlertTriangle className="w-8 h-8 text-destructive" />
        </div>
        <div>
          <h3 className="font-jakarta font-bold text-lg text-foreground mb-1">
            Something went wrong
          </h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            {this.props.message || 'An unexpected error occurred. Please try again.'}
          </p>
          {import.meta.env.DEV && this.state.error && (
            <pre className="mt-3 text-left text-xs text-destructive/70 bg-destructive/5 rounded-lg p-3 max-w-sm overflow-auto">
              {this.state.error.toString()}
            </pre>
          )}
        </div>
        <button
          onClick={this.handleReset}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Try Again
        </button>
      </div>
    );
  }
}