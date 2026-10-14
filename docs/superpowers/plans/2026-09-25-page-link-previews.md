# Page Link Previews Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every fixed public divine.video page previews as itself in any link-preview app, from one table that also drives browser tab titles and the sitemap.

**Architecture:** A TypeScript table (`src/seo/pageSeo.ts`) lists the 28 fixed pages. A shared head renderer (`src/seo/headTags.ts`) turns a resolved row into the full tag set. Build scripts load both through Vite SSR and write each page's tags into static `dist/<path>/index.html` files (plus `dist/sitemap.xml`), then self-check the output. In the browser, one router-level component sets tab titles from the same table. Duplicate per-page handlers on the Fastly edge and the Cloudflare function are deleted.

**Tech Stack:** React 18, Vite 6 (`ssrLoadModule`), Vitest 3 (jsdom), `@unhead/react` 2.1.16 with `InferSeoMetaPlugin`, i18next, Fastly Compute (JS), Cloudflare Pages Functions, bash (`verify-og-tags.sh`).

**Spec:** `docs/superpowers/specs/2026-09-24-page-link-previews-design.md`

## Global Constraints

- Work only in the worktree `/Users/mjb/code/divine-web/.claude/worktrees/726-page-link-previews` on branch `fix/726-page-link-previews`. Never `cd` to the main checkout.
- CI, deploy and preview run Node 20. Local `node` may be newer (it strips TypeScript natively), so every script change is re-run with `npx -y -p node@20 node <script>` before its task is done.
- No new dependencies.
- Canonical origin is exactly `https://divine.video`; site name is exactly `Divine`; preview images are 1200x630 `image/png`; default image is `/og.png`.
- Tab title rule: append `" - Divine"` unless the title already contains the word `Divine`. Preview titles never get the suffix.
- Descriptions are plain English, at most 200 characters. New copy uses "Divine" (never "diVine"/"DiVine"/"Divine Web") and no em dashes; existing copy is kept as written.
- Data-driven preview handlers (`/`, `/discovery`, `/category`, `/search`, videos, profiles, hashtags, `/@username`, vanity subdomains) are not changed.
- `/faq` keeps today's behaviour on both hosts (Fastly serves the prerendered page; Cloudflare redirects to about.divine.video).
- Commit format `type: description` (or `type(scope): description`); no co-author trailers. One commit per task.
- Brand guardrails stay green: `tests/brand/*`.

## Review Focus

1. **Trailing-slash URLs** (`/kids/`, which Cloudflare 308s to): must resolve to the same row, with a canonical that has no slash. Pinned in Task 2 (`findPageSeo`) and Task 5 (component).
2. **HTML-special characters in copy** (`DMCA & Copyright Policy`, `Can’t`, quotes): must be escaped in the HTML and compare equal after decoding. Pinned in Task 1 (round trip) and Task 3 (generated `/dmca` page).
3. **Non-English titles:** a translated title that already contains "Divine" (German `Bestenliste - Divine`) must not get a second suffix; one that doesn't must get it. Pinned in Task 2.
4. **Redirect edge cases:** `www.` host, query strings and the trailing-slash form of `/account-portability` must end at `/exit` on the apex with the query kept, in one hop after the www redirect. Pinned in Task 7.
5. **In-app navigation:** going from a table page to a page with no row must show the brand default title (not the previous page's), and a page that sets its own title must still win. Pinned in Task 5.

---

### Task 1: Shared head tag renderer

**Files:**
- Create: `src/seo/headTags.ts`
- Test: `src/seo/headTags.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `interface ResolvedPageHead { path: string; title: string; description: string; previewTitle: string; previewDescription: string; canonical: string; type: 'website' | 'article'; siteName: string; image: { url: string; width: number; height: number; type: string; alt: string }; lastModified?: string; prerenderedBy?: 'legal' | 'marketing' }`
  - `HEAD_TAG_KEYS: readonly HeadTagKey[]`, `type HeadTagKey`
  - `escapeHtml(value: unknown): string`, `decodeHtml(value: string): string`
  - `headTagValues(head: ResolvedPageHead): Record<HeadTagKey, string>`
  - `renderHeadTags(head: ResolvedPageHead, indent?: string): string`
  - `replaceHeadTags(html: string, head: ResolvedPageHead): string`
  - `readHeadTags(html: string): Map<HeadTagKey, string[]>`
  - `checkHeadTags(html: string, head: ResolvedPageHead): string[]`
  - `renderSitemap(entries: ReadonlyArray<{ loc: string; lastmod?: string }>): string`

- [ ] **Step 1: Set up the worktree**

Run from the worktree root:

```bash
npm ci
npx -y -p node@20 node --version
```

Expected: install succeeds; second command prints `v20.x`.

- [ ] **Step 2: Write the failing tests**

Create `src/seo/headTags.test.ts`:

```ts
// ABOUTME: Tests for the shared link-preview head renderer used by build scripts and tests
// ABOUTME: Covers rendering, stripping the homepage shell's tags, escaping, verification, and sitemap output

import { describe, expect, it } from 'vitest';

import {
  HEAD_TAG_KEYS,
  checkHeadTags,
  decodeHtml,
  escapeHtml,
  readHeadTags,
  renderHeadTags,
  renderSitemap,
  replaceHeadTags,
  type ResolvedPageHead,
} from './headTags';

const HEAD: ResolvedPageHead = {
  path: '/dmca',
  title: 'DMCA & Copyright Policy - Divine',
  description: 'What Divine can and can’t take down, and how to file a "counter-notice".',
  previewTitle: 'DMCA & Copyright Policy',
  previewDescription: 'What Divine can and can’t take down, and how to file a "counter-notice".',
  canonical: 'https://divine.video/dmca',
  type: 'website',
  siteName: 'Divine',
  image: { url: 'https://divine.video/og.png', width: 1200, height: 630, type: 'image/png', alt: 'DMCA & Copyright Policy' },
};

// Mirrors the tags index.html carries today, including ones the renderer must replace.
const SHELL = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'self'">
    <!-- No static canonical here -->
    <title>Divine Web - Short-form Looping Videos on Nostr</title>
    <meta name="description" content="Watch and share 6-second looping videos on the decentralized Nostr network." />
    <meta name="theme-color" content="#27C58B" />
    <meta name="apple-mobile-web-app-title" content="Divine" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="https://divine.video/" />
    <meta property="og:title" content="Divine Web - Short-form Looping Videos on Nostr" />
    <meta property="og:description" content="Watch and share 6-second looping videos on the decentralized Nostr network." />
    <meta property="og:image" content="https://divine.video/og.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="Divine Web - Short-form looping videos on the Nostr network" />
    <meta property="og:image:type" content="image/png" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="Divine Web - Short-form Looping Videos on Nostr" />
    <meta name="twitter:description" content="Watch and share 6-second looping videos on the decentralized Nostr network." />
    <meta name="twitter:image" content="https://divine.video/og.png" />
    <link rel="icon" type="image/png" sizes="72x72" href="/favicon.png" />
  </head>
  <body><div id="root"></div></body>
</html>
`;

describe('renderHeadTags', () => {
  it('emits every owned tag exactly once', () => {
    const html = `<html><head>${renderHeadTags(HEAD)}</head></html>`;
    const found = readHeadTags(html);
    for (const key of HEAD_TAG_KEYS) {
      expect(found.get(key), key).toHaveLength(1);
    }
  });

  it('escapes values so special characters survive the round trip', () => {
    const rendered = renderHeadTags(HEAD);
    expect(rendered).toContain('<title>DMCA &amp; Copyright Policy - Divine</title>');
    expect(rendered).toContain('&quot;counter-notice&quot;');
    expect(checkHeadTags(`<html><head>${rendered}</head></html>`, HEAD)).toEqual([]);
  });

  it('refuses to render an empty value', () => {
    expect(() => renderHeadTags({ ...HEAD, description: '' })).toThrow('/dmca: no value for head tag description');
  });
});

describe('replaceHeadTags', () => {
  it('replaces every homepage tag and keeps everything else', () => {
    const out = replaceHeadTags(SHELL, HEAD);
    expect(checkHeadTags(out, HEAD)).toEqual([]);
    expect(out).not.toContain('Divine Web');
    expect(out).toContain(`<meta http-equiv="Content-Security-Policy" content="default-src 'self'">`);
    expect(out).toContain('<meta name="theme-color" content="#27C58B" />');
    expect(out).toContain('<meta name="apple-mobile-web-app-title" content="Divine" />');
    expect(out).toContain('<link rel="icon" type="image/png" sizes="72x72" href="/favicon.png" />');
    expect(out).toContain('<body><div id="root"></div></body>');
  });

  it('is idempotent', () => {
    const once = replaceHeadTags(SHELL, HEAD);
    expect(replaceHeadTags(once, HEAD)).toBe(once);
  });

  it('throws when the source has no head', () => {
    expect(() => replaceHeadTags('<html><body></body></html>', HEAD)).toThrow('No <head>');
  });
});

describe('checkHeadTags', () => {
  it('reports a duplicated tag', () => {
    const out = replaceHeadTags(SHELL, HEAD).replace(
      '</head>',
      '<meta property="og:image:alt" content="extra"></head>',
    );
    expect(checkHeadTags(out, HEAD)).toContain('og:image:alt: expected 1 tag, found 2');
  });

  it('reports a wrong value', () => {
    const out = replaceHeadTags(SHELL, { ...HEAD, canonical: 'https://divine.video/' });
    expect(checkHeadTags(out, HEAD)).toContain(
      'og:url: expected "https://divine.video/dmca", found "https://divine.video/"',
    );
  });
});

describe('escapeHtml / decodeHtml', () => {
  it('round-trips quotes, ampersands, angle brackets and apostrophes', () => {
    const value = `Tom & Jerry's "<b>" — Can’t`;
    expect(decodeHtml(escapeHtml(value))).toBe(value);
  });
});

