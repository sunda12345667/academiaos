# StudentOS — Mobile Execution Roadmap

**Date:** 2026-05-09  
**Target:** iOS + Android via Capacitor (Phase 1) → React Native (Phase 2)

---

## 1. Mobile Strategy Overview

### Why Capacitor First, Not React Native

StudentOS is built in React + Tailwind. The fastest path to mobile distribution is:

```
Phase 1 (0–3 months): Capacitor wrapper
  - Wrap existing React web app in Capacitor shell
  - Native iOS/Android app = same codebase
  - App Store + Play Store distribution within weeks
  - All business logic, services, hooks reused 100%
  - Limitation: no native components (scroll performance, camera, etc.)

Phase 2 (6–12 months): React Native
  - Migrate UI layer to React Native (NativeWind for Tailwind → RN styles)
  - Services layer (services/*) is framework-agnostic — already reusable
  - Hooks layer is framework-agnostic — already reusable
  - Only components/ and pages/ need reimplementation
  - Incremental: migrate screen by screen
```

### Business Logic Portability (Already Done)

The existing service layer is 100% portable to React Native because:
- No DOM access
- No browser-only APIs (except `window.location` in a few places — flagged below)
- No React component imports
- Pure async functions with Base44 SDK calls

**Files with browser-only code to fix before React Native:**
```
services/growth/viral.service.js:
  window.location.origin → replace with: Platform.select({ web: window.location.origin, native: 'https://studentos.app' })

lib/infra/app-bootstrap.js:
  window.addEventListener → wrap in Platform.OS === 'web' check

lib/infra/performance.monitor.js:
  PerformanceObserver → web only, noop on native

lib/infra/event-queue.js:
  localStorage → replace with AsyncStorage on native
```

---

## 2. Capacitor Implementation Plan

### Phase 1 Setup (2 weeks)
```
Week 1:
  1. npx cap init StudentOS com.studentos.app
  2. npx cap add ios
  3. npx cap add android
  4. Configure app icon (1024×1024) + splash screen
  5. Configure Capacitor config (appId, appName, webDir: 'dist')
  
Week 2:
  6. Add @capacitor/push-notifications (FCM setup)
  7. Add @capacitor/camera (profile photo upload)
  8. Add @capacitor/share (share URLs to WhatsApp, Twitter, etc.)
  9. Add @capacitor/haptics (reaction feedback)
  10. Add @capacitor/status-bar (dark/light mode)
```

### Push Notifications Setup (Critical)

```
iOS:
  1. Apple Developer Account → Certificates → APNs key
  2. Firebase project → iOS app → upload APNs key
  3. FCM server key → store in backend function secrets

Android:
  1. Firebase project → Android app → download google-services.json
  2. Add to android/app/
  3. FCM sender ID → Capacitor config

Backend:
  1. Create backend function: sendPushNotification(userId, title, body, data)
  2. Calls FCM HTTP v1 API
  3. Store FCM token per user (add fcm_token field to UserProfile)
  4. notification.service → triggers push on create if is_pushed=false
```

### Native Share Integration

```javascript
// Replace buildShareUrl clipboard copy with native share sheet:
import { Share } from '@capacitor/share';

export async function nativeShare(url, title, text) {
  if (typeof Share !== 'undefined') {
    await Share.share({ title, text, url });
  } else {
    await navigator.clipboard.writeText(url);
  }
}
```

---

## 3. Mobile Navigation Adaptation

Current web navigation: React Router DOM (sidebar + bottom nav).

**Mobile already correct** — `MobileBottomNav` exists, `MobileHeader` exists, `AppShell` is responsive.

Required changes for Capacitor:
```
1. Back button handling (Android hardware back):
   @capacitor/app → App.addListener('backButton', handler)
   Deep nesting: navigate back, root: minimize app (don't close)

2. Status bar color:
   @capacitor/status-bar → match --sidebar-background in dark mode
   StatusBar.setStyle({ style: Style.Dark }) on dark mode

3. Keyboard handling (iOS):
   @capacitor/keyboard → Keyboard.addListener('keyboardDidShow', adjustScroll)
   Input fields in feed composer must scroll above keyboard

4. Safe area enforcement:
   env(safe-area-inset-*) already in index.css ✅
   pb-safe and pt-safe utilities already defined ✅
```

---

## 4. Offline Readiness

