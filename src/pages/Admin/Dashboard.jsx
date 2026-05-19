import { useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, ShieldAlert, CreditCard,
  Megaphone, FileText, Settings, ChevronRight, AlertTriangle
} from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV = [
  { to: '/admin',            icon: LayoutDashboard, label: 'Overview',    exact: true },
  { to: '/admin/users',      icon: Users,           label: 'Users' },
  { to: '/admin/moderation', icon: ShieldAlert,     label: 'Moderation' },
  { to: '/admin/payouts',    icon: CreditCard,      label: 'Payouts' },
  { to: '/admin/ads',        icon: Megaphone,       label: 'Ad Campaigns' },
  { to: '/admin/audit',      icon: FileText,        label: 'Audit Log' },
];

export default function AdminDashboard() {
  const { pathname } = useLocation();
  const isActive = (to, exact) => exact ? pathname === to : pathname.startsWith(to);

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 bg-white border-r border-border flex flex-col">
        <div className="px-5 py-5 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-destructive flex items-center justify-center">
              <ShieldAlert className="w-4 h-4 text-white" />
            </div>
            <span className="font-jakarta font-bold text-base text-foreground">Admin Panel</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">StudentOS Operations</p>
        </div>
        <nav className="flex-1 p-3 space-y-0.5">
          {NAV.map(({ to, icon: Icon, label, exact }) => (
            <Link
              key={to}
              to={to}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors',
                isActive(to, exact)
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="p-3 border-t border-border">
          <Link to="/" className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors">
            ← Back to App
          </Link>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 overflow-y-auto">
        <Outlet />
      </div>
    </div>
  );
}