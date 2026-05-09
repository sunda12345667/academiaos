/**
 * RequireRole — Role-based UI gate and route guard
 *
 * Two usage modes:
 *
 * 1. UI gate — wraps UI elements:
 *    <RequireRole role={ROLES.MODERATOR}>
 *      <ModerationDashboard />
 *    </RequireRole>
 *
 * 2. Route guard (atLeast=true) — renders <Outlet> for use in App.jsx:
 *    <Route element={<RequireRole role={ROLES.SCHOOL_ADMIN} asRoute />}>
 *      <Route path="/admin" element={<AdminPage />} />
 *    </Route>
 *
 * Props:
 *   role       — exact role required (unless atLeast is true)
 *   atLeast    — if true, allows the role AND any higher role
 *   asRoute    — renders <Outlet> as child (for use as a Route element)
 *   fallback   — what to render when access is denied (default: null)
 *   children   — what to render when access is granted
 */
import { Outlet } from 'react-router-dom';
import usePermission from '@/hooks/usePermission';

export default function RequireRole({
  role,
  atLeast = false,
  asRoute = false,
  fallback = null,
  children,
}) {
  const { isRole, isAtLeastRole } = usePermission();

  const allowed = atLeast ? isAtLeastRole(role) : isRole(role);

  if (!allowed) return fallback;

  return asRoute ? <Outlet /> : children;
}