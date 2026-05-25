# API Request: Add Pagination to Following Endpoint

## Summary

The `GET /api/users/{pubkey}/following` endpoint currently ignores the `limit` and `offset` query parameters and always returns the **entire** following list in a single response. Add proper pagination support matching the followers endpoint.

## Problem

Tested with a user who follows 925 accounts:

```
GET /api/users/{pubkey}/following?limit=3

Response: 925 pubkeys returned (limit ignored)
Response size: ~60KB of JSON
```

Compare to the followers endpoint which correctly paginates:

```
GET /api/users/{pubkey}/followers?limit=3

Response: 3 pubkeys returned (limit respected)
Response body: { "followers": [...], "total": 331, "offset": 0, "limit": 3 }
```

### Consequences

- **Wasted bandwidth on mobile**: 60KB of hex strings when the user only sees 10-15 rows at a time
- **Slower initial render**: The client must parse and process all 925 pubkeys before showing anything
- **Memory pressure**: On lower-end phones, holding 1000+ pubkeys in memory while only displaying 15 is wasteful
- **Inconsistent API surface**: Followers supports `limit`/`offset`, following does not — confusing for API consumers

## Proposed Change

Make the following endpoint respect `limit` and `offset` parameters, matching the followers endpoint behavior:

```json
GET /api/users/{pubkey}/following?limit=20&offset=0

{
  "following": [
    "2ef93f01cd2493e04235a6b87b10d3c4a74e2a7eb7c3caf168268f6af73314b5",
    "9ec7a778167afb1d30c4833de9322da0c08ba71a69e1911d5578d3144bb56437",
    ...
  ],
  "total": 925,
  "offset": 0,
  "limit": 20
}
```

### Default behavior

- If `limit` is omitted, a sensible default (e.g., 50 or 100) should apply — NOT the full list
- If the caller explicitly wants all results, they can set `limit=1000` or paginate through

## Why This Matters

- **Consistent API design**: Both social list endpoints should behave the same way
- **60x bandwidth reduction** for the initial load (1KB vs 60KB for the first page of 20)
- **Enables true infinite scroll**: The client can fetch pages on demand as the user scrolls, same as followers
- **Faster time-to-first-paint**: Parse 20 pubkeys instead of 925 before showing the list

## Current Client Workaround

We're working around this by:
1. Receiving all 925 pubkeys at once
2. Only resolving profiles for the visible window via chunked `useBatchedAuthors` calls
3. Using virtual scrolling to avoid rendering 925 DOM nodes

This works but wastes bandwidth and memory. Server-side pagination would be cleaner.

## Priority

Medium — client-side workarounds exist, but this is a straightforward fix that would improve efficiency and API consistency.
