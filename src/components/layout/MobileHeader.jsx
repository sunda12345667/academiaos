/**
 * MobileHeader — Context-aware top bar for mobile
 * Shows logo on feed, back button on detail views
 */
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Bell, Search, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import NavBadge from './NavBadge';

const ROUTE_TITLES = {
  '/learn': 'Learn',
  '/groups': 'Groups',
  '/marketplace': 'Marketplace',
  '/wallet': 'Wallet',
  '/notifications': 'Notifications',
  '/messages': 'Messages',
  '/search': 'Search',
  '/settings': 'Settings',
  '/profile': 'Profile',
};

export default function MobileHeader() {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const isHome = pathname === '/';
  const title = ROUTE_TITLES[pathname];
  const isTopLevel = isHome || !!title;

  return (
    <header className="flex items-center justify-between px-4 py-3 bg-background/95 backdrop-blur-sm border-b border-border/40 sticky top-0 z-40 pt-safe">
      {isTopLevel ? (
        <>
          {isHome ? (
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg gradient-brand flex items-center justify-center">
                <BookOpen className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="font-jakarta font-bold text-base text-foreground">
                Student<span className="text-primary">OS</span>
              </span>
            </div>
          ) : (
            <h1 className="font-jakarta font-bold text-lg text-foreground">{title}</h1>
          )}

          <div className="flex items-center gap-1">
            <Link to="/search">
              <Button variant="ghost" size="icon" className="w-9 h-9">
                <Search className="w-5 h-5" />
              </Button>
            </Link>
            <Link to="/notifications" className="relative">
              <Button variant="ghost" size="icon" className="w-9 h-9">
                <Bell className="w-5 h-5" />
                <NavBadge type="notifications" />
              </Button>
            </Link>
          </div>
        </>
      ) : (
        <>
          <Button
            variant="ghost"
            size="icon"
            className="w-9 h-9"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <span className="font-jakarta font-semibold text-base text-foreground">
            {title || ''}
          </span>
          <div className="w-9" />
        </>
      )}
    </header>
  );
}