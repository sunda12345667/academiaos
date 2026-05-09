/**
 * useWatchTime Hook
 *
 * Tracks video/content watch duration and fires analytics on completion or exit.
 * Designed for:
 *   - Short video feed (fires on scroll-past or video end)
 *   - Post detail view (fires on page leave)
 *   - Live session (fires on leave/disconnect)
 *   - Course lessons (fires on lesson completion)
 *
 * Implementation:
 *   - Uses IntersectionObserver for scroll-based impression tracking
 *   - Uses beforeunload for exit tracking
 *   - Debounces impressions (100ms) to prevent feed-scroll spam
 *   - All analytics writes are fire-and-forget (never await)
 *
 * Usage:
 *   const { startWatch, stopWatch, onVideoTimeUpdate } = useWatchTime(postId, 'post', { source, contentDuration });
 */

import { useEffect, useRef, useCallback } from 'react';
import watchService from '@/services/analytics/watch.service';
import { useCurrentUser } from '@/hooks/useCurrentUser';

export function useWatchTime(contentId, contentType = 'post', {
  source = 'feed_home',
  contentDuration = 0,
  autoStart = false,
} = {}) {
  const { profile } = useCurrentUser();
  const profileId = profile?.id;

  const startTimeRef = useRef(null);
  const watchedSecondsRef = useRef(0);
  const lastUpdateRef = useRef(0);
  const hasRecordedRef = useRef(false);
  const isActiveRef = useRef(false);

  // ─── Core Watch Tracking ──────────────────────────────────────────────────────

  const startWatch = useCallback(() => {
    if (isActiveRef.current || !contentId || !profileId) return;
    isActiveRef.current = true;
    startTimeRef.current = Date.now();
  }, [contentId, profileId]);

  const stopWatch = useCallback((exitedAtSeconds) => {
    if (!isActiveRef.current) return;
    isActiveRef.current = false;

    const sessionDuration = (Date.now() - (startTimeRef.current || Date.now())) / 1000;
    watchedSecondsRef.current += sessionDuration;

    if (!profileId || !contentId || hasRecordedRef.current) return;
    if (watchedSecondsRef.current < 1) return; // ignore sub-second bounces

    hasRecordedRef.current = true;

    watchService.recordWatchEvent({
      userProfileId: profileId,
      contentId,
      contentType,
      watchDuration: Math.round(watchedSecondsRef.current),
      contentDuration,
      source,
      exitedAtSeconds: exitedAtSeconds ?? Math.round(watchedSecondsRef.current),
    });
  }, [profileId, contentId, contentType, source, contentDuration]);

  // For <video> elements: track exact playhead position
  const onVideoTimeUpdate = useCallback((currentTime, duration) => {
    if (!isActiveRef.current) return;
    lastUpdateRef.current = currentTime;

    // Fire incremental watch event at 25%, 50%, 75%, 95% milestones
    // Future: send heartbeat to server for real-time retention curve
  }, []);

  // ─── Auto-start on mount if requested ────────────────────────────────────────

  useEffect(() => {
    if (!autoStart) return;
    startWatch();
    return () => stopWatch();
  }, [contentId, autoStart]); // eslint-disable-line

  // ─── Page/Tab Leave Handling ──────────────────────────────────────────────────

  useEffect(() => {
    const handleBeforeUnload = () => stopWatch(lastUpdateRef.current || undefined);
    window.addEventListener('beforeunload', handleBeforeUnload);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') stopWatch();
      else if (document.visibilityState === 'visible' && !hasRecordedRef.current) startWatch();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [startWatch, stopWatch]);

  return { startWatch, stopWatch, onVideoTimeUpdate };
}

/**
 * useImpression — Track when a post enters the viewport
 * Used on feed cards for non-video content view counting.
 *
 * Usage:
 *   const { ref } = useImpression(postId, { source: 'feed_home', minDuration: 1000 });
 *   <div ref={ref}>...</div>
 */
export function useImpression(contentId, { source = 'feed_home', minDuration = 1000 } = {}) {
  const { profile } = useCurrentUser();
  const profileId = profile?.id;
  const timerRef = useRef(null);
  const firedRef = useRef(false);
  const elementRef = useRef(null);

  useEffect(() => {
    if (!contentId || !profileId || firedRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          // Only record after minDuration ms in viewport (avoids fast-scroll spam)
          timerRef.current = setTimeout(() => {
            if (!firedRef.current) {
              firedRef.current = true;
              watchService.recordImpression(profileId, contentId, source);
            }
          }, minDuration);
        } else {
          clearTimeout(timerRef.current);
        }
      },
      { threshold: 0.5 }
    );

    if (elementRef.current) observer.observe(elementRef.current);

    return () => {
      clearTimeout(timerRef.current);
      observer.disconnect();
    };
  }, [contentId, profileId, source, minDuration]);

  return { ref: elementRef };
}

export default useWatchTime;