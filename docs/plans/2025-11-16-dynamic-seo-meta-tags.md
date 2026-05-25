# Dynamic SEO Meta Tags Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add dynamic Open Graph and Twitter Card meta tags to VideoPage, ProfilePage, and HashtagPage for better social media sharing previews.

**Architecture:** Use existing `@unhead/react` infrastructure with `useSeoMeta()` hook inside `useEffect` to update meta tags when page data loads. Pattern matches Index.tsx and NotFound.tsx which already use this approach.

**Tech Stack:**
- @unhead/react (already installed v2.0.10)
- React useEffect hooks
- Existing data from useVideoNavigation(), useAuthor(), useVideoEvents()

---

## Task 1: Add Dynamic SEO to VideoPage

**Files:**
- Modify: `src/pages/VideoPage.tsx`

**Step 1: Add useSeoMeta import**

At the top of VideoPage.tsx (after line 1), add the import:

```typescript
import { useSeoMeta } from '@unhead/react';
```

**Step 2: Add useEffect for dynamic meta tags**

After the existing useEffect for keyboard navigation (after line 70), add:

```typescript
// Dynamic SEO meta tags for social sharing
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

**Step 3: Verify the change compiles**

Run: `npm run build`
Expected: Build succeeds with no errors

**Step 4: Test in browser**

Run: `npm run dev`
1. Navigate to a video page (e.g., `/video/some-id`)
2. Open browser DevTools
3. Inspect `<head>` section
4. Verify meta tags update when video data loads

Expected: See `<meta property="og:title">` and other tags with video-specific data

**Step 5: Commit**

```bash
git add src/pages/VideoPage.tsx
git commit -m "feat: add dynamic SEO meta tags to VideoPage

Add Open Graph and Twitter Card meta tags that update when video data
loads. Uses video title, content, and thumbnail for social sharing
previews.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2: Add Dynamic SEO to ProfilePage

**Files:**
- Modify: `src/pages/ProfilePage.tsx`

**Step 1: Add useSeoMeta import**

At the top of ProfilePage.tsx (after existing imports, around line 1), add:

```typescript
import { useSeoMeta } from '@unhead/react';
```

**Step 2: Add useEffect for dynamic meta tags**

After the ProfilePage function starts (around line 23, after the state declarations), add:

```typescript
// Dynamic SEO meta tags for social sharing
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

**Note:** This useEffect should be placed after the variable declarations but before the early returns for error states.

**Step 3: Verify the change compiles**

Run: `npm run build`
Expected: Build succeeds with no errors

**Step 4: Test in browser**

Run: `npm run dev`
1. Navigate to a profile page (e.g., `/profile/npub1...`)
2. Open browser DevTools
3. Inspect `<head>` section
4. Verify meta tags update when profile data loads

Expected: See `<meta property="og:title">` with username, `<meta property="og:image">` with avatar

**Step 5: Commit**

```bash
git add src/pages/ProfilePage.tsx
git commit -m "feat: add dynamic SEO meta tags to ProfilePage

Add Open Graph and Twitter Card meta tags that update when profile data
loads. Uses user's display name, bio, and avatar for social sharing
previews.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3: Add Dynamic SEO to HashtagPage

**Files:**
- Modify: `src/pages/HashtagPage.tsx`

**Step 1: Add useSeoMeta import**

At the top of HashtagPage.tsx (after existing imports, around line 1), add:

```typescript
import { useSeoMeta } from '@unhead/react';
```

**Step 2: Add useEffect for dynamic meta tags**

After the HashtagPage function starts (around line 18, after the state declarations and console.log), add:

```typescript
// Dynamic SEO meta tags for social sharing
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

**Step 3: Verify the change compiles**

Run: `npm run build`
Expected: Build succeeds with no errors

**Step 4: Test in browser**

Run: `npm run dev`
1. Navigate to a hashtag page (e.g., `/hashtag/funny`)
2. Open browser DevTools
3. Inspect `<head>` section
4. Verify meta tags update with hashtag name and video count

Expected: See `<meta property="og:title">` with "#funny - diVine", description with video count

**Step 5: Commit**

```bash
git add src/pages/HashtagPage.tsx
git commit -m "feat: add dynamic SEO meta tags to HashtagPage

