# Open Graph / Twitter Card Link Previews — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make divine.video URLs render rich link previews (with thumbnails, titles, and inline video playback where supported) in Slack, Twitter/X, iMessage, Bluesky, Mastodon, Discord, Threads, Facebook, and LinkedIn.

**Architecture:** Edge worker (`compute-js/`) detects social media crawlers by User-Agent and serves a minimal HTML response with full Open Graph + Twitter Card metadata. Real users still get the SPA. We extract `buildCrawlerHtml`, `fetchVideoMetadata`, and a new `renderEmbedPage` into their own modules so they're independently testable. We add `og:video:*` + `twitter:card=player` for video pages, a new `/embed/:id` iframe-friendly route to back the player card, and new crawler handlers for routes that currently get only baseline OG (`/@username`, `/t/:tag`, `/search`, `/discovery[/:type]`, apex `/`).

**Tech Stack:** Fastly Compute@Edge (JS runtime), Vitest, NIP-71 video events from Funnelcake REST API.

**Spec:** [docs/superpowers/specs/2026-05-09-og-tags-link-previews-design.md](../specs/2026-05-09-og-tags-link-previews-design.md)

---

## File Structure

**New modules** (extracted from `compute-js/src/index.js` for testability):

| File | Responsibility |
| --- | --- |
| `compute-js/src/ogTags.js` | `buildCrawlerHtml(meta)` + helpers (`escapeHtml`, `cleanText`, `truncateText`) |
| `compute-js/src/videoMetadata.js` | `fetchVideoMetadata(videoId, target)` + `parseImetaTag(tag)` |
| `compute-js/src/embedPage.js` | `renderEmbedPage({ videoUrl, mime, poster, title })` → HTML for `/embed/:id` |
| `compute-js/src/crawlerHandlers.js` | `handleAtUsernameOg`, `handleHashtagOgTags`, `handleSearchOgTags`, `handleDiscoveryOgTags`, `handleApexOgTags` |

**New tests:**

| File | What it tests |
| --- | --- |
| `compute-js/src/ogTags.test.ts` | crawler HTML output: no meta-refresh, image dims, video block, player card |
| `compute-js/src/videoMetadata.test.ts` | imeta parsing: `url`, `m`, `dim`, `image-dim` |
| `compute-js/src/embedPage.test.ts` | embed iframe HTML: `<video>` attributes, CSP frame-ancestors |
| `compute-js/src/crawlerHandlers.test.ts` | each new handler happy path + funnelcake failure path |

**Modified:**

| File | Why |
| --- | --- |
| `compute-js/src/index.js` | Import from new modules, swap call sites, add `/embed/:id` route, register new crawler handlers in route table |

---

## Phase Map (PR boundaries)

- **PR 1 — Phase 1 (urgent fix):** Tasks 1–6. Removes meta-refresh, adds player card + og:video, image dims. This is what fixes Slack today.
- **PR 2 — Phases 2–6:** Tasks 7–17. `/embed/:id`, route coverage, prod validation.

Each task is self-contained with its own commit. Subagents executing this plan must respect file-edit ordering since most tasks touch `compute-js/src/index.js`.

---

## PR 1 — Crawler HTML fix

### Task 1: Extract `ogTags.js` module

**Files:**
- Create: `compute-js/src/ogTags.js`
- Modify: `compute-js/src/index.js` (remove the extracted functions, import them)

The current `buildCrawlerHtml`, `escapeHtml`, `cleanText`, and `truncateText` are inline at `compute-js/src/index.js:1086–1320`. Pulling them into a module makes them testable.

- [ ] **Step 1: Create `compute-js/src/ogTags.js` with the extracted code (no behavior change yet)**

```js
// ABOUTME: Open Graph + Twitter Card HTML for social media crawlers
// ABOUTME: Pure functions; no Fastly bindings; safe to unit-test in jsdom

export function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function cleanText(value) {
  return (value || '').replace(/\s+/g, ' ').trim();
}

export function truncateText(value, maxLength) {
  const trimmed = cleanText(value);
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength - 1).trimEnd()}…`;
}

