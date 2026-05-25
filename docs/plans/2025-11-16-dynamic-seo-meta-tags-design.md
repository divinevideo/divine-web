# Dynamic SEO Meta Tags Design

**Date:** 2025-11-16
**Author:** Claude (with Rabble)
**Status:** Approved

## Problem Statement

When users share diVine links on social media platforms (Twitter, Discord, Slack, etc.), all links show the same generic preview:
- Title: "diVine Web - Short-form Looping Videos on Nostr"
- Description: "Watch and share 6-second looping videos on the decentralized Nostr network."
- Image: `/og.avif`

This significantly hurts social sharing because:
- Video links don't show the actual video thumbnail or title
- Profile links don't show the user's avatar or bio
- Hashtag links don't show hashtag-specific information
- Every shared link looks identical, reducing click-through rates

## Current State

### What We Have
✅ **Static meta tags** in index.html (lines 7-19) with basic Open Graph/Twitter Card support
✅ **@unhead/react infrastructure** installed and configured (package.json:50-51, App.tsx:21-25)
✅ **InferSeoMetaPlugin** enabled for automatic SEO inference
✅ **Existing pattern**: Index.tsx and NotFound.tsx already use `useSeoMeta()`
✅ **Bot accessibility**: Cloudflare Pages Function returns 200 status for valid routes (bots can crawl)

### The Gap
Three page types need dynamic meta tags:
1. **VideoPage** (`/video/:id`) - should show video thumbnail, title, and author
2. **ProfilePage** (`/profile/:npub`) - should show user avatar, name, and bio
3. **HashtagPage** (`/hashtag/:tag`) - should show hashtag name and video count

## Solution Design

### Architecture

Add dynamic SEO meta tags using the existing `@unhead/react` infrastructure. Each page will:
1. Import `useSeoMeta` from `@unhead/react`
2. Add a `useEffect` hook that watches the relevant data
3. Call `useSeoMeta()` with Open Graph and Twitter Card properties when data loads
4. Provide sensible fallbacks when data is missing

**Performance guarantee:** Zero user-facing slowdown because:
- No new data fetching (reuse existing page data)
- `useEffect` runs after render (non-blocking)
- Meta tag updates are invisible DOM operations
- Pattern already proven in Index.tsx and NotFound.tsx

### Implementation Details

#### 1. VideoPage.tsx

**Data sources:**
- `currentVideo` from `useVideoNavigation()` hook (already fetched)
- `authorData` from `useAuthor()` hook (already fetched at line 36)
- `authorName` already computed at line 37

**Implementation:**
```typescript
import { useSeoMeta } from '@unhead/react';

// ... existing code ...

useEffect(() => {
  if (currentVideo) {
    useSeoMeta({
      title: currentVideo.title || 'Video on diVine',
      description: currentVideo.content || `Watch this video${authorName ? ` by ${authorName}` : ''} on diVine`,
      ogTitle: currentVideo.title || 'Video on diVine',
      ogDescription: currentVideo.content || 'Watch this video on diVine',
      ogImage: currentVideo.thumbnailUrl || '/og.avif',
      ogType: 'video.other',
      twitterCard: 'summary_large_image',
      twitterTitle: currentVideo.title || 'Video on diVine',
      twitterDescription: currentVideo.content || 'Watch this video on diVine',
      twitterImage: currentVideo.thumbnailUrl || '/og.avif',
    });
  }
}, [currentVideo, authorName]);
```

**Fallback strategy:**
- Title: Use video title, fall back to "Video on diVine"
- Description: Use video content, fall back to generic description with author name
- Image: Use video thumbnail, fall back to `/og.avif`

#### 2. ProfilePage.tsx

**Data sources:**
- `authorData` from `useAuthor()` hook (already fetched at line 57)
- `metadata` already extracted at line 59
- `displayName` already computed at line 97

