import { Toaster } from "@/components/ui/toaster";
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClientInstance } from '@/lib/query-client';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
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
const Login         = lazy(() => import('@/pages/Auth/Login'));
const SchoolSelect  = lazy(() => import('@/pages/Onboarding/SchoolSelect'));
const ProfileSetup  = lazy(() => import('@/pages/Onboarding/ProfileSetup'));
const InterestSelect = lazy(() => import('@/pages/Onboarding/InterestSelect'));
const OnboardingComplete = lazy(() => import('@/pages/Onboarding/Complete'));
const AdminDashboard   = lazy(() => import('@/pages/Admin/Dashboard'));
const AdminOverview    = lazy(() => import('@/pages/Admin/Overview'));
const AdminUsers       = lazy(() => import('@/pages/Admin/Users'));
const AdminModeration  = lazy(() => import('@/pages/Admin/Moderation'));
const AdminPayouts     = lazy(() => import('@/pages/Admin/Payouts'));
const AdminAdCampaigns = lazy(() => import('@/pages/Admin/AdCampaigns'));
const AdminAuditLog    = lazy(() => import('@/pages/Admin/AuditLog'));

import ProtectedRoute from '@/components/ProtectedRoute';


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
  const { isLoadingAuth } = useAuth();

  if (isLoadingAuth) return <AppLoader />;

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
          {/* Public Auth Routes */}
          <Route path="/login" element={<Login />} />
          
          {/* Onboarding Routes */}
          <Route path="/onboarding/school" element={<ProtectedRoute><SchoolSelect /></ProtectedRoute>} />
          <Route path="/onboarding/profile" element={<ProtectedRoute><ProfileSetup /></ProtectedRoute>} />
          <Route path="/onboarding/interests" element={<ProtectedRoute><InterestSelect /></ProtectedRoute>} />
          <Route path="/onboarding/complete" element={<ProtectedRoute><OnboardingComplete /></ProtectedRoute>} />

          {/* Protected App Routes */}
          <Route element={<ProtectedRoute requireOnboarding><AppShell /></ProtectedRoute>}>
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

          {/* Admin Routes */}
          <Route path="/admin" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>}>
            <Route index element={<AdminOverview />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="moderation" element={<AdminModeration />} />
            <Route path="payouts" element={<AdminPayouts />} />
            <Route path="ads" element={<AdminAdCampaigns />} />
            <Route path="audit" element={<AdminAuditLog />} />
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