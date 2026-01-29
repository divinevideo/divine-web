# Divine Web - AI Agent Guide

This document provides context for AI coding agents working on divine-web.

## Project Overview

**diVine** is a decentralized short-form video platform built on the Nostr protocol. Think "TikTok on Nostr" with 6-second looping videos (inspired by Vine). The codebase is a React 18.x SPA using Vite, TailwindCSS, shadcn/ui, and TanStack Query.

### Key Goals
- Fast, responsive video feeds with instant loading
- Decentralized architecture using Nostr protocol
- Preserve and celebrate the classic Vine archive
- Human-authentic content (anti-AI slop philosophy)

---

## Development Workflow

### TDD Approach (Test-Driven Development)
1. **RED**: Write failing tests first
2. **GREEN**: Write minimum code to pass
3. **REFACTOR**: Improve without changing behavior

### Clean Code Principles
- **Single Responsibility**: Each function has ONE job
- **DRY**: Don't repeat yourself - extract shared logic
- **Pure Functions**: Transform functions have no side effects
- **Clear Naming**: Functions named as verb+noun (fetchUserProfile, transformToStats)
- **No God Functions**: Keep functions <50 lines

### Code Architecture Layers
```
Components (UI) → Hooks (Orchestration) → Client (HTTP) → Transform (Mapping)
                        ↓ fallback
                   WebSocket queries
```

---

## Deployment

### Fastly Deployment (IMPORTANT!)
When deploying to Fastly, ALWAYS run BOTH commands:
1. `npm run fastly:deploy` - Deploys the edge worker (Wasm compute)
2. `npm run fastly:publish` - Publishes static content to KV Store

Running only deploy without publish means the new frontend code won't be served!

### Other Deployment Options
- `npm run deploy:cloudflare` - Deploy to Cloudflare Pages

### Git Conventions
- Commit format: `type: description` (feat, fix, perf, docs, refactor, test)
- Include `Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>` when AI-assisted
- Don't amend commits after hook failures - create new commits

---

## Funnelcake REST API

Funnelcake is our optimized REST API layer. Use REST for reads, WebSocket for writes.

### Base URLs
| Environment | WebSocket | REST API |
|------------|-----------|----------|
| Production | `wss://relay.divine.video` | `https://relay.divine.video/api/` |
| Staging | `wss://relay.staging.dvines.org` | `https://relay.staging.dvines.org/api/` |

**OpenAPI Docs**: `https://relay.divine.video/api/docs`

### When to Use REST vs WebSocket
- **REST**: Analytics, stats, bulk operations, search, pre-computed data
- **WebSocket**: Publishing events, real-time subscriptions, signature verification

### Key Endpoints
```
GET  /api/videos                    - List videos (sort: trending|recent|loops)
GET  /api/videos/{id}               - Single video with stats
POST /api/videos/stats/bulk         - Bulk video stats
GET  /api/users/{pubkey}            - User profile + stats
GET  /api/users/{pubkey}/videos     - User's videos
GET  /api/users/{pubkey}/followers  - Paginated followers
GET  /api/users/{pubkey}/following  - Following list
POST /api/users/bulk                - Bulk user profiles
GET  /api/search?q=                 - Full-text search
GET  /api/hashtags/trending         - Trending hashtags
```

### Bulk Endpoint Pattern
Bulk endpoints support `from_event` to resolve IDs from another event:
```json
// Get profiles of everyone a user follows
POST /api/users/bulk
{ "from_event": { "kind": 3, "pubkey": "user-pubkey" } }

// Get videos from a playlist
POST /api/videos/bulk
{ "from_event": { "kind": 30005, "pubkey": "curator", "d_tag": "playlist" } }
```

### Circuit Breaker Pattern
The app uses a circuit breaker for Funnelcake API calls:
- After 3 consecutive failures, circuit opens for 30 seconds
- Automatic fallback to WebSocket queries when circuit is open
- Use `isFunnelcakeAvailable()` to check status

---

## Nostr Protocol Essentials

### Event Structure
```json
{
  "id": "64-char-hex-sha256",
  "pubkey": "64-char-hex-public-key",
  "created_at": 1700000000,
  "kind": 34236,
  "tags": [["d", "unique-id"], ["title", "My Video"]],
  "content": "Description",
  "sig": "128-char-hex-signature"
}
```

### Key Event Kinds
| Kind | Purpose |
|------|---------|
| 0 | User profile metadata |
| 3 | Contact/follow list |
| 5 | Deletion requests |
| 7 | Reactions (likes) |
| 16 | Generic repost (for videos) |
| 1111 | Comments (NIP-22) |
| 10003 | Bookmark list |
| 30005 | Curation set / playlist |
| 34236 | Short-form video (NIP-71) |

