# Notifications Page - Implementation Plan

## Feature Overview

Add a Notifications page to divine-web that shows users their social interactions: likes, comments, follows, reposts, and zaps. This mirrors the existing mobile implementation (Flutter/Riverpod) but adapted for React/TanStack Query.

The Funnelcake relay already has a notifications REST API at `GET /api/users/{pubkey}/notifications` with NIP-98 authentication, cursor-based pagination, server-side read state tracking, and type filtering. The mobile app already consumes this API successfully.

### Notification Types

| Type | Nostr Kind | Relay `notification_type` | Display Message |
|------|-----------|--------------------------|-----------------|
| Like/Reaction | 7 | `reaction` | "{name} liked your video" |
| Comment | 1111 (NIP-22) | `reply` | "{name} commented on your video" |
| Follow | 3 | `follow` | "{name} started following you" |
| Repost | 16 | `repost` | "{name} reposted your video" |
| Zap | 9735 | `zap` | "{name} zapped your video" |

---

## Data Fetching Strategy

### Primary: Funnelcake REST API (NIP-98 authenticated)

The relay provides server-side filtered notifications with all the features we need:

**Endpoint**: `GET /api/users/{pubkey}/notifications`

**Query Parameters**:
- `limit` (int, default 50) - page size
- `before` (string) - cursor for pagination
- `types` (comma-separated) - filter by type: `reaction,reply,repost,follow,zap`
- `unread_only` (bool) - only unread notifications

**Response**:
```json
{
  "notifications": [
    {
      "id": "unique-notification-id",
      "source_pubkey": "hex-pubkey-of-actor",
      "source_event_id": "hex-event-id",
      "source_kind": 7,
      "referenced_event_id": "hex-video-event-id",
      "notification_type": "reaction",
      "created_at": 1700000000,
      "read": false,
      "content": "+"
    }
  ],
  "unread_count": 5,
  "next_cursor": "cursor-string",
  "has_more": true
}
```

**Mark as Read**: `POST /api/users/{pubkey}/notifications/read`
- Body: `{ "notification_ids": ["id1", "id2"] }` (specific) or `{}` (mark all)
- Requires NIP-98 auth

### Authentication: NIP-98 HTTP Auth

The notifications API requires NIP-98 authentication (a signed Nostr event as a bearer token). The web app already has signing capability via `useCurrentUser()` which provides `user.signer.signEvent()`.

We need to create a NIP-98 auth utility that:
1. Creates a kind 27235 event with the URL, method, and optional payload hash
2. Signs it with the user's signer
3. Base64-encodes it for the `Authorization: Nostr <base64>` header

### Fallback: WebSocket (not needed initially)

The mobile app has a real-time WebSocket bridge for instant notifications, but for the web MVP we can rely on polling the REST API on a timer (every 2-5 minutes) and on page focus. The WebSocket real-time bridge can be added as a follow-up enhancement.

---

## Implementation Architecture

### Layer Diagram

```
NotificationsPage (UI)
  |
  +-- NotificationTabs (filter tabs component)
  +-- NotificationList (virtualized list)
  |     +-- NotificationItem (individual item)
  |
  +-- useNotifications (hook - orchestration)
        |
        +-- fetchNotifications (client - HTTP with NIP-98 auth)
        +-- transformNotification (transform - API -> app types)
        +-- useBatchedAuthors (existing hook - profile enrichment)
```

---

## Types

### File: `src/types/notification.ts` (new)

```typescript
export type NotificationType = 'like' | 'comment' | 'follow' | 'repost' | 'zap';

export interface Notification {
  id: string;
  type: NotificationType;
  actorPubkey: string;
  actorName?: string;
  actorAvatar?: string;
  message: string;
  timestamp: number;       // Unix seconds
  isRead: boolean;
  targetEventId?: string;  // The video being referenced
  targetVideoThumbnail?: string;
  commentText?: string;    // For comment notifications
  sourceEventId: string;   // The event that caused the notification
  sourceKind: number;
}

export interface NotificationsResponse {
  notifications: Notification[];
  unreadCount: number;
  nextCursor?: string;
  hasMore: boolean;
}

export type NotificationFilter = NotificationType | 'all';
```

---

## Files to Create

### 1. `src/lib/nip98Auth.ts` - NIP-98 HTTP Authentication

Creates signed authorization headers for authenticated API calls.

