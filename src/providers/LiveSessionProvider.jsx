/**
 * LiveSessionProvider — Realtime live session orchestration
 *
 * Architecture:
 *   - ONE LiveSession subscription via RealtimeBus (shared across all consumers)
 *   - Tracks active sessions list + current open session state
 *   - Viewer join/leave managed here to prevent duplicate count updates
 *   - Live chat delegated to MessagingProvider (uses same Message subscription)
 *
 * Provider placement: inside AppShell, siblings to MessagingProvider
 *
 * Future:
 *   - WebRTC signaling events routed through this provider
 *   - Stream health monitoring (buffer events, quality changes)
 *   - Co-host permission events
 */

import {
  createContext, useContext, useState, useEffect,
  useCallback, useRef, useMemo
} from 'react';
import RealtimeBus from '@/lib/realtime/RealtimeBus';
import liveService from '@/services/live/live.service';
import { useCurrentUser } from '@/hooks/useCurrentUser';

const LiveSessionContext = createContext(null);

export function LiveSessionProvider({ children }) {
  const { profile } = useCurrentUser();

  const [liveSessions, setLiveSessions] = useState([]);  // platform-wide active sessions
  const [currentSession, setCurrentSession] = useState(null); // session user is currently viewing
  const [viewingSessionId, setViewingSessionId] = useState(null);
  const [loading, setLoading] = useState(false);

  // Track sessions the user has joined (for viewer count management)
  const joinedSessionRef = useRef(null);

  // ─── Initial Load ────────────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    liveService.getLiveSessions({ limit: 20 })
      .then(sessions => { if (!cancelled) setLiveSessions(sessions); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, []);

  // ─── Realtime Subscription ───────────────────────────────────────────────────

  useEffect(() => {
    return RealtimeBus.subscribe('LiveSession', '*', (event) => {
      const session = event.data;
      if (!session) return;

      if (event.type === 'create') {
        if (session.status === 'live') {
          setLiveSessions(prev => {
            if (prev.some(s => s.id === session.id)) return prev;
            return [session, ...prev].sort((a, b) =>
              (b.current_viewer_count || 0) - (a.current_viewer_count || 0)
            );
          });
        }
      }

      if (event.type === 'update') {
        // Update active sessions list
        if (session.status === 'live') {
          setLiveSessions(prev =>
            prev.map(s => s.id === session.id ? session : s)
              .sort((a, b) => (b.current_viewer_count || 0) - (a.current_viewer_count || 0))
          );
        } else if (session.status === 'ended' || session.status === 'cancelled') {
          setLiveSessions(prev => prev.filter(s => s.id !== session.id));
        }

        // Update current session if viewer is watching it
        if (currentSession?.id === session.id) {
          setCurrentSession(session);
        }
      }
    });
  }, [currentSession?.id]);

  // ─── Viewer Management ────────────────────────────────────────────────────────

  const joinSession = useCallback(async (sessionId) => {
    if (joinedSessionRef.current === sessionId) return;

    // Leave previous session if any
    if (joinedSessionRef.current) {
      liveService.viewerLeave(joinedSessionRef.current).catch(() => {});
    }

    joinedSessionRef.current = sessionId;
    setViewingSessionId(sessionId);

    const session = await liveService.getSessionById(sessionId);
    setCurrentSession(session);

    liveService.viewerJoin(sessionId).catch(() => {});
  }, []);

  const leaveSession = useCallback(async () => {
    const sessionId = joinedSessionRef.current;
    if (!sessionId) return;

    joinedSessionRef.current = null;
    setViewingSessionId(null);
    setCurrentSession(null);

    liveService.viewerLeave(sessionId).catch(() => {});
  }, []);

  // Cleanup on unmount (tab close / navigation)
  useEffect(() => {
    return () => {
      if (joinedSessionRef.current) {
        liveService.viewerLeave(joinedSessionRef.current).catch(() => {});
      }
    };
  }, []);

  // ─── Host Controls ────────────────────────────────────────────────────────────

  const startSession = useCallback(async (sessionId) => {
    if (!profile?.id) throw new Error('Not authenticated');
    const result = await liveService.startLiveSession(sessionId, profile.id);
    setCurrentSession(result.session);
    return result;
  }, [profile?.id]);

  const endSession = useCallback(async (sessionId) => {
    if (!profile?.id) throw new Error('Not authenticated');
    const ended = await liveService.endLiveSession(sessionId, profile.id);
    setCurrentSession(ended);
    setViewingSessionId(null);
    return ended;
  }, [profile?.id]);

  const setModerationMode = useCallback(async (sessionId, mode) => {
    if (!profile?.id) throw new Error('Not authenticated');
    return await liveService.setModerationMode(sessionId, profile.id, mode);
  }, [profile?.id]);

  const value = useMemo(() => ({
    liveSessions,
    currentSession,
    viewingSessionId,
    loading,
    joinSession,
    leaveSession,
    startSession,
    endSession,
    setModerationMode,
    isHosting: currentSession?.host_id === profile?.id,
    isLive: currentSession?.status === 'live',
  }), [
    liveSessions, currentSession, viewingSessionId, loading,
    joinSession, leaveSession, startSession, endSession, setModerationMode,
    profile?.id,
  ]);

  return (
    <LiveSessionContext.Provider value={value}>
      {children}
    </LiveSessionContext.Provider>
  );
}

export function useLiveSessionStore() {
  const ctx = useContext(LiveSessionContext);
  if (!ctx) return {
    liveSessions: [],
    currentSession: null,
    viewingSessionId: null,
    loading: false,
    joinSession: () => Promise.resolve(),
    leaveSession: () => Promise.resolve(),
    startSession: () => Promise.resolve(),
    endSession: () => Promise.resolve(),
    setModerationMode: () => Promise.resolve(),
    isHosting: false,
    isLive: false,
  };
  return ctx;
}