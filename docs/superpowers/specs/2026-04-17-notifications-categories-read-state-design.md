# Notifications Categories And Read State Design

## Summary

Add notification category tabs to the notifications page, keep the existing newest-first ordering, and make read state implicit when the user opens the page. The page should still show which items were unread when the page first loaded by splitting the initial result into `New` and `Earlier` sections.

## Goals

- Let users break notifications out by category without changing routes.
- Preserve the current "open notifications means I read them" mental model.
- Keep unread badges accurate across the header, sidebar, and bottom nav.
- Avoid client-side filtering that breaks pagination semantics.

## Non-Goals

- No manual sort controls beyond the existing reverse-chronological order.
- No explicit `Mark all read` button.
- No per-row read tracking based on clicks or visibility.

## Categories

The UI will expose these tabs:

- `All`
- `Unread`
- `Likes`
- `Comments`
- `Follows`
- `Reposts`
- `Zaps`

These map directly to backend notification filters. `Unread` uses the backend `unread_only` flag. The type-specific tabs use backend `types` values. `All` applies no filter.

## Page Behavior

`NotificationsPage` remains a single route and a single infinite list. A tab switch resets pagination and fetches a fresh server-filtered stream for that tab.

When the `All` tab first loads, the page captures which notifications were unread at arrival time, then immediately sends a mark-all-read mutation without notification IDs. That preserves the user’s requested implicit behavior while still letting the rendered page label those initially unread rows under `New`.

After the mark-all-read mutation succeeds, global unread badges should clear because the unread-count query is already invalidated by the mutation hook. Subsequent pages fetched in the same session should render as read unless the backend returns newer unread items later.

## Data Flow

`useNotifications` will accept a filter object with:

- `category`
- derived `types`
- derived `unreadOnly`

That filter becomes part of the React Query key so each tab gets its own cache entry. `fetchNotifications` will pass `types` and `unread_only` to the REST API. Pagination continues to use the backend cursor unchanged.

`useMarkNotificationsRead` keeps its optimistic cache behavior, but the notifications page will call it with no IDs to represent "mark all." For the active `All` query, the page will also maintain a local set of initially unread IDs so the UI can keep showing `New` vs `Earlier` after the optimistic cache flips those rows to `isRead: true`.

## UI Structure

The page header stays the same, followed by a tab bar using the existing shared `Tabs` components.

List presentation:

- `All`: show `New` and `Earlier` sections when both exist
- `Unread`: show a flat list because everything returned is new by definition
- Type tabs: show a flat list, but keep unread row styling if the backend still reports unread items before the implicit mark-all-read completes

Empty states should reflect the selected tab instead of always using the generic message.

## Error Handling

- Tab changes keep using the existing error state pattern.
- If the mark-all-read mutation fails, the list still renders and the unread badges will resync on the next refetch.
- The UI should not block on mark-all-read completion.

## Testing

Add coverage for:

- query filters being forwarded to the notification client
- unread-only and type-specific request params
- `NotificationsPage` rendering category tabs
- `All` tab splitting the first page into `New` and `Earlier`
- implicit mark-all-read firing once on initial `All` load
- tab changes resetting to the correct filtered results

## Implementation Notes

`origin/main` currently fails `npm run test` because of an unused `Loader2` import in `src/pages/ConversationPage.tsx`. Remove that import as a minimal cleanup in this branch so full verification remains meaningful.