describe('renderSitemap', () => {
  it('lists each entry with an optional lastmod and nothing else', () => {
    const xml = renderSitemap([
      { loc: 'https://divine.video/' },
      { loc: 'https://divine.video/family', lastmod: '2026-07-22' },
    ]);
    expect(xml).toBe(
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
        '  <url>\n    <loc>https://divine.video/</loc>\n  </url>\n' +
        '  <url>\n    <loc>https://divine.video/family</loc>\n    <lastmod>2026-07-22</lastmod>\n  </url>\n' +
        '</urlset>\n',
    );
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run src/seo/headTags.test.ts`
Expected: FAIL, `Failed to resolve import "./headTags"`.

- [ ] **Step 4: Write the implementation**

Create `src/seo/headTags.ts`:

```ts
// ABOUTME: Renders, replaces, and verifies the link-preview head tags for one fixed page
// ABOUTME: Shared by the build prerender scripts (loaded through Vite SSR), the build self-check, and tests

export interface ResolvedPageHead {
  path: string;
  /** Browser tab title, with the " - Divine" suffix rule applied */
  title: string;
  description: string;
  /** og:title / twitter:title, never suffixed */
  previewTitle: string;
  previewDescription: string;
  canonical: string;
  type: 'website' | 'article';
  siteName: string;
  image: { url: string; width: number; height: number; type: string; alt: string };
  lastModified?: string;
  prerenderedBy?: 'legal' | 'marketing';
}

/** Every tag this module owns, in the order it emits them. */
export const HEAD_TAG_KEYS = [
  'title', 'description', 'canonical',
  'og:type', 'og:url', 'og:title', 'og:description',
  'og:image', 'og:image:width', 'og:image:height', 'og:image:type', 'og:image:alt',
  'og:site_name',
  'twitter:card', 'twitter:title', 'twitter:description', 'twitter:image',
] as const;

export type HeadTagKey = (typeof HEAD_TAG_KEYS)[number];

export function escapeHtml(value: unknown): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function decodeHtml(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;|&apos;/gi, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, '&'); // last, so "&amp;lt;" decodes to "&lt;", not "<"
}

/** The value each owned tag must carry for a resolved row. */
export function headTagValues(head: ResolvedPageHead): Record<HeadTagKey, string> {
  return {
    title: head.title,
    description: head.description,
    canonical: head.canonical,
    'og:type': head.type,
    'og:url': head.canonical,
    'og:title': head.previewTitle,
    'og:description': head.previewDescription,
    'og:image': head.image.url,
    'og:image:width': String(head.image.width),
    'og:image:height': String(head.image.height),
    'og:image:type': head.image.type,
    'og:image:alt': head.image.alt,
    'og:site_name': head.siteName,
    'twitter:card': 'summary_large_image',
    'twitter:title': head.previewTitle,
    'twitter:description': head.previewDescription,
    'twitter:image': head.image.url,
  };
}

function renderTag(key: HeadTagKey, value: string): string {
  const v = escapeHtml(value);
  if (key === 'title') return `<title>${v}</title>`;
  if (key === 'canonical') return `<link rel="canonical" href="${v}">`;
  if (key.startsWith('og:')) return `<meta property="${key}" content="${v}">`;
  return `<meta name="${key}" content="${v}">`;
}

export function renderHeadTags(head: ResolvedPageHead, indent = '    '): string {
  const values = headTagValues(head);
  for (const key of HEAD_TAG_KEYS) {
    if (typeof values[key] !== 'string' || values[key] === '') {
      throw new Error(`${head.path}: no value for head tag ${key}`);
    }
  }
  return HEAD_TAG_KEYS.map((key) => renderTag(key, values[key])).join(`\n${indent}`);
}

// <title>, description/og:*/twitter:* metas (name= or property=, any attribute
// order, either quote style), and the canonical link.
const OWNED_TAG = [
  String.raw`<title\b[^>]*>[\s\S]*?<\/title\s*>`,
  String.raw`<meta\b(?=[^>]*\s(?:name|property)\s*=\s*["'](?:description|og:[^"']*|twitter:[^"']*)["'])[^>]*>`,
  String.raw`<link\b(?=[^>]*\srel\s*=\s*["']canonical["'])[^>]*>`,
].join('|');

function splitHead(html: string): { before: string; head: string; after: string } {
  const open = html.search(/<head\b[^>]*>/i);
  const close = html.search(/<\/head\s*>/i);
  if (open === -1 || close === -1 || close < open) {
    throw new Error('No <head>...</head> in source HTML');
  }
  return { before: html.slice(0, open), head: html.slice(open, close), after: html.slice(close) };
}

/** Strips every owned tag from <head> and inserts the full set where the first one stood. */
export function replaceHeadTags(html: string, head: ResolvedPageHead): string {
  const { before, head: headHtml, after } = splitHead(html);
  let insertAt = -1;
  // Consume the tag's own line (indent + newline) so no blank lines are left behind.
  const stripped = headHtml.replace(
    new RegExp(String.raw`[ \t]*(?:${OWNED_TAG})[ \t]*\r?\n?`, 'gi'),
    (_match: string, offset: number) => {
      if (insertAt === -1) insertAt = offset; // text before the first match is untouched, so the offset holds
      return '';
    },
  );
  const at = insertAt === -1 ? stripped.length : insertAt;
  return `${before}${stripped.slice(0, at)}    ${renderHeadTags(head)}\n${stripped.slice(at)}${after}`;
}

function readAttr(attrs: string, name: string): string | null {
  const m = attrs.match(new RegExp(String.raw`(?:^|\s)${name}\s*=\s*(?:"([^"]*)"|'([^']*)')`, 'i'));
  return m ? (m[1] ?? m[2]) : null;
}

/** Decoded values of every owned tag in <head>, keyed by tag key (duplicates kept). */
export function readHeadTags(html: string): Map<HeadTagKey, string[]> {
  const { head } = splitHead(html);
  const found = new Map<HeadTagKey, string[]>(HEAD_TAG_KEYS.map((key) => [key, []]));
  for (const m of head.matchAll(/<title\b[^>]*>([\s\S]*?)<\/title\s*>|<(meta|link)\b([^>]*)>/gi)) {
    if (m[1] !== undefined) {
      found.get('title')!.push(decodeHtml(m[1].trim()));
    } else if (m[2].toLowerCase() === 'link') {
      if (readAttr(m[3], 'rel')?.toLowerCase() === 'canonical') {
        found.get('canonical')!.push(decodeHtml(readAttr(m[3], 'href') ?? ''));
      }
    } else {
      const key = (readAttr(m[3], 'property') ?? readAttr(m[3], 'name')) as HeadTagKey | null;
      if (key && found.has(key) && key !== 'title' && key !== 'canonical') {
        found.get(key)!.push(decodeHtml(readAttr(m[3], 'content') ?? ''));
      }
    }
  }
  return found;
}

/** Problems with one page's head; an empty array means exactly one of each tag, each with the row's value. */
export function checkHeadTags(html: string, head: ResolvedPageHead): string[] {
  const expected = headTagValues(head);
  const found = readHeadTags(html);
  const problems: string[] = [];
  for (const key of HEAD_TAG_KEYS) {
    const values = found.get(key)!;
    if (values.length !== 1) problems.push(`${key}: expected 1 tag, found ${values.length}`);
    else if (values[0] !== expected[key]) {
      problems.push(`${key}: expected ${JSON.stringify(expected[key])}, found ${JSON.stringify(values[0])}`);
    }
  }
  return problems;
}

/** sitemap.xml body; changefreq and priority are omitted (search engines ignore them). */
export function renderSitemap(entries: ReadonlyArray<{ loc: string; lastmod?: string }>): string {
  const urls = entries.map(({ loc, lastmod }) =>
    ['  <url>', `    <loc>${escapeHtml(loc)}</loc>`, ...(lastmod ? [`    <lastmod>${escapeHtml(lastmod)}</lastmod>`] : []), '  </url>'].join('\n'),
  );
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/seo/headTags.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 6: Mutation check**

In `OWNED_TAG`, change `og:[^"']*|` to `og:title|` and re-run the tests.
Expected: `replaceHeadTags › replaces every homepage tag` FAILS with duplicate `og:` tags. Revert the change, re-run, confirm PASS.

- [ ] **Step 7: Type-check and commit**

```bash
npx tsc -p tsconfig.app.json --noEmit
git add src/seo/headTags.ts src/seo/headTags.test.ts
git commit -m "feat(seo): add a shared renderer for page link-preview tags"
```

---

### Task 2: The page table and its resolver

**Files:**
- Create: `src/seo/pageSeo.ts`
- Test: `src/seo/pageSeo.test.ts`, `src/seo/pageRoutes.test.ts`

**Interfaces:**
- Consumes: `ResolvedPageHead` from `src/seo/headTags.ts`; `createI18nInstance(options: { languages?: readonly string[] })` from `@/lib/i18n` (returns an i18next instance).
- Produces:
  - `SITE_ORIGIN = 'https://divine.video'`, `SITE_NAME = 'Divine'`, `DEFAULT_IMAGE = '/og.png'`, `MARKETING_PUBLICATION_DATE = '2026-07-22'`
  - `BRAND_DEFAULT_TITLE`, `BRAND_DEFAULT_DESCRIPTION` (equal to `index.html`'s `<title>` and description)
  - `type SeoText = string | { key: string; ns?: string }`
  - `interface PageSeoRow { path; title: SeoText; description; previewTitle?; previewDescription?; image?; imageAlt?; type?; lastModified?; prerenderedBy? }`
  - `PAGE_SEO: readonly PageSeoRow[]`, `EXCLUDED_ROUTES: Readonly<Record<string, string>>`
  - `type Translate = (key: string, options?: { ns?: string }) => string`
  - `normalizePath(pathname: string): string`, `findPageSeo(pathname: string): PageSeoRow | undefined`
  - `withTitleSuffix(title: string): string`, `resolveText(text: SeoText, t: Translate): string`
  - `resolvePageSeo(row: PageSeoRow, t: Translate): ResolvedPageHead`
  - `resolveAllPageSeoForBuild(languages?: readonly string[]): Promise<ResolvedPageHead[]>`

- [ ] **Step 1: Write the failing table tests**

Create `src/seo/pageSeo.test.ts`:

```ts
// ABOUTME: Tests for the fixed-page link-preview table and its resolver
// ABOUTME: Guards copy limits, translation keys, images, the title suffix rule, and path matching

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

// Plain JS config in the Fastly package; typed as any (noImplicitAny is off), so no directive is needed.
import publishConfig from '../../compute-js/publish-content.config.js';
import {
  BRAND_DEFAULT_DESCRIPTION,
  BRAND_DEFAULT_TITLE,
  DEFAULT_IMAGE,
  PAGE_SEO,
  findPageSeo,
  normalizePath,
  resolveAllPageSeoForBuild,
  resolvePageSeo,
  withTitleSuffix,
  type Translate,
} from './pageSeo';

const LOCALES_DIR = join(process.cwd(), 'src/lib/i18n/locales/en');

// Read from disk: tsconfig.app.json type-checks src/ tests and has no resolveJsonModule.
function englishValue(key: string, ns = 'common'): unknown {
  const messages: unknown = JSON.parse(readFileSync(join(LOCALES_DIR, `${ns}.json`), 'utf8'));
  return key.split('.').reduce<unknown>(
    (value, segment) => (value && typeof value === 'object' ? (value as Record<string, unknown>)[segment] : undefined),
    messages,
  );
}

function pngSize(file: string): { width: number; height: number } {
  const bytes = readFileSync(file);
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

describe('PAGE_SEO', () => {
  it('lists 28 unique paths', () => {
    const paths = PAGE_SEO.map((row) => row.path);
    expect(paths).toHaveLength(28);
    expect(new Set(paths).size).toBe(28);
  });

  it('keeps descriptions between 1 and 200 characters', () => {
    for (const row of PAGE_SEO) {
      for (const text of [row.description, row.previewDescription].filter(Boolean) as string[]) {
        expect(text.length, row.path).toBeGreaterThan(0);
        expect(text.length, row.path).toBeLessThanOrEqual(200);
      }
    }
  });

  it('never says "Divine Web"', () => {
    for (const row of PAGE_SEO) {
      expect(JSON.stringify(row), row.path).not.toContain('Divine Web');
    }
  });

  it('references only translation keys that exist in English', () => {
    for (const row of PAGE_SEO) {
      if (typeof row.title !== 'string') {
        expect(typeof englishValue(row.title.key, row.title.ns), `${row.path} ${row.title.key}`).toBe('string');
      }
    }
  });

  it('uses 1200x630 PNG images that the Fastly publish step includes', () => {
    for (const image of new Set(PAGE_SEO.map((row) => row.image ?? DEFAULT_IMAGE))) {
      expect(image).toMatch(/^\/[\w-]+\.png$/);
      expect(pngSize(join(process.cwd(), 'public', image)), image).toEqual({ width: 1200, height: 630 });
      expect(publishConfig.kvStoreAssetInclusionTest(image), image).toBe(true);
    }
  });

  it('matches the homepage title and description in index.html', () => {
    const indexHtml = readFileSync(join(process.cwd(), 'index.html'), 'utf8');
    expect(indexHtml).toContain(`<title>${BRAND_DEFAULT_TITLE}</title>`);
    expect(indexHtml).toContain(`<meta name="description" content="${BRAND_DEFAULT_DESCRIPTION}" />`);
  });
});

describe('withTitleSuffix', () => {
  it('appends " - Divine" when the title does not name Divine', () => {
    expect(withTitleSuffix('Trending')).toBe('Trending - Divine');
  });

  it('leaves titles that already name Divine alone', () => {
    expect(withTitleSuffix('Leaderboard - Divine')).toBe('Leaderboard - Divine');
    expect(withTitleSuffix('Merch — Divine')).toBe('Merch — Divine');
    expect(withTitleSuffix('Download Divine')).toBe('Download Divine');
  });
});

describe('normalizePath / findPageSeo', () => {
  it('treats a trailing slash like the bare path', () => {
    expect(normalizePath('/kids/')).toBe('/kids');
    expect(normalizePath('/')).toBe('/');
    expect(findPageSeo('/kids/')?.path).toBe('/kids');
    expect(findPageSeo('/family/media-plan/')?.path).toBe('/family/media-plan');
  });

  it('returns undefined for pages outside the table', () => {
    expect(findPageSeo('/')).toBeUndefined();
    expect(findPageSeo('/discovery')).toBeUndefined();
    expect(findPageSeo('/kidsx')).toBeUndefined();
  });
});

describe('resolvePageSeo', () => {
  const identity: Translate = (key) => key;

  it('derives canonical, image, type, site name and preview defaults', () => {
    const head = resolvePageSeo(findPageSeo('/download')!, identity);
    expect(head).toMatchObject({
      path: '/download',
      title: 'Download Divine',
      previewTitle: 'Download Divine',
      previewDescription: head.description,
      canonical: 'https://divine.video/download',
      type: 'website',
      siteName: 'Divine',
      image: { url: 'https://divine.video/og.png', width: 1200, height: 630, type: 'image/png', alt: 'Download the Divine mobile app' },
    });
  });

  it('keeps a canonical without a trailing slash', () => {
    expect(resolvePageSeo(findPageSeo('/kids/')!, identity).canonical).toBe('https://divine.video/kids');
  });

  it('suffixes a translated title that does not name Divine', () => {
    const t: Translate = () => 'Tendencias';
    expect(resolvePageSeo(findPageSeo('/trending')!, t).title).toBe('Tendencias - Divine');
    expect(resolvePageSeo(findPageSeo('/trending')!, t).previewTitle).toBe('Tendencias');
  });

  it('does not double-suffix a translated title that already names Divine', async () => {
    const [leaderboard] = (await resolveAllPageSeoForBuild(['de'])).filter((head) => head.path === '/leaderboard');
    expect(leaderboard.title).toBe('Bestenliste - Divine');
  });

  it('resolves every row in English for the build', async () => {
    const heads = await resolveAllPageSeoForBuild();
    expect(heads).toHaveLength(28);
    PAGE_SEO.forEach((row, index) => {
      const head = heads[index];
      if (typeof row.title !== 'string') {
        // i18next returns the key itself when a translation is missing
        expect(head.previewTitle, row.path).not.toBe(row.title.key);
      }
      expect(head.title, row.path).toMatch(/Divine/);
    });
    expect(heads.find((head) => head.path === '/dmca')?.title).toBe('DMCA & Copyright Policy - Divine');
  });
});
```

Create `src/seo/pageRoutes.test.ts`:

```ts
// ABOUTME: Guards that every static public route in AppRouter has a link-preview decision
// ABOUTME: Each route is in PAGE_SEO or EXCLUDED_ROUTES, and each entry there is a real route

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { EXCLUDED_ROUTES, PAGE_SEO } from './pageSeo';

function staticRoutes(): string[] {
  const source = readFileSync(join(process.cwd(), 'src/AppRouter.tsx'), 'utf8')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '') // JSX comments
    .replace(/\/\*[\s\S]*?\*\//g, '') // block comments
    .replace(/^\s*\/\/.*$/gm, ''); // line comments
  const paths = [...source.matchAll(/<Route\s[^>]*?\bpath="([^"]+)"/g)].map((m) => m[1]);
  return [...new Set(paths.filter((path) => !path.includes(':') && path !== '*'))];
}

describe('fixed-page route coverage', () => {
  const routes = staticRoutes();
  const decided = new Set([...PAGE_SEO.map((row) => row.path), ...Object.keys(EXCLUDED_ROUTES)]);

  it('finds the router routes (parser sanity check)', () => {
    expect(routes).toContain('/kids');
    expect(routes).toContain('/__brand-preview'); // multi-line <Route> under a DEV guard
    expect(routes).not.toContain('/upload'); // only exists inside a JSX comment
    expect(routes.length).toBeGreaterThan(40);
  });

  it('gives every static route a table row or an exclusion reason', () => {
    expect(routes.filter((path) => !decided.has(path))).toEqual([]);
  });

  it('only lists real routes', () => {
    expect([...decided].filter((path) => !routes.includes(path))).toEqual([]);
  });

  it('never lists a route in both places', () => {
    expect(PAGE_SEO.map((row) => row.path).filter((path) => path in EXCLUDED_ROUTES)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/seo/pageSeo.test.ts src/seo/pageRoutes.test.ts`
Expected: FAIL, `Failed to resolve import "./pageSeo"`.

- [ ] **Step 3: Write the table and resolver**

Create `src/seo/pageSeo.ts`. The descriptions for rows without a `// source: existing` note are drafts for Marketing/Comms approval (Task 9).

```ts
// ABOUTME: Single source of truth for fixed public pages' titles, descriptions, and preview images
// ABOUTME: Feeds the build-time static page heads, browser tab titles, the sitemap, and route coverage tests

import { createI18nInstance } from '@/lib/i18n';

import type { ResolvedPageHead } from './headTags';

export const SITE_ORIGIN = 'https://divine.video';
export const SITE_NAME = 'Divine';
export const DEFAULT_IMAGE = '/og.png';
export const MARKETING_PUBLICATION_DATE = '2026-07-22';

/** index.html's own title and description; shown for routes with no row */
export const BRAND_DEFAULT_TITLE = 'Divine Web - Short-form Looping Videos on Nostr';
export const BRAND_DEFAULT_DESCRIPTION = 'Watch and share 6-second looping videos on the decentralized Nostr network.';

/** Plain English, or a translation key the page itself already renders */
export type SeoText = string | { key: string; ns?: string };

export interface PageSeoRow {
  path: string;
  title: SeoText;
  /** Plain English, at most 200 characters */
  description: string;
  /** og:title / twitter:title when they should differ from the page title */
  previewTitle?: string;
  previewDescription?: string;
  /** Site-relative 1200x630 PNG; defaults to DEFAULT_IMAGE */
  image?: string;
  /** Defaults to the preview title */
  imageAlt?: string;
  type?: 'website' | 'article';
  /** sitemap <lastmod> */
  lastModified?: string;
  /** The build script that renders this page's body; the generic step skips these rows */
  prerenderedBy?: 'legal' | 'marketing';
}

export const PAGE_SEO: readonly PageSeoRow[] = [
  {
    path: '/authenticity',
    title: { key: 'hero.title', ns: 'authenticity' },
    description: "In a world of AI-generated content, Divine is a home for real human creativity. We brought back the Vine archive, and we're keeping it human.",
  },
  {
    path: '/privacy',
    title: { key: 'privacyPage.title' },
    // source: existing (scripts/prerender-legal.mjs), "Divine Web" -> "Divine"
    description: 'Privacy Policy for Divine - How we handle your data on the decentralized Nostr network.',
    prerenderedBy: 'legal',
  },
  {
    path: '/terms',
    title: { key: 'termsPage.title' },
    // source: existing (scripts/prerender-legal.mjs), "Divine Web" -> "Divine"
    description: 'Terms of Service for Divine - Short-form looping videos on the Nostr network.',
    prerenderedBy: 'legal',
  },
  {
    path: '/open-source',
    title: { key: 'title', ns: 'openSource' },
    description: 'Divine is open source. Get the apps, dig into the code on GitHub, and help build short-form video that belongs to the people making it.',
  },
  {
    path: '/proofmode',
    title: { key: 'hero.title', ns: 'proofmode' },
    description: "Proofmode adds cryptographic proof to videos so you can tell real camera footage from AI fakes. Here's how it works on Divine.",
  },
  {
    path: '/human-created',
    title: { key: 'title', ns: 'humanCreated' },
    description: 'The Human-Made badge marks videos made by real people, not AI. See when it shows up on Divine and how it works with Proofmode.',
  },
  {
    path: '/dmca',
    title: { key: 'title', ns: 'dmca' },
    // Replaces the old legal-script copy, which described sections the page no longer has
    description: "How to report copyright infringement to Divine, file a counter-notice, and what Divine can and can't take down on an open network.",
    prerenderedBy: 'legal',
  },
  {
    path: '/safety',
    title: { key: 'title', ns: 'safety' },
    // source: existing (scripts/prerender-legal.mjs), "Divine Web" -> "Divine"
    description: 'Safety Standards for Divine - Our commitment to protecting users and preventing child exploitation.',
    prerenderedBy: 'legal',
  },
  {
    path: '/family',
    // source: existing (src/seo/marketingSeo.ts, serverSocialMeta image alt)
    title: 'For Families on Divine — Talking With Teens About Social Media',
    description: "An honest guide for parents and teens: what Divine's safety tools do, what no app can promise, and how to build a family media plan that actually holds.",
    previewTitle: 'For Families on Divine',
    previewDescription: "Conversation over surveillance. What our safety tools do, what they can't, and how to talk with your teen about it.",
    image: '/og-family.png',
    imageAlt: 'Divine — family resource hub for parents and teens',
    lastModified: MARKETING_PUBLICATION_DATE,
    prerenderedBy: 'marketing',
  },
  {
    path: '/family/talking-to-your-teen',
    // source: existing (src/seo/marketingSeo.ts)
    title: 'How to Talk With Your Teen About Social Media — Divine for Families',
    description: 'Conversation starters and research-backed guidance for talking with your teen about social media — without surveillance, and without the blow-up.',
    previewTitle: 'How to Talk With Your Teen About Social Media',
    previewDescription: 'The goal is not to win the conversation. It is to keep having one. Conversation starters and guidance drawn from youth online-safety research.',
    image: '/og-family-talking.png',
    type: 'article',
    lastModified: MARKETING_PUBLICATION_DATE,
    prerenderedBy: 'marketing',
  },
  {
    path: '/family/media-plan',
    // source: existing (src/seo/marketingSeo.ts)
    title: 'Creating a Family Media Plan — Divine for Families',
    description: 'How to build a family media plan together: where and when screens make sense, healthier feed habits, and regular check-ins that actually hold.',
    previewTitle: 'Creating a Family Media Plan',
    previewDescription: 'A plan that everyone helped write is a plan that everyone is more likely to follow. Templates and habits for household screen use.',
    image: '/og-family-media-plan.png',
    type: 'article',
    lastModified: MARKETING_PUBLICATION_DATE,
    prerenderedBy: 'marketing',
  },
  {
    path: '/family/when-something-goes-wrong',
    // source: existing (src/seo/marketingSeo.ts)
    title: 'What to Do if Your Child Saw Something Upsetting Online — Divine',
    description: 'Four steps for when your child sees something upsetting online: pause, talk before punishing, use the in-app tools, and know when to escalate.',
    previewTitle: 'What to Do if Your Child Saw Something Upsetting Online',
    previewDescription: 'What helps most is not a perfect filter. It is a parent who reacts in a way that makes the next conversation possible. Four concrete steps.',
    image: '/og-family-when-something-goes-wrong.png',
    type: 'article',
    lastModified: MARKETING_PUBLICATION_DATE,
    prerenderedBy: 'marketing',
  },
  {
    path: '/family/safety-tools',
    // source: existing (src/seo/marketingSeo.ts)
    title: 'Divine Safety Tools and Content Settings — What They Can and Can’t Do',
    description: 'How content settings work on Divine: adult content gating, moderation lists, blocking, muting, and reporting — and what no app can promise.',
    previewTitle: "Divine's Safety Tools and Content Settings",
    previewDescription: 'Settings are a useful layer. They are not a guarantee. How adult-content gating, filters, blocking, and reporting work on Divine.',
    image: '/og-family-safety-tools.png',
    type: 'article',
    lastModified: MARKETING_PUBLICATION_DATE,
    prerenderedBy: 'marketing',
  },
  {
    path: '/age-review',
    // source: existing (compute-js/src/index.js, src/lib/serverSocialMeta.ts)
    title: 'Account review — Divine',
    description: 'If your Divine account was flagged as possibly belonging to someone under 16, this page explains what to do — and the 15-day window for responding.',
    imageAlt: 'Divine — account review information',
  },
  {
    path: '/kids',
    // source: existing (src/lib/serverSocialMeta.ts; the Fastly copy lacked the Greenlight clause the page has)
    title: 'Kids on Divine — How accounts work for under-16s',
    description: 'How Divine handles accounts for people under 16 — the rules, the reasoning, Divine Greenlight for teens 13-15, and what families can do together regardless of age.',
    imageAlt: 'Divine — how accounts work for kids and families',
  },
  {
    path: '/download',
    // source: existing (src/pages/DownloadPage.tsx)
    title: 'Download Divine',
    description: 'Get Divine from the App Store, Google Play, or Zapstore.',
    imageAlt: 'Download the Divine mobile app',
  },
  {
    path: '/exit',
    // source: existing (src/pages/PortabilityPage.tsx)
    title: 'Account Portability on Divine',
    description: 'A plain-language guide to moving your Divine account and content to infrastructure you choose.',
  },
  {
    path: '/exit/start',
    // source: existing (src/pages/ExitStartPage.tsx)
    title: 'Export your Divine account',
    description: 'Download a portable archive of your Divine posts, video records, and media files.',
  },
  {
    path: '/delete-account',
    // source: existing (src/pages/DeleteAccountPage.tsx)
    title: 'Delete Your Divine Account',
    description: 'How to request deletion of your Divine account and what deletion can and cannot remove on an open network.',
  },
  {
    path: '/support',
    title: { key: 'support.title' },
    description: "Need a hand? We've got you. Search the Help Center, message support inside Divine, open a ticket, or report a bug on GitHub.",
  },
  {
    path: '/faq',
    title: { key: 'title', ns: 'faq' },
    // source: existing (scripts/prerender-legal.mjs), "Divine Web" -> "Divine"
    description: 'Frequently Asked Questions about Divine - Everything you need to know about the platform.',
    previewTitle: 'Frequently Asked Questions',
    prerenderedBy: 'legal',
  },
  {
    path: '/get-embed',
    title: { key: 'getEmbedPage.title' },
    description: 'Add your latest Divine videos to any website or blog sidebar. Pick a theme, copy the code, done.',
  },
  {
    path: '/services',
    title: { key: 'servicesPage.title' },
    // source: existing (scripts/prerender-legal.mjs)
    description: 'Companion services that help you make the most of Divine: Space, Sounds, Badges, Crossposter, Verifier, and Status.',
    prerenderedBy: 'legal',
  },
  {
    path: '/merch',
    title: { key: 'merchPage.metaTitle' },
    // source: existing (merchPage.metaDescription / merchPage.ogTitle English values)
    description: "Tees, hoodies, hats, and stuff that doesn't take itself too seriously. Designed by Divine, printed and shipped by Bonfire.",
    previewTitle: 'Divine Merch',
  },
  {
    path: '/leaderboard',
    title: { key: 'leaderboardPage.seoTitle' },
    // source: existing (leaderboardPage.seoDescription / seoOgDescription English values)
    description: 'Top videos and creators by loops on Divine',
    previewDescription: 'See the most popular videos and creators',
  },
  {
    path: '/trending',
    title: { key: 'trendingPage.heading' },
    description: "See what's taking off on Divine right now. Sort by hot, new, top, rising, classic Vines, or the ones nobody can agree on.",
  },
  {
    path: '/popular',
    title: { key: 'popularPage.heading' },
    description: 'The most-watched videos on Divine. Pick fresh posts or classic Vines, from right now back to all time.',
  },
  {
    path: '/hashtags',
    title: { key: 'hashtagExplorer.heading' },
    description: 'Find trending hashtags on Divine and explore the communities behind them.',
  },
];

/** Static routes that deliberately have no row, with the reason. */
export const EXCLUDED_ROUTES: Readonly<Record<string, string>> = {
  '/': 'data-driven: the edge renders the home preview',
  '/discovery': 'data-driven: the edge renders the discovery preview',
  '/discovery/new': 'redirect to /discovery/hot',
  '/category': 'data-driven: the edge renders the category preview',
  '/search': 'data-driven: the edge renders the search preview',
  '/home': 'logged-in only',
  '/notifications': 'logged-in only',
  '/messages': 'logged-in only',
  '/analytics': 'logged-in only',
  '/lists': 'logged-in only',
  '/collabs': 'logged-in only',
  '/settings/moderation': 'logged-in only',
  '/settings/linked-accounts': 'logged-in only',
  '/settings/relays': 'logged-in only',
  '/debug-video': 'logged-in only',
  '/account-portability': 'redirect to /exit (server 301 on Fastly and Cloudflare)',
  '/app/callback': 'auth callback',
  '/auth/callback': 'auth callback',
  '/__brand-preview': 'dev only',
};

export type Translate = (key: string, options?: { ns?: string }) => string;

/** Strips one trailing slash; Cloudflare Pages serves prebuilt pages at /<path>/. */
export function normalizePath(pathname: string): string {
  return pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
}

export function findPageSeo(pathname: string): PageSeoRow | undefined {
  const path = normalizePath(pathname);
  return PAGE_SEO.find((row) => row.path === path);
}

export function withTitleSuffix(title: string): string {
  return /\bDivine\b/.test(title) ? title : `${title} - ${SITE_NAME}`;
}

export function resolveText(text: SeoText, t: Translate): string {
  return typeof text === 'string' ? text : t(text.key, text.ns ? { ns: text.ns } : undefined);
}

export function resolvePageSeo(row: PageSeoRow, t: Translate): ResolvedPageHead {
  const pageTitle = resolveText(row.title, t);
  const previewTitle = row.previewTitle ?? pageTitle;
  return {
    path: row.path,
    title: withTitleSuffix(pageTitle),
    description: row.description,
    previewTitle,
    previewDescription: row.previewDescription ?? row.description,
    canonical: `${SITE_ORIGIN}${row.path}`,
    type: row.type ?? 'website',
    siteName: SITE_NAME,
    image: {
      url: `${SITE_ORIGIN}${row.image ?? DEFAULT_IMAGE}`,
      width: 1200,
      height: 630,
      type: 'image/png',
      alt: row.imageAlt ?? previewTitle,
    },
    ...(row.lastModified ? { lastModified: row.lastModified } : {}),
    ...(row.prerenderedBy ? { prerenderedBy: row.prerenderedBy } : {}),
  };
}

/** Every row resolved in one language (English by default), for build scripts. */
export async function resolveAllPageSeoForBuild(languages: readonly string[] = ['en']): Promise<ResolvedPageHead[]> {
  const i18n = await createI18nInstance({ languages });
  const t: Translate = (key, options) => i18n.t(key, options);
  return PAGE_SEO.map((row) => resolvePageSeo(row, t));
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/seo/pageSeo.test.ts src/seo/pageRoutes.test.ts`
Expected: PASS. If `resolveAllPageSeoForBuild(['de'])` returns English, check `createI18nInstance`'s language option in `src/lib/i18n/index.ts:134-160` and pass the language the way `src/prerender/render-marketing.tsx` does; do not change the assertion.

- [ ] **Step 5: Mutation checks**

1. Temporarily delete the `/hashtags` row → `gives every static route a table row` FAILS listing `/hashtags`. Restore.
2. Temporarily add `'/nope': 'x'` to `EXCLUDED_ROUTES` → `only lists real routes` FAILS. Restore.
3. Temporarily change `withTitleSuffix`'s regex to `/Divine$/` → `does not double-suffix` or `leaves titles that already name Divine alone` FAILS. Restore.

- [ ] **Step 6: Type-check, lint, commit**

```bash
npx tsc -p tsconfig.app.json --noEmit && npx eslint src/seo
git add src/seo/pageSeo.ts src/seo/pageSeo.test.ts src/seo/pageRoutes.test.ts
git commit -m "feat(seo): list every fixed page's title, description and preview image in one table"
```

---

### Task 3: Legal and family prerenders read the table

**Files:**
- Create: `scripts/lib/viteSsr.mjs`, `scripts/lib/distDir.mjs`
- Modify: `scripts/prerender-legal.mjs`, `scripts/prerender-marketing.mjs`, `src/seo/marketingSeo.ts`, `src/seo/marketingSeo.test.ts`, `tests/divine-services-directory.test.ts`
- Test: `tests/prerender-ownership.test.ts`

**Interfaces:**
- Consumes: `PAGE_SEO`, `resolveAllPageSeoForBuild`, `SITE_ORIGIN`, `MARKETING_PUBLICATION_DATE` (Task 2); `renderHeadTags`, `ResolvedPageHead` (Task 1); `MARKETING_SSG_ROUTES` from `src/prerender/render-marketing.tsx`.
- Produces:
  - `withViteSsr(root: string, fn: (load: (id: string) => Promise<any>) => Promise<T>): Promise<T>` in `scripts/lib/viteSsr.mjs`
  - `resolveDistDir(root: string, argv?: string[], env?: NodeJS.ProcessEnv): string` in `scripts/lib/distDir.mjs` (`--out-dir <dir>` wins, then `PRERENDER_OUT_DIR`, else `<root>/dist`)
  - `PAGES` exported from `scripts/prerender-legal.mjs` (path + `sourceFile`/`contentFile` only)
  - `getFamilySeo` / `FAMILY_SEO` in `marketingSeo.ts` keep their shape minus `campaign`, now derived from `PAGE_SEO`

- [ ] **Step 1: Write the failing ownership test**

Create `tests/prerender-ownership.test.ts`:

```ts
// ABOUTME: Guards that PAGE_SEO's prerenderedBy markers match what each prerender script renders
// ABOUTME: A mismatch would leave a page with no file or with two writers

import { describe, expect, it } from 'vitest';

// @ts-expect-error - plain ESM build script, no type declarations
import { PAGES } from '../scripts/prerender-legal.mjs';
import { MARKETING_SSG_ROUTES } from '../src/prerender/render-marketing';
import { PAGE_SEO } from '../src/seo/pageSeo';

const owned = (owner: 'legal' | 'marketing') =>
  PAGE_SEO.filter((row) => row.prerenderedBy === owner).map((row) => row.path).sort();

describe('prerender ownership', () => {
  it('marks exactly the legal script pages as legal', () => {
    expect(owned('legal')).toEqual((PAGES as Array<{ path: string }>).map((page) => page.path).sort());
  });

  it('marks exactly the family SSG routes as marketing', () => {
    expect(owned('marketing')).toEqual([...MARKETING_SSG_ROUTES].sort());
  });
});
```

Run: `npx vitest run tests/prerender-ownership.test.ts`
Expected: FAIL. Importing `prerender-legal.mjs` runs `main()` today (it exits or writes into `dist/`), and `PAGES` is not exported.

- [ ] **Step 2: Add the build-script helpers**

Create `scripts/lib/viteSsr.mjs`:

```js
// ABOUTME: Runs a callback with a short-lived Vite SSR loader rooted at the repo, for build scripts on Node 20
// ABOUTME: ws:false avoids Vite's fixed HMR port so parallel invocations (tests) cannot collide

export async function withViteSsr(root, fn) {
  const { createServer } = await import('vite'); // lazy: importers that never call this stay light
  const vite = await createServer({
    root,
    logLevel: 'error',
    appType: 'custom',
    server: { middlewareMode: true, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] }, // SSR loading never needs client pre-bundling
  });
  try {
    return await fn((id) => vite.ssrLoadModule(id));
  } finally {
    await vite.close();
  }
}
```

Create `scripts/lib/distDir.mjs`:

```js
// ABOUTME: Resolves the output directory for prerender scripts
// ABOUTME: --out-dir <dir> wins, then PRERENDER_OUT_DIR, else <root>/dist; Vite root and content sources stay the repo

import { resolve } from 'node:path';
import { parseArgs } from 'node:util';

export function resolveDistDir(root, argv = process.argv.slice(2), env = process.env) {
  const { values } = parseArgs({
    args: argv,
    options: { 'out-dir': { type: 'string' } },
    strict: false,
    allowPositionals: true,
  });
  const dir = values['out-dir'] ?? env.PRERENDER_OUT_DIR;
  return dir ? resolve(dir) : resolve(root, 'dist');
}
```

- [ ] **Step 3: Convert `scripts/prerender-legal.mjs`**

1. Imports (lines 4-9) become:

```js
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { resolveDistDir } from './lib/distDir.mjs';
import { withViteSsr } from './lib/viteSsr.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
```

2. `buildPage` takes `{ head, headTags, content, shell }`. Replace lines 56-66 and 69 (the `<title>` through `twitter:description` lines, and the canonical link) so the head reads:

```js
    <meta charset="UTF-8">
    ${cspMeta}
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes, viewport-fit=cover">
    ${headTags}
    <meta name="theme-color" content="#27C58B">
    <link rel="icon" type="image/png" sizes="72x72" href="/favicon.png">
    <link rel="apple-touch-icon" href="/app_icon.png">
    ${fontLinks.join('\n    ')}
```

The signature line becomes `function buildPage({ headTags, content, shell }) {`. Leave the body markup unchanged.

3. `PAGES` becomes exported, with titles and descriptions removed (the table owns them):

```js
export const PAGES = [
  { path: '/terms', sourceFile: '../src/pages/TermsPage.tsx' },
  { path: '/privacy', sourceFile: '../src/pages/PrivacyPage.tsx' },
  { path: '/safety', sourceFile: '../src/pages/SafetyPage.tsx' },
  { path: '/dmca', sourceFile: '../src/pages/DMCAPage.tsx' },
  { path: '/faq', contentFile: 'faq-content.html' },
  { path: '/services', contentFile: 'services-content.html' },
];
```

4. `main` becomes async, resolves the dist dir, loads heads through Vite, and fails loudly when a page has no legal row:

```js
async function main() {
  const DIST = resolveDistDir(ROOT);
  if (!existsSync(DIST)) {
    console.error('Error: dist/ directory not found. Run "vite build" first.');
    process.exit(1);
  }

  const { heads, renderHeadTags } = await withViteSsr(ROOT, async (load) => ({
    heads: await (await load('/src/seo/pageSeo.ts')).resolveAllPageSeoForBuild(),
    renderHeadTags: (await load('/src/seo/headTags.ts')).renderHeadTags,
  }));
  const legalHeads = new Map(heads.filter((h) => h.prerenderedBy === 'legal').map((h) => [h.path, h]));
```

Keep the existing index.html read, shell extraction and script match. Inside the loop, before `buildPage`:

```js
    const head = legalHeads.get(page.path);
    if (!head) {
      throw new Error(`${page.path}: no PAGE_SEO row with prerenderedBy 'legal'`);
    }
```

and call `buildPage({ headTags: renderHeadTags(head), content, shell })`. `outDir` stays `join(DIST, page.path.slice(1))`.

5. Replace the bare `main();` at the end with the repo's main-guard idiom:

```js
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error('prerender-legal failed:', err);
    process.exit(1);
  });
}
```

- [ ] **Step 4: Convert `scripts/prerender-marketing.mjs`**

1. Add imports `pathToFileURL`, `resolveDistDir`, `withViteSsr`; replace the fixed `DIST` constant with `const ROOT = join(__dirname, '..');` and `const DIST = resolveDistDir(ROOT);` inside `main`.
2. In `buildPage`, replace the lines from `<title>${escapeHtml(seo.title)}</title>` through `<meta name="twitter:image" content="${seo.ogImage}">` with:

```js
    ${headTags}
    <meta name="theme-color" content="#27C58B">
```

and change the signature to `function buildPage({ headTags, appHtml, shell })`. Delete the local `escapeHtml` if nothing else uses it.
3. Replace the `createServer(...)` / `ssrLoadModule` / `vite.close()` block in `main` with:

```js
  await withViteSsr(ROOT, async (load) => {
    const { MARKETING_SSG_ROUTES, renderMarketingRoute } = await load('/src/prerender/render-marketing.tsx');
    const heads = await (await load('/src/seo/pageSeo.ts')).resolveAllPageSeoForBuild();
    const { renderHeadTags } = await load('/src/seo/headTags.ts');

    for (const path of MARKETING_SSG_ROUTES) {
      const head = heads.find((h) => h.path === path && h.prerenderedBy === 'marketing');
      if (!head) {
        throw new Error(`${path}: no PAGE_SEO row with prerenderedBy 'marketing'`);
      }
      const { appHtml } = await renderMarketingRoute(path);
      const html = buildPage({ headTags: renderHeadTags(head), appHtml, shell });

      const outDir = join(DIST, path.slice(1));
      mkdirSync(outDir, { recursive: true });
      writeFileSync(join(outDir, 'index.html'), html);
      console.log(`Pre-rendered: ${path} -> ${join(outDir, 'index.html')}`);
    }
  });
```

4. Replace the trailing `main().catch(...)` with the same main-guard as Step 3.5 (message `prerender-marketing failed:`).

- [ ] **Step 5: Derive `marketingSeo.ts` from the table**

Replace the body of `src/seo/marketingSeo.ts` (keep the exported names other files import):

```ts
// ABOUTME: Family route SEO view over the shared PAGE_SEO table, plus family-only breadcrumb labels
// ABOUTME: Consumed by the family JSON-LD components, the family SSG prerender, and tests

import { MARKETING_PUBLICATION_DATE, PAGE_SEO, SITE_ORIGIN } from './pageSeo';

export { MARKETING_PUBLICATION_DATE, SITE_ORIGIN };

export interface MarketingSeoRoute {
  path: string;
  /** <title> */
  title: string;
  /** <meta name="description"> */
  description: string;
  /** og:title */
  ogTitle: string;
  /** og:description */
  ogDescription: string;
  /** Absolute og:image URL (1200x630) */
  ogImage: string;
  ogType: 'website' | 'article';
  /** Self-referencing canonical URL */
  canonical: string;
  /** Breadcrumb label (empty for the hub) */
  breadcrumb: string;
}

const BREADCRUMBS: Readonly<Record<string, string>> = {
  '/family': '',
  '/family/talking-to-your-teen': 'Talking with your teen',
  '/family/media-plan': 'Family media plan',
  '/family/when-something-goes-wrong': 'When something goes wrong',
  '/family/safety-tools': 'Safety tools',
};

export const FAMILY_SEO: MarketingSeoRoute[] = PAGE_SEO.filter((row) => row.prerenderedBy === 'marketing').map((row) => {
  if (typeof row.title !== 'string') {
    throw new Error(`${row.path}: family titles are plain English`);
  }
  return {
    path: row.path,
    title: row.title,
    description: row.description,
    ogTitle: row.previewTitle ?? row.title,
    ogDescription: row.previewDescription ?? row.description,
    ogImage: `${SITE_ORIGIN}${row.image ?? '/og.png'}`,
    ogType: row.type ?? 'website',
    canonical: `${SITE_ORIGIN}${row.path}`,
    breadcrumb: BREADCRUMBS[row.path] ?? '',
  };
});

export function getFamilySeo(path: string): MarketingSeoRoute | undefined {
  return FAMILY_SEO.find((r) => r.path === path);
}
```

In `src/seo/marketingSeo.test.ts`, delete the test `derives utm campaign slugs from route slugs` (the `campaign` field had no users outside that test). Leave the other ten tests unchanged.

- [ ] **Step 6: Run the legal script in place in its test**

In `tests/divine-services-directory.test.ts`, replace `prerenderToTempDir` and its callers with one in-place run. New top of file (after the existing imports, which gain `afterAll, beforeAll` from vitest and lose `copyFileSync`, `mkdirSync`):

```ts
let outDir: string;

beforeAll(() => {
  outDir = mkdtempSync(join(tmpdir(), 'prerender-guard-'));
  writeFileSync(
    join(outDir, 'index.html'),
    '<!DOCTYPE html><html><head>' +
      `<meta http-equiv="Content-Security-Policy" content="${TEST_CSP}">` +
      '</head><body><div id="root"></div>' +
      '<script type="module" crossorigin src="/assets/index-TEST.js"></script>' +
      '</body></html>',
  );
  execFileSync(process.execPath, [resolve(REPO_ROOT, 'scripts/prerender-legal.mjs'), '--out-dir', outDir], {
    cwd: REPO_ROOT,
    stdio: 'pipe',
    timeout: 60_000,
  });
}, 90_000);

afterAll(() => rmSync(outDir, { recursive: true, force: true }));

const generated = (page: string) => readFileSync(join(outDir, page, 'index.html'), 'utf8');
```

Replace `prerenderToTempDir('services')` with `generated('services')` and `prerenderToTempDir(page)` with `generated(page)`. Add one test for Review Focus 2:

```ts
  it('writes the table head, escaped, onto a legal page', () => {
    const dmca = generated('dmca');
    expect(dmca).toContain('<title>DMCA &amp; Copyright Policy - Divine</title>');
    expect(dmca).toContain('<meta property="og:url" content="https://divine.video/dmca">');
    expect(dmca).not.toContain('Divine Web</title>');
  });
```

- [ ] **Step 7: Run the tests**

Run: `npx vitest run tests/prerender-ownership.test.ts tests/divine-services-directory.test.ts src/seo`
Expected: PASS.

- [ ] **Step 8: Run both scripts on Node 20 against a real build**

```bash
npx vite build
npx -y -p node@20 node scripts/prerender-legal.mjs
npx -y -p node@20 node scripts/prerender-marketing.mjs
grep -o '<title>[^<]*</title>' dist/terms/index.html dist/family/media-plan/index.html
```

Expected: `Terms of Service - Divine` and `Creating a Family Media Plan — Divine for Families`; both scripts exit 0.

- [ ] **Step 9: Mutation check**

Change `/services`'s `prerenderedBy` to `'marketing'` → ownership test FAILS on both assertions. Restore.

- [ ] **Step 10: Commit**

```bash
npx tsc -p tsconfig.app.json --noEmit && npx eslint src/seo tests/prerender-ownership.test.ts
git add scripts/lib scripts/prerender-legal.mjs scripts/prerender-marketing.mjs src/seo/marketingSeo.ts src/seo/marketingSeo.test.ts tests/divine-services-directory.test.ts tests/prerender-ownership.test.ts
git commit -m "refactor(seo): build legal and family page heads from the shared table"
```

---

### Task 4: Prebuilt heads for every other fixed page, and a generated sitemap

**Files:**
- Create: `src/seo/pageFiles.ts`, `scripts/prerender-pages.mjs`
- Modify: `package.json` (`build`), `src/lib/seoFiles.test.ts`
- Delete: `public/sitemap.xml`
- Test: `src/seo/pageFiles.test.ts`

**Interfaces:**
- Consumes: `replaceHeadTags`, `checkHeadTags`, `renderSitemap`, `ResolvedPageHead` (Task 1); `resolveAllPageSeoForBuild`, `SITE_ORIGIN` (Task 2); `withViteSsr`, `resolveDistDir` (Task 3).
- Produces:
  - `pageFilePath(path: string): string` (e.g. `kids/index.html`)
  - `buildPageFiles(shellHtml: string, heads: readonly ResolvedPageHead[]): Array<{ file: string; html: string }>` (skips `prerenderedBy` rows)
  - `buildSitemap(heads: readonly ResolvedPageHead[]): string` (`/` plus every row)
  - `checkPageFiles(heads, readFile: (file: string) => string | undefined): string[]`

- [ ] **Step 1: Write the failing tests**

Create `src/seo/pageFiles.test.ts`:

```ts
// ABOUTME: Tests the build step that writes a static head for each fixed page, and the sitemap
// ABOUTME: Runs against the real index.html shell so stripping the homepage tags is proven on real input

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

import type { ResolvedPageHead } from './headTags';
import { buildPageFiles, buildSitemap, checkPageFiles, pageFilePath } from './pageFiles';
import { resolveAllPageSeoForBuild } from './pageSeo';

const shell = readFileSync(join(process.cwd(), 'index.html'), 'utf8');
let heads: ResolvedPageHead[];

beforeAll(async () => {
  heads = await resolveAllPageSeoForBuild();
});

describe('pageFilePath', () => {
  it('maps a path to its index.html', () => {
    expect(pageFilePath('/kids')).toBe('kids/index.html');
    expect(pageFilePath('/exit/start')).toBe('exit/start/index.html');
  });
});

describe('buildPageFiles', () => {
  it('writes one file per row that no other prerender owns', () => {
    const files = buildPageFiles(shell, heads).map((f) => f.file).sort();
    const expected = heads.filter((h) => !h.prerenderedBy).map((h) => pageFilePath(h.path)).sort();
    expect(files).toEqual(expected);
    expect(files).toContain('kids/index.html');
    expect(files).not.toContain('terms/index.html');
  });

  it('produces files that pass the self-check', () => {
    const files = new Map(buildPageFiles(shell, heads).map((f) => [f.file, f.html]));
    const own = heads.filter((h) => !h.prerenderedBy);
    expect(checkPageFiles(own, (file) => files.get(file))).toEqual([]);
  });

  it('keeps the CSP and the app bundle script', () => {
    const [kids] = buildPageFiles(shell, heads).filter((f) => f.file === 'kids/index.html');
    expect(kids.html).toMatch(/<meta http-equiv="Content-Security-Policy"/);
    expect(kids.html).toContain('<script type="module" src="/src/main.tsx"></script>');
    expect(kids.html).not.toContain('Divine Web');
  });
});

describe('checkPageFiles', () => {
  it('reports a missing file', () => {
    const [kids] = heads.filter((h) => h.path === '/kids');
    expect(checkPageFiles([kids], () => undefined)).toEqual(['/kids: missing kids/index.html']);
  });

  it('reports a homepage og:url', () => {
    const [kids] = heads.filter((h) => h.path === '/kids');
    const html = buildPageFiles(shell, [kids])[0].html.replace(
      '<meta property="og:url" content="https://divine.video/kids">',
      '<meta property="og:url" content="https://divine.video/">',
    );
    expect(checkPageFiles([kids], () => html)).toEqual([
      '/kids: og:url: expected "https://divine.video/kids", found "https://divine.video/"',
    ]);
  });
});

describe('buildSitemap', () => {
  it('lists the home page and every table row, and nothing else', () => {
    const locs = [...buildSitemap(heads).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    expect(locs).toEqual(['https://divine.video/', ...heads.map((h) => h.canonical)]);
  });

  it('dates the family pages', () => {
    const xml = buildSitemap(heads);
    for (const path of ['/family', '/family/media-plan']) {
      expect(xml).toContain(`<loc>https://divine.video${path}</loc>\n    <lastmod>2026-07-22</lastmod>`);
    }
  });
});
```

Run: `npx vitest run src/seo/pageFiles.test.ts`
Expected: FAIL, `Failed to resolve import "./pageFiles"`.

- [ ] **Step 2: Write `src/seo/pageFiles.ts`**

```ts
// ABOUTME: Pure build logic for fixed pages' static heads and the sitemap
// ABOUTME: scripts/prerender-pages.mjs does the file IO; tests call these directly

