# StudentOS MVP Implementation Roadmap
**Production-Grade Phase 1 Execution Plan**

---

## 1. MVP SCOPE BOUNDARIES

### In Scope (Phase 1)
```
✓ Authentication (sign-up, login, email verification)
✓ User onboarding (profile setup, school selection, interests)
✓ Feed system (post browsing, infinite scroll, real-time updates)
✓ Post creation (text + image upload, publishing)
✓ Media uploads (images, video thumbnails, progress tracking)
✓ Following system (follow/unfollow, follower counts)
✓ Social interactions (likes, comments, shares — basic)
✓ Groups/communities (join, leave, basic chat)
✓ Direct messaging (1-on-1 conversations, message history)
✓ Notifications (in-app delivery, badge counts)
✓ Creator profile (earnings display, tier badges, verification ready)
✓ Wallet basics (balance display, transaction history)
✓ Gifting system (gift catalog, send flow, creator credit)
✓ Moderation system (report, hide, block — ready for admin)
✓ Livestream readiness (scheduler UI, no actual streaming yet)
```

### Out of Scope (Post-MVP)
```
✗ Advanced AI recommendations
✗ Marketplace full feature set
✗ Courses & educational content
✗ Complex analytics dashboards
✗ Advanced fintech (payouts, tax forms)
✗ Ad platform
✗ Enterprise features
✗ API marketplace
✗ Mobile app (v2)
```

### Deferred (Phase 2+)
```
⏳ Video livestreaming (infrastructure only in Phase 1)
⏳ Advanced search/filtering
⏳ User-generated livestream UI
⏳ Advanced gifting animations
⏳ Marketplace selling
⏳ Course creation
⏳ AI moderation (rules-based only in Phase 1)
```

---

## 2. CRITICAL-PATH DEPENDENCY GRAPH

```
Authentication
  ↓
User Entity & Profile
  ↓
Onboarding Flow
  ├─→ Feed System (depends on user auth + posts)
  │   ├─→ Post Creation (depends on media upload)
  │   ├─→ Real-time Feed Updates (depends on feed system)
  │   └─→ Social Interactions (depends on posts + users)
  │
  ├─→ Messaging (depends on user auth + real-time)
  │   └─→ Notifications (depends on messaging + events)
  │
  └─→ Wallet (depends on user auth + transactions)
      └─→ Gifting (depends on wallet + post/session events)
```

**Critical Path Duration:** 6 weeks minimum for MVP (serial dependencies)
**Parallel Opportunities:** Auth + Onboarding, Feed + Messaging (after auth)
**Blocking Items:** Authentication (blocks everything), Media Uploads (blocks posts)

---

## 3. SPRINT-BY-SPRINT EXECUTION PLAN

### SPRINT 1: AUTHENTICATION & USER ENTITY (Week 1)
**Goal:** User registration, login, and core user data structure

#### Sprint Objective
Establish authentication foundation and user profile entity so all downstream features can build on authenticated user context.

#### Backend Implementation
```
Tasks:
1. Entity: User (already built-in)
   - Extend with: school_id, interests[], profile_photo, bio, status

2. Entity: UserProfile
   - Fields: user_id, display_name, avatar_url, bio, school_id, level, 
             verified, tier, trust_score, created_at
   - Indexes: user_id (unique), school_id

3. Backend Functions:
   - registerUser(email, password, full_name) → user_id
   - loginUser(email, password) → auth_token
   - verifyEmail(email, code) → boolean
   - updateProfile(user_id, profile_data) → UserProfile
   - getUser(user_id) → UserProfile

4. Database Migrations:
   - Add school relationship (School entity)
   - Add interests array to UserProfile
   - Create indexes on user_id, school_id

5. Email Integration:
   - Set up Base44 SendEmail for verification
   - Email template: verification code
```

#### Frontend Implementation
```
Components:
1. AuthContext (providers/AuthContext.jsx)
   - State: isAuthenticated, user, loading, error
   - Methods: register(), login(), logout(), updateProfile()

2. Login Page (pages/Auth/Login.jsx)
   - Email + password form
   - Validation (email format, password > 8 chars)
   - Error display
   - "Create account" link

3. Register Page (pages/Auth/Register.jsx)
   - Email, password, full_name form
   - Confirmation email prompt
   - Password strength indicator
   - Terms acceptance checkbox

4. Verify Email Page (pages/Auth/VerifyEmail.jsx)
   - Code input (6 digits)
   - Resend option
   - Countdown timer (3 min)

5. Protected Route HOC (components/ProtectedRoute.jsx)
   - Redirect to login if not authenticated
   - Show loading state while checking auth
```

#### Real-time Implementation
```
None required in this sprint.
(Real-time user status comes later)
```

#### UX Implementation
```
- Dark-mode login form (center, card-based)
- Form validation feedback (inline errors)
- Loading spinner on submit
- Success toast on registration
- Email verification flow (email → verify code → complete)
```

#### Testing Requirements
```
Unit Tests:
✓ Email validation
✓ Password validation
✓ Register function (success/error cases)
✓ Login function (success/error cases)

Integration Tests:
✓ Full registration flow (register → verify email → login)
✓ Login with wrong credentials (error handling)
✓ Profile update (successful)

E2E Tests:
✓ Complete onboarding through verification
```

#### Production Risks
```
Risk: Email delivery failure → user can't verify
Mitigation: Resend option, 30-minute code expiry

Risk: Password reset not implemented
Mitigation: Add forgot-password in Week 1 follow-up

Risk: Session timeout not enforced
Mitigation: Client-side token refresh (auto-refresh on 401)
```

#### Definition of Done
```
✓ User can register with email + password
✓ Verification email sent and verified
✓ User can login with email + password
✓ Auth token persists across page reloads
✓ Protected pages redirect to login if not authenticated
✓ User profile data persists in database
✓ All auth endpoints tested (unit + integration)
✓ No secrets exposed in frontend code
✓ HTTPS enforced (environment-aware)
```

