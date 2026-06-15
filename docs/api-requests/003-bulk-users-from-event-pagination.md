# API Request: Pagination Support for Bulk Users with `from_event`

## Summary

The `POST /api/users/bulk` endpoint supports a `from_event` parameter that resolves pubkeys from a Nostr event (e.g., kind 3 contact list), but it fails with "Maximum 100 pubkeys allowed" when the resolved event contains more than 100 pubkeys. Add `limit` and `offset` support to paginate through the resolved results.

## Problem

The `from_event` feature is designed to resolve pubkeys from events like contact lists (kind 3) and return profiles in a single request. This is extremely useful — it combines "get the list" and "resolve profiles" into one call.

However, many users follow more than 100 accounts, causing the request to fail:

```json
POST /api/users/bulk
{
  "from_event": {
    "kind": 3,
    "pubkey": "32e1827635450ebb3c5a7d12c1f8e7b2b514439ac10a67eef3d9fd9c5c68e245"
  }
}

Response: { "error": "Maximum 100 pubkeys allowed" }
```

This user follows 925 accounts, so `from_event` resolves 925 pubkeys and immediately hits the cap.

## Proposed Change

Add `limit` and `offset` parameters to `from_event` to paginate through the resolved pubkeys:

```json
POST /api/users/bulk
{
  "from_event": {
    "kind": 3,
    "pubkey": "32e1827635450ebb3c5a7d12c1f8e7b2b514439ac10a67eef3d9fd9c5c68e245"
  },
  "limit": 20,
  "offset": 0
}

Response:
{
  "users": [
    {
      "pubkey": "2ef93f01cd2493e04235a6b87b10d3c4a74e2a7eb7c3caf168268f6af73314b5",
      "profile": { "name": "alice", "display_name": "Alice", ... },
      "social": { "follower_count": 42, "following_count": 100 },
      "stats": { "video_count": 5 }
    },
    ...
  ],
  "total": 925,
  "offset": 0,
  "limit": 20,
  "missing": []
}
```

## Why This Matters

This would enable a **single-request following list with profiles** — the holy grail for this feature:

| Approach | Requests | Latency |
|----------|----------|---------|
| Current: following + bulk users | 2 sequential | ~400-600ms |
| With this: bulk from_event paginated | 1 | ~200-300ms |
| With doc #001 (include=profiles) | 1 | ~200-300ms |

This is an alternative path to the same optimization as doc #001 (`include=profiles` on the following endpoint). Either solution works — this one is more general-purpose since `from_event` also works with playlists (kind 30005), bookmark lists (kind 10003), and other list events.

### Additional use cases unlocked

- **Playlist member profiles**: `from_event: { kind: 30005, pubkey, d_tag }` — paginated profiles of curated creators
- **Bookmark list authors**: `from_event: { kind: 10003, pubkey }` — profiles of bookmarked content authors
- **Any Nostr list**: Generic paginated profile resolution from any event containing pubkey tags

## Current Client Workaround

We split the following list into chunks of 50 and make multiple `POST /api/users/bulk` calls with explicit pubkey arrays. This works but:
- Requires the client to first fetch the following list separately
- Multiple sequential HTTP requests instead of one
- More client-side complexity

## Priority

Low-medium — this is a nice-to-have generalization. If doc #001 (`include=profiles`) is implemented, this becomes less critical for the followers/following use case specifically. But it would unlock efficient profile resolution for other list-based features.