import { checkHeadTags, renderSitemap, replaceHeadTags, type ResolvedPageHead } from './headTags';
import { SITE_ORIGIN } from './pageSeo';

export function pageFilePath(path: string): string {
  return `${path.slice(1)}/index.html`;
}

/** One static file per row that no other prerender script owns. */
export function buildPageFiles(
  shellHtml: string,
  heads: readonly ResolvedPageHead[],
): Array<{ file: string; html: string }> {
  return heads
    .filter((head) => !head.prerenderedBy)
    .map((head) => ({ file: pageFilePath(head.path), html: replaceHeadTags(shellHtml, head) }));
}

export function buildSitemap(heads: readonly ResolvedPageHead[]): string {
  return renderSitemap([
    { loc: `${SITE_ORIGIN}/` },
    ...heads.map((head) => ({ loc: head.canonical, lastmod: head.lastModified })),
  ]);
}

/** Self-check: every row's file exists and carries exactly the tags the table resolves to. */
export function checkPageFiles(
  heads: readonly ResolvedPageHead[],
  readFile: (file: string) => string | undefined,
): string[] {
  const problems: string[] = [];
  for (const head of heads) {
    const file = pageFilePath(head.path);
    const html = readFile(file);
    if (html === undefined) {
      problems.push(`${head.path}: missing ${file}`);
      continue;
    }
    for (const problem of checkHeadTags(html, head)) problems.push(`${head.path}: ${problem}`);
  }
  return problems;
}
```

Run: `npx vitest run src/seo/pageFiles.test.ts` → PASS.

- [ ] **Step 3: Write `scripts/prerender-pages.mjs`**

```js
// ABOUTME: Writes dist/<path>/index.html for every fixed-page row no other prerender owns, plus dist/sitemap.xml
// ABOUTME: Runs last in the prerender chain and ends with the self-check over every row, including legal and family

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { resolveDistDir } from './lib/distDir.mjs';
import { withViteSsr } from './lib/viteSsr.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

