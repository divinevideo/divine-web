# Share Improvements Plan

## Current State Audit

### Existing Share Implementations

The web app already has basic share functionality in three locations, each with slightly different implementations:

#### 1. VideoCard.tsx (line 304-341)
- Uses `getApexShareUrl()` for subdomain-aware URLs
- Calls `navigator.share({ url })` on mobile -- shares URL only, no title/text
- Falls back to `navigator.clipboard.writeText()` on desktop
- Toast notifications for success/error
- Shares URL pattern: `/video/{event_id}`

#### 2. FullscreenFeed.tsx (line 96-126)
- Uses `window.location.origin` for URL (does NOT use `getApexShareUrl`) -- **BUG**: broken on subdomains
- Calls `navigator.share({ url })` -- URL only, no title/text
- Falls back to clipboard copy
- Same URL pattern: `/video/{video.id}`

#### 3. ListDetailPage.tsx (line 303-324)
- Uses `window.location.href` directly
- Calls `navigator.share({ title, text, url })` -- includes title and description
- Falls back to clipboard copy
- No subdomain awareness

#### 4. ProfileHeader.tsx (line 129-143)
- Only has "Copy npub" button
- No share profile URL functionality
- No Web Share API usage

### Mobile Reference (share_service.dart)

The mobile app's ShareService provides three share options in a bottom sheet:
1. **Share to Apps** -- native share sheet with just the web URL (`https://divine.video/video/{stableId}`)
2. **Copy Web Link** -- copies `https://divine.video/video/{stableId}` to clipboard
3. **Copy Nostr Link** -- copies `nostr:nevent1{eventId}` to clipboard

Key design choices:
- Uses `video.stableId` (d-tag) rather than event ID for stable URLs
- Share text is just the URL -- lets the user add their own context
- Subject line: "Check out this video on divine"

### OG Meta Tags (Edge Worker)

The Fastly edge worker at `compute-js/src/index.js` already handles dynamic OG tags:

**Video pages** (for social media crawlers):
- Fetches video metadata from Funnelcake API
- Generates OG tags with title, description (content or engagement stats), thumbnail
- Uses `og:type = "video.other"`, `twitter:card = "summary_large_image"`
- Image dimensions: 480x480

**Subdomain profiles** (for all requests):
- Injects OG tags with display name, about, profile picture
- Sets canonical URL to `https://{subdomain}.{apex}/`

**Default** (`index.html`):
- Static OG tags: "diVine Web - Short-form Looping Videos on Nostr"
- Image: `https://divine.video/og.png` (1920x1080)

### URL Generation (`subdomainLinks.ts`)

- `getApexShareUrl(path)` -- always returns apex domain URL for sharing (correct behavior)
- On apex: returns `window.location.origin + path`
- On subdomain: returns `https://{apexDomain}{path}`

---

## Problems to Fix

1. **Inconsistent share implementations** -- three copy-paste variations with different behavior
2. **FullscreenFeed subdomain bug** -- uses `window.location.origin` instead of `getApexShareUrl`, producing broken URLs on subdomains
3. **Missing share data** -- VideoCard and FullscreenFeed only share URL, no title/text for richer previews in messaging apps
4. **No profile sharing** -- ProfileHeader only copies npub, no share URL
5. **No Nostr link sharing** -- mobile offers "Copy Nostr Link", web does not
6. **No list share subdomain awareness** -- ListDetailPage uses `window.location.href`
7. **OG tags missing for profiles on apex** -- only subdomain profiles get dynamic OG tags; `/profile/npub1...` on apex domain gets generic site tags
8. **Video URLs use event ID, not d-tag** -- mobile uses `stableId` (d-tag) for stable URLs; web uses `video.id` (event ID) which changes if the user edits their video

---

## Implementation Plan

### Phase 1: Extract Shared Share Utility

**Goal**: Single source of truth for all share logic.

#### New file: `src/lib/shareUtils.ts`