---

### SPRINT 2: ONBOARDING FLOW & PROFILE SETUP (Week 2)
**Goal:** Complete onboarding from sign-up to functional profile

#### Sprint Objective
Guide new users through profile setup, school selection, and interests so they can immediately start using the platform.

#### Backend Implementation
```
Tasks:
1. Entity: School
   - Fields: name, slug, country, city, logo_url, student_count
   - Index: slug (unique)

2. Entity: Interest
   - Fields: name, slug, icon, color
   - Seed data: 50+ interests (education, tech, sports, etc.)

3. Backend Functions:
   - getSchools(query?) → School[]
   - searchSchools(query) → School[]
   - getInterests() → Interest[]
   - completeOnboarding(user_id, school_id, interests[]) → UserProfile
   - uploadProfilePhoto(user_id, file) → avatar_url

4. Seed Data:
   - 500 major schools worldwide
   - 50 interests categories
```

#### Frontend Implementation
```
Pages:
1. Onboarding Flow (pages/Onboarding/index.jsx)
   - Multi-step wizard (4 screens)
   - Progress indicator
   - Save draft locally (localStorage)

2. Step 1: School Selection (pages/Onboarding/SchoolSelect.jsx)
   - Search bar (debounced, 300ms)
   - School list (autocomplete)
   - "Can't find your school?" option
   - Map geolocation (optional, auto-fill country)

3. Step 2: Profile Photo (pages/Onboarding/PhotoUpload.jsx)
   - Camera or upload option
   - Crop/zoom (image-cropper library)
   - Progress bar (upload %)

4. Step 3: Bio & Display Name (pages/Onboarding/BioSetup.jsx)
   - Display name input (min 2, max 30 chars)
   - Bio textarea (max 150 chars)
   - Character counters

5. Step 4: Interests (pages/Onboarding/InterestSelect.jsx)
   - Grid of interest pills
   - Multi-select (choose 3–8)
   - Search interests
   - "Skip" option

6. Complete Screen (pages/Onboarding/Complete.jsx)
   - Success animation (confetti, pulse)
   - "Start exploring" button
   - Redirect to Home feed

Components:
- OnboardingProgress.jsx (progress bar)
- SchoolSelector.jsx (reusable dropdown)
- InterestPill.jsx (toggleable pill button)
- PhotoUploader.jsx (with crop)
```

#### Real-time Implementation
```
Presence Update:
- Mark user as "online" when they complete onboarding
- Real-time school member count update (WebSocket)
```

#### UX Implementation
```
- Step-by-step progression (no back button, forward-only)
- Validation on each step (prevent next if invalid)
- Dark-mode form styling (card-based)
- Character counters (dynamic text display)
- Photo preview before upload
- Success animation on completion (scale + confetti)
- Mobile-optimized (full-width, thumb-friendly)
```

#### Testing Requirements
```
Unit Tests:
✓ School search function (debounce, filtering)
✓ Interest selection validation
✓ Bio/display name validation
✓ Photo upload handler

Integration Tests:
✓ Full onboarding flow (all 4 steps)
✓ Skip optional fields
✓ Photo upload with crop
✓ Profile saved to database

E2E Tests:
✓ Complete onboarding from registration → home feed
✓ Validation prevents proceeding with invalid data
```

#### Production Risks
```
Risk: Large photo uploads cause memory issues
Mitigation: Client-side compression before upload (max 2MB)

Risk: Photo upload timeout on slow networks
Mitigation: Resumable upload (simple retry, not S3)

Risk: User quits onboarding mid-flow
Mitigation: Auto-save to localStorage, resume option

Risk: School selection overwhelms with results
Mitigation: Limit to top 50, add "can't find" option
```

#### Definition of Done
```
✓ New user can complete onboarding in <3 minutes
✓ Profile photo uploaded and stored
✓ School, interests, bio saved to database
✓ User redirected to home feed on completion
✓ Onboarding can be skipped (minimal viable profile)
✓ Photo upload progress visible to user
✓ All form validation working
✓ Mobile form layout tested
```

---

### SPRINT 3: FEED SYSTEM & POST ENTITY (Week 3)
**Goal:** Build feed infrastructure and post creation

#### Sprint Objective
Create foundational feed system so users can see content, and creators can publish posts to the platform.

#### Backend Implementation
```
Tasks:
1. Entity: Post
   - Fields: user_id, title, content, media_urls[], 
             status (draft/published), tags[], school_id,
             view_count, like_count, comment_count, share_count,
             created_at, updated_at
   - Indexes: user_id, school_id, created_at (for sorting)

2. Entity: PostInteraction
   - Fields: user_id, post_id, type (like/comment/share/view),
             created_at
   - Index: user_id + post_id + type (for deduplication)

3. Backend Functions:
   - createPost(user_id, title, content, media_urls) → Post
   - updatePost(post_id, data) → Post
   - deletePost(post_id) → boolean
   - getPost(post_id) → Post + author_profile + comments_count
   - getFeed(user_id, limit=20, offset=0) → Post[]
   - getCreatorPosts(creator_id, limit=20) → Post[]
   - likePost(user_id, post_id) → boolean
   - unlikePost(user_id, post_id) → boolean
   - getPostStats(post_id) → {likes, comments, shares, views}

4. Ranking Function (Basic):
   - getFeedRanked(user_id) → sorted posts
   - Algorithm: recency + engagement (basic first)
   - No AI yet (deterministic for MVP)

5. Media Handling:
   - Upload image to file storage (UploadFile integration)
   - Generate thumbnail (200x200 for feed, 400x400 for full view)
   - Return media_url for storage

6. Transactions:
   - createPost() is atomic (post + user stats update)
   - likePost() is idempotent (no double-counting)
```