async function main() {
  const distDir = resolveDistDir(ROOT);
  const indexPath = join(distDir, 'index.html');
  if (!existsSync(indexPath)) {
    console.error(`Error: ${indexPath} not found. Run "vite build" first.`);
    process.exit(1);
  }

  const problems = await withViteSsr(ROOT, async (load) => {
    const heads = await (await load('/src/seo/pageSeo.ts')).resolveAllPageSeoForBuild();
    const { buildPageFiles, buildSitemap, checkPageFiles } = await load('/src/seo/pageFiles.ts');

    for (const { file, html } of buildPageFiles(readFileSync(indexPath, 'utf8'), heads)) {
      const target = join(distDir, file);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, html);
    }
    writeFileSync(join(distDir, 'sitemap.xml'), buildSitemap(heads));

    return checkPageFiles(heads, (file) => {
      const target = join(distDir, file);
      return existsSync(target) ? readFileSync(target, 'utf8') : undefined;
    });
  });

  if (problems.length > 0) {
    console.error(`Page head self-check failed:\n  ${problems.join('\n  ')}`);
    process.exit(1);
  }
  console.log('Page heads verified for every fixed page; sitemap written.');
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error('prerender-pages failed:', err);
    process.exit(1);
  });
}
```

- [ ] **Step 4: Wire it into the build and remove the hand-kept sitemap**

In `package.json` `build`, insert `node scripts/prerender-pages.mjs && ` between `node scripts/prerender-marketing.mjs && ` and `node scripts/verify-well-known.mjs`.

```bash
git rm public/sitemap.xml
```

In `src/lib/seoFiles.test.ts`, change the second ABOUTME line to `// ABOUTME: Guards that robots stays permissive and points at the generated sitemap (see src/seo/pageFiles.test.ts)` and delete the whole `describe('public sitemap.xml', ...)` block (its assertions now live in `pageFiles.test.ts`, against the generated sitemap).

