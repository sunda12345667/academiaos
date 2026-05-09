/**
 * SensitiveActionGuard — Confirmation gate for destructive / financial actions
 *
 * Renders a confirmation dialog before executing a sensitive action.
 * Future: Add re-authentication step (password re-entry) for KYC-level actions.
 *
 * Usage:
 *   <SensitiveActionGuard
 *     trigger={<Button variant="destructive">Delete Account</Button>}
 *     title="Delete your account?"
 *     description="This action cannot be undone. All your data will be permanently removed."
 *     confirmLabel="Yes, delete"
 *     onConfirm={handleDeleteAccount}
 *     destructive
 *   />
 */
import { useState } from 'react';
import { AlertTriangle, ShieldCheck } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export default function SensitiveActionGuard({
  trigger,
  title = 'Are you sure?',
  description = 'This action may not be reversible.',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  destructive = false,
  disabled = false,
}) {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (!onConfirm) return;
    setLoading(true);
    try {
      await onConfirm();
    } finally {
      setLoading(false);
    }
  };

  if (disabled) return trigger;

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-1">
            {destructive
              ? <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0" />
              : <ShieldCheck className="w-5 h-5 text-primary flex-shrink-0" />
            }
            <AlertDialogTitle>{title}</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="pl-8">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={loading}
            className={destructive ? 'bg-destructive hover:bg-destructive/90 text-destructive-foreground' : ''}
          >
            {loading ? 'Please wait…' : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}