#### Frontend Implementation
```
Pages:
1. Home Feed (pages/Home.jsx) — UPDATE existing
   - Replace mock data with real queries
   - useQuery hook for feed data
   - Infinite scroll (IntersectionObserver)
   - Real-time updates via subscription

2. Post Creation Flow (pages/Create.jsx)
   - Text input (title + content)
   - Media upload (image selector)
   - Preview before publish
   - Publish button (creates post)
   - Success toast

3. Post Detail (pages/PostDetail.jsx) [NEW]
   - Full post display
   - Comments section (see Sprint 4)
   - Engagement buttons
   - Author profile card
   - Share modal

Components:
- FeedCard.jsx (UPDATE existing, wire to real data)
- PostCreator.jsx (text + image input, upload)
- MediaUploader.jsx (image select + preview)
- EngagementButtons.jsx (like, comment, share)
- FeedCarousel.jsx (infinite scroll container)
- PostSkeleton.jsx (loading state)

Hooks:
- useFeed(filters?) → {posts, loading, error, loadMore}
- usePost(post_id) → {post, loading, error}
- useCreatePost() → {createPost, loading, error}
- useLikePost(post_id) → {like, unlike, isLiked}
```

#### Real-time Implementation
```
Tasks:
1. Real-time Feed Updates
   - Subscribe to new posts in followed creators
   - subscribe('posts:new', (post) => appendToFeed(post))
   - Animate new posts sliding into view (top of feed)

2. Like Count Updates
   - Subscribe to post interactions
   - Update like count in real-time
   - Animate count change (scale pulse)

3. Presence Indicator
   - Show "User is typing a post" (optional in MVP)
```

#### UX Implementation
```
- Feed cards render with hover state (shadow, scale)
- Post creation button sticky (bottom-right on mobile, top-right desktop)
- Media preview before publish (crop, zoom, remove)
- Like button animation (scale pulse on click)
- Infinite scroll pagination (load more on scroll 80% down)
- Empty feed state (no posts yet)
- Loading skeletons while fetching
- Timestamp display ("2 hours ago", relative format)
```

#### Testing Requirements
```
Unit Tests:
✓ Post creation validation (title/content min length)
✓ Like/unlike idempotency
✓ Feed ranking function

Integration Tests:
✓ Create post → appears in feed
✓ Like post → count updates
✓ Unlike post → count decrements
✓ Delete post → removed from feed

E2E Tests:
✓ User creates post with image → post visible in feed
✓ User likes post → count updates in real-time
✓ Infinite scroll loads more posts
```

#### Production Risks
```
Risk: Feed query N+1 (author profile lookup for each post)
Mitigation: JOIN author profile in single query, or batch load

Risk: Like spam (user clicks rapidly)
Mitigation: Optimistic UI + debounce on backend (idempotent)

Risk: Media upload large files
Mitigation: Client-side compression (max 2MB), server-side validation

Risk: Slow feed queries on large datasets
Mitigation: Pagination (limit 20), create indexes on created_at, user_id
```

#### Definition of Done
```
✓ User can create post with text + image
✓ Post appears in their feed immediately (optimistic)
✓ Posts visible to other users in real-time
✓ Like/unlike works with real-time count update
✓ Infinite scroll loads more posts
✓ Feed loads in <2s (performance target)
✓ Media uploads complete within 10s (target)
✓ All post operations tested (unit + integration)
✓ Real-time feed updates working (WebSocket)
```

---

### SPRINT 4: SOCIAL INTERACTIONS & COMMENTS (Week 4)
**Goal:** Enable comments, shares, and basic engagement

#### Sprint Objective
Allow users to comment on posts and share content, building engagement loops and social signals for ranking.

#### Backend Implementation
```
Tasks:
1. Entity: Comment
   - Fields: user_id, post_id, parent_comment_id (for threads),
             content, created_at, updated_at, like_count
   - Indexes: post_id, user_id, created_at

2. Entity: Share
   - Fields: user_id, post_id, created_at, channel (feed/dm/external)
   - Index: post_id, user_id

3. Backend Functions:
   - addComment(user_id, post_id, content) → Comment
   - deleteComment(comment_id) → boolean
   - getComments(post_id, limit=20) → Comment[]
   - replyToComment(user_id, parent_comment_id, content) → Comment
   - sharePost(user_id, post_id, channel) → Share
   - getShares(post_id) → Share[]
   - likeComment(user_id, comment_id) → boolean

4. Notifications:
   - Trigger notification when comment added to user's post
   - Trigger when reply added to user's comment
   - Trigger on post like (batch: only notify at 5+ likes)

5. Real-time:
   - Broadcast new comment to all viewers of post
   - Update post comment_count in real-time
```

#### Frontend Implementation
```
Components:
1. CommentsSection.jsx
   - List of comments (with replies nested)
   - Comment count header
   - "Load more" button for pagination

2. CommentItem.jsx
   - Author avatar + name
   - Timestamp
   - Content text
   - Like count + button
   - Reply button
   - Delete (if own comment)

3. CommentInput.jsx
   - Text input (max 300 chars)
   - Character counter
   - Submit button (disabled if empty)
   - @ mention support (optional in MVP)

4. ReplyThread.jsx
   - Show parent comment context
   - List of replies
   - Reply input

5. ShareModal.jsx
   - Share options: "Copy link", "Share to groups", "Direct message"
   - Copy link button (copy to clipboard)

Pages:
- PostDetail.jsx (UPDATE to show comments)

Hooks:
- useComments(post_id) → {comments, loading, error, add, delete}
- useShare(post_id) → {share, loading, error}
```

#### Real-time Implementation
```
Tasks:
1. Real-time Comment Delivery
   - New comment broadcasts to all post viewers
   - Subscribe to 'post:{id}:comments' channel
   - Animate new comment sliding in

2. Comment Like Count Update
   - Like count updates in real-time
   - Similar to post like animation

3. Reply Notifications
   - Notify user when someone replies to their comment
```