### NIP-50 Search (relay supports)
```typescript
// Trending videos
{ kinds: [34236], search: "sort:hot", limit: 50 }

// Popular all-time
{ kinds: [34236], search: "sort:top", limit: 50 }

// Combined search + sort
{ kinds: [34236], search: "sort:hot bitcoin", limit: 50 }
```

### Addressable Events (kinds 30000-39999)
- Unique key: `pubkey:kind:d-tag`
- Deduplicate by this key, NOT by event ID
- Publishing same d-tag replaces the event

### Video Event Tags
```json
["d", "unique-video-id"],           // REQUIRED
["title", "Video Title"],
["imeta", "url https://...", "m video/mp4", "image https://..."],
["t", "hashtag"]
```

### Comment Structure (NIP-22)
Comments use UPPERCASE for root, lowercase for parent:
```json
{
  "kind": 1111,
  "tags": [
    ["E", "<video-id>"],      // Root = the video
    ["K", "34236"],           // Root kind
    ["P", "<video-author>"],  // Root author
    ["e", "<parent-id>"],     // Parent (video or comment being replied to)
    ["k", "34236"],           // Parent kind (34236 for video, 1111 for reply)
    ["p", "<parent-author>"]  // Parent author
  ],
  "content": "Great video!"
}
```

---

## Codebase Patterns

### Hooks Pattern
```typescript
// Use React Query for data fetching
const query = useQuery({
  queryKey: ['resource', id],
  queryFn: async ({ signal }) => {
    // Try REST first
    if (isFunnelcakeAvailable(apiUrl)) {
      const result = await fetchFromRest(apiUrl, id, signal);
      if (result) return result;
    }
    // Fallback to WebSocket
    return fetchFromWebSocket(nostr, id, signal);
  },
  staleTime: 60000,
  gcTime: 300000,
});
```

### Transform Pattern
```typescript
// Pure functions that map API responses to app types
export function transformFunnelcakeProfile(response: ApiResponse): ProfileStats {
  return {
    followersCount: response.social?.follower_count ?? 0,
    followingCount: response.social?.following_count ?? 0,
    // ...
  };
}
```

### Testing Pattern
```typescript
// Vitest with React Testing Library
describe('useProfileStats', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('fetches from REST when available', async () => {
    mockFetch({ follower_count: 100 });
    const { result } = renderHook(() => useProfileStats(PUBKEY));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.followersCount).toBe(100);
  });
});
```

---

## Key Files & Directories

```
src/
├── hooks/              # React Query hooks
│   ├── useProfileStats.ts
│   ├── useBatchedAuthors.ts
│   ├── useInfiniteVideosFunnelcake.ts
│   └── useVideoEvents.ts
├── lib/
│   ├── funnelcakeClient.ts    # REST API client
│   ├── funnelcakeHealth.ts    # Circuit breaker
│   ├── funnelcakeTransform.ts # Response transforms
│   └── videoParser.ts         # Nostr event parsing
├── components/
│   ├── VideoCard.tsx
│   ├── VideoFeed.tsx
│   └── ProfileHeader.tsx
├── types/
│   ├── video.ts
│   └── funnelcake.ts
└── config/
    ├── api.ts           # API configuration
    └── relays.ts        # Relay configuration
```

---

## Common Gotchas

### Video Deduplication
Always deduplicate videos by `pubkey:kind:d-tag`, NOT by event ID. Different events can represent the same addressable video.

### Key Formats
- API uses hex format (64 chars)
- Users share bech32 (`npub1...`, `note1...`)
- Always decode bech32 to hex before API calls

### Profile Data
Funnelcake profile response is nested:
```json
{
  "profile": { "name": "..." },
  "social": { "follower_count": 100 },
  "stats": { "video_count": 10 }
}
```

### Classic Viners
- Videos with `loopCount > 0` are from the Vine archive
- Show "Classic Viner" badge for these users
- Original loop counts are preserved in video metadata

---

## Running Tests

```bash
npm test              # Full test suite
npx vitest run        # Just vitest
npx tsc --noEmit      # Type check only
```

---

## Environment Variables

```bash
VITE_FUNNELCAKE_API_URL=https://relay.divine.video  # Funnelcake API base
```

---

## Useful Commands

```bash
npm run dev           # Local development server
npm run build         # Production build
npm run fastly:deploy && npm run fastly:publish  # Deploy to Fastly
npm run deploy:cloudflare  # Deploy to Cloudflare Pages
```
