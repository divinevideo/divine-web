# API Request: Inline Profiles on Followers/Following Endpoints

## Summary

Add an `include=profiles` query parameter to `GET /api/users/{pubkey}/followers` and `GET /api/users/{pubkey}/following` that returns user profile metadata alongside each pubkey, eliminating the need for a separate bulk-users call.

## Problem

Displaying a followers or following list currently requires **two sequential network requests**:

1. `GET /api/users/{pubkey}/followers?limit=50` — returns bare pubkey strings
2. `POST /api/users/bulk` with those 50 pubkeys — returns profile metadata (name, avatar, etc.)

On mobile devices, this two-request waterfall adds noticeable latency. The user clicks "Followers", sees a loading spinner, waits for request 1, then sees another loading state while request 2 resolves profiles. The perceived delay is roughly doubled compared to a single request.

### Current response

```json
GET /api/users/{pubkey}/followers?limit=20

{
  "followers": [
    "d28413712171c33e117d4bd0930ac05b2c51b30eb3021ef8d4f1233f02c90a2b",
    "786347f3c0d3be667d0330c6257bcd4c4749c3552abe03c7380dca2425f9873c"
  ],
  "total": 331,
  "offset": 0,
  "limit": 20
}
```

## Proposed Change

When `include=profiles` is set, return an array of objects instead of bare strings:

```json
GET /api/users/{pubkey}/followers?limit=20&include=profiles

{
  "followers": [
    {
      "pubkey": "d28413712171c33e117d4bd0930ac05b2c51b30eb3021ef8d4f1233f02c90a2b",
      "profile": {
        "name": "alice",
        "display_name": "Alice",
        "picture": "https://...",
        "nip05": "alice@example.com"
      }
    },
    {
      "pubkey": "786347f3c0d3be667d0330c6257bcd4c4749c3552abe03c7380dca2425f9873c",
      "profile": {
        "name": "Evan",
        "display_name": "Evan",
        "picture": "https://...",
        "about": "Executive Director..."
      }
    }
  ],
  "total": 331,
  "offset": 0,
  "limit": 20
}
```

Same change applies to `/api/users/{pubkey}/following`.

## Why This Matters

- **Eliminates a network round-trip**: 1 request instead of 2, cutting perceived latency roughly in half
- **Reduces server load**: One DB join vs two separate API calls hitting the users table
- **The data is already available**: The bulk-users endpoint already joins profile data — this just moves that join earlier in the pipeline
- **Backwards compatible**: Without `include=profiles`, the response stays the same (bare pubkey strings)

## Impact

- Profile follower/following lists will load instantly on first paint
- Mobile users (the primary audience for a short-video app) benefit most from fewer round-trips
- The client can fall back to the current two-request flow if the parameter isn't supported yet

## Priority

High — this is the single biggest optimization available for the followers/following UI.