```typescript
import { getApexShareUrl } from '@/lib/subdomainLinks';
import { nip19 } from 'nostr-tools';
import type { ParsedVideoData } from '@/types/video';

export interface ShareTarget {
  title: string;
  text?: string;
  url: string;
}

/** Build a shareable video URL (always apex domain, stable d-tag ID). */
export function getVideoShareUrl(video: ParsedVideoData): string {
  // Prefer vineId (d-tag) for stable URLs that survive edits
  const id = video.vineId || video.id;
  return getApexShareUrl(`/video/${id}`);
}

/** Build shareable data for a video. */
export function getVideoShareData(video: ParsedVideoData): ShareTarget {
  return {
    title: video.title || 'Video on diVine',
    url: getVideoShareUrl(video),
  };
}

/** Build a shareable profile URL. */
export function getProfileShareUrl(pubkey: string): string {
  const npub = nip19.npubEncode(pubkey);
  return getApexShareUrl(`/${npub}`);
}

/** Build shareable data for a profile. */
export function getProfileShareData(
  pubkey: string,
  displayName?: string
): ShareTarget {
  return {
    title: displayName
      ? `${displayName} on diVine`
      : 'Profile on diVine',
    url: getProfileShareUrl(pubkey),
  };
}

/** Build a shareable list URL. */
export function getListShareUrl(pubkey: string, listId: string): string {
  return getApexShareUrl(`/list/${pubkey}/${listId}`);
}

/** Build shareable data for a list. */
export function getListShareData(
  pubkey: string,
  listId: string,
  listName?: string,
  listDescription?: string
): ShareTarget {
  return {
    title: listName || 'Video List on diVine',
    text: listDescription,
    url: getListShareUrl(pubkey, listId),
  };
}

/** Generate a Nostr nevent URI for a video. */
export function getNostrVideoLink(video: ParsedVideoData): string {
  try {
    const encoded = nip19.neventEncode({
      id: video.id,
      author: video.pubkey,
      kind: 34236,
      relays: ['wss://relay.divine.video'],
    });
    return `nostr:${encoded}`;
  } catch {
    return `nostr:note1${video.id}`;
  }
}

/** Generate a Nostr nprofile URI for a user. */
export function getNostrProfileLink(pubkey: string): string {
  try {
    const encoded = nip19.nprofileEncode({
      pubkey,
      relays: ['wss://relay.divine.video'],
    });
    return `nostr:${encoded}`;
  } catch {
    return `nostr:${nip19.npubEncode(pubkey)}`;
  }
}
```

#### New hook: `src/hooks/useShare.ts`

```typescript
import { useCallback } from 'react';
import { useToast } from '@/hooks/useToast';
import type { ShareTarget } from '@/lib/shareUtils';

/** Returns a share function that tries Web Share API, then clipboard fallback. */
export function useShare() {
  const { toast } = useToast();

  const share = useCallback(async (data: ShareTarget) => {
    // Web Share API (mobile browsers, some desktop)
    if (navigator.share) {
      try {
        await navigator.share({
          title: data.title,
          text: data.text,
          url: data.url,
        });
        return; // User completed or cancelled share sheet
      } catch (error) {
        if ((error as Error).name === 'AbortError') return; // User cancelled
        // Fall through to clipboard
      }
    }

    // Fallback: copy URL to clipboard
    try {
      await navigator.clipboard.writeText(data.url);
      toast({
        title: 'Link copied!',
        description: 'Link has been copied to clipboard',
      });
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to copy link to clipboard',
        variant: 'destructive',
      });
    }
  }, [toast]);

  const copyToClipboard = useCallback(async (text: string, label?: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: 'Copied!',
        description: label || 'Copied to clipboard',
      });
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to copy to clipboard',
        variant: 'destructive',
      });
    }
  }, [toast]);

  return { share, copyToClipboard };
}
```

