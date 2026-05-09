# StudentOS Service Layer

## Architecture Overview

This directory contains the **business logic abstraction layer** — the boundary between UI components and data infrastructure.

### Migration-Aware Design

Every service in this directory is designed to be **infrastructure-agnostic**. 
The UI never calls base44 SDK directly. Instead, it calls services here.

When migrating to NestJS + PostgreSQL:
1. Replace service implementations — NOT the UI
2. Service contracts (function signatures) remain the same
3. UI components require zero changes

### Service Modules

```
services/
├── feed/         # Feed ranking, pagination, personalization
├── user/         # Profile management, follow graph
├── social/       # Posts, comments, interactions  
├── groups/       # Community management
├── messaging/    # Conversations, messages, realtime
├── academic/     # Courses, enrollment, academic identity
├── marketplace/  # Listings, search, orders
├── wallet/       # Balance, transactions, payments
├── notifications/# Notification dispatch, preferences
├── moderation/   # Reports, reviews, actions
├── auth/         # Permission checks, RBAC
└── media/        # Upload, optimization, processing
```

### Naming Conventions

- Service files: `camelCase.service.js`  
- Hook wrappers: `use[ServiceName].js`
- Each service exports a default object with methods

### Example Migration Path

Today (Base44):
```js
import feedService from '@/services/feed/feed.service';
const posts = await feedService.getPersonalizedFeed(userId, options);
```

Post-migration (NestJS API):
```js
// Only feed.service.js changes — API call replaces base44 query
// All components remain unchanged
``