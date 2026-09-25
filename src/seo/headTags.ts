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
  image: { url: string; width: number; height: number; type: 'image/png'; alt: string };
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
