/**
 * EmptyState — Generic reusable empty state component
 */
import { cn } from '@/lib/utils';
import { Button } from './button';

export default function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  onAction,
  actionTo,
  className,
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 px-6 text-center', className)}>
      {Icon && (
        <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
          <Icon className="w-7 h-7 text-muted-foreground" />
        </div>
      )}
      {title && (
        <h3 className="font-jakarta font-semibold text-base text-foreground mb-1">{title}</h3>
      )}
      {description && (
        <p className="text-sm text-muted-foreground max-w-xs">{description}</p>
      )}
      {action && onAction && (
        <Button onClick={onAction} size="sm" className="mt-5 font-semibold">
          {action}
        </Button>
      )}
    </div>
  );
}