export function buildCrawlerHtml({
  title,
  description,
  image,
  url,
  ogType,
  twitterCard = 'summary_large_image',
  twitterCreator = '',
  imageWidth = 1200,
  imageHeight = 630,
  siteName = 'Divine',
  video = null,
}) {
  const e = escapeHtml;
  const videoBlock = video ? `
  <meta property="og:video" content="${e(video.url)}" />
  <meta property="og:video:secure_url" content="${e(video.url)}" />
  <meta property="og:video:type" content="${e(video.type || 'video/mp4')}" />
  <meta property="og:video:width" content="${Number(video.width) || 720}" />
  <meta property="og:video:height" content="${Number(video.height) || 1280}" />
  ${video.embedUrl ? `<meta name="twitter:player" content="${e(video.embedUrl)}" />
  <meta name="twitter:player:width" content="${Number(video.width) || 720}" />
  <meta name="twitter:player:height" content="${Number(video.height) || 1280}" />
  <meta name="twitter:player:stream" content="${e(video.url)}" />
  <meta name="twitter:player:stream:content_type" content="${e(video.type || 'video/mp4')}" />` : ''}` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${e(title)}</title>

  <meta property="og:type" content="${e(ogType)}" />
  <meta property="og:title" content="${e(title)}" />
  <meta property="og:description" content="${e(description)}" />
  <meta property="og:image" content="${e(image)}" />
  <meta property="og:image:width" content="${Number(imageWidth) || 1200}" />
  <meta property="og:image:height" content="${Number(imageHeight) || 630}" />
  <meta property="og:url" content="${e(url)}" />
  <meta property="og:site_name" content="${e(siteName)}" />
${videoBlock}
  <meta name="twitter:card" content="${e(twitterCard)}" />
  <meta name="twitter:title" content="${e(title)}" />
  <meta name="twitter:description" content="${e(description)}" />
  <meta name="twitter:image" content="${e(image)}" />
  ${twitterCreator ? `<meta name="twitter:creator" content="${e(twitterCreator)}" />` : ''}

  <link rel="canonical" href="${e(url)}" />
</head>
<body>
  <p><a href="${e(url)}">${e(title)}</a></p>
</body>
</html>`;
}
```

Note the deliberate changes vs. the existing implementation:
- **Removed `<meta http-equiv="refresh">`.** This is the bug.
- Added `og:image:width` / `og:image:height`.
- Added optional `video` block with `og:video:*` and `twitter:player:*`.
- Replaced `<p>Redirecting to...</p>` body with a plain link (Slack/Twitter never read body, but if a real browser hits a stale crawler-cached HTML the link still works).

- [ ] **Step 2: Replace usages in `compute-js/src/index.js`**

At the top of `index.js` add:
```js
import { buildCrawlerHtml, escapeHtml, cleanText, truncateText } from './ogTags.js';
```
Then delete the inline copies of these four functions at lines ~1086–1320. Leave all call sites untouched — the new function takes the same arguments.

- [ ] **Step 3: Build the worker to verify no syntax errors**

```bash
cd compute-js && npm run build
```

Expected: succeeds, writes `compute-js/bin/main.wasm`.

- [ ] **Step 4: Commit**

```bash
git add compute-js/src/ogTags.js compute-js/src/index.js
git commit -m "refactor(compute-js): extract ogTags helpers into their own module"
```

---

### Task 2: Unit-test `buildCrawlerHtml` (TDD for behavior we're about to add)

**Files:**
- Create: `compute-js/src/ogTags.test.ts`

Write the assertions FIRST for the behavior changes we just made. Tests should pass against the code from Task 1.

- [ ] **Step 1: Write the test file**

```ts
import { describe, expect, it } from 'vitest';
import { buildCrawlerHtml, escapeHtml, truncateText } from './ogTags.js';

const baseArgs = {
  title: 'Hello',
  description: 'A description',
  image: 'https://example.com/img.jpg',
  url: 'https://example.com/page',
  ogType: 'website',
};

describe('buildCrawlerHtml', () => {
  it('does NOT emit a meta http-equiv refresh tag (breaks Slack unfurls)', () => {
    const html = buildCrawlerHtml(baseArgs);
    expect(html).not.toMatch(/http-equiv\s*=\s*"refresh"/i);
  });

  it('emits og:image:width and og:image:height defaults', () => {
    const html = buildCrawlerHtml(baseArgs);
    expect(html).toContain('<meta property="og:image:width" content="1200"');
    expect(html).toContain('<meta property="og:image:height" content="630"');
  });

  it('respects custom image dimensions', () => {
    const html = buildCrawlerHtml({ ...baseArgs, imageWidth: 720, imageHeight: 1280 });
    expect(html).toContain('content="720"');
    expect(html).toContain('content="1280"');
  });

  it('omits og:video block when no video is provided', () => {
    const html = buildCrawlerHtml(baseArgs);
    expect(html).not.toContain('og:video');
    expect(html).not.toContain('twitter:player');
  });

  it('emits the og:video block when video is provided', () => {
    const html = buildCrawlerHtml({
      ...baseArgs,
      ogType: 'video.other',
      twitterCard: 'player',
      video: {
        url: 'https://media.divine.video/abc.mp4',
        type: 'video/mp4',
        width: 720,
        height: 1280,
        embedUrl: 'https://divine.video/embed/abc',
      },
    });
    expect(html).toContain('<meta property="og:video" content="https://media.divine.video/abc.mp4"');
    expect(html).toContain('<meta property="og:video:secure_url"');
    expect(html).toContain('<meta property="og:video:type" content="video/mp4"');
    expect(html).toContain('<meta property="og:video:width" content="720"');
    expect(html).toContain('<meta property="og:video:height" content="1280"');
    expect(html).toContain('<meta name="twitter:card" content="player"');
    expect(html).toContain('<meta name="twitter:player" content="https://divine.video/embed/abc"');
    expect(html).toContain('<meta name="twitter:player:width" content="720"');
    expect(html).toContain('<meta name="twitter:player:height" content="1280"');
    expect(html).toContain('<meta name="twitter:player:stream" content="https://media.divine.video/abc.mp4"');
    expect(html).toContain('<meta name="twitter:player:stream:content_type" content="video/mp4"');
  });

  it('falls back to twitter:card=summary_large_image by default', () => {
    const html = buildCrawlerHtml(baseArgs);
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image"');
  });

  it('escapes HTML in user-supplied fields', () => {
    const html = buildCrawlerHtml({ ...baseArgs, title: '<script>alert(1)</script>' });
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('emits canonical link', () => {
    const html = buildCrawlerHtml(baseArgs);
    expect(html).toContain('<link rel="canonical" href="https://example.com/page"');
  });
});

describe('escapeHtml', () => {
  it('escapes the five HTML special characters', () => {
    expect(escapeHtml(`<>&"'`)).toBe('&lt;&gt;&amp;&quot;&#039;');
  });
  it('returns empty string for null/undefined', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });
});

describe('truncateText', () => {
  it('returns short input unchanged', () => {
    expect(truncateText('hi there', 80)).toBe('hi there');
  });
  it('truncates long input with ellipsis', () => {
    const long = 'a'.repeat(100);
    const result = truncateText(long, 20);
    expect(result.length).toBeLessThanOrEqual(20);
    expect(result.endsWith('…')).toBe(true);
  });
});
```

- [ ] **Step 2: Run the tests**

```bash
npx vitest run compute-js/src/ogTags.test.ts
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add compute-js/src/ogTags.test.ts
git commit -m "test(compute-js): cover buildCrawlerHtml refresh removal + video block"
```

---

### Task 3: Wire video block into `handleVideoOgTags`

**Files:**
- Modify: `compute-js/src/index.js` (the `handleVideoOgTags` function around line 1128)

Currently it builds a card with `twitterCard: 'summary_large_image'` and no video block. We pass through video metadata if available. Until Task 5 lands, `videoMeta` won't have `videoUrl` — so this task gates the new branch on `videoMeta?.videoUrl`. That keeps Phase 1 shippable on its own.

- [ ] **Step 1: Update `handleVideoOgTags`**

Find this in `compute-js/src/index.js` (around line 1138–1154):

```js
const title = videoMeta?.title || 'Video on Divine';
const description = videoMeta?.description || `Watch this video on Divine. ${DEFAULT_SITE_DESCRIPTION}`;
const thumbnail = videoMeta?.thumbnail || DEFAULT_OG_IMAGE;
const authorName = videoMeta?.authorName || '';
const videoUrl = `https://divine.video/video/${videoId}`;

console.log('Generating OG HTML for video:', videoId, 'title:', title);
const html = buildCrawlerHtml({
  title,
  description,
  image: thumbnail,
  url: videoUrl,
  ogType: 'video.other',
  twitterCard: 'summary_large_image',
  twitterCreator: authorName,
});
```

Replace with:

```js
const title = videoMeta?.title || 'Video on Divine';
const description = videoMeta?.description || `Watch this video on Divine. ${DEFAULT_SITE_DESCRIPTION}`;
const thumbnail = videoMeta?.thumbnail || DEFAULT_OG_IMAGE;
const authorName = videoMeta?.authorName || '';
const pageUrl = `https://divine.video/video/${videoId}`;