#### UX Implementation
```
- Comments section collapses by default (show count only)
- Click "Show comments" to expand
- Comment input sticky at bottom of section
- Reply button shows reply-to-parent quote
- Delete button only visible on own comments (hover state)
- Like button on comments (scale animation)
- Timestamp relative ("2 min ago")
- Loading skeleton for comments while fetching
```

#### Testing Requirements
```
Unit Tests:
✓ Comment validation (min length 1, max 300)
✓ Reply threading logic
✓ Comment like idempotency

Integration Tests:
✓ Add comment → appears in post
✓ Reply to comment → nested correctly
✓ Like comment → count updates
✓ Delete comment → removed

E2E Tests:
✓ User comments on post → comment visible to others in real-time
✓ User replies to comment → reply threaded correctly
✓ Share post → link copied to clipboard
```

#### Production Risks
```
Risk: Comment spam (rapid-fire comments)
Mitigation: Rate limit (1 comment per 5s per user per post)

Risk: Deeply nested reply threads (performance)
Mitigation: Limit nesting to 2 levels (reply to top-level only)

Risk: Missing @ mention notifications
Mitigation: Skip @ mentions for MVP, add in Phase 2

Risk: Real-time comment delivery fails
Mitigation: Fallback to polling (refresh on focus)
```

#### Definition of Done
```
✓ User can add comment to post
✓ Comments appear in real-time for all viewers
✓ User can reply to comment (1 level)
✓ User can delete own comment
✓ Like count updates on comments in real-time
✓ Share post functionality working (copy link)
✓ Comment count updates correctly
✓ Comment section loads in <1s
✓ All interactions tested (unit + integration)
```

---

### SPRINT 5: MESSAGING & NOTIFICATIONS (Week 5)
**Goal:** Direct messaging and in-app notification system

#### Sprint Objective
Enable user-to-user communication and real-time notifications so users stay engaged and informed.

#### Backend Implementation
```
Tasks:
1. Entity: Conversation
   - Fields: participants[] (2 for 1-on-1), 
             last_message_at, created_at
   - Index: participants (compound)

2. Entity: Message
   - Fields: conversation_id, sender_id, content, 
             read_at, created_at, media_urls[]
   - Index: conversation_id, created_at

3. Entity: Notification
   - Fields: recipient_id, type (comment/like/follow/message),
             actor_id, entity_type, entity_id, read, created_at
   - Index: recipient_id, read, created_at

4. Backend Functions:
   - getOrCreateConversation(user1_id, user2_id) → Conversation
   - sendMessage(sender_id, conversation_id, content) → Message
   - getMessages(conversation_id, limit=50, offset=0) → Message[]
   - markAsRead(conversation_id, user_id) → boolean
   - getConversations(user_id) → Conversation[]
   - createNotification(recipient_id, type, actor_id, entity_id) → Notification
   - getNotifications(user_id, limit=20) → Notification[]
   - markNotificationAsRead(notification_id) → boolean

5. Real-time:
   - Broadcast new message to conversation
   - Broadcast notification to recipient
   - Typing indicator (optional)

6. Background Jobs:
   - Deliver notifications (in-app, no email yet)
   - Cleanup old read messages (30-day retention)
```

#### Frontend Implementation
```
Pages:
1. Messaging Hub (pages/Groups.jsx) — UPDATE existing
   - Conversation list (sidebar)
   - Current conversation thread
   - Message input

2. Message Detail Thread (existing structure)
   - Message bubbles (sent/received)
   - Timestamp
   - Read indicator (checkmark)

3. Notification Center (pages/Notifications.jsx) — NEW
   - List of notifications
   - Filter by type (likes, comments, follows, messages)
   - Mark as read (individual or bulk)
   - Delete option

Components:
1. ConversationList.jsx
   - List of conversations (avatar + name + last message)
   - Unread badge (red dot)
   - Search conversations

2. MessageBubble.jsx (UPDATE existing)
   - Display sent/received message
   - Show avatar + name (received only)
   - Timestamp
   - Read indicator

3. MessageInput.jsx
   - Text input for message
   - Send button
   - Media upload option

4. NotificationItem.jsx
   - Icon (by type)
   - Actor name + action
   - Timestamp
   - Mark as read (checkbox)

5. NotificationCenter.jsx (modal/sidebar)
   - Notification list
   - Filter tabs
   - Badge count

Hooks:
- useConversations() → {conversations, loading, error}
- useMessages(conversation_id) → {messages, loading, error, send}
- useNotifications() → {notifications, loading, unread_count}
```

#### Real-time Implementation
```
Tasks:
1. Real-time Message Delivery
   - Subscribe to conversation channel
   - New message broadcast immediately
   - Animate message sliding in

2. Real-time Notification Delivery
   - Subscribe to user notifications channel
   - Badge count updates immediately
   - Toast notification appears (top-right)

3. Typing Indicator (Optional for MVP)
   - User sees "X is typing..." in conversation
   - 3-dot animation
   - Clears when message sent or timeout (3s)

4. Online Presence
   - Show "Online" status in conversation list
   - Update when user last active
```

#### UX Implementation
```
- Message bubbles: sent (right, blue), received (left, gray)
- Timestamp on hover (or always visible)
- Read indicator: single checkmark (delivered), double (read)
- Unread conversation badge (red dot)
- Notification toast slides in (top-right)
- Notification center shows 20 most recent
- Mark as read button on each notification
- Dark-mode message styling (blue for sent, card for received)
```

#### Testing Requirements
```
Unit Tests:
✓ Conversation lookup (create if not exists)
✓ Message validation
✓ Notification creation
✓ Read status tracking

Integration Tests:
✓ Send message → appears for both users
✓ Message marked as read → checkmark updates
✓ Notification created on post interaction
✓ Conversation list updated

E2E Tests:
✓ User sends message → recipient sees in real-time
✓ User receives notification → badge updates
✓ Mark notification as read → disappears from unread
✓ Conversation history loads correctly
```