**Files to create:**
- `src/lib/shareUtils.ts`
- `src/hooks/useShare.ts`

---

### Phase 2: Update Existing Share Buttons

#### 2a. VideoCard.tsx

Replace the inline `handleShare` function (lines 304-341) to use the new utility:

```typescript
// Import at top:
import { useShare } from '@/hooks/useShare';
import { getVideoShareData } from '@/lib/shareUtils';

// In component:
const { share } = useShare();

const handleShare = () => share(getVideoShareData(video));
```

Remove: the `getApexShareUrl` import and inline share logic.

#### 2b. FullscreenFeed.tsx

Replace `handleShare` in `FullscreenVideoWithMetrics` (lines 96-126):

```typescript
import { useShare } from '@/hooks/useShare';
import { getVideoShareData } from '@/lib/shareUtils';

const { share } = useShare();
const handleShare = () => share(getVideoShareData(video));
```

This also **fixes the subdomain bug** since `getVideoShareData` uses `getApexShareUrl`.

#### 2c. ListDetailPage.tsx

Replace `handleShare` (lines 303-324):

```typescript
import { useShare } from '@/hooks/useShare';
import { getListShareData } from '@/lib/shareUtils';

const { share } = useShare();
const handleShare = () => share(getListShareData(pubkey!, listId!, list?.name, list?.description));
```

**Files to modify:**
- `src/components/VideoCard.tsx`
- `src/components/FullscreenFeed.tsx`
- `src/pages/ListDetailPage.tsx`

---

### Phase 3: Add Profile Share Button

#### ProfileHeader.tsx

Add a "Share profile" button next to the existing "Copy npub" button:

```typescript
import { useShare } from '@/hooks/useShare';
import { getProfileShareData } from '@/lib/shareUtils';
import { Share } from 'lucide-react';

const { share } = useShare();

// In the JSX next to the copy npub button:
<Button
  variant="ghost"
  size="icon"
  className="h-8 w-8 shrink-0"
  onClick={() => share(getProfileShareData(pubkey, displayName))}
  title="Share profile"
>
  <Share className="h-4 w-4" />
</Button>
```

**Files to modify:**
- `src/components/ProfileHeader.tsx`

---

### Phase 4: Add "Copy Nostr Link" Option

Add a Nostr link copy option to the video overflow menu (DropdownMenu) in VideoCard and FullscreenVideoItem. This mirrors the mobile app's "Copy Nostr Link" option.

#### VideoCard.tsx -- add to DropdownMenu (after "View source"):

```typescript
import { getNostrVideoLink } from '@/lib/shareUtils';

<DropdownMenuItem onClick={() => {
  copyToClipboard(getNostrVideoLink(video), 'Nostr link copied');
}}>
  <Zap className="h-4 w-4 mr-2" />
  Copy Nostr link
</DropdownMenuItem>
```

#### FullscreenVideoItem.tsx -- add to DropdownMenu:

Same pattern as VideoCard.

**Files to modify:**
- `src/components/VideoCard.tsx`
- `src/components/FullscreenVideoItem.tsx`

---

### Phase 5: Profile OG Meta Tags (Edge Worker)

Currently, profiles on the apex domain (`divine.video/profile/npub1...` or `divine.video/npub1...`) get generic site-level OG tags. Social media crawlers see "diVine Web" instead of the user's name and avatar.

#### compute-js/src/index.js

Add a new handler before the SPA fallback (step 7.5), similar to the existing video OG handler:

```javascript
// 5b. Handle dynamic OG meta tags for profile pages (for social media crawlers)
if ((url.pathname.startsWith('/profile/') || url.pathname.match(/^\/npub1[a-z0-9]+$/))
    && isSocialMediaCrawler(request)) {
  // Extract npub, decode to hex, fetch from Funnelcake
  const ogResponse = await handleProfileOgTags(request, url);
  if (ogResponse) return ogResponse;
}
```