const hasPlayableVideo = Boolean(videoMeta?.videoUrl);
const videoBlock = hasPlayableVideo ? {
  url: videoMeta.videoUrl,
  type: videoMeta.videoMime || 'video/mp4',
  width: videoMeta.videoWidth || 720,
  height: videoMeta.videoHeight || 1280,
  embedUrl: `https://divine.video/embed/${videoId}`,
} : null;

console.log('Generating OG HTML for video:', videoId, 'title:', title, 'player:', hasPlayableVideo);
const html = buildCrawlerHtml({
  title,
  description,
  image: thumbnail,
  url: pageUrl,
  ogType: 'video.other',
  twitterCard: hasPlayableVideo ? 'player' : 'summary_large_image',
  twitterCreator: authorName,
  imageWidth: videoMeta?.imageWidth || 1200,
  imageHeight: videoMeta?.imageHeight || 630,
  video: videoBlock,
});
```

- [ ] **Step 2: Build to confirm syntax**

```bash
cd compute-js && npm run build
```

Expected: succeeds.

- [ ] **Step 3: Commit**

```bash
git add compute-js/src/index.js
git commit -m "feat(compute-js): wire og:video + twitter:player into video page OG tags"
```

---

### Task 4: PR 1 — open the PR

- [ ] **Step 1: Push branch and open PR**

```bash
git push -u origin HEAD
gh pr create --title "feat(og): fix Slack/Twitter unfurls + add og:video tags" --body "$(cat <<'EOF'
## Summary
- Removes the `<meta http-equiv="refresh">` from `buildCrawlerHtml()` — this is the root cause of Slack rendering bare blue links instead of preview cards
- Adds `og:image:width` / `og:image:height` so Slack/Facebook render the large card variant
- Adds `og:video:*` and `twitter:card="player"` (with `twitter:player:*` and `twitter:player:stream:*`) for video pages — enables inline playback in Slack and Twitter
- Extracts `buildCrawlerHtml`, `escapeHtml`, `cleanText`, `truncateText` into `compute-js/src/ogTags.js` for testability
- Adds unit test coverage for the new tag output