#### Production Risks
```
Risk: Message delivery fails (real-time down)
Mitigation: Fallback to polling on next open

Risk: Notification spam (too many notifications)
Mitigation: Batch notifications (only notify for major events)

Risk: Message ordering issues
Mitigation: Use created_at timestamp for ordering, handle clock skew

Risk: Read receipts not synced
Mitigation: Batch update read status (not per-message)
```

#### Definition of Done
```
✓ User can send direct messages
✓ Messages appear in real-time for recipient
✓ Message history persists and loads
✓ Conversations list shows all active conversations
✓ Unread badge appears on conversations
✓ Notifications appear for likes, comments, follows
✓ Mark notification as read working
✓ Real-time notification delivery <500ms
✓ Message load time <1s per conversation
```

---

### SPRINT 6: MEDIA UPLOADS & OPTIMIZATION (Week 6)
**Goal:** Robust media handling and performance optimization

#### Sprint Objective
Ensure media uploads are stable, fast, and user-friendly; optimize feed performance for scale.

#### Backend Implementation
```
Tasks:
1. Media Upload Pipeline:
   - Server-side validation (file type, size, dimensions)
   - Compression (images: WebP 70%, videos: H.264 1080p)
   - Thumbnail generation (3 sizes: 200px, 400px, 800px)
   - Virus scanning (optional, use external API if needed)
   - Storage in file service (UploadFile integration)

2. Image Processing:
   - Accept: JPEG, PNG, WebP, GIF
   - Max: 10MB
   - Compress to WebP 70% quality
   - Generate thumbnails
   - Return all 3 URLs

3. Video Processing (Minimal for MVP):
   - Accept: MP4, WebM
   - Max: 100MB
   - Extract first frame as thumbnail
   - Store thumbnail + original
   - No transcoding yet (Phase 2)

4. Backend Functions:
   - uploadMedia(user_id, file, type) → {url, thumbnail_url, meta}
   - generateThumbnail(image_url, size) → thumbnail_url
   - deleteMedia(media_url) → boolean
   - getMediaMeta(media_url) → {width, height, size, type}

5. CDN Integration (Optional):
   - Serve images from CDN (Base44 file storage)
   - Cache-Control headers (1 year for immutable)
   - Lazy-load images (IntersectionObserver)

6. Feed Performance:
   - Pagination optimization (20 posts per page)
   - Image lazy-loading (intersection observer)
   - Skeleton loading (while images load)
   - Database indexes on created_at, user_id
```

#### Frontend Implementation
```
Components:
1. ImageUploader.jsx (UPDATE)
   - File input
   - Preview with crop
   - Progress bar (% uploaded)
   - Drag-and-drop support
   - Error display

2. Crop Tool (react-image-crop or custom)
   - Adjust crop area
   - Preview cropped result
   - Apply/cancel buttons

3. LazyImage.jsx (NEW)
   - Use IntersectionObserver
   - Show placeholder until loaded
   - Fade-in animation
   - Fallback on error

4. FeedCardMedia.jsx (UPDATE)
   - Render media (image/video thumbnail)
   - Lazy load images
   - Aspect ratio maintained
   - Click to expand

Hooks:
- useImageUpload() → {upload, progress, error, reset}
- useMediaMeta(url) → {width, height, size}
```

#### Real-time Implementation
```
Tasks:
1. Upload Progress
   - Track upload progress (bytes sent / total bytes)
   - Show progress bar in UI
   - Real-time XHR events

2. Media Optimism
   - Show uploaded image immediately (local preview)
   - Update with CDN URL when available
   - Fallback gracefully if upload fails
```

#### UX Implementation
```
- Upload progress bar (with % indicator)
- Image crop interface (pinch-zoom on mobile)
- Drag-and-drop zone (accept images)
- Multiple image upload (up to 4 images per post)
- Image carousel in feed (swipe to next)
- Video thumbnail shows play icon overlay
- Lazy-load images as they enter viewport
- Broken image fallback (gray placeholder)
```

#### Testing Requirements
```
Unit Tests:
✓ File validation (type, size)
✓ Image compression
✓ Thumbnail generation

Integration Tests:
✓ Upload image → stored and URL returned
✓ Lazy-load image → loads on intersection
✓ Upload progress tracked correctly
✓ Concurrent uploads handled

E2E Tests:
✓ User uploads image to post → preview shown
✓ Image appears in feed → loads lazily
✓ Video thumbnail extracted correctly
✓ Upload fails gracefully (retry option)
```

#### Production Risks
```
Risk: Large video uploads block user (no chunking)
Mitigation: Implement chunked upload (Phase 2) or show "Large file" warning

Risk: Image compression fails (invalid JPEG)
Mitigation: Fallback to original, only serve if valid

Risk: Thumbnail generation timeout
Mitigation: Async job (generate later if slow), use fast lib

Risk: Lazy-load images delay feed render
Mitigation: Use requestIdleCallback, load in background

Risk: CDN serving stale images
Mitigation: Cache-busting with version hash
```

#### Definition of Done
```
✓ User can upload images to posts (multi-image)
✓ Images compressed and stored
✓ Thumbnails generated for all sizes
✓ Upload progress visible (%)
✓ Crop tool works (pinch-zoom mobile)
✓ Images lazy-loaded in feed
✓ Feed renders <2s without images
✓ Upload succeeds for all image types (JPEG, PNG, WebP, GIF)
✓ Upload fails gracefully with error message
```

---

### SPRINT 7: GROUPS/COMMUNITIES & FOLLOWING (Week 7)
**Goal:** Community participation and social graph

#### Sprint Objective
Enable users to join groups, follow creators, and build social networks for peer engagement.

