/**
 * DesktopSidebar — Light theme left nav matching the design reference
 */
import { Link, useLocation } from 'react-router-dom';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import {
  LayoutDashboard, MessageCircle, BookOpen, ShoppingBag,
  Wallet, User, BookMarked, Plus, CircleDot
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';

const NAV_ITEMS = [
  { to: '/',            icon: LayoutDashboard, label: 'Dashboard', exact: true },
  { to: '/groups',      icon: MessageCircle,   label: 'Chat' },
  { to: '/learn',       icon: BookOpen,        label: 'Study Hub' },
  { to: '/marketplace', icon: ShoppingBag,     label: 'Marketplace' },
  { to: '/wallet',      icon: Wallet,          label: 'Wallet' },
  { to: '/profile',     icon: User,            label: 'Profile' },
];

export default function DesktopSidebar() {
  const { pathname } = useLocation();
  const { profile } = useCurrentUser();

  const isActive = (to, exact = false) =>
    exact ? pathname === to : pathname === to || pathname.startsWith(to + '/');

  return (
    <nav className="flex flex-col h-full bg-white border-r border-border overflow-hidden">
      {/* Brand */}
      <div className="px-5 py-5 flex-shrink-0">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-7 h-7 rounded-lg gradient-brand flex items-center justify-center">
            <BookMarked className="w-4 h-4 text-white" />
          </div>
          <span className="font-jakarta font-bold text-lg text-primary">
            StudentOS
          </span>
        </div>
        <p className="text-xs text-muted-foreground pl-9">Academic Workspace</p>
      </div>

      {/* Nav Items */}
      <div className="flex-1 overflow-y-auto scrollbar-hide px-3 space-y-0.5">
        {NAV_ITEMS.map(({ to, icon: Icon, label, exact }) => (
          <Link
            key={to}
            to={to}
            className={cn(
              'nav-item',
              isActive(to, exact) && 'nav-item-active'
            )}
          >
            <Icon className="w-[18px] h-[18px] flex-shrink-0" />
            <span className="text-sm font-medium">{label}</span>
          </Link>
        ))}
      </div>

      {/* New Study Session CTA */}
      <div className="flex-shrink-0 px-3 pb-5 pt-3 border-t border-border">
        <Button className="w-full gradient-brand text-white font-semibold gap-2 rounded-xl">
          <Plus className="w-4 h-4" />
          New Study Session
        </Button>
      </div>
    </nav>
  );
}