## Test plan
- [ ] `npx vitest run compute-js/src/ogTags.test.ts` passes
- [ ] After deploy: `curl -A "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)" -i https://divine.video/video/<id>?v=2` shows the new tags and no meta-refresh
- [ ] Paste a fresh `?v=2` URL into Slack and confirm the unfurl renders with thumbnail
- [ ] Facebook Sharing Debugger (https://developers.facebook.com/tools/debug/) shows the new tags

The `twitter:player` URL points to `/embed/:id`, which doesn't exist yet — that ships in PR 2. Slack falls back to thumbnail card in the meantime, which is still the correct behavior pre-embed.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 2: Verify CI passes, then merge**

After CI is green and review approved:
```bash
gh pr merge --squash
```

- [ ] **Step 3: Deploy**

```bash
npm run fastly:deploy && npm run fastly:publish
```

Wait ~60s, then verify:
```bash
curl -A "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)" -i \
  "https://divine.video/video/e6afed733c4b1e59fd5d62a744ca1d0d2db618e7a11ed405fda80b9440401631?v=2" \
  | grep -E 'og:|twitter:|http-equiv'
```

Expected: no `http-equiv`, `og:image:width=1200`, no `og:video` yet (because `videoUrl` extraction lands in PR 2). If the unfurl renders even without inline video, PR 1 succeeded.

---

## PR 2 — Coverage + embed route

### Task 5: Extract `videoMetadata.js` + parse all `imeta` fields

**Files:**
- Create: `compute-js/src/videoMetadata.js`
- Create: `compute-js/src/videoMetadata.test.ts`
- Modify: `compute-js/src/index.js`

The existing `fetchVideoMetadata` parses the imeta tag but discards everything except `image`. We need `url`, `m`, `dim` (`"720x1280"`), and `image-dim`.

- [ ] **Step 1: Write the failing test for `parseImetaTag`**

`compute-js/src/videoMetadata.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parseImetaTag, transformVideoApiResponse } from './videoMetadata.js';

describe('parseImetaTag', () => {
  it('returns empty object when tag is null or not an imeta tag', () => {
    expect(parseImetaTag(null)).toEqual({});
    expect(parseImetaTag(['t', 'foo'])).toEqual({});
  });

  it('parses url, mime, dim, and image-dim', () => {
    const tag = ['imeta',
      'url https://media.example/video.mp4',
      'm video/mp4',
      'image https://media.example/thumb.jpg',
      'dim 720x1280',
      'image-dim 1280x720'];
    expect(parseImetaTag(tag)).toEqual({
      url: 'https://media.example/video.mp4',
      m: 'video/mp4',
      image: 'https://media.example/thumb.jpg',
      dim: '720x1280',
      'image-dim': '1280x720',
    });
  });

  it('handles values that contain spaces (joined back together)', () => {
    const tag = ['imeta', 'alt A long alt text with spaces'];
    expect(parseImetaTag(tag)).toEqual({ alt: 'A long alt text with spaces' });
  });

  it('skips entries without a value', () => {
    const tag = ['imeta', 'url', 'm video/mp4'];
    expect(parseImetaTag(tag)).toEqual({ m: 'video/mp4' });
  });
});

describe('transformVideoApiResponse', () => {
  const baseEvent = {
    id: 'abc',
    pubkey: 'def',
    kind: 34236,
    content: 'hello',
    tags: [],
  };

  it('returns null when there is no event', () => {
    expect(transformVideoApiResponse({})).toBeNull();
    expect(transformVideoApiResponse({ event: null })).toBeNull();
  });

  it('extracts videoUrl, mime, and dimensions from imeta', () => {
    const result = transformVideoApiResponse({
      event: {
        ...baseEvent,
        tags: [
          ['title', 'My Video'],
          ['imeta',
            'url https://media.example/video.mp4',
            'm video/mp4',
            'image https://media.example/thumb.jpg',
            'dim 720x1280'],
        ],
      },
      stats: {},
    });
    expect(result?.videoUrl).toBe('https://media.example/video.mp4');
    expect(result?.videoMime).toBe('video/mp4');
    expect(result?.videoWidth).toBe(720);
    expect(result?.videoHeight).toBe(1280);
    expect(result?.thumbnail).toBe('https://media.example/thumb.jpg');
    expect(result?.imageWidth).toBe(720);
    expect(result?.imageHeight).toBe(1280);
  });

  it('uses image-dim for image dimensions when present', () => {
    const result = transformVideoApiResponse({
      event: {
        ...baseEvent,
        tags: [
          ['imeta',
            'url https://media.example/video.mp4',
            'image https://media.example/thumb.jpg',
            'dim 720x1280',
            'image-dim 1200x630'],
        ],
      },
      stats: {},
    });
    expect(result?.imageWidth).toBe(1200);
    expect(result?.imageHeight).toBe(630);
  });

  it('returns sensible defaults when imeta is missing', () => {
    const result = transformVideoApiResponse({
      event: { ...baseEvent, tags: [['title', 'No imeta']] },
      stats: {},
    });
    expect(result?.videoUrl).toBeNull();
    expect(result?.videoMime).toBeNull();
    expect(result?.videoWidth).toBeNull();
    expect(result?.videoHeight).toBeNull();
    expect(result?.title).toBe('No imeta');
  });
});
```

- [ ] **Step 2: Run the test (expect failure: module not found)**

```bash
npx vitest run compute-js/src/videoMetadata.test.ts
```

Expected: fail with "Cannot find module './videoMetadata.js'".

- [ ] **Step 3: Create `compute-js/src/videoMetadata.js`**

```js
// ABOUTME: Funnelcake video event → OG-friendly metadata transformer
// ABOUTME: Pure transform + a thin Fastly-aware fetch wrapper

import { cleanText, truncateText } from './ogTags.js';

export function parseImetaTag(tag) {
  if (!Array.isArray(tag) || tag[0] !== 'imeta') return {};
  const out = {};
  for (let i = 1; i < tag.length; i++) {
    const entry = tag[i];
    if (typeof entry !== 'string') continue;
    const space = entry.indexOf(' ');
    if (space === -1) continue;
    const key = entry.slice(0, space);
    const value = entry.slice(space + 1);
    if (!key || !value) continue;
    out[key] = value;
  }
  return out;
}

function parseDim(dim) {
  if (typeof dim !== 'string') return [null, null];
  const m = dim.match(/^(\d+)x(\d+)$/i);
  if (!m) return [null, null];
  return [Number(m[1]), Number(m[2])];
}

export function transformVideoApiResponse(result, { defaultOgImage = null } = {}) {
  if (!result?.event) return null;
  const event = result.event;
  const stats = result.stats || {};
  const getTag = (name) => event.tags?.find((t) => t[0] === name)?.[1];

  const imetaTag = event.tags?.find((t) => t[0] === 'imeta');
  const imeta = parseImetaTag(imetaTag);

  const [videoWidth, videoHeight] = parseDim(imeta.dim);
  const [imageW, imageH] = imeta['image-dim']
    ? parseDim(imeta['image-dim'])
    : parseDim(imeta.dim);

  const summary = cleanText(getTag('summary'));
  const alt = cleanText(getTag('alt'));
  const content = cleanText(event.content);
  const title = cleanText(getTag('title')) || alt || summary || truncateText(content, 80) || null;

  const statsList = [];
  if (stats.reactions > 0) statsList.push(`${stats.reactions} ❤️`);
  if (stats.comments > 0) statsList.push(`${stats.comments} 💬`);
  if (stats.reposts > 0) statsList.push(`${stats.reposts} 🔁`);

  let description;
  if (content) description = content;
  else if (summary) description = summary;
  else if (alt) description = alt;
  else if (statsList.length > 0) description = `${statsList.join(' • ')} on Divine`;
  else description = 'Watch this short video on Divine';

  return {
    title: title || 'Video on Divine',
    description,
    thumbnail: imeta.image || defaultOgImage,
    authorName: cleanText(getTag('author')) || cleanText(stats.author_name) || '',
    reactions: stats.reactions || 0,
    comments: stats.comments || 0,
    videoUrl: imeta.url || null,
    videoMime: imeta.m || null,
    videoWidth: videoWidth || null,
    videoHeight: videoHeight || null,
    imageWidth: imageW || null,
    imageHeight: imageH || null,
  };
}
```

- [ ] **Step 4: Re-run the test**

```bash
npx vitest run compute-js/src/videoMetadata.test.ts
```

Expected: all pass.

- [ ] **Step 5: Replace usages in `compute-js/src/index.js`**

Find `fetchVideoMetadata` (around line 978). Replace its body with a thin wrapper that delegates parsing:

```js
import { transformVideoApiResponse } from './videoMetadata.js';

async function fetchVideoMetadata(videoId, funnelcakeTarget = getFunnelcakeOriginForApiHost()) {
  try {
    const response = await fetchFromFunnelcake(funnelcakeTarget, `/api/videos/${videoId}`);
    if (!response.ok) {
      console.log('Funnelcake API returned:', response.status);
      return null;
    }
    const result = await response.json();
    const meta = transformVideoApiResponse(result, { defaultOgImage: DEFAULT_OG_IMAGE });
    if (meta) {
      console.log('Fetched video metadata - title:', meta.title, 'videoUrl:', meta.videoUrl);
    }
    return meta;
  } catch (err) {
    console.error('Failed to fetch video metadata:', err.message);
    return null;
  }
}
```

The `videoUrl`, `videoMime`, `videoWidth`, `videoHeight`, `imageWidth`, `imageHeight` fields now flow through to `handleVideoOgTags` (which already reads them — Task 3).

- [ ] **Step 6: Build + run all tests**

```bash
cd compute-js && npm run build && cd ..
npx vitest run compute-js/src/
```

Expected: build succeeds, all tests pass.

- [ ] **Step 7: Commit**

```bash
git add compute-js/src/videoMetadata.js compute-js/src/videoMetadata.test.ts compute-js/src/index.js
git commit -m "feat(compute-js): extract videoUrl + dimensions from imeta for og:video"
```

---

### Task 6: Build the `/embed/:id` route

**Files:**
- Create: `compute-js/src/embedPage.js`
- Create: `compute-js/src/embedPage.test.ts`
- Modify: `compute-js/src/index.js` (add route handler before crawler check)

The embed page is a tiny HTML doc with an autoplaying looping `<video>`, designed to be iframed by Slack/Twitter when they show the player card. It's served to all clients (not crawler-gated) so a human pasting the embed URL also sees a video.

- [ ] **Step 1: Write the failing test**

`compute-js/src/embedPage.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { renderEmbedPage } from './embedPage.js';

describe('renderEmbedPage', () => {
  it('renders a <video> with autoplay loop muted playsinline', () => {
    const html = renderEmbedPage({
      videoUrl: 'https://media.divine.video/x.mp4',
      mime: 'video/mp4',
      poster: 'https://media.divine.video/x.jpg',
      title: 'My Video',
    });
    expect(html).toContain('<video');
    expect(html).toContain('autoplay');
    expect(html).toContain('loop');
    expect(html).toContain('muted');
    expect(html).toContain('playsinline');
    expect(html).toContain('src="https://media.divine.video/x.mp4"');
    expect(html).toContain('type="video/mp4"');
    expect(html).toContain('poster="https://media.divine.video/x.jpg"');
  });

  it('escapes HTML in title and URLs', () => {
    const html = renderEmbedPage({
      videoUrl: 'https://media.divine.video/x.mp4?a="><script>',
      mime: 'video/mp4',
      poster: '',
      title: '<script>alert(1)</script>',
    });
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).not.toContain(`?a="><script>`);
  });

  it('renders a fallback message when no videoUrl is given', () => {
    const html = renderEmbedPage({ videoUrl: null, mime: null, poster: null, title: 'X' });
    expect(html).not.toContain('<video');
    expect(html).toMatch(/video unavailable/i);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run compute-js/src/embedPage.test.ts
```

Expected: fail (module not found).

- [ ] **Step 3: Create `compute-js/src/embedPage.js`**

```js
// ABOUTME: Minimal /embed/:id HTML for iframed players (Slack, Twitter)
// ABOUTME: No JS bundles, no analytics — just an autoplaying loop

import { escapeHtml } from './ogTags.js';

export function renderEmbedPage({ videoUrl, mime, poster, title }) {
  const e = escapeHtml;
  const safeTitle = e(title || 'Video on Divine');

  if (!videoUrl) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${safeTitle}</title>
  <style>html,body{margin:0;height:100%;background:#000;color:#fff;font-family:system-ui;display:flex;align-items:center;justify-content:center}</style>
</head>
<body><p>Video unavailable</p></body>
</html>`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${safeTitle}</title>
  <style>
    html,body{margin:0;padding:0;height:100%;background:#000;overflow:hidden}
    video{width:100vw;height:100vh;object-fit:contain;display:block}
  </style>
</head>
<body>
  <video autoplay loop muted playsinline${poster ? ` poster="${e(poster)}"` : ''}>
    <source src="${e(videoUrl)}" type="${e(mime || 'video/mp4')}">
  </video>
</body>
</html>`;
}
```

- [ ] **Step 4: Re-run the test**

```bash
npx vitest run compute-js/src/embedPage.test.ts
```

Expected: all pass.

- [ ] **Step 5: Add `/embed/:id` route to `compute-js/src/index.js`**

Add this BEFORE the `isSocialMediaCrawler` block (around line 129). This way humans, crawlers, and iframe clients all hit the same handler. Imports go at the top with the others.

```js
import { renderEmbedPage } from './embedPage.js';

// (in handleRequest, before crawler-detection block)

if (url.pathname.startsWith('/embed/')) {
  const videoId = url.pathname.split('/embed/')[1]?.split('?')[0];
  if (videoId) {
    let videoMeta = null;
    try {
      videoMeta = await fetchVideoMetadata(videoId, funnelcakeTarget);
    } catch (e) {
      console.error('Embed: failed to fetch video metadata:', e.message);
    }
    const html = renderEmbedPage({
      videoUrl: videoMeta?.videoUrl,
      mime: videoMeta?.videoMime,
      poster: videoMeta?.thumbnail,
      title: videoMeta?.title,
    });
    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
        'Content-Security-Policy': 'frame-ancestors *',
        'X-Robots-Tag': 'noindex',
      },
    });
  }
}
```

Note: do NOT set `X-Frame-Options`. Twitter's `twitter:player` requires the embed to be iframable from any origin. `frame-ancestors *` in CSP is sufficient and modern browsers prefer it over `X-Frame-Options`.

- [ ] **Step 6: Build to confirm**

```bash
cd compute-js && npm run build
```

- [ ] **Step 7: Commit**

```bash
git add compute-js/src/embedPage.js compute-js/src/embedPage.test.ts compute-js/src/index.js
git commit -m "feat(compute-js): add /embed/:id route for twitter:player iframes"
```

---

### Task 7: Extract crawler handlers + add `/@username` OG

**Files:**
- Create: `compute-js/src/crawlerHandlers.js`
- Create: `compute-js/src/crawlerHandlers.test.ts`
- Modify: `compute-js/src/index.js`

This task creates the new module with the existing `handleVideoOgTags`, `handleProfileOgTags`, `handleCategoryOgTags` moved in (no behavior change), then adds `handleAtUsernameOg`. Subsequent tasks (8–11) add the remaining handlers.

- [ ] **Step 1: Move existing handlers to `compute-js/src/crawlerHandlers.js`**

Cut `handleVideoOgTags`, `handleProfileOgTags`, `handleCategoryOgTags`, `fetchProfileMetadata`, `fetchCategoriesMetadata`, `humanizeCategoryName`, `decodeNpubToHex`, `convertBits`, `hrpExpand`, `polymod`, `createChecksum` from `index.js` (and `hexToNpub` if not used elsewhere — check first; it's used in `handleSubdomainProfile` so leave it where it is or duplicate-export carefully).

Actually keep all the bech32 helpers in `index.js` since `handleSubdomainProfile` uses them. The new module imports `decodeNpubToHex` from `index.js` would create a circular import. Instead: move bech32 helpers into a new `compute-js/src/bech32.js` module that both files can import. **Sub-step:**

  1. Create `compute-js/src/bech32.js` with `hexToNpub`, `decodeNpubToHex`, `convertBits`, `hrpExpand`, `polymod`, `createChecksum`.
  2. `index.js` imports from `bech32.js`.
  3. `crawlerHandlers.js` imports from `bech32.js`.

- [ ] **Step 2: Add `handleAtUsernameOg` in `crawlerHandlers.js`**

```js
import { KVStore } from 'fastly:kv-store';
import { hexToNpub } from './bech32.js';
import { buildCrawlerHtml, cleanText } from './ogTags.js';