#### Backend Implementation
```
Tasks:
1. Entity: Group (already designed)
   - Fields: name, slug, description, cover_url, owner_id,
             member_count, type (study_group/department/club),
             privacy (public/private), created_at
   - Index: slug, owner_id, type

2. Entity: GroupMembership (already designed)
   - Fields: group_id, user_id, role (owner/admin/member),
             status (active/pending/banned), joined_at
   - Index: group_id, user_id

3. Entity: Follow
   - Fields: follower_id, followee_id, created_at
   - Index: follower_id, followee_id (compound unique)

4. Backend Functions:
   - getGroup(group_id) → Group + member_count
   - joinGroup(user_id, group_id) → GroupMembership
   - leaveGroup(user_id, group_id) → boolean
   - getGroupMembers(group_id) → User[]
   - getUserGroups(user_id) → Group[]
   - createGroup(user_id, group_data) → Group
   - followUser(follower_id, followee_id) → Follow
   - unfollowUser(follower_id, followee_id) → boolean
   - getFollowees(user_id) → User[]
   - getFollowers(user_id) → User[]
   - isFollowing(user_id, target_user_id) → boolean

5. Real-time:
   - Broadcast new member joined group
   - Broadcast follower count update
```

#### Frontend Implementation
```
Pages:
1. Groups Hub (pages/Groups.jsx) — UPDATE existing
   - Group list (cards with join buttons)
   - Recommended groups
   - My groups (sidebar)

2. Group Detail Page (pages/GroupDetail.jsx) — NEW
   - Group header (cover + name + description)
   - Member list
   - Group posts feed
   - Join/Leave button

3. Creator Discovery (pages/Discover.jsx) — NEW
   - Suggested creators to follow
   - Filter by school, interest
   - Follow button on each card

Components:
1. GroupCard.jsx
   - Cover image
   - Group name + member count
   - Description (1 line)
   - Join button (or "Joined" badge)

2. FollowButton.jsx
   - Toggle button: "Follow" / "Following"
   - Animation on toggle (scale)

3. GroupMemberList.jsx
   - Avatar grid
   - Show 6, "+N more" link

4. SuggestedCreators.jsx
   - Creator cards (avatar, name, follower count)
   - "Follow" buttons
   - Reason for suggestion (optional)

Hooks:
- useGroups() → {groups, loading}
- useGroup(group_id) → {group, loading, join, leave}
- useFollow(target_user_id) → {isFollowing, follow, unfollow}
```

#### Real-time Implementation
```
Tasks:
1. Member Count Update
   - Real-time member_count on group card
   - Update when user joins/leaves

2. Follower Count Update
   - Real-time follower count on profile
   - Animate count change
```

#### UX Implementation
```
- Follow button toggles color (muted → primary)
- Join/Leave button shows confirmation (optional modal)
- Group cards show member avatars
- Suggested groups section on Home feed
- Following list accessible from profile
- Member count displayed on group card
- Member grid shows avatars with hover info (name)
```

#### Testing Requirements
```
Unit Tests:
✓ Follow/unfollow idempotency
✓ Group join/leave operations

Integration Tests:
✓ Join group → user appears in member list
✓ Leave group → user removed from list
✓ Follow user → count updates
✓ Unfollow user → count updates

E2E Tests:
✓ User joins group → sees group posts
✓ User follows creator → sees their posts in feed
✓ Group member count updates in real-time
```

#### Production Risks
```
Risk: N+1 query for group member avatars
Mitigation: Batch load avatars, cache in Redis

Risk: Follow cycles (A follows B, B follows A spam)
Mitigation: No prevention needed for MVP

Risk: Group spam/abuse
Mitigation: Admin moderation, report feature (Phase 2)

Risk: Large group member list (10k+)
Mitigation: Paginate member list, show top 100
```

#### Definition of Done
```
✓ User can join groups
✓ User can leave groups
✓ Group member list visible
✓ User can follow other creators
✓ Follower count displayed and updates in real-time
✓ Suggested groups/creators shown
✓ User can unfollow
✓ Real-time member count update
```

---

### SPRINT 8: GIFTING SYSTEM & WALLET (Week 8)
**Goal:** Creator monetization foundation

#### Sprint Objective
Enable users to send gifts to creators, establishing the monetization loop and creator earnings visibility.

#### Backend Implementation
```
Tasks:
1. Entity: GiftCatalogItem (already designed)
   - Seed data: 10–15 gifts (emoji + names + prices)

2. Entity: Gift (already designed)
   - Fields: sender_id, recipient_id, gift_item_id,
             naira_value, creator_credit, session_id (optional),
             created_at

3. Entity: Wallet (already designed)
   - Fields: user_id, balance_available, balance_locked,
             total_earnings, updated_at

4. Entity: Transaction (already designed)
   - Fields: type (gift_received, deposit, withdrawal),
             amount, user_id, created_at, status

5. Backend Functions:
   - getGiftCatalog() → GiftCatalogItem[]
   - sendGift(sender_id, recipient_id, gift_item_id, 
              session_id?) → Gift
   - getWallet(user_id) → Wallet
   - getTransactions(user_id) → Transaction[]
   - creditCreator(creator_id, amount) → Wallet
   - calculateCreatorEarnings(creator_id, period) → amount

6. Transactions (Atomic):
   - sendGift() atomically:
     ├─ Deduct from sender wallet (if applicable)
     ├─ Credit creator wallet
     ├─ Create Gift record
     ├─ Create Transaction record
     └─ Update Wallet balance

7. Real-time:
   - Broadcast gift sent (animation trigger)
   - Update creator earnings immediately
```