- [ ] **Step 5: Run a full build on Node 20**

```bash
npx -y -p node@20 npm run build
grep -o '<meta property="og:url" content="[^"]*">' dist/kids/index.html dist/support/index.html dist/terms/index.html
grep -c '<url>' dist/sitemap.xml
```

Expected: build ends with `Page heads verified for every fixed page; sitemap written.`; og:url values are the pages' own URLs; sitemap has `29` entries.

- [ ] **Step 6: Mutation check on the real build**

Delete `dist/terms/index.html` (a legal-owned file this script checks but does not write), then run `npx -y -p node@20 node scripts/prerender-pages.mjs`.
Expected: exit 1 with `/terms: missing terms/index.html`. Re-run `npx -y -p node@20 npm run build` to restore.

- [ ] **Step 7: Commit**

```bash
npx tsc -p tsconfig.app.json --noEmit && npx eslint src/seo
git add src/seo/pageFiles.ts src/seo/pageFiles.test.ts scripts/prerender-pages.mjs package.json src/lib/seoFiles.test.ts
git commit -m "feat(seo): give every fixed page its own preview tags in a static file, and generate the sitemap"
```

---

### Task 5: Tab titles from the table, at the router level

**Files:**
- Create: `src/components/PageSeoForRoute.tsx`
- Modify: `src/AppRouter.tsx` (after `<ScrollToTop />`), `src/pages/LeaderboardPage.tsx`, `src/pages/MerchPage.tsx`, `src/pages/MerchPage.test.tsx`, `src/pages/DeleteAccountPage.tsx`, `src/pages/PortabilityPage.tsx`, `src/pages/ExitStartPage.tsx`, `src/pages/DownloadPage.tsx`, the five family pages, all 20 `src/lib/i18n/locales/*/common.json`
- Delete: `src/components/family/FamilySeoHead.tsx`
- Test: `src/components/PageSeoForRoute.test.tsx`