const DEFAULT_OG_IMAGE = 'https://divine.video/og.png';

export async function handleAtUsernameOg(username, url, funnelcakeTarget, fetchFromFunnelcake) {
  try {
    const namesStore = new KVStore('divine-names');
    const entry = await namesStore.get(`user:${username}`);
    if (!entry) return null;
    const userData = JSON.parse(await entry.text());
    if (userData.status !== 'active' || !userData.pubkey) return null;

    const npub = hexToNpub(userData.pubkey);
    let profile = {};
    let stats = {};
    try {
      const r = await fetchFromFunnelcake(funnelcakeTarget, `/api/users/${userData.pubkey}`);
      if (r.ok) {
        const data = await r.json();
        profile = data.profile || {};
        stats = data.stats || {};
      }
    } catch (e) {
      console.error('handleAtUsernameOg funnelcake error:', e.message);
    }

    const displayName = cleanText(profile.display_name) || cleanText(profile.name) || username;
    const about = cleanText(profile.about);
    const videoCount = typeof stats.video_count === 'number' ? stats.video_count : null;
    const description = about
      || (videoCount && videoCount > 0
        ? `Watch ${displayName}'s ${videoCount} videos on Divine.`
        : `Watch ${displayName}'s videos on Divine.`);

    const html = buildCrawlerHtml({
      title: `${displayName} on Divine`,
      description,
      image: cleanText(profile.picture) || DEFAULT_OG_IMAGE,
      url: `https://divine.video/@${username}`,
      ogType: 'profile',
      twitterCard: 'summary',
    });

    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
        'Vary': 'User-Agent',
      },
    });
  } catch (err) {
    console.error('handleAtUsernameOg error:', err.message);
    return null;
  }
}
```

- [ ] **Step 3: Wire into `handleRequest` in `index.js`**

In the apex `/@username` block (around line 96), within the crawler-detection branch, call `handleAtUsernameOg` first:

```js
if (atUsernameMatch) {
  const username = atUsernameMatch[1].toLowerCase();
  if (isSocialMediaCrawler(request)) {
    const og = await handleAtUsernameOg(username, url, funnelcakeTarget, fetchFromFunnelcake);
    if (og) return og;
  }
  // ... existing handleSubdomainProfile fallback
}
```

- [ ] **Step 4: Add unit test**

`compute-js/src/crawlerHandlers.test.ts`:

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('fastly:kv-store', () => {
  const store = new Map<string, unknown>();
  class KVStore {
    constructor() {}
    async get(key: string) {
      const val = store.get(key);
      if (!val) return null;
      return { text: async () => val };
    }
    static __seed(key: string, value: string) { store.set(key, value); }
    static __reset() { store.clear(); }
  }
  return { KVStore };
});

import { KVStore } from 'fastly:kv-store';
import { handleAtUsernameOg } from './crawlerHandlers.js';

describe('handleAtUsernameOg', () => {
  beforeEach(() => {
    (KVStore as any).__reset();
  });

  it('returns null when username is not in KV', async () => {
    const result = await handleAtUsernameOg('nobody', new URL('https://divine.video/@nobody'), null, async () => ({ ok: false }));
    expect(result).toBeNull();
  });

  it('returns OG HTML when username is active and funnelcake responds', async () => {
    (KVStore as any).__seed('user:alice', JSON.stringify({
      status: 'active',
      pubkey: '0'.repeat(64),
    }));
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        profile: { display_name: 'Alice', about: 'Hello', picture: 'https://x/y.jpg' },
        stats: { video_count: 5 },
      }),
    });
    const result = await handleAtUsernameOg('alice', new URL('https://divine.video/@alice'), null, fakeFetch as any);
    expect(result).not.toBeNull();
    const html = await result!.text();
    expect(html).toContain('Alice on Divine');
    expect(html).toContain('Hello');
    expect(html).toContain('https://x/y.jpg');
  });

  it('falls back to defaults when funnelcake fails', async () => {
    (KVStore as any).__seed('user:alice', JSON.stringify({
      status: 'active',
      pubkey: '0'.repeat(64),
    }));
    const fakeFetch = vi.fn().mockResolvedValue({ ok: false });
    const result = await handleAtUsernameOg('alice', new URL('https://divine.video/@alice'), null, fakeFetch as any);
    const html = await result!.text();
    expect(html).toContain('alice on Divine');
    expect(html).toContain(`Watch alice's videos on Divine.`);
  });
});
```

- [ ] **Step 5: Run tests + build**

```bash
npx vitest run compute-js/src/
cd compute-js && npm run build
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add compute-js/src/bech32.js compute-js/src/crawlerHandlers.js compute-js/src/crawlerHandlers.test.ts compute-js/src/index.js
git commit -m "feat(compute-js): add /@username crawler OG handler"
```

---

### Task 8: Add `handleHashtagOgTags` for `/t/:tag`

**Files:**
- Modify: `compute-js/src/crawlerHandlers.js`
- Modify: `compute-js/src/crawlerHandlers.test.ts`
- Modify: `compute-js/src/index.js`

Funnelcake exposes `GET /api/hashtags/{tag}` and `GET /api/videos?t={tag}&limit=1`. We use the latter to get a top video for the OG image.

- [ ] **Step 1: Write the failing test**

Add to `crawlerHandlers.test.ts`:

```ts
import { handleHashtagOgTags } from './crawlerHandlers.js';

