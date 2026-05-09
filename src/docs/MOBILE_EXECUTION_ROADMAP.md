# StudentOS — Mobile Execution Roadmap
*v1.0 | 2026-05-09*

---

## Mobile-First Design Decisions (Already in Place)

StudentOS is built on React + Vite. The same codebase serves both the web app and — via **Capacitor** — iOS and Android as a hybrid native app. This is the correct architecture for a startup that needs to move fast.

### Capacitor (Not React Native) — Rationale

| Factor | Capacitor | React Native |
|---|---|---|
| Code reuse | 100% — exact same React components | ~70% — separate native navigation + components |
| Migration cost | Days (add Capacitor, build apps) | Months (rewrite navigation, gestures) |
| Performance at MVP | Sufficient for social feeds, DMs, profiles | Marginally better for animations |
| Ecosystem | Ionic plugins (camera, push, biometrics) | React Native ecosystem |
| Team requirement | Frontend web engineers can ship mobile | Requires dedicated RN engineers |

**Decision: Ship Capacitor hybrid app for Phase 1. Evaluate React Native migration at Phase 3 when DAU > 10k and animation performance becomes user-complained.**

---

## Current Mobile Readiness (Web Layer)

### Already Done ✅
- Mobile-bottom nav (`MobileBottomNav`) with safe-area padding
- `MobileHeader` for contextual top nav
- `pb-safe` / `pt-safe` safe area utilities
- `scrollbar-hide` on feeds (mobile scroll behavior)
- `overflow-x-auto scrollbar-hide snap-x` for horizontal carousels
- Touch-friendly min 44px targets (enforced in DESIGN_SYSTEM.md)
- Responsive at 375px minimum viewport
- `AppLoader` splash screen before React renders
- `lazy()` route splitting (one JS chunk per page)

### Still Needed for Mobile App Build

#### Phase 0 — Web PWA (ship first, zero app store friction)
- [ ] `index.html` — add `<meta name="theme-color">`, `<link rel="manifest">`
- [ ] Service Worker for offline caching of shell (via `vite-plugin-pwa`)
- [ ] Add-to-homescreen prompt on mobile Safari/Chrome
- [ ] Splash screen image set (192px, 512px icons)

#### Phase 1 — Capacitor Hybrid App
- [ ] `npm install @capacitor/core @capacitor/cli`
- [ ] `npx cap init StudentOS com.studentos.app`
- [ ] `npx cap add ios && npx cap add android`
- [ ] Wire `Capacitor.getPlatform()` into AppShell to switch mobile-native nav
- [ ] Install `@capacitor/push-notifications` → wire to NotificationProvider
- [ ] Install `@capacitor/camera` → wire to post media picker
- [ ] Install `@capacitor/filesystem` → offline draft storage
- [ ] Install `@capacitor/haptics` → gift send, like tap feedback
- [ ] Install `@capacitor/status-bar` → match status bar to dark sidebar

#### Phase 2 — React Native (when warranted)
Full migration plan in ARCHITECTURE_AUDIT.md Phase 4+.

---

## Shared Business Logic Layer (Already Migration-Safe)

All services (`services/`) are framework-agnostic JavaScript. They work identically in:
- React web app
- Capacitor hybrid app
- React Native (with `@base44/sdk` compatible RN version)

**Zero changes needed to any service file when migrating to native.**

The only migration surface is UI layer:
```
services/    ← 100% portable (no DOM APIs)
hooks/       ← 95% portable (replace window.addEventListener with AppState)
providers/   ← 90% portable (RealtimeBus works, replace visibilitychange)
components/  ← 20% portable (DOM-specific → RN View/Text/Image)
pages/       ← 0% portable (React Router → React Navigation)
```

---

## Mobile Performance Budgets

### Target Metrics (Lighthouse Mobile, Good 3G simulation)

| Metric | Target | Measuring |
|---|---|---|
| First Contentful Paint | < 1.5s | `perf.mark('fcp')` via PerformanceObserver |
| Time to Interactive | < 3.0s | Route + first data load |
| Feed initial render | < 2.0s | `journeyTimer.feedLoad/feedLoaded` |
| Route change | < 500ms | `journeyTimer.routeStart/routeComplete` |
| JS bundle (initial) | < 200KB gzipped | Vite bundle analyzer |
| Image LCP | < 2.5s | WebP format, responsive srcSet |

### Performance Rules for Mobile

```
✅ DO:
  - Use next-gen image formats (WebP, AVIF) for all media
  - Lazy-load images below the fold (loading="lazy" on <img>)
  - Use Skeleton components for all content loading (no CLS)
  - Debounce realtime re-renders (max 60fps via requestAnimationFrame)
  - Virtualize long lists (react-window) when post count > 50

❌ DON'T:
  - Animate CSS width/height (use transform instead)
  - Load all feed images eagerly
  - Block TTI with analytics scripts
  - Store large blobs in entity fields (FIELD_SIZE_LIMITS rule)
  - Subscribe to entities from inside lists (RealtimeBus rule)
```

---

## Offline Readiness

### Phase 0 — Graceful Degradation
- event-queue DLQ buffers analytics events when offline (already in place)
- RealtimeBus reconnects on `online` event (already in place)
- Feed shows stale content from react-query cache when offline
- Compose box disabled with "You're offline" message
- Wallet operations blocked with clear offline state