**Interfaces:**
- Consumes: `findPageSeo`, `resolvePageSeo`, `BRAND_DEFAULT_TITLE`, `BRAND_DEFAULT_DESCRIPTION`, `Translate` (Task 2); `ResolvedPageHead` (Task 1).
- Produces: `PageSeoForRoute(): JSX.Element` (renders nothing visible).

- [ ] **Step 1: Write the failing tests**

Create `src/components/PageSeoForRoute.test.tsx`:

```tsx
// ABOUTME: Tests the router-level head component that sets tab titles and preview tags from PAGE_SEO
// ABOUTME: Covers trailing slashes, navigation to pages without a row, and page-level titles winning

import { act, render, waitFor } from '@testing-library/react';
import { InferSeoMetaPlugin } from '@unhead/addons';
import { createHead, UnheadProvider, useSeoMeta } from '@unhead/react/client';
import { useEffect } from 'react';
import { MemoryRouter, Route, Routes, useNavigate, type NavigateFunction } from 'react-router-dom';
import { beforeAll, describe, expect, it } from 'vitest';

import { initializeI18n } from '@/lib/i18n';
import { BRAND_DEFAULT_TITLE } from '@/seo/pageSeo';

import { PageSeoForRoute } from './PageSeoForRoute';

let navigate: NavigateFunction;

function CaptureNavigate() {
  const nav = useNavigate();
  useEffect(() => {
    navigate = nav;
  }, [nav]);
  return null;
}

function VideoStub() {
  useSeoMeta({ title: 'A video on Divine' });
  return null;
}

// PageSeoForRoute is mounted AFTER the routes here, the worst case: unhead breaks
// equal-priority ties in favour of the later entry, so only tagPriority 'low'
// lets a page's own title win from this position.
function renderAt(path: string) {
  const head = createHead({ plugins: [InferSeoMetaPlugin()] });
  return render(
    <UnheadProvider head={head}>
      <MemoryRouter initialEntries={[path]}>
        <CaptureNavigate />
        <Routes>
          <Route path="/video/:id" element={<VideoStub />} />
          <Route path="*" element={null} />
        </Routes>
        <PageSeoForRoute />
      </MemoryRouter>
    </UnheadProvider>,
  );
}

const meta = (selector: string) => document.head.querySelector(selector)?.getAttribute('content');
const canonical = () => document.head.querySelector('link[rel="canonical"]')?.getAttribute('href');

beforeAll(async () => {
  await initializeI18n({ languages: ['en'] });
});

describe('PageSeoForRoute', () => {
  it('sets the tab title, preview tags and canonical for a table page', async () => {
    renderAt('/kids');
    await waitFor(() => expect(document.title).toBe('Kids on Divine — How accounts work for under-16s'));
    expect(meta('meta[property="og:url"]')).toBe('https://divine.video/kids');
    expect(meta('meta[property="og:image:alt"]')).toBe('Divine — how accounts work for kids and families');
    expect(canonical()).toBe('https://divine.video/kids');
  });

  it('matches a trailing-slash URL and keeps the canonical without the slash', async () => {
    renderAt('/trending/');
    await waitFor(() => expect(document.title).toBe('Trending - Divine'));
    expect(canonical()).toBe('https://divine.video/trending');
  });

  it('shows the brand default after navigating to a page with no row', async () => {
    document.title = 'Kids on Divine — How accounts work for under-16s'; // as a prebuilt page loads
    renderAt('/kids');
    await waitFor(() => expect(document.title).toBe('Kids on Divine — How accounts work for under-16s'));
    act(() => navigate('/discovery'));
    await waitFor(() => expect(document.title).toBe(BRAND_DEFAULT_TITLE));
  });

  it('lets a page that sets its own title win over the brand default', async () => {
    renderAt('/video/abc');
    await waitFor(() => expect(document.title).toBe('A video on Divine'));
    // The brand default sets no og:* tags, so the inferred preview title follows the page title
    await waitFor(() => expect(meta('meta[property="og:title"]')).toBe('A video on Divine'));
  });
});
```

Run: `npx vitest run src/components/PageSeoForRoute.test.tsx`
Expected: FAIL, `Failed to resolve import "./PageSeoForRoute"`.

- [ ] **Step 2: Write the component**

Create `src/components/PageSeoForRoute.tsx`:

```tsx
// ABOUTME: Sets the browser tab title and preview tags for fixed pages from PAGE_SEO, once, at the router level
// ABOUTME: Routes with no row get the brand default title and description at low priority, so page-level titles win

import { useHead, useSeoMeta } from '@unhead/react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';

import type { ResolvedPageHead } from '@/seo/headTags';
import {
  BRAND_DEFAULT_DESCRIPTION,
  BRAND_DEFAULT_TITLE,
  findPageSeo,
  resolvePageSeo,
  type Translate,
} from '@/seo/pageSeo';

function PageHead({ head }: { head: ResolvedPageHead }) {
  useSeoMeta({
    title: head.title,
    description: head.description,
    ogType: head.type,
    ogUrl: head.canonical,
    ogTitle: head.previewTitle,
    ogDescription: head.previewDescription,
    ogImage: head.image.url,
    ogImageWidth: head.image.width,
    ogImageHeight: head.image.height,
    ogImageType: head.image.type as 'image/png',
    ogImageAlt: head.image.alt,
    ogSiteName: head.siteName,
    twitterCard: 'summary_large_image',
    twitterTitle: head.previewTitle,
    twitterDescription: head.previewDescription,
    twitterImage: head.image.url,
  });
  // useSeoMeta cannot emit <link rel="canonical">
  useHead({ link: [{ rel: 'canonical', href: head.canonical }] });
  return null;
}

// Title and description only. Setting og:* here would tie with InferSeoMetaPlugin's
// low-priority tags and, being registered later, replace a page's inferred preview title.
function BrandDefaultHead() {
  useHead(
    { title: BRAND_DEFAULT_TITLE, meta: [{ name: 'description', content: BRAND_DEFAULT_DESCRIPTION }] },
    { tagPriority: 'low' },
  );
  return null;
}

export function PageSeoForRoute() {
  const { pathname } = useLocation();
  const { t } = useTranslation();
  const row = findPageSeo(pathname);
  if (!row) return <BrandDefaultHead />;
  const translate: Translate = (key, options) => t(key, options);
  return <PageHead head={resolvePageSeo(row, translate)} />;
}
```

Run: `npx vitest run src/components/PageSeoForRoute.test.tsx`
Expected: PASS. If `ogImageType`'s type rejects the cast, use `ogImageType: 'image/png'` (every table image is PNG, enforced by `pageSeo.test.ts`).

- [ ] **Step 3: Mount it**

In `src/AppRouter.tsx`, add `import { PageSeoForRoute } from '@/components/PageSeoForRoute';` with the other component imports, and insert `<PageSeoForRoute />` on the line after `<ScrollToTop />` inside `<BrowserRouter>`.

- [ ] **Step 4: Remove the six pages' own head code**

- `src/pages/LeaderboardPage.tsx`: delete the `useSeoMeta({...})` call at 444-449 and the `useSeoMeta` import at line 7.
- `src/pages/MerchPage.tsx`: delete `const metaDescription = ...` (line 92), the `useHead({...})` call (93-105) and the `useHead` import (line 2). In `src/pages/MerchPage.test.tsx`, delete the now-dead `vi.mock('@unhead/react', ...)` block (lines 9-11).
- `src/pages/DeleteAccountPage.tsx` (39-49), `src/pages/PortabilityPage.tsx` (63-73), `src/pages/ExitStartPage.tsx` (82-92), `src/pages/DownloadPage.tsx` (24-28): delete the `useHead({...})` call and its import.
- Family pages (`FamilyHubPage.tsx:72`, `TalkingToYourTeenPage.tsx:55`, `MediaPlanPage.tsx:28`, `WhenSomethingGoesWrongPage.tsx:45`, `SafetyToolsPage.tsx:27`): delete the `{seo && <FamilySeoHead seo={seo} />}` line and the `FamilySeoHead` import. Keep `getFamilySeo` where `JsonLd` still uses `seo`; if a page no longer uses `seo` at all, delete the variable and import too.
- `git rm src/components/family/FamilySeoHead.tsx`

Then confirm nothing still sets these pages' head:

```bash
grep -n "useHead\|useSeoMeta\|FamilySeoHead" src/pages/LeaderboardPage.tsx src/pages/MerchPage.tsx src/pages/DeleteAccountPage.tsx src/pages/PortabilityPage.tsx src/pages/ExitStartPage.tsx src/pages/DownloadPage.tsx src/pages/family/*.tsx
```

Expected: no output.

- [ ] **Step 5: Remove translation keys that lost their last user**

`merchPage.metaDescription`, `merchPage.ogTitle`, `leaderboardPage.seoDescription` and `leaderboardPage.seoOgDescription` are no longer referenced in code (their English copy now lives in the table; previews are English-only). Confirm, then remove them from every locale:

