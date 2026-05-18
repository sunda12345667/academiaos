import { useAuth } from '@/lib/AuthContext';

// Simply renders children — Base44 platform handles login redirect automatically
export default function ProtectedRoute({ children, requireOnboarding = false }) {
  const { isLoadingAuth } = useAuth();

  if (isLoadingAuth) {
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

  return children;
}