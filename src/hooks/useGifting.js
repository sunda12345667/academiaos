/**
 * useGifting Hook
 *
 * Manages gift catalog loading, sending, and realtime gift stream display
 * for live sessions and post tipping.
 *
 * Realtime gift stream:
 *   Subscribes to Gift entity via RealtimeBus.
 *   New gifts for this session/post → pushed to giftStream array.
 *   UI layer reads giftStream to trigger animations.
 *   Gifts are pruned after 8s to avoid memory accumulation.
 *
 * Usage (live session gift panel):
 *   const { catalog, giftStream, sendGift, loading } = useGifting({ sessionId });
 *
 * Usage (post tipping):
 *   const { catalog, sendGift, sending } = useGifting({ postId, recipientId });
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import RealtimeBus from '@/lib/realtime/RealtimeBus';
import giftingService from '@/services/wallet/gifting.service';
import { useCurrentUser } from '@/hooks/useCurrentUser';

export function useGifting({ sessionId, postId, recipientId } = {}) {
  const { profile } = useCurrentUser();
  const profileId = profile?.id;

  const [catalog, setCatalog] = useState([]);
  const [giftStream, setGiftStream] = useState([]); // recent gifts for animations
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(null);
  const [catalogLoading, setCatalogLoading] = useState(true);

  const pruneTimersRef = useRef([]);

  // ─── Load Catalog ─────────────────────────────────────────────────────────

  useEffect(() => {
    giftingService.getGiftCatalog()
      .then(items => setCatalog(items))
      .catch(() => {})
      .finally(() => setCatalogLoading(false));
  }, []);

  // ─── Realtime Gift Stream ─────────────────────────────────────────────────

  useEffect(() => {
    if (!sessionId && !postId) return;

    return RealtimeBus.subscribe('Gift', 'create', (event) => {
      const gift = event.data;
      if (!gift) return;

      // Filter by context
      if (sessionId && gift.session_id !== sessionId) return;
      if (postId && gift.post_id !== postId) return;
      if (gift.status !== 'delivered') return;

      setGiftStream(prev => [
        { ...gift, _streamKey: `${gift.id}_${Date.now()}` },
        ...prev.slice(0, 19), // keep last 20
      ]);

      // Prune from stream after 8s (animation window)
      const timer = setTimeout(() => {
        setGiftStream(prev => prev.filter(g => g.id !== gift.id));
      }, 8000);
      pruneTimersRef.current.push(timer);
    });
  }, [sessionId, postId]);

  // Cleanup animation prune timers
  useEffect(() => {
    return () => {
      pruneTimersRef.current.forEach(t => clearTimeout(t));
    };
  }, []);

  // ─── Send Gift ─────────────────────────────────────────────────────────────

  const sendGift = useCallback(async ({ giftItemId, message, isAnonymous = false }) => {
    if (!profileId) throw new Error('Not authenticated');
    if (!recipientId) throw new Error('No recipient specified');

    setSending(true);
    setSendError(null);

    try {
      const result = await giftingService.sendGift({
        senderId: profileId,
        recipientId,
        giftItemId,
        sessionId,
        postId,
        message,
        isAnonymous,
        context: sessionId ? 'live_session' : postId ? 'post_tip' : 'appreciation',
      });
      return result;
    } catch (err) {
      setSendError(err.message);
      throw err;
    } finally {
      setSending(false);
    }
  }, [profileId, recipientId, sessionId, postId]);

  return {
    catalog,
    catalogLoading,
    giftStream,
    sendGift,
    sending,
    sendError,
    // Grouped catalog for UI
    catalogByCategory: _groupByCategory(catalog),
  };
}

function _groupByCategory(items) {
  return items.reduce((acc, item) => {
    const cat = item.category || 'appreciation';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});
}

export default useGifting;