Add Open Graph and Twitter Card meta tags that update when hashtag data
loads. Uses hashtag name and video count for social sharing previews.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 4: Validate Social Media Previews

**Files:**
- None (manual validation)

**Step 1: Deploy to preview environment**

Run: `npm run deploy:cloudflare:preview`
Expected: Deployment succeeds, get preview URL

**Step 2: Validate video page with Twitter Card Validator**

1. Go to https://cards-dev.twitter.com/validator
2. Enter a video page URL from preview environment (e.g., `https://preview.divine.video/video/abc123`)
3. Click "Preview card"

Expected:
- Card shows video thumbnail (or default og.avif if no thumbnail)
- Card shows video title (or "Video on diVine" fallback)
- Card shows video description

**Step 3: Validate profile page with Facebook Sharing Debugger**

1. Go to https://developers.facebook.com/tools/debug/
2. Enter a profile page URL from preview environment (e.g., `https://preview.divine.video/profile/npub1...`)
3. Click "Debug"

Expected:
- Shows user's avatar (or app_icon.avif fallback)
- Shows user's display name in title
- Shows user's bio in description

**Step 4: Validate hashtag page with Open Graph Preview**

1. Go to https://www.opengraph.xyz/
2. Enter a hashtag page URL from preview environment (e.g., `https://preview.divine.video/hashtag/funny`)
3. View preview

Expected:
- Shows "#funny - diVine" as title
- Shows video count in description
- Shows default og.avif image

**Step 5: Test in Discord/Slack**

1. Copy a video page URL from preview
2. Paste into Discord or Slack
3. Wait for preview to load

Expected: Discord/Slack shows rich preview with video thumbnail and title

---

## Task 5: Run Tests and Final Build

**Files:**
- All modified files

**Step 1: Run TypeScript type checking**

Run: `tsc -p tsconfig.app.json --noEmit`
Expected: No type errors

**Step 2: Run linting**

Run: `npm run test` (includes eslint)
Expected: All tests pass, no linting errors

**Step 3: Build production bundle**

Run: `npm run build`
Expected: Build succeeds, creates dist/ folder

**Step 4: Verify bundle size**

Run: `ls -lh dist/assets/*.js | head -5`
Expected: Bundle sizes similar to before (no significant increase)

**Step 5: Final commit (if any cleanup needed)**

If any cleanup or adjustments were needed:
```bash
git add .
git commit -m "chore: cleanup after SEO meta tags implementation

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Testing Checklist

After implementation, verify:

- [ ] VideoPage shows video thumbnail in social previews
- [ ] VideoPage shows video title in social previews
- [ ] VideoPage falls back to default image when no thumbnail
- [ ] ProfilePage shows user avatar in social previews
- [ ] ProfilePage shows user bio in social previews
- [ ] ProfilePage falls back to app icon when no avatar
- [ ] HashtagPage shows hashtag name in social previews
- [ ] HashtagPage shows video count in description
- [ ] All pages compile without TypeScript errors
- [ ] All existing tests still pass
- [ ] No performance degradation (Lighthouse score similar)
- [ ] Twitter Card Validator shows correct previews
- [ ] Facebook Sharing Debugger shows correct previews
- [ ] Discord/Slack show rich previews when links are pasted

---

## Rollback Plan

If issues are discovered after deployment:

1. Revert commits:
   ```bash
   git revert HEAD~3..HEAD
   git push
   ```

2. Redeploy:
   ```bash
   npm run deploy:cloudflare
   ```

3. Investigate issue in separate branch before re-attempting

---

## Success Criteria

✅ All three page types (video, profile, hashtag) have dynamic SEO meta tags
✅ Social media platforms show rich previews with page-specific content
✅ Fallbacks work correctly when data is missing
✅ No performance regression
✅ All tests pass
✅ No TypeScript or linting errors