```bash
grep -rn "merchPage.metaDescription\|merchPage.ogTitle\|leaderboardPage.seoDescription\|leaderboardPage.seoOgDescription" src --include='*.ts' --include='*.tsx'
node -e '
const fs = require("fs");
for (const dir of fs.readdirSync("src/lib/i18n/locales")) {
  const file = `src/lib/i18n/locales/${dir}/common.json`;
  const json = JSON.parse(fs.readFileSync(file, "utf8"));
  delete json.merchPage.metaDescription; delete json.merchPage.ogTitle;
  delete json.leaderboardPage.seoDescription; delete json.leaderboardPage.seoOgDescription;
  fs.writeFileSync(file, JSON.stringify(json, null, 2) + "\n");
}'
git diff --stat -- src/lib/i18n/locales
```

Expected: the grep prints nothing; the diff shows exactly 4 deletions and 0 insertions per file (20 files). If any file shows insertions, `JSON.stringify` reformatted it: restore it with `git checkout -- <file>` and delete the four lines by hand.

- [ ] **Step 6: Run the affected tests**

Run: `npx vitest run src/components/PageSeoForRoute.test.tsx src/AppRouter.test.tsx src/pages src/lib/i18n src/seo`
Expected: PASS.

- [ ] **Step 7: Mutation checks**

1. In `BrandDefaultHead`, remove `{ tagPriority: 'low' }` → `lets a page that sets its own title win` FAILS (the brand default, registered later, wins the tie). Restore.
2. In `PageSeoForRoute`, render `null` instead of `<BrandDefaultHead />` → `shows the brand default after navigating` FAILS. Restore.

- [ ] **Step 8: Commit**

```bash
npx tsc -p tsconfig.app.json --noEmit && npx eslint src
git add -A src/components src/AppRouter.tsx src/pages src/lib/i18n/locales
git commit -m "feat(seo): set tab titles for fixed pages from the shared table"
```

---

### Task 6: Remove the duplicate per-page preview code on Fastly and Cloudflare

**Files:**
- Modify: `compute-js/src/index.js`, `compute-js/src/crawlerHandlers.js`, `compute-js/src/crawlerHandlers.test.ts`, `compute-js/src/templateCachePolicy.js`, `compute-js/src/templateCachePolicy.test.js`, `src/lib/serverSocialMeta.ts`, `src/lib/serverSocialMeta.test.ts`, `functions/[[path]].ts`, `functions/[[path]].test.ts`

**Interfaces:**
- Consumes: the static files from Tasks 3-4 (these pages are now served as prebuilt files on both hosts).
- Produces: nothing new.

- [ ] **Step 1: Add the Cloudflare pass-through test first**

In `functions/[[path]].test.ts`, add inside the existing `describe` for `onRequest` (reuse the file's existing `INDEX_HTML` fixture):

```ts
  it('leaves a static fixed page untouched', async () => {
    const pageHtml = INDEX_HTML.replace('Divine Web - Short-form Looping Videos on Nostr</title>', 'Kids - Divine</title>');
    const response = await onRequest({
      request: new Request('https://divine.video/kids/'),
      next: async () => new Response(pageHtml, { status: 200, headers: { 'content-type': 'text/html; charset=UTF-8' } }),
      env: {},
    });
    expect(response.status).toBe(200);
    expect(await response.text()).toBe(pageHtml);
  });
```

Run: `npx vitest run "functions/[[path]].test.ts"`
Expected: PASS already (`/kids/` matches no branch today); it guards the removal below.

- [ ] **Step 2: Remove the Fastly handlers**

In `compute-js/src/index.js`:
- Delete line 23 (`  handleDownloadOgTags,` in the `crawlerHandlers.js` import).
- Change the `templateCachePolicy.js` import (35-38) to `import { createEdgeTemplateHeaders } from './templateCachePolicy.js';`.
- Delete lines 301-332: the blank line and the `/family`, `/age-review`, `/kids` and `/download` blocks inside `if (isSocialMediaCrawler(request)) {`. Keep line 300 (closing `/discovery`) and line 333 (closing the crawler block).
- Delete lines 1433-1559: the `// Mirrors src/seo/marketingSeo.ts` comment, `FAMILY_CRAWLER_META`, `handleFamilyOgTags`, `handleAgeReviewOgTags`, `handleKidsPolicyOgTags`, and the trailing blank line.

Line numbers are from `origin/main` at `03f86ac1`; confirm each block by its first and last lines before deleting.

In `compute-js/src/crawlerHandlers.js`: delete line 8 (`import { HOST_DEPENDENT_CRAWLER_VARY } ...`) and lines 14-35 (`export function handleDownloadOgTags` and its trailing blank line).

In `compute-js/src/templateCachePolicy.js`: delete line 4 (`HOST_DEPENDENT_CRAWLER_VARY`). In `templateCachePolicy.test.js`: drop it from the import (line 5) and delete the test `varies host-dependent crawler responses by host and user agent` (29-31).

In `compute-js/src/crawlerHandlers.test.ts`: drop `handleDownloadOgTags` from the import (line 22) and delete `describe('handleDownloadOgTags')` (26-38).

Confirm nothing dangles:

```bash
grep -n "handleDownloadOgTags\|handleFamilyOgTags\|handleAgeReviewOgTags\|handleKidsPolicyOgTags\|FAMILY_CRAWLER_META\|HOST_DEPENDENT_CRAWLER_VARY" -r compute-js/src
```

Expected: no output.

- [ ] **Step 3: Remove the Cloudflare branches**

In `src/lib/serverSocialMeta.ts`: delete `buildFamilyPageMeta`, `buildAgeReviewPageMeta`, `buildKidsPolicyPageMeta` and `buildDownloadPageMeta` (336-386), keeping `getDefaultPageMeta` and everything else.

In `functions/[[path]].ts`: delete the four imports (lines 5, 8, 9, 10) and the four branches in `fetchRouteMeta` (333-351); line 352 `return buildSimpleRouteMeta(url);` stays.

In `src/lib/serverSocialMeta.test.ts`: drop `buildDownloadPageMeta` from the import (line 6) and delete `builds metadata for the public download page` (80-88).

In `functions/[[path]].test.ts`: delete the four tests `injects family-hub metadata for /family on apex`, `injects age-review metadata for /age-review on apex`, `injects kids-policy metadata for /kids on apex`, `injects download metadata for /download on apex` (246-309).

```bash
grep -rn "buildFamilyPageMeta\|buildAgeReviewPageMeta\|buildKidsPolicyPageMeta\|buildDownloadPageMeta" src functions
```

Expected: no output.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run compute-js/src src/lib/serverSocialMeta.test.ts "functions/[[path]].test.ts" tests/embed-route-parity.test.ts`
Expected: PASS.

- [ ] **Step 5: Build the Fastly worker**

Run: `npm run -w divine-web-edge build` (runs `js-compute-runtime ./src/index.js ./bin/main.wasm`)
Expected: the Wasm build succeeds (catches leftover imports that no test loads).

- [ ] **Step 6: Commit**

```bash
git add compute-js/src src/lib/serverSocialMeta.ts src/lib/serverSocialMeta.test.ts "functions/[[path]].ts" "functions/[[path]].test.ts"
git commit -m "refactor(edge): drop per-page preview handlers now served as static files"
```

---

### Task 7: Redirect `/account-portability` to `/exit` on the server

**Files:**
- Modify: `compute-js/src/hostRedirect.js`, `compute-js/src/hostRedirect.test.js`, `compute-js/src/index.js`, `public/_redirects`

**Interfaces:**
- Consumes: `redirectNoStore` (module-private in `hostRedirect.js`).
- Produces: `buildAccountPortabilityRedirectResponse(url: URL, hostnameToUse: string): Response | null`

- [ ] **Step 1: Write the failing tests**

In `compute-js/src/hostRedirect.test.js`, change the import to `import { buildAccountPortabilityRedirectResponse, buildWwwRedirectResponse } from './hostRedirect.js';` and append:

```js
describe('buildAccountPortabilityRedirectResponse', () => {
  it('redirects to /exit on the forwarded host and keeps the query string', () => {
    const response = buildAccountPortabilityRedirectResponse(
      new URL('https://origin.example/account-portability?ref=email'),
      'divine.video',
    );

    expect(response?.status).toBe(301);
    expect(response?.headers.get('Location')).toBe('https://divine.video/exit?ref=email');
    expect(response?.headers.get('Cache-Control')).toBe('no-store');
    expect(response?.headers.get('Vary')).toContain('X-Original-Host');
    expect(response?.headers.get('Vary')).toContain('X-Forwarded-Host');
  });

  it('redirects the trailing-slash form', () => {
    const response = buildAccountPortabilityRedirectResponse(
      new URL('https://dvine.video/account-portability/'),
      'dvine.video',
    );

    expect(response?.status).toBe(301);
    expect(response?.headers.get('Location')).toBe('https://dvine.video/exit');
  });

  it('does not redirect other paths', () => {
    for (const path of ['/exit', '/account-portability/extra', '/account-portabilityx']) {
      expect(buildAccountPortabilityRedirectResponse(new URL(`https://divine.video${path}`), 'divine.video')).toBeNull();
    }
  });

  it('takes a www request to the apex in one hop, then to /exit in one more', () => {
    const www = buildWwwRedirectResponse(new URL('https://www.divine.video/account-portability?x=1'), 'www.divine.video');
    expect(www?.headers.get('Location')).toBe('https://divine.video/account-portability?x=1');
    const next = buildAccountPortabilityRedirectResponse(new URL(www.headers.get('Location')), 'divine.video');
    expect(next?.headers.get('Location')).toBe('https://divine.video/exit?x=1');
  });
});
```

Run: `npx vitest run compute-js/src/hostRedirect.test.js`
Expected: FAIL, `buildAccountPortabilityRedirectResponse is not a function`.

- [ ] **Step 2: Implement the helper**

In `compute-js/src/hostRedirect.js`, add after `buildWwwRedirectResponse`:

```js
const ACCOUNT_PORTABILITY_PATHS = new Set(['/account-portability', '/account-portability/']);

// /account-portability moved to /exit (#591). This is a same-host redirect, so
// it cannot use EXTERNAL_REDIRECTS, which maps exact paths to absolute
// cross-host URLs and drops the query string.
export function buildAccountPortabilityRedirectResponse(url, hostnameToUse) {
  if (!ACCOUNT_PORTABILITY_PATHS.has(url.pathname)) {
    return null;
  }

  const targetUrl = new URL(url);
  targetUrl.hostname = hostnameToUse;
  targetUrl.pathname = '/exit';

  return redirectNoStore(targetUrl.toString(), 301);
}
```

Update the file's second ABOUTME line to mention same-host path redirects.

Run: `npx vitest run compute-js/src/hostRedirect.test.js` → PASS.

- [ ] **Step 3: Call it from the worker**

In `compute-js/src/index.js`, change the `hostRedirect.js` import (line 15) to `import { buildAccountPortabilityRedirectResponse, buildWwwRedirectResponse } from './hostRedirect.js';` and insert right after the `EXTERNAL_REDIRECTS` block (after line 150):

```js
  // 3a. /account-portability moved to /exit (#591). After the www redirect, so
  // www takes one hop to the apex and then one to /exit.
  const accountPortabilityRedirect = buildAccountPortabilityRedirectResponse(url, hostnameToUse);
  if (accountPortabilityRedirect) {
    return accountPortabilityRedirect;
  }
```

- [ ] **Step 4: Add the Cloudflare rules**

Append to `public/_redirects`:

```
# /account-portability moved to /exit (#591); Fastly does the same in compute-js/src/hostRedirect.js
/account-portability  /exit  301
/account-portability/  /exit  301
```

The client `<Navigate to="/exit" replace />` in `src/AppRouter.tsx` stays as a fallback.

- [ ] **Step 5: Build the worker and commit**

```bash
npm run -w divine-web-edge build
npx vitest run compute-js/src
git add compute-js/src/hostRedirect.js compute-js/src/hostRedirect.test.js compute-js/src/index.js public/_redirects
git commit -m "fix(edge): redirect /account-portability to /exit on the server"
```

---

### Task 8: Extend the live preview check

**Files:**
- Modify: `scripts/verify-og-tags.sh`, `tests/verify-og-tags-network-resilience.test.ts`, `.github/workflows/og-audit.yml`
- Test: `tests/verify-og-tags-table-routes.test.ts`

**Interfaces:**
- Consumes: `PAGE_SEO` (Task 2).
- Produces: `TABLE_ROUTES` bash array in `verify-og-tags.sh`, kept equal to `PAGE_SEO` paths by test.

- [ ] **Step 1: Write the failing drift test**

Create `tests/verify-og-tags-table-routes.test.ts`:

```ts
// ABOUTME: Keeps the live preview check's fixed-page list equal to the PAGE_SEO table
// ABOUTME: So a page added to the table is also audited in production

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { PAGE_SEO } from '../src/seo/pageSeo';

describe('verify-og-tags.sh TABLE_ROUTES', () => {
  it('lists exactly the PAGE_SEO paths', () => {
    const script = readFileSync(join(process.cwd(), 'scripts/verify-og-tags.sh'), 'utf8');
    const block = script.match(/^TABLE_ROUTES=\(\n([\s\S]*?)\n\)/m);
    expect(block, 'TABLE_ROUTES array not found').not.toBeNull();
    const routes = [...block![1].matchAll(/"([^"]+)"/g)].map((m) => m[1]).sort();
    expect(routes).toEqual(PAGE_SEO.map((row) => row.path).sort());
  });
});
```

Run: `npx vitest run tests/verify-og-tags-table-routes.test.ts`
Expected: FAIL, `TABLE_ROUTES array not found`.

- [ ] **Step 2: Change the script**

Apply these edits to `scripts/verify-og-tags.sh`:

1. Replace `BASE_URL="${BASE_URL:-https://divine.video}"` with:

```bash
PRODUCTION_BASE_URL="https://divine.video"
BASE_URL="${BASE_URL:-${PRODUCTION_BASE_URL}}"
```

2. Append to `USER_AGENTS`, before its closing `)`:

```bash
  # Not on Fastly's isSocialMediaCrawler() list: fixed pages must preview as
  # themselves in every app, not only allowlisted crawlers (#726).
  "mastodon|http.rb/5.1.1 (Mastodon/4.2.0; +https://mastodon.social/)"
