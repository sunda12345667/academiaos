/**
 * LoadingSpinner — Reusable spinner variants
 */
import { cn } from '@/lib/utils';

export default function LoadingSpinner({ size = 'md', className }) {
  const sizes = { sm: 'w-4 h-4 border-2', md: 'w-8 h-8 border-4', lg: 'w-12 h-12 border-4' };
  return (
    <div className={cn(
      sizes[size],
      'rounded-full border-border border-t-primary animate-spin',
      className
    )} />
  );
}

export function PageLoader() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background">
      <LoadingSpinner size="lg" />
    </div>
  );
}

export function InlineLoader({ label }) {
  return (
    <div className="flex items-center justify-center gap-3 py-8">
      <LoadingSpinner size="sm" />
      {label && <span className="text-sm text-muted-foreground">{label}</span>}
    </div>
  );
}