describe('handleHashtagOgTags', () => {
  it('builds OG with the top video thumbnail when one is available', async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ videos: [{ thumbnail: 'https://x/thumb.jpg' }] }),
    });
    const result = await handleHashtagOgTags('cooking', null, fakeFetch as any);
    const html = await result!.text();
    expect(html).toContain('#cooking');
    expect(html).toContain('https://x/thumb.jpg');
    expect(html).toContain('https://divine.video/t/cooking');
  });

  it('falls back to default image when API fails', async () => {
    const fakeFetch = vi.fn().mockResolvedValue({ ok: false });
    const result = await handleHashtagOgTags('cooking', null, fakeFetch as any);
    const html = await result!.text();
    expect(html).toContain('#cooking');
    expect(html).toContain('https://divine.video/og.png');
  });

  it('rejects malformed tags', async () => {
    const result = await handleHashtagOgTags('', null, vi.fn() as any);
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test (fail)**

```bash
npx vitest run compute-js/src/crawlerHandlers.test.ts
```

Expected: fail.

- [ ] **Step 3: Implement `handleHashtagOgTags`**

In `crawlerHandlers.js`:

```js
export async function handleHashtagOgTags(tag, funnelcakeTarget, fetchFromFunnelcake) {
  try {
    const cleanTag = (tag || '').trim().replace(/^#/, '');
    if (!cleanTag) return null;

    let topThumbnail = null;
    try {
      const r = await fetchFromFunnelcake(funnelcakeTarget, `/api/videos?t=${encodeURIComponent(cleanTag)}&limit=1`);
      if (r.ok) {
        const data = await r.json();
        const top = data.videos?.[0];
        topThumbnail = top?.thumbnail || null;
      }
    } catch (e) {
      console.error('handleHashtagOgTags funnelcake error:', e.message);
    }

    const html = buildCrawlerHtml({
      title: `#${cleanTag} videos on Divine`,
      description: `Watch the latest #${cleanTag} videos on Divine.`,
      image: topThumbnail || DEFAULT_OG_IMAGE,
      url: `https://divine.video/t/${encodeURIComponent(cleanTag)}`,
      ogType: 'website',
      twitterCard: 'summary_large_image',
    });

    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
        'Vary': 'User-Agent',
      },
    });
  } catch (err) {
    console.error('handleHashtagOgTags error:', err.message);
    return null;
  }
}
```

- [ ] **Step 4: Wire route in `index.js`**

Inside the `if (isSocialMediaCrawler(request))` block, after the `/category` handler:

```js
if (url.pathname.startsWith('/t/')) {
  const tag = decodeURIComponent(url.pathname.slice(3).split('?')[0]);
  const og = await handleHashtagOgTags(tag, funnelcakeTarget, fetchFromFunnelcake);
  if (og) return og;
}
```

- [ ] **Step 5: Run tests + build**

```bash
npx vitest run compute-js/src/
cd compute-js && npm run build
```

- [ ] **Step 6: Commit**

```bash
git add compute-js/src/crawlerHandlers.js compute-js/src/crawlerHandlers.test.ts compute-js/src/index.js
git commit -m "feat(compute-js): add /t/:tag hashtag OG handler"
```

---

### Task 9: Add `handleSearchOgTags` for `/search`

**Files:**
- Modify: `compute-js/src/crawlerHandlers.js`
- Modify: `compute-js/src/crawlerHandlers.test.ts`
- Modify: `compute-js/src/index.js`

No funnelcake call — search results are too volatile and the bot rarely shares specific queries. Use a static template with the query echoed.

- [ ] **Step 1: Write the failing test**

```ts
import { handleSearchOgTags } from './crawlerHandlers.js';