```

3. Remove the `/family`, `/age-review` and `/kids` entries from `ROUTES` (they move to `TABLE_ROUTES`), and add after the `ROUTES` array:

```bash
# Fixed public pages whose tags are written into static HTML at build time from
# src/seo/pageSeo.ts (#726): every row of that table, and nothing else.
# tests/verify-og-tags-table-routes.test.ts keeps this list equal to the table.
TABLE_ROUTES=(
  "/authenticity" "/privacy" "/terms" "/open-source" "/proofmode"
  "/human-created" "/dmca" "/safety" "/family" "/family/talking-to-your-teen"
  "/family/media-plan" "/family/when-something-goes-wrong" "/family/safety-tools"
  "/age-review" "/kids" "/download" "/exit" "/exit/start" "/delete-account"
  "/support" "/faq" "/get-embed" "/services" "/merch" "/leaderboard"
  "/trending" "/popular" "/hashtags"
)
```

4. Replace the comment above `CRAWLER_UA_LABELS` (it wrongly says linkedin is not on the Fastly list) with `# linkedin and chrome are defined but not asserted on here.`, and add after that array:

```bash

# Run against TABLE_ROUTES only: static pages must not depend on the allowlist.
TABLE_ONLY_UA_LABELS=(
  "mastodon"
)
```

5. Add next to `get_user_agent`:

```bash
is_table_route() {
  local wanted="$1"
  local table_path
  for table_path in "${TABLE_ROUTES[@]}"; do
    [[ "$table_path" == "$wanted" ]] && return 0
  done
  return 1
}

# Cloudflare Pages deployments (production and previews) are served on *.pages.dev.
is_cloudflare_target() {
  local host="${BASE_URL#*://}"
  host="${host%%/*}"
  host="${host%%:*}"
  [[ "$host" == *.pages.dev ]]
}

# Run one route against the given User-Agent labels, honoring UA_ONLY.
audit_route() {
  local path="$1" description="$2" assertions="$3"
  shift 3

  echo
  echo "-- ${description} --"
  echo "   path: ${path}"

  local ua_label
  for ua_label in "$@"; do
    if [[ -n "$UA_ONLY" && "$UA_ONLY" != "$ua_label" ]]; then
      continue
    fi

    local ua_value
    if ! ua_value=$(get_user_agent "$ua_label"); then
      echo "ERROR: unknown User-Agent label '${ua_label}'"
      exit 2
    fi

    total_checks=$((total_checks + 1))
    run_check "$path" "$description" "$assertions" "$ua_label" "$ua_value"
  done
}
```

6. In the `og_url_matches_path)` case, wrap the existing `case "$path" in ... esac` and the `if/elif` chain that follows it in an `else` branch of this new check, and delete the `/family)` alternate (it is a table route now):

```bash
        if is_table_route "$path"; then
          # Static files always name the production URL, whatever host serves
          # them (Cloudflare, local Fastly, dvine.video). No trailing slash and no
          # homepage URL: a homepage og:url is exactly the bug these pages fix.
          if [[ "$og_url" != "${PRODUCTION_BASE_URL}${path}" && "$og_url" != "${BASE_URL}${path}" ]]; then
            all_passed=false
            echo "    FAIL: og:url is not the page's canonical URL"
            echo "          expected: ${PRODUCTION_BASE_URL}${path}"
            echo "          got:      ${og_url:-<missing>}"
          fi
        else
          # ...existing case "$path" in (keeping only /discovery/hot|/discovery/classics) and if/elif chain...
        fi
```

7. In `og_title_not_brand)`, make a missing `og:title` fail before the brand comparison:

```bash
        if [[ -z "$og_title" ]]; then
          all_passed=false
          echo "    FAIL: missing og:title tag"
        elif ...existing brand comparison...
```

8. Replace the main loop's body so both lists run through `audit_route`:

```bash
  for route_entry in "${ROUTES[@]}"; do
    local path="${route_entry%%|*}"
    local rest="${route_entry#*|}"
    local description="${rest%%|*}"
    local assertions="${rest#*|}"
    audit_route "$path" "$description" "$assertions" "${CRAWLER_UA_LABELS[@]}"
  done

  local table_path
  for table_path in "${TABLE_ROUTES[@]}"; do
    if [[ "$table_path" == "/faq" ]] && is_cloudflare_target; then
      # Cloudflare redirects /faq to about.divine.video/faqs/ (public/_redirects)
      # while Fastly serves the prerendered page. That host split is a separate
      # change (#726 design, Non-goals); only Fastly has a /faq preview.
      echo
      echo "-- fixed page /faq: skipped on Cloudflare (deferred /faq host split) --"
      continue
    fi
    audit_route "$table_path" "fixed page" "og_title_not_brand && og_url_matches_path" \
      "${CRAWLER_UA_LABELS[@]}" "${TABLE_ONLY_UA_LABELS[@]}"
  done
```

9. Update the `~64 live requests` comment (line 124) to `~190 live requests`.

- [ ] **Step 3: Update the resilience test and workflow**

In `tests/verify-og-tags-network-resilience.test.ts`, change `'FAILED: 1 of 16 checks did not pass'` to `'FAILED: 1 of 41 checks did not pass'` (13 remaining routes plus 28 table routes; `UA_ONLY=slackbot` filters out mastodon) and the ABOUTME's `out of 64` to `out of about 190`.

In `.github/workflows/og-audit.yml`, raise `timeout-minutes` for the production job from 5 to 10 and the Cloudflare job from 8 to 15 (the check now makes about three times as many requests).

- [ ] **Step 4: Run the tests and the script against production**

```bash
npx vitest run tests/verify-og-tags-table-routes.test.ts tests/verify-og-tags-network-resilience.test.ts tests/og-audit-alerting.test.ts
BASE_URL=https://divine.video UA_ONLY=mastodon bash scripts/verify-og-tags.sh | tail -20
```

Expected: tests PASS. Against today's production the script FAILS on the table pages still served without static heads (for example `/kids`, `/support`) and passes `/privacy`, `/faq` and `/family`: this is the bug, reproduced by the new check before the fix ships.

- [ ] **Step 5: Commit**

```bash
git add scripts/verify-og-tags.sh tests/verify-og-tags-network-resilience.test.ts tests/verify-og-tags-table-routes.test.ts .github/workflows/og-audit.yml
git commit -m "test(og): audit every fixed page's preview in production, including unrecognised apps"
```

---

### Task 9: Documentation, full verification, and the copy review

**Files:**
- Modify: `ARCHITECTURE.md` (Build Pipeline, around lines 130-136), `index.html` (comment at lines 12-15), `docs/superpowers/specs/2026-09-24-page-link-previews-design.md` (implementation notes)

- [ ] **Step 1: Update `ARCHITECTURE.md`**

Replace the Build Pipeline block with:

```
vite build
cp dist/index.html dist/404.html
node scripts/copy-well-known.mjs
node scripts/prerender-legal.mjs      # legal pages, /faq, /services: full body + table head
node scripts/prerender-marketing.mjs  # /family/*: React SSG body + table head
node scripts/prerender-pages.mjs      # every other fixed page: shell + table head; sitemap.xml; self-check
node scripts/verify-well-known.mjs
```

and add one paragraph after it:

```
Fixed public pages (legal, family, kids, support, and the rest) take their
title, description, and preview image from `src/seo/pageSeo.ts`, the only
place that copy is written. The build writes each page's tags into a static
`dist/<path>/index.html` so any link-preview app sees them without running
JavaScript, generates `dist/sitemap.xml`, and fails if any page's tags do not
match the table. In the browser, `src/components/PageSeoForRoute.tsx` sets the
tab title from the same table. Adding a public route without a table row or an
exclusion reason fails `src/seo/pageRoutes.test.ts`.
```

- [ ] **Step 2: Update the `index.html` comment**

Change the comment at lines 12-15 so it no longer claims no page has a static canonical: `<!-- No static canonical in this shell: it is served for every SPA route. Fixed pages get their own canonical and preview tags at build time (scripts/prerender-pages.mjs); other routes set theirs client-side. -->`

- [ ] **Step 3: Note implementation choices in the spec**

In the spec's section 2, replace "One head renderer (plain JS, importable by build scripts)" with "One head renderer (`src/seo/headTags.ts`, loaded by build scripts through Vite SSR, so it is type-checked and linted like the rest of `src/`)". Add under Open Items: "Preview titles default to the untranslated page title without the tab suffix; `/faq` sets `previewTitle` so its preview reads 'Frequently Asked Questions' rather than 'FAQ'."

- [ ] **Step 4: Full test suite on Node 20**

```bash
npx -y -p node@20 npm test
```

Expected: tsc, eslint, all vitest files and `vite build` pass. Paste the vitest summary line into the PR description.

- [ ] **Step 5: Full build and local Fastly check**

```bash
npx -y -p node@20 npm run build
npm run fastly:local &
```

When the local server is up (default `http://127.0.0.1:7676`), run:

```bash
for ua in "facebookexternalhit/1.1" "http.rb/5.1.1 (Mastodon/4.2.0; +https://mastodon.social/)"; do
  for p in /kids /age-review /download /support /proofmode /exit/start /terms /family/media-plan /discovery; do
    printf '%s %s ' "$ua" "$p"
    curl -s -A "$ua" "http://127.0.0.1:7676$p" | grep -o '<meta property="og:url" content="[^"]*"' | head -1
  done
done
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' "http://127.0.0.1:7676/account-portability?x=1"
BASE_URL=http://127.0.0.1:7676 bash scripts/verify-og-tags.sh | tail -5
```

Expected: every fixed page shows its own `https://divine.video<path>` for both user agents; `/discovery` still shows its edge preview for Facebook; `/account-portability?x=1` returns `301 http://127.0.0.1:7676/exit?x=1`; the audit summary shows no failures. Stop the local server afterwards.

- [ ] **Step 6: Cloudflare preview check**

Push the branch; the PR's `deploy-preview` job publishes a preview. Read its URL from `gh pr checks 728`, then run:

```bash
BASE_URL=<preview-url> bash scripts/verify-og-tags.sh | tail -5
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' "<preview-url>/account-portability"
```

Expected: no failures (`/faq` reported as skipped); `/account-portability` returns 301 to `/exit`.

- [ ] **Step 7: Prepare the copy review for Marketing/Comms**

Produce a table (path, tab title, preview title, description) from `resolveAllPageSeoForBuild()` and hand it to Matt for Marketing/Comms. Flag for their decision:
- `/dmca` description replaced (old copy described sections the page no longer has).
- `/faq` tab title becomes "FAQ - Divine" (from the page's translated heading); preview title "Frequently Asked Questions".
- `/services` title becomes "Divine services" (lowercase s, from the page's translated title).
- `/merch` description names the print vendor; it is existing shipped copy.
- Whether the em-dash titles (`Merch — Divine`, `Account review — Divine`, `Kids on Divine — …`, family) move to " - Divine".

Merge waits for their approval.

- [ ] **Step 8: Commit**

```bash
git add ARCHITECTURE.md index.html docs/superpowers/specs/2026-09-24-page-link-previews-design.md
git commit -m "docs: describe the fixed-page preview table and build step"
```

## After merge (not part of the PR)

- CI deploys both Fastly halves and purges. If deploying by hand: `npm run fastly:deploy && npm run fastly:publish`, then purge the cache.
- `BASE_URL=https://divine.video bash scripts/verify-og-tags.sh` shows no failures.
- Re-scrape `https://divine.video/kids` in Facebook's Sharing Debugger.
