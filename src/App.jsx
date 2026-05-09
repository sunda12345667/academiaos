import { Toaster } from "@/components/ui/toaster";
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClientInstance } from '@/lib/query-client';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import { UserProvider } from '@/hooks/useCurrentUser';
import AppShell from '@/components/layout/AppShell';
import ErrorBoundary from '@/lib/errors/ErrorBoundary';

// Route-level code splitting — each page is a separate bundle chunk
const Home          = lazy(() => import('@/pages/Home'));
const Learn         = lazy(() => import('@/pages/Learn'));
const Groups        = lazy(() => import('@/pages/Groups'));
const Marketplace   = lazy(() => import('@/pages/Marketplace'));
const Wallet        = lazy(() => import('@/pages/Wallet'));
const Notifications = lazy(() => import('@/pages/Notifications'));
const Profile       = lazy(() => import('@/pages/Profile'));
const Create        = lazy(() => import('@/pages/Create'));

// App-level splash loader (used before router is ready)
function AppLoader() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-2xl gradient-brand flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
        </div>
        <p className="text-sm text-muted-foreground font-medium">Loading StudentOS…</p>
      </div>
    </div>
  );
}

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) return <AppLoader />;

  if (authError) {
    if (authError.type === 'user_not_registered') return <UserNotRegisteredError />;
    if (authError.type === 'auth_required') { navigateToLogin(); return null; }
  }

  return (
    // UserProvider is above AppShell so profile is available when AppShell mounts providers
    <UserProvider>
      {/*
        Suspense here is the ROOT fallback for initial lazy chunk loads.
        AppShell adds a SECOND Suspense for subsequent navigations.
        This prevents the entire app from going blank on first load.
      */}
      <Suspense fallback={<AppLoader />}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={<Home />} />
            <Route path="/learn" element={<Learn />} />
            <Route path="/groups" element={<Groups />} />
            <Route path="/marketplace" element={<Marketplace />} />
            <Route path="/wallet" element={<Wallet />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/profile/:username" element={<Profile />} />
            <Route path="/create" element={<Create />} />
          </Route>
          <Route path="*" element={<PageNotFound />} />
        </Routes>
      </Suspense>
    </UserProvider>
  );
};

export default function App() {
  return (
    // Top-level ErrorBoundary catches any catastrophic failures (auth, query client, router)
    <ErrorBoundary message="StudentOS failed to load. Please refresh the page.">
      <AuthProvider>
        <QueryClientProvider client={queryClientInstance}>
          <Router>
            <AuthenticatedApp />
          </Router>
          <Toaster />
        </QueryClientProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}