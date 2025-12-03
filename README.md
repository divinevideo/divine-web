# diVine Web

OpenVine-compatible Nostr client for short-form looping videos. Built with React 18.x, TailwindCSS 3.x, Vite, shadcn/ui, and Nostrify.

## Features

- **6-second looping videos** (Kind 34236)
- **MP4 and GIF support** with auto-loop playback
- **Blurhash placeholders** for smooth progressive loading
- **Social features**: Likes, reposts, follows, hashtag discovery
- **Feed types**: Home (following), Discovery, Trending, Hashtag, Profile
- **Primary relay**: wss://relay.divine.video

## Relay Architecture

**relay.divine.video** is a high-performance OpenSearch-backed relay with NIP-50 search extensions.

### NIP-50 Search Support

The relay implements [NIP-50](https://github.com/nostr-protocol/nips/blob/master/50.md) full-text search with advanced sorting:

```typescript
{
  kinds: VIDEO_KINDS,
  search: "sort:hot",  // Recent + high engagement
  limit: 50
}
```

**Supported sort modes:**
- `sort:hot` - Recent events with high engagement (trending)
- `sort:top` - Most referenced events (popular all-time)
- `sort:rising` - Recently created events gaining engagement
- `sort:controversial` - Events with mixed reactions

**Combined search and sort:**
```typescript
{
  kinds: VIDEO_KINDS,
  search: "sort:hot bitcoin",  // Hot bitcoin videos
  limit: 50
}
```

**Feed types using NIP-50:**
- Trending (sort:hot)
- Discovery (sort:top)
- Home following feed (sort:top)
- Hashtag feeds (sort:hot)
- Full-text search (with relevance scoring)

**Fallback:** Standard Nostr relays without NIP-50 will return chronological results.

For detailed relay documentation, see [docs/relay-architecture.md](docs/relay-architecture.md).

## Development

Built with MKStack template - a starter for Nostr client applications.