#### Frontend Implementation
```
Pages:
1. Wallet Page (pages/Wallet.jsx) — UPDATE existing
   - Balance display (large, prominent)
   - Balance breakdown (available, locked)
   - Recent transactions list
   - Withdraw button (ready for Phase 2)

2. Gift Modal (pages/Home.jsx > GiftModal.jsx)
   - Gift catalog grid (emoji, name, price)
   - Gift selection
   - Send button
   - Confirmation toast

Components:
1. GiftCatalog.jsx
   - Grid of gift items
   - Each: emoji + name + price
   - Hover: scale 1.05, shadow
   - Selected: border + glow

2. WalletCard.jsx
   - Balance display (h2 size, --success color)
   - Available / Locked / Total
   - Deposit button (Phase 2)

3. TransactionList.jsx
   - List of transactions
   - Icon by type
   - Amount + timestamp
   - Expandable detail

4. GiftSentAnimation.jsx
   - Gift emoji flies from button to creator avatar
   - Confetti burst on arrival
   - Creator earnings update animation

Hooks:
- useWallet(user_id) → {wallet, loading}
- useGiftCatalog() → {gifts, loading}
- useSendGift() → {send, loading, error}
- useTransactions(user_id) → {transactions, loading}
```

#### Real-time Implementation
```
Tasks:
1. Gift Received Animation
   - Animate gift emoji flying to avatar
   - Trigger confetti (3–4 colors)
   - Update earnings display

2. Earnings Update
   - Creator balance updates in real-time
   - Animate count increment (scale pulse)
   - Toast notification: "Gift received!"

3. Wallet Sync
   - Wallet balance syncs across tabs/devices
```

#### UX Implementation
```
- Gift selection modal opens on gift button click
- Gifts displayed as emoji + name + price
- Selected gift highlighted (border + glow)
- Send button confirms selection
- Gift flies from sender to recipient (curved path)
- Confetti bursts on arrival (colorful, celebratory)
- Earnings update with animation (number increments)
- Toast notification: "You sent a gift!"
- Creator sees "You received a gift" notification
- Wallet balance shows earned amount (--success color)
```

#### Testing Requirements
```
Unit Tests:
✓ Gift send validation (creator exists, gift valid)
✓ Wallet balance calculation
✓ Transaction atomicity

Integration Tests:
✓ Send gift → creator wallet updated
✓ Send gift → transaction created
✓ Wallet balance persists
✓ Transaction history loads

E2E Tests:
✓ User sends gift → animation plays
✓ Creator earnings updated in real-time
✓ Gift appears in transaction history
✓ Wallet balance accurate after multiple gifts
```

#### Production Risks
```
Risk: Wallet balance mismatch (concurrent gift sends)
Mitigation: Pessimistic locking (row-level lock on wallet)

Risk: Gift send without balance (if integrated with top-up)
Mitigation: Check balance before send (pre-validation)

Risk: Failed gift transaction leaves inconsistent state
Mitigation: Rollback atomically, retry logic

Risk: Earnings calculation incorrect for multiple gifts
Mitigation: Sum transactions (immutable ledger)
```

#### Definition of Done
```
✓ User can send gift to creator
✓ Gift catalog displays correctly
✓ Creator wallet credited immediately
✓ Gift animation plays (emoji flies, confetti)
✓ Creator earnings displayed on profile
✓ Transaction history persists
✓ Wallet balance accurate
✓ Real-time earnings update
✓ No double-gifting (idempotent)
```

---

## 4. CRITICAL PATH TIMELINE

```
Week 1:  Auth + User Entity           [BLOCKER]
         ↓
Week 2:  Onboarding + Profile Setup   [BLOCKER]
         ↓
Week 3:  Feed System + Posts          [BLOCKER]
         ├─→ Week 4: Comments + Engagement (parallel start possible)
         ├─→ Week 5: Messaging + Notifications (parallel start possible)
         └─→ Week 6: Media Uploads + Optimization (parallel start possible)
         
Week 7:  Groups + Following           (sequential after feed)
         ↓
Week 8:  Gifting + Wallet             (sequential after wallet entity)

Total MVP Timeline: 8 weeks (sequential critical path)
Parallel Opportunities: Weeks 3–6 can run in parallel (after auth)
```

---

## 5. DEPENDENCY GRAPH

```
Auth
├─→ Onboarding (requires User)
    ├─→ Feed (requires User + Post entity)
    │   ├─→ Comments (requires Post)
    │   ├─→ Media Uploads (requires file upload)
    │   ├─→ Groups (independent after User)
    │   └─→ Following (requires User)
    ├─→ Messaging (requires User + Conversation entity)
    ├─→ Notifications (requires User + events)
    └─→ Wallet (requires User)
        └─→ Gifting (requires Wallet + Gift entity)
```

**Parallel Opportunities:**
- Feed + Messaging can run in parallel (after Week 2)
- Comments + Messaging can run in parallel (after Week 3)
- Media Uploads + Groups can run in parallel (after Week 3)

**Blocking Issues:**
- Authentication blocks everything (must complete)
- Onboarding blocks feed visibility (must complete)
- Post entity blocks comments, messaging features
- Media upload needed for posts with images

---

## 6. MVP DEFINITION OF DONE

```
✓ New users can sign up → verify email → onboard
✓ Users have profile with photo + bio + interests
✓ Users can create posts (text + images)
✓ Posts appear in feed in real-time
✓ Users can like, comment, share posts
✓ Users can follow other creators
✓ Users can see followed creators' posts in feed
✓ Users can join groups and see group content
✓ Users can message other users directly
✓ Users receive in-app notifications
✓ Creators can see wallet balance
✓ Users can send gifts to creators
✓ Creator earnings display correctly
✓ All core features work on mobile (responsive)
✓ Critical path features load in <2s (performance)
✓ Real-time features working (feed, notifications, gifts)
```

---

## 7. PRODUCTION READINESS CHECKLIST

### Performance Targets (MVP)
```
Feed Load:              <2s (first 20 posts)
Post Creation:          <1s (upload + publish)
Media Upload (10MB):    <10s
Comment Load:           <1s
Message Load:           <1s
Real-time Latency:      <500ms (feed, notifications, gifts)
Mobile Load:            <3s (on 3G)
```