### Phase 1 — Offline Drafts
- Store post drafts in `localStorage` / Capacitor Filesystem
- Resync drafts on reconnect
- Show offline badge in MobileHeader when `navigator.onLine === false`

### Phase 2 — Offline-First
- Service Worker caches: app shell, last 20 feed posts, user profile, own notifications
- Message queue: DMs written offline → sync on reconnect (CRDTs for conflict resolution)

---

## Push Notification Strategy

### Web Push (Phase 0 — PWA)
```
1. Request permission on: first live session notification OR first DM received
   (Never ask on first app open — this destroys opt-in rate)
2. Service Worker handles push events via Notification API
3. Deep link routing: push payload includes { route: '/notifications', entity_id }
4. Silent push budget: max 3 silent pushes/day (iOS limitation)
```

### Native Push (Phase 1 — Capacitor)
```
Capacitor Push Notifications plugin → FCM (Android) + APNs (iOS)
Token stored on UserProfile.push_token field
Backend function: sendPushNotification(token, title, body, data)
Called by: notification.intelligence.js after createNotification()
```

### Push Permission UX Strategy
```
DO NOT ask for push permission:
  - On first app open
  - On signup
  - In an interrupting modal

DO ask when:
  - User receives their first comment/like (contextual: "Get notified when people engage")
  - User follows their first creator (contextual: "Know when they go live")
  - After first message received (contextual: "Never miss a message")

Result: 40-60% opt-in rate (vs 5-15% for cold-ask)
```

---

## App Lifecycle Handling

### React Web
Already handled in `app-bootstrap.js`:
- `pagehide` → flush event-queue, flush logger
- `visibilitychange` → RealtimeBus stale check + reconnect
- `online/offline` → network status events

### Capacitor Native (add when integrating)
```js
// providers/AppLifecycleProvider.jsx — add to AppShell
import { App } from '@capacitor/app';

App.addListener('appStateChange', ({ isActive }) => {
  if (isActive) {
    RealtimeBus.checkStaleConnections();
    eventQueue.track('session', 'app_foregrounded', {});
  } else {
    eventQueue.flush();
    logger.flush();
  }
});

App.addListener('backButton', () => {
  // Android back button → navigate back or minimize (not exit)
  if (window.history.length > 1) window.history.back();
  else App.minimizeApp();
});
```

---

## Media Optimization

### Image Pipeline
```
Upload path:   User selects → compress client-side (< 500KB) → UploadFile → CDN URL stored
Display path:  CDN URL → responsive img srcSet → WebP with JPEG fallback
Thumbnails:    Auto-generated by CDN (CloudFlare Image Resizing or imgix)
```

### Video Pipeline
```
Upload:    User records/selects → validate (< 100MB, < 3min for feed) → UploadFile
Transcode: Mux or Cloudflare Stream (future) — currently raw upload
Playback:  <video> with controls={false} loop muted playsInline (autoplay policy)
Thumbnail: First-frame capture (future Mux thumbnail endpoint)
```

### Live Stream
```
Protocol:  RTMP (creator side) → stream provider (Agora/LiveKit/Mux)
Playback:  HLS (viewer side) — works in <video> on all platforms
Quality:   Adaptive bitrate (ABR) — provider managed
```

---

## App Store Readiness

### iOS App Store Requirements
- [ ] Privacy manifest (`PrivacyInfo.xcprivacy`) — declare APIs: NSUserDefaults, NSFileManager
- [ ] App Tracking Transparency (ATT) prompt — only if using IDFA (skip for MVP)
- [ ] Required reason APIs — declare camera, photo library usage descriptions
- [ ] Age rating: 12+ (due to: mild social content, DMs, financial features)
- [ ] Content Policy: Human Interface Guidelines compliance (no custom keyboards blocking)
- [ ] In-App Purchase (IAP): gift coins MUST go through Apple IAP if on iOS (30% cut)
  - **Critical:** Gift coin purchase on web → OK (Paystack)
  - Gift coin purchase in iOS app → MUST use Apple IAP or App Store rejection
  - **Decision:** Phase 1 iOS app is social/feed only, no coin purchase in-app
- [ ] App Review demo account provided (admin@studentos.demo)
- [ ] Screenshots: iPhone 15 Pro Max + iPhone SE sizes

### Google Play Requirements
- [ ] Target SDK 34+ (required for all new apps)
- [ ] 64-bit architecture (Capacitor handles this)
- [ ] Data safety form: declare data collected (email, usage data, financial info)
- [ ] Policy: financial features require "Payments" declaration
- [ ] Content rating: ESRB questionnaire → Teen rating
- [ ] Play Integrity API: add for production anti-tampering (Phase 2)

### Privacy Policy Requirements (legal, must have)
Clauses required (obtain legal review):
- Data collected: email, device ID, usage, financial transactions
- Third-party services: Paystack, Google Analytics (if used), AI providers
- Data retention: transaction records 7 years (Nigerian FIRS requirement)
- User rights: deletion, data export
- Minors: platform age-gated at 13+ (COPPA equivalent)
- Financial: CBN compliance statement for wallet features