describe('handleSearchOgTags', () => {
  it('echoes the search query in the title and description', () => {
    const result = handleSearchOgTags('skateboarding');
    expect(result).not.toBeNull();
    return result!.text().then((html) => {
      expect(html).toContain('"skateboarding"');
      expect(html).toContain('https://divine.video/search?q=skateboarding');
    });
  });

  it('escapes HTML in the query', async () => {
    const result = handleSearchOgTags('<script>');
    const html = await result!.text();
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('returns null for empty query', () => {
    expect(handleSearchOgTags('')).toBeNull();
    expect(handleSearchOgTags('   ')).toBeNull();
  });

  it('truncates very long queries', async () => {
    const result = handleSearchOgTags('x'.repeat(500));
    const html = await result!.text();
    expect(html).toContain('…');
  });
});
```

- [ ] **Step 2: Implement `handleSearchOgTags`**

```js
import { truncateText } from './ogTags.js';

export function handleSearchOgTags(query) {
  const trimmed = (query || '').trim();
  if (!trimmed) return null;
  const safe = truncateText(trimmed, 80);

  const html = buildCrawlerHtml({
    title: `"${safe}" on Divine`,
    description: `Search Divine for "${safe}" — watch loops, find creators, follow what you love.`,
    image: DEFAULT_OG_IMAGE,
    url: `https://divine.video/search?q=${encodeURIComponent(trimmed)}`,
    ogType: 'website',
    twitterCard: 'summary_large_image',
  });

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
      'Vary': 'User-Agent',
    },
  });
}
```

- [ ] **Step 3: Wire route**

```js
if (url.pathname === '/search') {
  const og = handleSearchOgTags(url.searchParams.get('q'));
  if (og) return og;
}
```

- [ ] **Step 4: Tests + build + commit**

```bash
npx vitest run compute-js/src/
cd compute-js && npm run build
git add compute-js/src/crawlerHandlers.js compute-js/src/crawlerHandlers.test.ts compute-js/src/index.js
git commit -m "feat(compute-js): add /search OG handler"
```

---

### Task 10: Add `handleDiscoveryOgTags` for `/discovery[/:type]`

**Files:**
- Modify: `compute-js/src/crawlerHandlers.js`
- Modify: `compute-js/src/crawlerHandlers.test.ts`
- Modify: `compute-js/src/index.js`

Reuse the existing `fetchFeedData` (line ~205 of `index.js`) by exporting/passing it. Top video's thumbnail becomes the OG image.

- [ ] **Step 1: Refactor `fetchFeedData` to be importable**

Cut `fetchFeedData` and `getDiscoveryFeedType` from `index.js`. Move into a new file `compute-js/src/feedData.js`. Update imports in both `index.js` and `crawlerHandlers.js`.

- [ ] **Step 2: Write tests**

```ts
import { handleDiscoveryOgTags } from './crawlerHandlers.js';

describe('handleDiscoveryOgTags', () => {
  it('builds OG for trending feed by default', async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ videos: [{ thumbnail: 'https://x/top.jpg' }] }),
    });
    const result = await handleDiscoveryOgTags('trending', null, fakeFetch as any);
    const html = await result!.text();
    expect(html).toContain('Trending');
    expect(html).toContain('https://x/top.jpg');
  });

  it('honors specific feed types', async () => {
    const fakeFetch = vi.fn().mockResolvedValue({ ok: false });
    const html = await (await handleDiscoveryOgTags('recent', null, fakeFetch as any))!.text();
    expect(html).toContain('Recent');
  });
});
```

- [ ] **Step 3: Implement**

```js
const FEED_TITLES = {
  trending: 'Trending videos',
  recent: 'Recent videos',
  popular: 'Popular videos',
  loops: 'Top loops',
};

export async function handleDiscoveryOgTags(feedType, funnelcakeTarget, fetchFromFunnelcake) {
  const type = FEED_TITLES[feedType] ? feedType : 'trending';
  let topThumbnail = null;
  try {
    const r = await fetchFromFunnelcake(funnelcakeTarget, `/api/videos?sort=${type}&limit=1`);
    if (r.ok) {
      const data = await r.json();
      topThumbnail = data.videos?.[0]?.thumbnail || null;
    }
  } catch (e) {
    console.error('handleDiscoveryOgTags funnelcake error:', e.message);
  }
  const label = FEED_TITLES[type];
  const html = buildCrawlerHtml({
    title: `${label} on Divine`,
    description: `${label} on Divine — 6-second loops from real humans.`,
    image: topThumbnail || DEFAULT_OG_IMAGE,
    url: type === 'trending' ? 'https://divine.video/discovery' : `https://divine.video/discovery/${type}`,
    ogType: 'website',
    twitterCard: 'summary_large_image',
  });
  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
      'Vary': 'User-Agent',
    },
  });
}
```

- [ ] **Step 4: Wire route**

```js
if (url.pathname === '/discovery' || url.pathname.startsWith('/discovery/')) {
  const type = url.pathname === '/discovery' ? 'trending' : url.pathname.slice('/discovery/'.length).split('?')[0];
  const og = await handleDiscoveryOgTags(type, funnelcakeTarget, fetchFromFunnelcake);
  if (og) return og;
}
```

- [ ] **Step 5: Tests + build + commit**

```bash
npx vitest run compute-js/src/
cd compute-js && npm run build
git add compute-js/src/feedData.js compute-js/src/crawlerHandlers.js compute-js/src/crawlerHandlers.test.ts compute-js/src/index.js
git commit -m "feat(compute-js): add /discovery[/:type] OG handler"
```

---

### Task 11: Add `handleApexOgTags` for `/`

**Files:**
- Modify: `compute-js/src/crawlerHandlers.js`
- Modify: `compute-js/src/crawlerHandlers.test.ts`
- Modify: `compute-js/src/index.js`

Same pattern as discovery, but with the Divine homepage hero copy. Hits the trending feed for a fresh OG image.

- [ ] **Step 1: Test**

```ts
import { handleApexOgTags } from './crawlerHandlers.js';