### Stability Targets (MVP)
```
Uptime:                 99%
Error Rate:             <0.1%
Auth Success Rate:      99.9%
Upload Success Rate:    99%
Real-time Delivery:     99%
```

### Security Checklist
```
✓ HTTPS enforced
✓ Auth tokens validated
✓ SQL injection protected (parameterized queries)
✓ XSS protected (sanitized input)
✓ CSRF tokens (if forms)
✓ Rate limiting on auth endpoints
✓ File upload validation (type, size)
✓ User data privacy (no PII logs)
```

### Accessibility Checklist
```
✓ Dark mode functional
✓ Mobile responsive (320px+)
✓ Touch targets 44px+ minimum
✓ Keyboard navigation working
✓ Color contrast WCAG AA
✓ Focus indicators visible
```

---

## 8. SPRINT RESOURCE ALLOCATION

```
Team Composition (Estimated):
├─ Backend Engineers: 2 (entities, functions, real-time)
├─ Frontend Engineers: 2 (pages, components, UX)
├─ Full-stack: 1 (integrations, auth, media)
├─ Product Manager: 1 (prioritization, scope)
└─ QA/Automation: 1 (testing, performance)

Total: 7 people, 8 weeks = ~560 engineer-hours

Per Sprint:
├─ Development: ~80 hours
├─ Testing: ~20 hours
├─ Deployment/Stabilization: ~10 hours
└─ Contingency (25%): ~30 hours
Total per sprint: 140 hours (17.5 per engineer)
```

---

## 9. RISK & MITIGATION STRATEGY

### High-Risk Items
```
1. Real-time System Reliability
   Risk:  WebSocket failures, message loss
   Impact: Critical (blocks notifications, messaging)
   Mitigation: Fallback to polling, queued delivery, observability

2. Media Upload Stability
   Risk:  Upload failures, corrupted files
   Impact: Critical (blocks post creation)
   Mitigation: Client-side validation, server-side scanning, retry

3. Database Performance at Scale
   Risk:  Slow queries on large datasets
   Impact: Critical (feed load times)
   Mitigation: Indexes, pagination, denormalization (if needed)

4. Auth Token Expiry
   Risk:  Users logged out unexpectedly
   Impact: High (UX friction)
   Mitigation: Auto-refresh tokens, silent refresh on 401

5. Email Delivery (verification)
   Risk:  Users can't verify email
   Impact: High (blocks onboarding)
   Mitigation: Resend option, long expiry codes (1 hour)
```

### Medium-Risk Items
```
1. Comment/Message Moderation
   Risk:  Spam, abuse in early user base
   Impact: Medium (user trust)
   Mitigation: Basic filtering, report feature, admin review

2. Gift Atomicity
   Risk:  Failed gift leaves balance inconsistent
   Impact: Medium (financial)
   Mitigation: Atomic transactions, retry logic, reconciliation job

3. Real-time Feed Ordering
   Risk:  Out-of-order posts (clock skew)
   Impact: Medium (UX confusion)
   Mitigation: Server-side timestamps, idempotency keys

4. Group Spam Creation
   Risk:  Malicious groups created
   Impact: Medium (discovery pollution)
   Mitigation: Group creation limits, admin moderation
```

### Mitigation Strategy
```
Monitoring: Implement observability (logs, metrics, alerts) early
Runbooks: Create incident response procedures
Redundancy: Database backups, session failover
Testing: Comprehensive integration tests before launch
Gradual Rollout: Beta test with small user group (Week 9)
Support: On-call rotation for first 2 weeks post-launch
```

---

## 10. POST-MVP EXPANSION STRATEGY

### Phase 2 (Weeks 9–16, immediate post-MVP)
```
High Priority:
✓ Video livestreaming (Agora/LiveKit integration)
✓ Advanced search (full-text + filters)
✓ Creator dashboard (analytics, earnings breakdown)
✓ Payment integration (withdraw earnings)
✓ Admin moderation dashboard
✓ Scheduled posts

Medium Priority:
✓ Course creation (for educators)
✓ Marketplace selling (physical goods)
✓ Advanced AI recommendations
✓ Content translation (i18n)
✓ Push notifications (Firebase Cloud Messaging)
```

### Phase 3 (Weeks 17–24, scale & engagement)
```
✓ Trending algorithms
✓ Ad platform
✓ Creator partnerships program
✓ Campus ambassador program
✓ Brand integrations
✓ International expansion (localization)
```

---

## 11. LAUNCH READINESS MILESTONES

```
Week 1:  Auth + Onboarding DONE
Week 2:  Feed + Posts DONE, User testing begins
Week 3:  Comments + Engagement DONE, UX refinement
Week 4:  Messaging + Notifications DONE, performance optimization
Week 5:  Media + Groups DONE, security audit
Week 6:  Gifting + Wallet DONE, stability testing
Week 7:  QA + Stabilization, bug fixing, performance tuning
Week 8:  Beta launch (1000 users), gather feedback
Week 9:  Final refinements, production launch readiness
```

---

## 12. LAUNCH WEEK CHECKLIST

```
3 Days Before:
✓ Database backup verified
✓ Monitoring alerts configured
✓ On-call rotation scheduled
✓ Support team trained
✓ Runbooks reviewed

1 Day Before:
✓ Final security audit completed
✓ Load testing passed (1000 concurrent users)
✓ Rollback plan documented
✓ Communication templates ready

Launch Day:
✓ Gradual rollout (10% → 50% → 100% traffic)
✓ Real-time monitoring active
✓ Support team on standby
✓ Metrics dashboard live
✓ User feedback channels active

Post-Launch (Week 1):
✓ Daily bug triage (critical fixes only)
✓ Performance monitoring
✓ User feedback analysis
✓ Stability assessment
```

---

**This roadmap transforms architectural designs into executable sprints. Success requires disciplined scope management, real-time coordination, and relentless focus on stabilization before expansion.**