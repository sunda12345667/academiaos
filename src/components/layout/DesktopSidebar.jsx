/**
 * DesktopSidebar — Left navigation for desktop
 * Role-aware nav items, notification badges, creator CTA
 */
import { Link, useLocation } from 'react-router-dom';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import {
  Home, GraduationCap, Users, ShoppingBag, Wallet,
  Bell, User, Search, Settings,
  BookOpen, MessageCircle, TrendingUp
} from 'lucide-react';
import { cn } from '@/lib/utils';
import NavBadge from './NavBadge';
import SidebarUserCard from './SidebarUserCard';
import SidebarCreateButton from './SidebarCreateButton';
import ErrorBoundary from '@/lib/errors/ErrorBoundary';

const PRIMARY_NAV = [
  { to: '/', icon: Home, label: 'Home', exact: true },
  { to: '/learn', icon: GraduationCap, label: 'Learn' },
  { to: '/groups', icon: Users, label: 'Groups' },
  { to: '/marketplace', icon: ShoppingBag, label: 'Marketplace' },
  { to: '/wallet', icon: Wallet, label: 'Wallet' },
];

const SECONDARY_NAV = [
  { to: '/notifications', icon: Bell, label: 'Notifications', badge: 'notifications' },
  { to: '/messages', icon: MessageCircle, label: 'Messages', badge: 'messages' },
  { to: '/search', icon: Search, label: 'Search' },
  { to: '/trending', icon: TrendingUp, label: 'Trending' },
];

export default function DesktopSidebar() {
  const { pathname } = useLocation();
  const { profile } = useCurrentUser();

  const isActive = (to, exact = false) =>
    exact ? pathname === to : pathname.startsWith(to);

  return (
    <nav className="flex flex-col h-full bg-sidebar border-r border-sidebar-border overflow-hidden">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-5 py-5 flex-shrink-0">
        <div className="w-8 h-8 rounded-xl gradient-brand flex items-center justify-center">
          <BookOpen className="w-4 h-4 text-white" />
        </div>
        <span className="font-jakarta font-800 text-lg text-sidebar-foreground tracking-tight">
          Student<span className="text-sidebar-primary">OS</span>
        </span>
      </div>

      {/* Create Button */}
      <div className="px-3 mb-3 flex-shrink-0">
        <SidebarCreateButton />
      </div>

      {/* Primary Nav */}
      <div className="flex-1 overflow-y-auto scrollbar-hide px-3 space-y-0.5">
        <div className="space-y-0.5">
          {PRIMARY_NAV.map(({ to, icon: Icon, label, exact }) => (
            <Link
              key={to}
              to={to}
              className={cn('nav-item', isActive(to, exact) && 'nav-item-active')}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm font-medium">{label}</span>
            </Link>
          ))}
        </div>

        <div className="my-3 border-t border-sidebar-border" />

        <div className="space-y-0.5">
          {SECONDARY_NAV.map(({ to, icon: Icon, label, badge }) => (
            <Link
              key={to}
              to={to}
              className={cn('nav-item relative', isActive(to) && 'nav-item-active')}
            >
              <div className="relative">
                <Icon className="w-5 h-5 flex-shrink-0" />
                {badge && <NavBadge type={badge} />}
              </div>
              <span className="text-sm font-medium">{label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Profile + Settings footer */}
      <div className="flex-shrink-0 px-3 pb-4 space-y-1 border-t border-sidebar-border pt-3">
        <Link
          to="/profile"
          className={cn('nav-item', isActive('/profile') && 'nav-item-active')}
        >
          <User className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm font-medium">Profile</span>
        </Link>
        <Link
          to="/settings"
          className={cn('nav-item', isActive('/settings') && 'nav-item-active')}
        >
          <Settings className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm font-medium">Settings</span>
        </Link>
        {profile && (
        <ErrorBoundary inline>
          <SidebarUserCard profile={profile} />
        </ErrorBoundary>
      )}
      </div>
    </nav>
  );
}