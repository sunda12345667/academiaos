/**
 * AppShell — Root layout container
 * Orchestrates: Sidebar + Main content + Right panel + Mobile nav
 * All page content renders inside <Outlet />
 *
 * Provider layering (innermost to outermost, all inside Router + UserProvider):
 *   FeedRealtimeProvider — ONE Post subscription for all feeds
 *   NotificationProvider — ONE Notification subscription + state
 *   ErrorBoundary        — Route-level crash isolation
 */
import { Outlet, useLocation } from 'react-router-dom';
import { Suspense } from 'react';
import DesktopSidebar from './DesktopSidebar';
import MobileBottomNav from './MobileBottomNav';
import RightPanel from './RightPanel';
import MobileHeader from './MobileHeader';
import { FeedRealtimeProvider } from '@/providers/FeedRealtimeProvider';
import { NotificationProvider } from '@/providers/NotificationProvider';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import ErrorBoundary from '@/lib/errors/ErrorBoundary';
import AccountStatusGuard from '@/components/auth/AccountStatusGuard';
import { MessagingProvider } from '@/providers/MessagingProvider';
import { LiveSessionProvider } from '@/providers/LiveSessionProvider';
import { WalletProvider } from '@/providers/WalletProvider';

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-border border-t-primary rounded-full animate-spin" />
    </div>
  );
}

export default function AppShell() {
  const { profile } = useCurrentUser();
  const location = useLocation();

  return (
    <FeedRealtimeProvider>
      <NotificationProvider profileId={profile?.id}>
        <AccountStatusGuard>
        <MessagingProvider>
        <WalletProvider>
        <LiveSessionProvider>
        <div className="flex h-screen bg-background overflow-hidden">
          {/* Desktop Left Sidebar — hidden on mobile */}
          <aside className="hidden lg:flex flex-col w-52 flex-shrink-0 border-r border-border">
            <DesktopSidebar />
          </aside>

          {/* Top header (desktop) */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            {/* Top bar — desktop */}
            <div className="hidden lg:flex flex-shrink-0 items-center justify-between px-6 py-3 bg-white border-b border-border">
              <div className="relative w-72">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                <input placeholder="Search resources..." className="w-full pl-9 pr-4 py-2 text-sm bg-muted rounded-xl border-0 outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div className="flex items-center gap-3">
                <button className="w-9 h-9 rounded-xl hover:bg-muted flex items-center justify-center text-muted-foreground relative">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                </button>
                <button className="w-9 h-9 rounded-xl hover:bg-muted flex items-center justify-center text-muted-foreground">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                </button>
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm cursor-pointer">A</div>
              </div>
            </div>

            {/* Mobile-only top header */}
            <div className="lg:hidden flex-shrink-0">
              <MobileHeader />
            </div>

            {/* Main content + right panel */}
            <div className="flex-1 flex overflow-hidden">
              {/* Scrollable page content */}
              <div className="flex-1 overflow-y-auto scrollbar-thin">
                <div className="min-h-full">
                  <ErrorBoundary resetKey={location.pathname}>
                    <Suspense fallback={<PageLoader />}>
                      <Outlet />
                    </Suspense>
                  </ErrorBoundary>
                </div>
              </div>

              {/* Desktop Right Panel — xl+ */}
              <aside className="hidden xl:flex flex-col w-64 flex-shrink-0 border-l border-border">
                <RightPanel />
              </aside>
            </div>

            {/* Mobile Bottom Nav */}
            <div className="lg:hidden flex-shrink-0 pb-safe">
              <MobileBottomNav />
            </div>
          </div>
        </div>
        </LiveSessionProvider>
        </WalletProvider>
        </MessagingProvider>
        </AccountStatusGuard>
      </NotificationProvider>
    </FeedRealtimeProvider>
  );
}