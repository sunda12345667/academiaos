/**
 * PresenceBus — Ephemeral user presence tracking
 *
 * Tracks which users are "online" or "active in a conversation".
 * This is intentionally CLIENT-SIDE ONLY — never persisted to DB.
 *
 * Architecture:
 *   - Heartbeat: each active user emits a heartbeat every 30s
 *   - Presence map: profileId → lastSeenMs
 *   - Stale threshold: > 45s = offline
 *   - Page visibility: pause heartbeat on hidden tab
 *
 * Usage:
 *   PresenceBus.startHeartbeat(profileId)       — call when user is authenticated
 *   PresenceBus.stopHeartbeat()                 — call on logout
 *   PresenceBus.isOnline(profileId)             — check presence
 *   PresenceBus.getOnlineUsers(profileIds[])    — batch check
 *   PresenceBus.onPresenceChange(cb)            — subscribe to presence events
 *   PresenceBus.setConversationActive(convId)   — mark user as in a conversation
 *
 * Migration note:
 *   Move to a dedicated WebSocket presence service (e.g., Ably or custom WS gateway).
 *   Presence should be stored in Redis with 60s TTL per profileId.
 *   "Last seen" timestamps persist to UserProfile.last_active on heartbeat.
 *
 * Future: Voice/Video
 *   The PresenceBus also tracks "in_call" status which will gate
 *   WebRTC signaling flows (offer/answer/ICE candidates).
 *   Call presence: { status: 'available' | 'in_call' | 'busy', roomId? }
 */

const HEARTBEAT_INTERVAL_MS = 30_000;
const STALE_THRESHOLD_MS    = 45_000;

// profileId → { lastSeen: number, status: 'online'|'away'|'in_call', conversationId?: string }
const presenceMap = new Map();

// Registered presence change listeners
const changeListeners = new Set();

let heartbeatTimer = null;
let currentProfileId = null;

// ─── Heartbeat ────────────────────────────────────────────────────────────────

export function startHeartbeat(profileId) {
  if (!profileId) return;
  currentProfileId = profileId;

  // Mark self as online immediately
  _updatePresence(profileId, { status: 'online', lastSeen: Date.now() });

  if (heartbeatTimer) clearInterval(heartbeatTimer);

  heartbeatTimer = setInterval(() => {
    if (document.visibilityState === 'visible') {
      _updatePresence(profileId, { status: 'online', lastSeen: Date.now() });
    }
  }, HEARTBEAT_INTERVAL_MS);

  // Page visibility integration
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', _handleVisibility);
  }
}

export function stopHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
  if (currentProfileId) {
    presenceMap.delete(currentProfileId);
    _notifyListeners({ type: 'offline', profileId: currentProfileId });
    currentProfileId = null;
  }
  if (typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', _handleVisibility);
  }
}

// ─── Presence Queries ─────────────────────────────────────────────────────────

export function isOnline(profileId) {
  const entry = presenceMap.get(profileId);
  if (!entry) return false;
  return Date.now() - entry.lastSeen < STALE_THRESHOLD_MS;
}

export function getPresence(profileId) {
  const entry = presenceMap.get(profileId);
  if (!entry || Date.now() - entry.lastSeen >= STALE_THRESHOLD_MS) {
    return { online: false, status: 'offline', lastSeen: null };
  }
  return { online: true, status: entry.status || 'online', lastSeen: entry.lastSeen, conversationId: entry.conversationId };
}

/**
 * Batch check — returns Map<profileId, { online, status }>
 */
export function getOnlineUsers(profileIds) {
  const result = new Map();
  profileIds.forEach(id => result.set(id, getPresence(id)));
  return result;
}

// ─── Conversation Presence ────────────────────────────────────────────────────

export function setConversationActive(conversationId) {
  if (!currentProfileId) return;
  _updatePresence(currentProfileId, {
    status: 'online',
    lastSeen: Date.now(),
    conversationId,
  });
}

export function clearConversationActive() {
  if (!currentProfileId) return;
  const entry = presenceMap.get(currentProfileId) || {};
  _updatePresence(currentProfileId, {
    ...entry,
    conversationId: null,
    lastSeen: Date.now(),
  });
}

// ─── Future: Voice/Video Readiness ───────────────────────────────────────────

export function setInCall(roomId) {
  if (!currentProfileId) return;
  _updatePresence(currentProfileId, {
    status: 'in_call',
    lastSeen: Date.now(),
    callRoomId: roomId,
  });
}

export function clearCall() {
  if (!currentProfileId) return;
  _updatePresence(currentProfileId, {
    status: 'online',
    lastSeen: Date.now(),
    callRoomId: null,
  });
}

// ─── Subscriptions ────────────────────────────────────────────────────────────

/**
 * Subscribe to presence changes.
 * @param {function} callback - receives { type: 'online'|'offline'|'update', profileId, presence }
 * @returns {function} unsubscribe
 */
export function onPresenceChange(callback) {
  changeListeners.add(callback);
  return () => changeListeners.delete(callback);
}

/**
 * Register a remote user's presence (when their heartbeat arrives via WS/Realtime).
 * Future: Called by WS gateway when receiving presence events from other clients.
 */
export function receivePresence(profileId, presenceData) {
  _updatePresence(profileId, { ...presenceData, lastSeen: Date.now() });
}

// ─── Internal ─────────────────────────────────────────────────────────────────

function _updatePresence(profileId, data) {
  const prev = presenceMap.get(profileId);
  const next = { ...(prev || {}), ...data };
  presenceMap.set(profileId, next);
  _notifyListeners({ type: 'update', profileId, presence: getPresence(profileId) });
}

function _notifyListeners(event) {
  changeListeners.forEach(cb => {
    try { cb(event); } catch {}
  });
}

function _handleVisibility() {
  if (!currentProfileId) return;
  if (document.visibilityState === 'visible') {
    _updatePresence(currentProfileId, { status: 'online', lastSeen: Date.now() });
  } else {
    _updatePresence(currentProfileId, { status: 'away', lastSeen: Date.now() });
  }
}

const PresenceBus = {
  startHeartbeat,
  stopHeartbeat,
  isOnline,
  getPresence,
  getOnlineUsers,
  setConversationActive,
  clearConversationActive,
  setInCall,
  clearCall,
  onPresenceChange,
  receivePresence,
};

export default PresenceBus;