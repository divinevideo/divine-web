# Notifications Video Context Design

## Summary

Make content notifications answer the missing question inline: which video got liked, commented on, reposted, or zapped. The backend already enriches notification rows with `referenced_video` data, but the web client currently drops that shape during transformation and renders only a generic action string.

## Goals

- Show the target video directly in `like`, `comment`, `repost`, and `zap` notification rows.
- Reuse the enriched notification payload instead of adding a second fetch path.
- Preserve existing row click behavior and graceful fallbacks when enrichment is missing.

## Non-Goals

- No route or pagination changes.
- No redesign of follow notifications.
- No extra background fetch for video metadata unless the existing payload proves absent.

## Backend Contract

`GET /api/users/{pubkey}/notifications` has a stale minimal example in some docs, but the backend handler tests already assert richer response fields:

- `source_profile.display_name`
- `source_profile.picture`
- `source_profile.nip05`
- `referenced_video.title`
- `referenced_video.thumbnail`
- `referenced_video.d_tag`

The web client should treat these enrichment fields as optional, not speculative.

## Data Flow

`RawApiNotification` will grow optional enrichment fields for `source_profile` and `referenced_video`. `transformNotification` will preserve that data on the app-level `Notification` object instead of dropping it.

The row component will keep using `useAuthor` as a fallback for actor metadata, but it should prefer `source_profile` when the notification payload already provides it. This reduces unnecessary dependency on a secondary profile lookup for notification rendering.

## UI Structure

For `like`, `comment`, `repost`, and `zap` rows, render a compact referenced-video preview under the primary message line:

- small rounded thumbnail on the left
- one-line title or caption on the right
- fallback text such as `Untitled video` when no title exists

Comment notifications will continue showing the comment text preview below the referenced-video preview. Follow notifications remain unchanged.

## Error Handling And Fallbacks

- If `referenced_video` is missing, render the current generic row with no empty preview shell.
- If the thumbnail URL is missing or invalid, render the title-only preview.
- If actor enrichment is missing, keep the existing `useAuthor` fallback behavior.

## Testing

Add coverage for:

- preserving enrichment fields in the notification transform
- preferring enriched actor metadata when present
- rendering video context for likes, reposts, comments, and zaps
- omitting the preview cleanly when enrichment is absent

