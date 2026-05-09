/**
 * PageHeader — Consistent page title + action bar
 * Used across all main pages
 */
import { cn } from '@/lib/utils';

export default function PageHeader({ title, subtitle, action, className }) {
  return (
    <div className={cn('flex items-center justify-between px-4 py-4 lg:px-6', className)}>
      <div>
        <h1 className="font-jakarta font-bold text-xl text-foreground">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}