/**
 * MobileBottomNav — iOS/Android style bottom tab bar
 * Haptic-ready, thumb-zone optimized
 */
import { Link, useLocation } from 'react-router-dom';
import { Home, GraduationCap, PlusCircle, Users, User } from 'lucide-react';
import { cn } from '@/lib/utils';

const TABS = [
  { to: '/', icon: Home, label: 'Home', exact: true },
  { to: '/learn', icon: GraduationCap, label: 'Learn' },
  { to: '/create', icon: PlusCircle, label: 'Create', isCreate: true },
  { to: '/groups', icon: Users, label: 'Groups' },
  { to: '/profile', icon: User, label: 'Me' },
];

export default function MobileBottomNav() {
  const { pathname } = useLocation();

  const isActive = (to, exact = false) =>
    exact ? pathname === to : pathname.startsWith(to);

  return (
    <nav className="flex items-center justify-around bg-card border-t border-border/60 px-2 py-1">
      {TABS.map(({ to, icon: Icon, label, exact, isCreate }) => {
        const active = isActive(to, exact);
        return (
          <Link
            key={to}
            to={to}
            className={cn(
              'flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all duration-150 min-w-[52px]',
              isCreate
                ? 'text-primary'
                : active
                  ? 'text-primary'
                  : 'text-muted-foreground'
            )}
          >
            {isCreate ? (
              <Icon className="w-7 h-7 text-primary" strokeWidth={1.8} />
            ) : (
              <Icon
                className={cn('w-6 h-6 transition-all', active ? 'scale-110' : '')}
                strokeWidth={active ? 2.2 : 1.8}
                fill={active ? 'currentColor' : 'none'}
              />
            )}
            <span className={cn('text-[10px] font-medium', isCreate && 'text-primary')}>
              {label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}