```typescript
// Creates a NIP-98 auth header for HTTP requests
// Signs a kind 27235 event with URL, method, and optional payload hash
export async function createNip98AuthHeader(
  signer: { signEvent: (event: any) => Promise<any> },
  url: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  payload?: string
): Promise<string>
```

This is a reusable utility that future authenticated endpoints can also use.

### 2. `src/lib/notificationClient.ts` - Notification API Client

HTTP client for the notifications REST API.

```typescript
// Fetch paginated notifications
export async function fetchNotifications(
  apiUrl: string,
  pubkey: string,
  authHeader: string,
  options?: { limit?: number; before?: string; types?: string[]; unreadOnly?: boolean },
  signal?: AbortSignal
): Promise<NotificationsResponse>

// Mark notifications as read
export async function markNotificationsRead(
  apiUrl: string,
  pubkey: string,
  authHeader: string,
  notificationIds?: string[]  // omit for mark-all
): Promise<{ success: boolean; markedCount: number }>

// Fetch just the unread count (lightweight)
export async function fetchUnreadCount(
  apiUrl: string,
  pubkey: string,
  authHeader: string,
  signal?: AbortSignal
): Promise<number>
```

### 3. `src/lib/notificationTransform.ts` - Response Transforms

Pure functions mapping API responses to app types (following existing transform pattern).

```typescript
// Transform raw API notification to app Notification type
export function transformNotification(raw: RawApiNotification): Notification

// Map API notification_type string to NotificationType
export function mapNotificationType(apiType: string): NotificationType

// Generate human-readable message
export function generateNotificationMessage(type: NotificationType, actorName?: string, content?: string): string

// Consolidate follow notifications (keep only latest per user)
export function consolidateFollowNotifications(notifications: Notification[]): Notification[]
```

### 4. `src/hooks/useNotifications.ts` - Main Notifications Hook

TanStack Query hook with infinite scroll pagination.

```typescript
export function useNotifications(filter?: NotificationFilter) {
  // Returns useInfiniteQuery result with:
  // - pages of notifications
  // - fetchNextPage for infinite scroll
  // - refetch for pull-to-refresh
  // - Auto-refresh on window focus
  // - 2-minute polling interval
}

export function useUnreadCount() {
  // Lightweight query that polls for unread count
  // Used by the notification bell badge in header
  // Refetches every 60 seconds and on window focus
}

export function useMarkAsRead() {
  // Mutation hook for marking notifications as read
  // Optimistic update pattern (update cache immediately, sync to server)
}

export function useMarkAllAsRead() {
  // Mutation to mark all notifications as read
}
```

### 5. `src/pages/NotificationsPage.tsx` - Page Component

```typescript
// Tabbed notifications page with filter tabs
// Tabs: All | Likes | Comments | Follows | Reposts
// Each tab renders a filtered NotificationList
// Includes pull-to-refresh and infinite scroll
// Shows empty state when no notifications
// "Mark all as read" button in header
```

### 6. `src/components/NotificationList.tsx` - Notification List

```typescript
// Renders a list of notification items with:
// - Date headers (Today, Yesterday, weekday names, then dates)
// - Infinite scroll (IntersectionObserver at bottom)
// - Loading spinner during pagination
// - Empty state per tab
```

### 7. `src/components/NotificationItem.tsx` - Individual Notification

```typescript
// Single notification item displaying:
// - Actor avatar (with link to profile)
// - Type icon overlay on avatar (like=red heart, comment=blue, follow=purple, repost=green)
// - Rich text message (bold actor name + action text)
// - Comment preview text (for comment notifications)
// - Relative timestamp
// - Video thumbnail on right (for video-related notifications)
// - Unread indicator (subtle background highlight)
// - Click handler to navigate to video or profile
```

### 8. `src/components/NotificationBell.tsx` - Header Bell Icon

```typescript
// Bell icon with unread count badge
// Shows red badge with count (or dot for 99+)
// Placed in AppHeader next to theme toggle
// Links to /notifications
// Only visible when user is logged in
```

---

## Files to Modify

### 1. `src/AppRouter.tsx`

Add the notifications route under the protected routes section:

```tsx
{isLoggedIn && (
  <>
    <Route path="/home" element={<HomePage />} />
    <Route path="/notifications" element={<NotificationsPage />} />  {/* NEW */}
    <Route path="/lists" element={<ListsPage />} />
    ...
  </>
)}
```

