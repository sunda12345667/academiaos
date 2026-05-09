/**
 * AccountStatusGuard
 *
 * Wraps the authenticated app and enforces account health checks.
 * Suspended and banned users are shown a hard block screen instead of the app.
 *
 * Placement: Inside UserProvider, wrapping <AppShell> (or its children).
 *
 * Users with account_status: 'pending_verification' pass through — they can
 * still use the platform with limited functionality; feature gates handle the rest.
 */
import { ShieldAlert, LogOut } from 'lucide-react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { base44 } from '@/api/base44Client';

const BLOCK_REASONS = {
  suspended: {
    title: 'Account Suspended',
    description:
      'Your account has been temporarily suspended due to a violation of our community guidelines. ' +
      'If you believe this is a mistake, please contact support.',
    color: 'text-amber-600',
    bg: 'bg-amber-50 border-amber-200',
  },
  banned: {
    title: 'Account Banned',
    description:
      'Your account has been permanently banned for serious violations of our community guidelines. ' +
      'If you believe this is an error, please contact support.',
    color: 'text-destructive',
    bg: 'bg-destructive/5 border-destructive/20',
  },
};

export default function AccountStatusGuard({ children }) {
  const { profile, loading } = useCurrentUser();

  // Don't block while profile is loading — avoid flash of block screen
  if (loading || !profile) return children;

  const status = profile.account_status;
  const block = BLOCK_REASONS[status];

  if (!block) return children;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background p-6">
      <div className={`max-w-md w-full rounded-2xl border p-8 text-center space-y-4 ${block.bg}`}>
        <div className="flex justify-center">
          <ShieldAlert className={`w-12 h-12 ${block.color}`} />
        </div>
        <div>
          <h2 className={`font-jakarta font-bold text-xl mb-2 ${block.color}`}>
            {block.title}
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {block.description}
          </p>
        </div>
        <button
          onClick={() => base44.auth.logout()}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-secondary text-secondary-foreground text-sm font-medium hover:bg-secondary/80 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </div>
  );
}