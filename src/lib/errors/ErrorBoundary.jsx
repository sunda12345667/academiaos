/**
 * ErrorBoundary — Route-level and component-level error isolation
 *
 * Usage:
 *   <ErrorBoundary>                    // default full-page fallback
 *   <ErrorBoundary inline>             // compact inline fallback for widgets
 *   <ErrorBoundary fallback={<Custom/>}> // custom fallback
 */
import { Component } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Centralized error logging hook — swap with Sentry/Datadog in production
    console.error('[ErrorBoundary] Caught error:', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    if (this.props.fallback) return this.props.fallback;

    if (this.props.inline) {
      return (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-destructive/10 text-destructive text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span className="flex-1">Something went wrong.</span>
          <button
            onClick={this.handleReset}
            className="text-xs underline hover:no-underline"
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