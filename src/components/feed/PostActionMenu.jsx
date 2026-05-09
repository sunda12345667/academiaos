/**
 * PostActionMenu — Context menu for post actions
 * Permission-aware: shows different options based on role
 */
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Flag, Trash2, Edit, Link2, EyeOff, PinIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { PERMISSIONS } from '@/services/auth/permissions';

export default function PostActionMenu({ post, currentProfile }) {
  const { can } = useCurrentUser();
  const isOwn = currentProfile?.id === post.author_id;
  const canDelete = isOwn || can(PERMISSIONS.POST_DELETE_ANY);
  const canPin = can(PERMISSIONS.POST_PIN);

  function copyLink() {
    navigator.clipboard.writeText(`${window.location.origin}/post/${post.id}`);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="w-8 h-8 text-muted-foreground hover:text-foreground flex-shrink-0">
          <MoreHorizontal className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={copyLink} className="gap-2">
          <Link2 className="w-4 h-4" /> Copy link
        </DropdownMenuItem>

        {isOwn && (
          <DropdownMenuItem className="gap-2">
            <Edit className="w-4 h-4" /> Edit post
          </DropdownMenuItem>
        )}

        {canPin && (
          <DropdownMenuItem className="gap-2">
            <PinIcon className="w-4 h-4" /> Pin post
          </DropdownMenuItem>
        )}

        <DropdownMenuItem className="gap-2">
          <EyeOff className="w-4 h-4" /> Not interested
        </DropdownMenuItem>

        {!isOwn && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2 text-destructive focus:text-destructive">
              <Flag className="w-4 h-4" /> Report
            </DropdownMenuItem>
          </>
        )}

        {canDelete && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2 text-destructive focus:text-destructive">
              <Trash2 className="w-4 h-4" /> Delete post
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}