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
import { Outlet } from 'react-router-dom';
import { Suspense } from 'react';
import DesktopSidebar from './DesktopSidebar';
import MobileBottomNav from './MobileBottomNav';
import RightPanel from './RightPanel';
import MobileHeader from './MobileHeader';
import { FeedRealtimeProvider } from '@/providers/FeedRealtimeProvider';
import { NotificationProvider } from '@/providers/NotificationProvider';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import ErrorBoundary from '@/lib/errors/ErrorBoundary';

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="w-6 h-6 border-2 border-border border-t-primary rounded-full animate-spin" />
    </div>
  );
}

export default function AppShell() {
  const { profile } = useCurrentUser();

  return (
    <FeedRealtimeProvider>
      <NotificationProvider profileId={profile?.id}>
        <div className="flex h-screen bg-background overflow-hidden">
          {/* Desktop Left Sidebar — hidden on mobile */}
          <aside className="hidden lg:flex flex-col w-64 xl:w-72 flex-shrink-0">
            <DesktopSidebar />
          </aside>

          {/* Main Content Area */}
          <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
            {/* Mobile-only top header */}
            <div className="lg:hidden flex-shrink-0">
              <MobileHeader />
            </div>

            {/* Scrollable page content with route-level error boundary */}
            <div className="flex-1 overflow-y-auto scrollbar-thin">
              <div className="min-h-full">
                <ErrorBoundary>
                  <Suspense fallback={<PageLoader />}>
                    <Outlet />
                  </Suspense>
                </ErrorBoundary>
              </div>
            </div>

            {/* Mobile Bottom Nav — hidden on desktop */}
            <div className="lg:hidden flex-shrink-0 pb-safe">
              <MobileBottomNav />
            </div>
          </main>

          {/* Desktop Right Utility Panel — only xl+ */}
          <aside className="hidden xl:flex flex-col w-80 flex-shrink-0 border-l border-border/50">
            <RightPanel />
          </aside>
        </div>
      </NotificationProvider>
    </FeedRealtimeProvider>
  );
}