### 2. `src/components/AppHeader.tsx`

Add the NotificationBell component between the Search button and theme toggle:

```tsx
import { NotificationBell } from './NotificationBell';

// In the header JSX, after Search button, before theme toggle:
{user && <NotificationBell />}
```

### 3. `src/components/BottomNav.tsx`

Add a notification icon to the mobile bottom nav (replace or add alongside existing items):

```tsx
import { Bell } from 'lucide-react';

// Add between Search and Profile buttons:
{user && (
  <Button ...>
    <div className="relative">
      <Bell className="h-5 w-5" />
      {unreadCount > 0 && <span className="absolute -top-1 -right-1 ...badge...">{unreadCount}</span>}
    </div>
    <span className="text-xs">Alerts</span>
  </Button>
)}
```

### 4. `src/config/api.ts`

Add notification endpoints to the API config:

```typescript
endpoints: {
  // ... existing endpoints ...
  userNotifications: '/api/users/{pubkey}/notifications',
  userNotificationsRead: '/api/users/{pubkey}/notifications/read',
},
```

---

## UI Design

### Page Layout

```
+------------------------------------------+
|  Header: [Bell icon w/ badge]            |
+------------------------------------------+
|  [All] [Likes] [Comments] [Follows] [Re] |  <-- Scrollable tab bar
+------------------------------------------+
|  Today                                    |  <-- Date header
|  +--------------------------------------+|
|  | [Avatar+icon] Name liked your video  ||  <-- Notification item
|  |               2 hours ago     [thumb]||
|  +--------------------------------------+|
|  | [Avatar+icon] Name commented on ...  ||
|  |   "Great video!"                     ||
|  |               3 hours ago     [thumb]||
|  +--------------------------------------+|
|  Yesterday                               |
|  | [Avatar+icon] Name followed you      ||
|  |               Yesterday              ||
|  +--------------------------------------+|
|  ...infinite scroll...                   |
+------------------------------------------+
```

### Notification Item Layout

```
+---------------------------------------------------+
| [48px Avatar]  **ActorName** liked your video      |  [64px video
|  [20px type    2 hours ago                         |   thumbnail]
|   icon]                                            |
+---------------------------------------------------+
```

For comment notifications, include the comment text preview:

```
+---------------------------------------------------+
| [48px Avatar]  **ActorName** commented on your     |  [64px video
|  [blue icon]   video                               |   thumbnail]
|                [gray box: "Great video! Love..."]  |
|                3 hours ago                         |
+---------------------------------------------------+
```

### Color Coding (matching mobile)

| Type | Icon Color | Icon |
|------|-----------|------|
| Like | Red | Heart |
| Comment | Blue | MessageCircle |
| Follow | Purple (brand) | UserPlus |
| Repost | Green (vine green) | Repeat2 |
| Zap | Yellow/Amber | Zap |

### Read/Unread State

- **Unread**: Slightly different background (`bg-muted/50` in light, `bg-muted/30` in dark)
- **Read**: Normal background
- Transition with subtle animation on mark-as-read

### Empty States

- Per-tab: "No {type} notifications" with descriptive subtext
- Global: "No notifications yet" with icon and "When people interact with your content, you'll see it here"

---

## Navigation from Notifications

Clicking a notification navigates to the relevant content:

| Notification Type | Navigation Target |
|------------------|-------------------|
| Like | `/video/{eventId}` - the liked video |
| Comment | `/video/{eventId}` - the video (ideally with comments open) |
| Follow | `/profile/{npub}` - the follower's profile |
| Repost | `/video/{eventId}` - the reposted video |
| Zap | `/video/{eventId}` - the zapped video |

On click, also mark the notification as read (optimistic update).

---

## Implementation Steps

### Phase 1: Core Infrastructure (NIP-98 + API Client)

1. Create `src/types/notification.ts` with type definitions
2. Create `src/lib/nip98Auth.ts` - NIP-98 HTTP auth utility
3. Create `src/lib/notificationClient.ts` - API client functions
4. Create `src/lib/notificationTransform.ts` - pure transform functions
5. Add notification endpoints to `src/config/api.ts`
6. Write tests for transforms and NIP-98 auth

### Phase 2: Hooks

7. Create `src/hooks/useNotifications.ts` with:
   - `useNotifications(filter)` - infinite query for notification list
   - `useUnreadCount()` - lightweight polling for badge
   - `useMarkAsRead()` - optimistic mutation
   - `useMarkAllAsRead()` - mark all mutation
