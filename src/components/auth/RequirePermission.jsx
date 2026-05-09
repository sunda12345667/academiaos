/**
 * RequirePermission — Declarative UI permission gate
 *
 * Renders children only when the current user holds the required permission(s).
 * Renders `fallback` (default: null) otherwise.
 *
 * Usage:
 *   <RequirePermission permission={PERMISSIONS.COURSE_CREATE}>
 *     <CreateCourseButton />
 *   </RequirePermission>
 *
 *   <RequirePermission anyOf={[PERMISSIONS.POST_DELETE_ANY, PERMISSIONS.CONTENT_REMOVE]}>
 *     <ModerationMenu />
 *   </RequirePermission>
 *
 *   <RequirePermission permission={PERMISSIONS.ADMIN_DASHBOARD} fallback={<AccessDenied />}>
 *     <AdminPanel />
 *   </RequirePermission>
 */
import usePermission from '@/hooks/usePermission';

export default function RequirePermission({
  permission,
  anyOf,
  allOf,
  fallback = null,
  children,
}) {
  const { can, canAny, canAll } = usePermission();

  let allowed = false;
  if (permission) allowed = can(permission);
  else if (anyOf)  allowed = canAny(anyOf);
  else if (allOf)  allowed = canAll(allOf);

  return allowed ? children : fallback;
}