**Implementation:**
```typescript
import { useSeoMeta } from '@unhead/react';

// ... existing code ...

useEffect(() => {
  if (metadata || pubkey) {
    const name = displayName;
    const bio = metadata?.about || `${name}'s profile on diVine`;
    const avatar = metadata?.picture || '/app_icon.avif';

    useSeoMeta({
      title: `${name} - diVine`,
      description: bio,
      ogTitle: `${name} - diVine Profile`,
      ogDescription: bio,
      ogImage: avatar,
      ogType: 'profile',
      twitterCard: 'summary',
      twitterTitle: `${name} - diVine`,
      twitterDescription: bio,
      twitterImage: avatar,
    });
  }
}, [metadata, displayName, pubkey]);
```

**Fallback strategy:**
- Name: Use displayName (which already has fallback to generated name from pubkey)
- Bio: Use metadata.about, fall back to "${name}'s profile on diVine"
- Avatar: Use metadata.picture, fall back to `/app_icon.avif`

#### 3. HashtagPage.tsx

**Data sources:**
- `tag` from URL params (line 19)
- `normalizedTag` already computed (line 20)
- `videos` array from `useVideoEvents()` (line 26)
- `videoCount` already computed (line 84)

**Implementation:**
```typescript
import { useSeoMeta } from '@unhead/react';

// ... existing code ...

useEffect(() => {
  if (normalizedTag) {
    const count = videoCount;
    const description = count > 0
      ? `Browse ${count} video${count !== 1 ? 's' : ''} tagged with #${tag} on diVine`
      : `Explore videos tagged with #${tag} on diVine`;

    useSeoMeta({
      title: `#${tag} - diVine`,
      description: description,
      ogTitle: `#${tag} - diVine`,
      ogDescription: description,
      ogImage: '/og.avif',
      ogType: 'website',
      twitterCard: 'summary_large_image',
      twitterTitle: `#${tag} - diVine`,
      twitterDescription: description,
      twitterImage: '/og.avif',
    });
  }
}, [normalizedTag, videoCount, tag]);
```

**Fallback strategy:**
- Title: Always includes hashtag name
- Description: Shows video count if available, otherwise generic message
- Image: Use default `/og.avif` (hashtags don't have natural thumbnails)

### Error Handling

All three pages already have robust error states:
- VideoPage: Shows "Video not found" card if video doesn't exist
- ProfilePage: Shows "Invalid Profile" card if pubkey is invalid
- HashtagPage: Shows "Invalid Hashtag" card if tag is empty

The `useEffect` hooks only run when valid data exists, so no additional error handling is needed for meta tags. If a page errors out or data doesn't load, the static meta tags from index.html remain active as the correct fallback.

## Testing Strategy

### Manual Testing
1. Share a video link in Discord/Slack/Twitter - verify video thumbnail and title appear in preview
2. Share a profile link - verify user avatar and bio appear
3. Share a hashtag link - verify hashtag name and video count appear
4. Test with videos/profiles that have no thumbnails/avatars - verify fallbacks work (default images)

### Validation Tools
- Twitter Card Validator: https://cards-dev.twitter.com/validator
- Facebook Sharing Debugger: https://developers.facebook.com/tools/debug/
- Open Graph Preview: https://www.opengraph.xyz/

### Performance Testing
- Lighthouse audit before/after (should show no change in performance metrics)
- Verify no additional network requests are made
- Confirm page render is not blocked

## Implementation Checklist

- [ ] Add `useSeoMeta` import to VideoPage.tsx
- [ ] Add `useEffect` with SEO meta tags to VideoPage.tsx
- [ ] Add `useSeoMeta` import to ProfilePage.tsx
- [ ] Add `useEffect` with SEO meta tags to ProfilePage.tsx
- [ ] Add `useSeoMeta` import to HashtagPage.tsx
- [ ] Add `useEffect` with SEO meta tags to HashtagPage.tsx
- [ ] Test video link sharing on Twitter/Discord
- [ ] Test profile link sharing on Twitter/Discord
- [ ] Test hashtag link sharing on Twitter/Discord
- [ ] Validate with Twitter Card Validator
- [ ] Validate with Facebook Sharing Debugger
- [ ] Run Lighthouse audit to confirm no performance regression

## Future Enhancements (Out of Scope)

These are potential improvements but NOT part of this implementation:

1. **Hashtag thumbnail composites** - Generate composite images showing first few video thumbnails for hashtag pages
2. **Server-Side Rendering (SSR)** - Pre-render meta tags server-side for instant bot access (significant architectural change)
3. **Dynamic og:video tags** - Add `og:video` tags pointing to actual video files (may improve social media embedding)
4. **Image optimization** - Resize/optimize images specifically for social media preview dimensions

## Success Criteria

✅ Video links show video thumbnails and titles when shared
✅ Profile links show user avatars and bios when shared
✅ Hashtag links show hashtag names when shared
✅ No performance degradation (verified by Lighthouse)
✅ Fallbacks work correctly when data is missing
✅ Static meta tags remain as backup for error states