describe('handleApexOgTags', () => {
  it('builds homepage OG with top trending thumbnail', async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ videos: [{ thumbnail: 'https://x/hero.jpg' }] }),
    });
    const html = await (await handleApexOgTags(null, fakeFetch as any))!.text();
    expect(html).toContain('Divine');
    expect(html).toContain('https://x/hero.jpg');
    expect(html).toContain('https://divine.video/');
  });

  it('falls back to default image on API failure', async () => {
    const fakeFetch = vi.fn().mockResolvedValue({ ok: false });
    const html = await (await handleApexOgTags(null, fakeFetch as any))!.text();
    expect(html).toContain('https://divine.video/og.png');
  });
});
```

- [ ] **Step 2: Implement**

```js
export async function handleApexOgTags(funnelcakeTarget, fetchFromFunnelcake) {
  let topThumbnail = null;
  try {
    const r = await fetchFromFunnelcake(funnelcakeTarget, `/api/videos?sort=trending&limit=1`);
    if (r.ok) {
      const data = await r.json();
      topThumbnail = data.videos?.[0]?.thumbnail || null;
    }
  } catch (e) {
    console.error('handleApexOgTags funnelcake error:', e.message);
  }
  const html = buildCrawlerHtml({
    title: 'Divine — 6-second loops from real humans',
    description: 'Watch and share 6-second looping videos on the decentralized Nostr network.',
    image: topThumbnail || DEFAULT_OG_IMAGE,
    url: 'https://divine.video/',
    ogType: 'website',
    twitterCard: 'summary_large_image',
  });
  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
      'Vary': 'User-Agent',
    },
  });
}
```

- [ ] **Step 3: Wire**

In the apex landing block, before the existing feed-injection code:

```js
if ((url.pathname === '/' || url.pathname === '/index.html') && isApexDomain && isSocialMediaCrawler(request)) {
  const og = await handleApexOgTags(funnelcakeTarget, fetchFromFunnelcake);
  if (og) return og;
}
```

- [ ] **Step 4: Tests + build + commit**

```bash
npx vitest run compute-js/src/
cd compute-js && npm run build
git add compute-js/src/crawlerHandlers.js compute-js/src/crawlerHandlers.test.ts compute-js/src/index.js
git commit -m "feat(compute-js): add apex / OG handler with top trending thumbnail"
```

---

### Task 12: PR 2 — open the PR

- [ ] **Step 1: Push and open PR**

```bash
git push -u origin HEAD
gh pr create --title "feat(og): /embed/:id route + OG coverage for @username, hashtags, search, discovery, apex" --body "$(cat <<'EOF'
## Summary
- Adds `/embed/:id` route serving a minimal autoplaying-loop iframe for `twitter:player` (Slack inline player + Twitter player card)
- Extracts videoUrl, mime, dimensions from NIP-71 `imeta` so video pages now emit complete `og:video:*` and `twitter:player:*` blocks
- Adds crawler OG handlers for `/@username`, `/t/:tag`, `/search?q=`, `/discovery[/:type]`, and apex `/`
- Refactors helpers into focused modules: `ogTags.js`, `videoMetadata.js`, `embedPage.js`, `crawlerHandlers.js`, `bech32.js`, `feedData.js`

## Test plan
- [ ] All vitest unit tests pass (`npx vitest run compute-js/src/`)
- [ ] After deploy, curl-as-Slackbot returns OG HTML for: `/`, `/video/:id`, `/profile/:npub`, `/@username`, `/t/:tag`, `/search?q=foo`, `/discovery`, `/discovery/recent`
- [ ] `/embed/:id` returns video HTML with `Content-Security-Policy: frame-ancestors *`
- [ ] Slack unfurl on a video URL shows the inline player (not just the thumbnail)
- [ ] Facebook Sharing Debugger shows the new tags for each route

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 2: Merge after review + CI**

```bash
gh pr merge --squash
```

- [ ] **Step 3: Deploy**

```bash
npm run fastly:deploy && npm run fastly:publish
```

---

### Task 13: Production validation

After PR 2 ships, validate each route end-to-end. Pick a fresh video ID, profile, hashtag, etc. that have not been shared in Slack before so we don't fight the unfurl cache.

- [ ] **Step 1: Curl-as-Slackbot for every route**

```bash
UA="Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)"
for path in \
  "/" \
  "/video/<fresh-video-id>" \
  "/profile/<fresh-npub>" \
  "/@<fresh-username>" \
  "/t/cooking" \
  "/search?q=skateboarding" \
  "/discovery" \
  "/discovery/recent"; do
  echo "=== $path ==="
  curl -sA "$UA" "https://divine.video$path" | grep -E 'og:|twitter:|http-equiv' | head -20
  echo
done
```

Expected for each: og:title, og:image with width/height, twitter:card. NO `http-equiv="refresh"`. For `/video/:id` specifically: og:video, twitter:player, twitter:player:stream.

- [ ] **Step 2: Verify `/embed/:id` is iframable**

```bash
curl -sI "https://divine.video/embed/<id>" | grep -iE 'content-security|frame-options|content-type'
```

Expected: `content-security-policy: frame-ancestors *`, `content-type: text/html`, no `x-frame-options`.

- [ ] **Step 3: Facebook Sharing Debugger**

For each route, paste into https://developers.facebook.com/tools/debug/ and click "Scrape Again". Expected: rich preview with image, no errors.

- [ ] **Step 4: Slack post test**

Paste a fresh URL (or `?v=N` busted) into a private Slack channel. Expected: rich preview with thumbnail and (for video pages) inline player.

- [ ] **Step 5: Twitter/X test (optional)**

Paste a video URL into a Tweet draft. Expected: player card preview. NOTE: Twitter historically required allowlisting domains for player cards via the dev portal — if cards don't appear, document this and apply via developer.twitter.com.

- [ ] **Step 6: Update spec status**

If everything works, mark the spec as **Implemented** and link to the merged PRs:

```bash
# Edit docs/superpowers/specs/2026-05-09-og-tags-link-previews-design.md
# Change "Status: Approved for implementation" → "Status: Implemented (PR #X, #Y)"
git add docs/superpowers/specs/2026-05-09-og-tags-link-previews-design.md
git commit -m "docs: mark OG link preview spec as implemented"
git push
```

---

## Skills referenced

- @superpowers:test-driven-development — every task writes a failing test first.
- @superpowers:subagent-driven-development — orchestrates the parallel/sequential execution.
- @superpowers:verification-before-completion — Task 13 enforces evidence before claiming done.
- @superpowers:requesting-code-review — both PRs request a code review before merge.