Add `handleProfileOgTags` function that:
1. Extracts npub from path, decodes to hex pubkey
2. Fetches profile from Funnelcake API (`/api/users/{pubkey}`)
3. Generates minimal HTML with OG tags (same pattern as `handleVideoOgTags`)

**Files to modify:**
- `compute-js/src/index.js`

---

### Phase 6: Use Stable Video URLs (d-tag)

Currently, shared video URLs use event IDs (`/video/{event_id}`). If the author edits their video, the event ID changes and old shared links break. The mobile app uses `stableId` (d-tag / vineId) instead.

The Funnelcake API already supports d-tag lookups on `/api/videos/{id}`. The `useVideoByIdFunnelcake` hook already handles both event IDs and d-tags.

Changes needed:
- `getVideoShareUrl` in `shareUtils.ts` already prefers `vineId` (see Phase 1)
- Verify the routing in `AppRouter.tsx` handles both ID formats (it does -- the param is generic `id`)
- No router changes needed since Funnelcake resolves both formats

**No additional file changes needed** -- this is handled by the Phase 1 `shareUtils.ts` implementation.

---

## Files Summary

### Files to Create
| File | Purpose |
|------|---------|
| `src/lib/shareUtils.ts` | Share URL generation, Nostr link generation |
| `src/hooks/useShare.ts` | Web Share API + clipboard fallback hook |

### Files to Modify
| File | Change |
|------|--------|
| `src/components/VideoCard.tsx` | Use `useShare` + `getVideoShareData`, add Nostr link to menu |
| `src/components/FullscreenFeed.tsx` | Use `useShare` + `getVideoShareData` (fixes subdomain bug) |
| `src/components/FullscreenVideoItem.tsx` | Add Nostr link to overflow menu |
| `src/pages/ListDetailPage.tsx` | Use `useShare` + `getListShareData` |
| `src/components/ProfileHeader.tsx` | Add share profile button |
| `compute-js/src/index.js` | Add profile OG meta tag handler for crawlers |

### Files Unchanged
| File | Notes |
|------|-------|
| `src/lib/subdomainLinks.ts` | Already correct -- `getApexShareUrl` works well |
| `index.html` | Default OG tags are fine as fallback |

---

## Implementation Order

1. **Phase 1** -- Create `shareUtils.ts` and `useShare.ts` (foundation, no UI changes)
2. **Phase 2** -- Update VideoCard, FullscreenFeed, ListDetailPage (fixes bugs, consolidates code)
3. **Phase 3** -- Add profile share button (new feature, small change)
4. **Phase 4** -- Add Nostr link copy (parity with mobile app)
5. **Phase 5** -- Profile OG meta tags (edge worker change, requires separate deploy)
6. **Phase 6** -- Verify stable URLs work end-to-end (already handled by Phase 1)

Phases 1-4 are client-side only and can ship together.
Phase 5 requires an edge worker deploy (`npm run fastly:deploy && npm run fastly:publish`).

---

## Testing Strategy

### Unit Tests
- `shareUtils.test.ts` -- verify URL generation for videos, profiles, lists, Nostr links
- `useShare.test.ts` -- mock `navigator.share` and `navigator.clipboard`, verify fallback behavior

### Manual Testing Checklist
- [ ] Share video from VideoCard on mobile browser -- native share sheet appears
- [ ] Share video from VideoCard on desktop -- URL copied to clipboard with toast
- [ ] Share video from fullscreen feed on subdomain -- URL points to apex domain
- [ ] Share profile from ProfileHeader -- native share or clipboard
- [ ] Copy Nostr link from video menu -- valid nevent URI
- [ ] Share list -- title and description included in share sheet
- [ ] Paste shared video URL -- loads correctly (test with vineId-based URL)
- [ ] Share video URL in Slack/Discord -- OG preview shows title, thumbnail, description
- [ ] Share profile URL in Slack/Discord -- OG preview shows name, avatar, bio
