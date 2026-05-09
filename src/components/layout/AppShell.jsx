/**
 * AppShell — Root layout container
 * Orchestrates: Sidebar + Main content + Right panel + Mobile nav
 * All page content renders inside <Outlet />
 */
import { Outlet } from 'react-router-dom';
import DesktopSidebar from './DesktopSidebar';
import MobileBottomNav from './MobileBottomNav';
import RightPanel from './RightPanel';
import MobileHeader from './MobileHeader';

export default function AppShell() {
  return (
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

        {/* Scrollable page content */}
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="min-h-full">
            <Outlet />
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
  );
}