8. Write tests for hooks

### Phase 3: UI Components

9. Create `src/components/NotificationItem.tsx` - single notification row
10. Create `src/components/NotificationList.tsx` - scrollable list with date headers
11. Create `src/pages/NotificationsPage.tsx` - tabbed page with filters
12. Create `src/components/NotificationBell.tsx` - header bell with badge

### Phase 4: Integration

13. Add route to `src/AppRouter.tsx` (protected, logged-in only)
14. Add NotificationBell to `src/components/AppHeader.tsx`
15. Add notification icon to `src/components/BottomNav.tsx`
16. Test end-to-end with real relay

### Phase 5: Polish

17. Add loading skeletons for initial load
18. Add pull-to-refresh on mobile (optional, swipe gesture)
19. Add "Mark all as read" action
20. Add profile enrichment via `useBatchedAuthors` for actor names/avatars
21. Follow consolidation (deduplicate repeated follow/unfollow from same user)

---

## Technical Considerations

### NIP-98 Authentication

The mobile app uses a dedicated `Nip98AuthService` for creating auth tokens. The web equivalent needs to:

1. Create a kind `27235` event:
   ```json
   {
     "kind": 27235,
     "created_at": <now>,
     "tags": [
       ["u", "<full-url>"],
       ["method", "GET"],
       ["payload", "<sha256-of-body>"]  // only for POST
     ],
     "content": ""
   }
   ```
2. Sign it with the user's signer (`user.signer.signEvent()`)
3. Base64-encode the JSON event
4. Use as `Authorization: Nostr <base64>` header

### Profile Enrichment

The API returns `source_pubkey` but not profile data (name, avatar). We need to batch-fetch profiles for all unique pubkeys in the notification list. The existing `useBatchedAuthors` hook handles this pattern already. Each `NotificationItem` should call `useAuthor(actorPubkey)` to get the profile.

### Polling Strategy

- **Unread count**: Poll every 60 seconds + on window focus (lightweight, 1 item)
- **Full notification list**: Refetch on window focus + manual refresh; staleTime of 2 minutes
- **Future**: Add WebSocket subscription for real-time push

### Optimistic Updates

Mark-as-read uses optimistic updates (matching mobile pattern):
1. Immediately update the local cache (mark notification as read, decrement unread count)
2. Fire the API call in the background
3. If API call fails, don't revert (server will sync on next refresh)

### Error Handling

- API unavailable: Show error state with retry button
- Auth failure (401): Could mean signer issue or expired token; show "Please re-login" message
- Network error: Show offline-friendly error with retry

---

## Dependencies

### Existing (no new packages needed)

- `@tanstack/react-query` - data fetching (already used extensively)
- `lucide-react` - icons (Bell, Heart, MessageCircle, UserPlus, Repeat2, Zap)
- `nostr-tools` - nip19 encoding for profile links (already used)
- `@nostrify/react` - Nostr context and signing (already used)
- `date-fns` or manual relative time formatting

### Mobile Reference Files

Key files used as reference for this plan:
- `divine-mobile/mobile/lib/screens/notifications_screen.dart` - Screen layout with tabs
- `divine-mobile/mobile/lib/widgets/notification_list_item.dart` - Item UI design
- `divine-mobile/mobile/lib/services/relay_notification_api_service.dart` - API contract
- `divine-mobile/mobile/lib/services/notification_model_converter.dart` - Transform logic
- `divine-mobile/mobile/lib/services/notification_event_parser.dart` - Nostr event parsing
- `divine-mobile/mobile/lib/providers/relay_notifications_provider.dart` - State management
- `divine-mobile/mobile/lib/widgets/notification_badge.dart` - Badge component
- `divine-mobile/mobile/lib/providers/notification_realtime_bridge_provider.dart` - Real-time bridge

---

## Future Enhancements (out of scope for MVP)

- **WebSocket real-time bridge**: Subscribe to events mentioning the user for instant notification delivery without polling
- **Push notifications**: Service worker + Web Push API for background notifications
- **Notification settings**: Per-type toggle (mute follows, etc.)
- **Grouped notifications**: "Alice and 3 others liked your video" style grouping
- **Sound/vibration**: Audio/haptic feedback on new notification
- **Browser tab badge**: Update document.title with unread count
