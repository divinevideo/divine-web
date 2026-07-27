# URL Guide for Linking to diVine

This guide explains how to create links to videos, users, and content on divine.video.

## Base URL

All URLs are relative to the production domain:
```
https://divine.video
```

## Video URLs

### Direct Video Link
Link to a specific video using its Nostr event ID (hex format):
```
https://divine.video/video/{eventId}
```

**Example:**
```
https://divine.video/video/a1b2c3d4e5f6789...
```

The event ID is a 64-character hex string (the Nostr event's `id` field).

### Video URLs with Nostr Identifiers (Coming Soon)
The platform supports NIP-19 identifiers but video routing via `note`, `nevent`, and `naddr` formats is not yet fully implemented:
- `note1...` - Short video event reference
- `nevent1...` - Video event with relay hints
- `naddr1...` - Addressable video event (Kind 34236)

These will redirect to the appropriate video page once implemented.

## User Profile URLs

### Using npub (Recommended)
Link to a user profile using their npub (NIP-19 encoded public key):
```
https://divine.video/profile/{npub}
```

**Example:**
```
https://divine.video/profile/npub1abc123def456...
```

### Using Hex Pubkey
You can also use raw hex pubkeys (64 characters):
```
https://divine.video/profile/{hexPubkey}
```

### Universal User Lookup
The `/u/` route provides a smart lookup that works with multiple identifier types:
```
https://divine.video/u/{identifier}
```

Supports:
- **Vine User IDs**: 15-20 digit numeric strings (e.g., `1080167736266633216`)
- **Bare NIP-05 local part on the default apex**: e.g. `jacky` resolves to
  `_@jacky.divine.video` (and `jacky@divine.video`) — the same profile as
  visiting `https://jacky.divine.video`.
- **Explicit NIP-05 segments**: `_@x.divine.video` or `x.divine.video` for
  the default apex, `_@x.dvine.video` or `x.dvine.video` for the alternate
  apex, and any third-party `local.domain` for external NIP-05s.

**Examples:**
```
https://divine.video/u/1080167736266633216     # Vine user ID
https://divine.video/u/jacky                   # bare local part on the default apex
https://divine.video/u/jacky.divine.video      # explicit default apex
https://divine.video/u/jacky.dvine.video       # explicit alternate apex
https://divine.video/u/alice.primal.net        # third-party NIP-05
```

### Using nprofile (Nostr Profile)
If you have an `nprofile1...` identifier, you can use it directly:
```
https://divine.video/{nprofile1abc123...}
```

It will automatically redirect to the corresponding `/profile/{npub}` URL.

## Hashtag URLs

### Hashtag Feed
Link to videos tagged with a specific hashtag:
```
https://divine.video/hashtag/{tag}
```

**Example:**
```
https://divine.video/hashtag/comedy
```

### Short Hashtag URL
Shorter alternative using `/t/`:
```
https://divine.video/t/{tag}
```

**Example:**
```
https://divine.video/t/comedy
```

## Feed URLs

### Discovery Feed
Curated discovery feed (no login required):
```
https://divine.video/discovery
```

### Trending Feed
Most popular videos (no login required):
```
https://divine.video/trending
```

### Home Feed
Personalized feed (requires login):
```
https://divine.video/home
```

### Hashtag Discovery
Browse all hashtags:
```
https://divine.video/hashtags
```

## Search

Search across videos, users, and hashtags (no login required):
```
https://divine.video/search?q={query}
```

**Example:**
```
https://divine.video/search?q=funny%20cats
```

## Lists

### User's Lists
View all lists for the logged-in user (requires login):
```
https://divine.video/lists
```

### Specific List
View a specific list's videos (requires login):
```
https://divine.video/list/{pubkey}/{listId}
```

**Example:**
```
https://divine.video/list/abc123.../my-favorites
```

## Nostr Integration

### General NIP-19 Support
The platform automatically handles various Nostr identifier formats:

```
https://divine.video/{nip19identifier}
```

Supported formats:
- `npub1...` → Redirects to `/profile/{npub}`
- `nprofile1...` → Extracts pubkey, redirects to `/profile/{npub}`
- `note1...` → Coming soon (video view)
- `nevent1...` → Coming soon (video view with relay hints)
- `naddr1...` → Coming soon (addressable video events)

## Code Examples

### JavaScript/TypeScript
```typescript
import { nip19 } from 'nostr-tools';

// Link to a user profile
const npub = nip19.npubEncode(userPubkey);
const profileUrl = `https://divine.video/profile/${npub}`;

// Link to a video
const videoUrl = `https://divine.video/video/${eventId}`;

// Link to a hashtag
const hashtagUrl = `https://divine.video/hashtag/${tag}`;
```

### HTML
```html
<!-- Video link -->
<a href="https://divine.video/video/a1b2c3d4e5f6789...">
  Watch this video on diVine
</a>

<!-- Profile link -->
<a href="https://divine.video/profile/npub1abc123...">
  View profile on diVine
</a>

<!-- Hashtag link -->
<a href="https://divine.video/hashtag/comedy">
  #comedy videos on diVine
</a>
```

### Markdown
```markdown
[Watch on diVine](https://divine.video/video/a1b2c3d4e5f6789...)

[View profile](https://divine.video/profile/npub1abc123...)

[#comedy videos](https://divine.video/hashtag/comedy)
```

## SEO and Social Sharing

All video and profile URLs include Open Graph and Twitter Card metadata for rich social media previews.

**Video pages include:**
- Video title
- Description (video content)
- Thumbnail image
- Author information

**Profile pages include:**
- User display name
- Bio/about text
- Profile picture
- Recent videos

## Public vs. Login-Required Routes

### Public Routes (No Login Required)
- Discovery feed: `/discovery`
- Trending feed: `/trending`
- Hashtag pages: `/hashtag/{tag}`, `/t/{tag}`
- Hashtag discovery: `/hashtags`
- Profile pages: `/profile/{npub}`, `/u/{userId}`
- Video pages: `/video/{id}`
- Search: `/search`
- All informational pages: `/about`, `/faq`, `/privacy`, etc.

### Login-Required Routes
- Home feed: `/home`
- Lists: `/lists`, `/list/{pubkey}/{listId}`
- Moderation settings: `/settings/moderation`

## Best Practices

1. **Always use npub for user links**: While hex pubkeys work, npub is the standard Nostr format and more recognizable.

2. **Use event IDs for videos**: Videos are identified by their Nostr event ID (hex format).

3. **URL encode hashtags**: If hashtags contain spaces or special characters, URL-encode them:
   ```javascript
   const tag = "funny cats";
   const url = `https://divine.video/hashtag/${encodeURIComponent(tag)}`;
   ```

4. **Include relay hints for video links**: When possible, use `nevent` or `naddr` formats (once implemented) to include relay hints for better content discovery.

5. **Test links**: Always verify links work before publishing, especially with encoded identifiers.

## Future Enhancements

Planned URL features:
- Full `note` / `nevent` / `naddr` support for video links
- Relay hint support in video URLs
- Deep linking with video timestamps

## Questions or Issues?

If you encounter issues with URLs or have suggestions for improvements:
- Open an issue on GitHub
- Contact: support@divine.video
- Check FAQ: https://divine.video/faq