### What Works Offline (Progressive Enhancement)

| Feature | Offline Behavior |
|---|---|
| Feed (cached) | Show cached posts from last session |
| Post creation | Queue locally, sync on reconnect |
| Notifications | Show cached (badge count may be stale) |
| Wallet balance | Show last known balance with stale indicator |
| Messages | Show last loaded conversation, queue outbound |

### Implementation (Phase 1: basic)

```javascript
// service worker (add to vite.config.js via vite-plugin-pwa)
// Cache strategy: NetworkFirst for API, CacheFirst for static assets

// event-queue already has DLQ for offline resilience ✅
// Add "offline indicator" banner in MobileHeader when navigator.onLine = false
```

### Implementation (Phase 2: full offline)

- Post draft saved to IndexedDB (pending sync)
- Feed posts cached in IndexedDB (last 50 posts)
- Sync queue processed in background when online

---

## 5. Mobile Performance Budgets

| Metric | Target | Measurement Tool |
|---|---|---|
| App cold start (web) | < 3s on 4G | Lighthouse |
| First meaningful paint | < 1.5s | Core Web Vitals |
| Feed scroll jank | 0 dropped frames | Chrome DevTools |
| Image load (feed card) | < 500ms | Network panel |
| Route transition | < 200ms | `journey.routeComplete()` |
| Video start time | < 2s | Manual test |
| Offline detection → banner | < 500ms | `app-bootstrap.js` |

### Media Optimization Rules (MVP)

```
Images:
  - Always use WebP format (60% smaller than JPEG)
  - Serve at 2× max display size (no 4K images in feed cards)
  - Feed card: max 800px width
  - Avatar: max 120px
  - Use loading="lazy" on all images below fold

Videos:
  - Max upload: 50MB (enforce in media.service.js)
  - Auto-play: muted only (browser policy + UX)
  - Poster image: required for all videos
  - Compress on upload: target 720p, 2Mbps max bitrate
  - Use Intersection Observer to pause off-screen videos
```

---

## 6. App Lifecycle Handling

```javascript
// Capacitor lifecycle events (wire in app-bootstrap.js for native)
import { App } from '@capacitor/app';

App.addListener('appStateChange', ({ isActive }) => {
  if (isActive) {
    // App foregrounded — reconnect realtime, refresh stale data
    RealtimeBus.checkStaleness();
    eventQueue.track('session', 'app_foregrounded', {});
  } else {
    // App backgrounded — flush analytics, pause non-critical ops
    eventQueue.flush();
    logger.flush();
  }
});

App.addListener('appUrlOpen', ({ url }) => {
  // Deep link handling — /post/:id, /profile/:username, etc.
  const route = parseDeepLink(url);
  if (route) router.navigate(route);
});
```

---

## 7. React Native Migration Readiness (Phase 2 Checklist)

### Already Portable (no changes needed)
- ✅ All services (`services/**`) — pure JS, no DOM
- ✅ All hooks (`hooks/**`) — no DOM
- ✅ All providers (`providers/**`) — React context, no DOM
- ✅ `lib/infra/retry.js` — pure JS
- ✅ `lib/infra/feature-flags.js` — pure JS
- ✅ `lib/infra/logger.js` — minor fix needed (`localStorage` → `AsyncStorage`)
- ✅ `lib/errors/AppError.js` — pure JS
- ✅ `lib/constants/platform.constants.js` — pure JS
- ✅ All entities (JSON schemas)

### Needs Adaptation
- 🔄 `components/**` — migrate to React Native components
- 🔄 `pages/**` — migrate to React Native screens (React Navigation)
- 🔄 `tailwind.config.js` → `nativewind.config.js`
- 🔄 `lib/infra/app-bootstrap.js` — split into web/native bootstrap
- 🔄 `lib/infra/event-queue.js` — replace `localStorage` with `AsyncStorage`
- 🔄 `lib/realtime/RealtimeBus.js` — replace `visibilitychange` with `AppState`

### Migration Strategy (Screen Priority Order)
```
1. Home feed (most-used) — highest ROI
2. Post card + actions  — used on every screen
3. Profile page         — discovery driver
4. Notifications        — retention driver
5. Messaging (DMs)      — engagement driver
6. Groups               — community driver
7. Creator dashboard    — creator retention
8. Wallet               — financial (highest risk, migrate last)
``