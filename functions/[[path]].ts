// ABOUTME: Cloudflare Pages Function to handle SPA routing and route-specific social metadata
// ABOUTME: Returns index.html with a 200 status for SPA routes and injects per-video OG/Twitter tags for bots

import {
  buildAgeReviewPageMeta,
  buildCategoriesIndexMeta,
  buildCategoryPageMeta,
  buildDownloadPageMeta,
  buildFamilyPageMeta,
  buildKidsPolicyPageMeta,
  buildProfilePageMeta,
  buildVideoPageMeta,
  decodeNpubToHex,
  extractCategoryName,
  extractProfileNpub,
  getDefaultPageMeta,
  safeDecodeURIComponent,
  type PageMeta,
  type ProfileApiResponse,
  type VideoApiResponse,
} from '../src/lib/serverSocialMeta';

const FUNNELCAKE_API_URL = 'https://relay.divine.video';

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// `String.prototype.replace` reads `$&`, `$'`, `` $` ``, `$1`-`$9` and `$$` in a
// replacement *string* as substitution patterns. Route text arrives straight from
// the URL, so every helper below builds its replacement in a function instead,
// where the returned value is inserted verbatim.
function replaceTitle(html: string, title: string): string {
  return html.replace(/<title>[^<]*<\/title>/i, () => `<title>${escapeHtml(title)}</title>`);
}

function upsertMetaTag(html: string, attribute: 'name' | 'property', key: string, content: string): string {
  const escapedKey = escapeRegExp(key);
  const pattern = new RegExp(`(<meta[^>]+${attribute}="${escapedKey}"[^>]+content=")[^"]*(".*?>)`, 'i');
  const escapedContent = escapeHtml(content);

  if (pattern.test(html)) {
    return html.replace(pattern, (_match, prefix: string, suffix: string) => `${prefix}${escapedContent}${suffix}`);
  }

  return html.replace(
    '</head>',
    () => `    <meta ${attribute}="${key}" content="${escapedContent}" />\n  </head>`
  );
}

function upsertLinkTag(html: string, rel: string, type: string, href: string): string {
  const linkTag = `<link rel="${rel}" type="${type}" href="${href}">`;
  const pattern = new RegExp(`<link[^>]+rel="${rel}"[^>]*>`, 'i');

  if (pattern.test(html)) {
    return html.replace(pattern, () => linkTag);
  }

  return html.replace('</head>', () => `${linkTag}</head>`);
}

function isVideoPage(path: string): boolean {
  return /^\/video\/([^/]+)$/.test(path);
}

function extractVideoId(path: string): string | null {
  const match = path.match(/^\/video\/([^/]+)$/);
  return match ? match[1] : null;
}

function removeMetaTag(html: string, attribute: 'name' | 'property', key: string): string {
  const escapedKey = escapeRegExp(key);
  return html.replace(new RegExp(`\\s*<meta[^>]+${attribute}="${escapedKey}"[^>]*>\\s*`, 'ig'), '');
}

function injectMetaTags(html: string, meta: PageMeta, path: string): string {
  let updatedHtml = replaceTitle(html, meta.title);

  updatedHtml = upsertMetaTag(updatedHtml, 'name', 'description', meta.description);
  updatedHtml = upsertMetaTag(updatedHtml, 'property', 'og:type', meta.ogType);
  updatedHtml = upsertMetaTag(updatedHtml, 'property', 'og:url', meta.url);
  updatedHtml = upsertMetaTag(updatedHtml, 'property', 'og:title', meta.title);
  updatedHtml = upsertMetaTag(updatedHtml, 'property', 'og:description', meta.description);
  updatedHtml = upsertMetaTag(updatedHtml, 'property', 'og:image', meta.image);
  updatedHtml = upsertMetaTag(updatedHtml, 'property', 'og:image:alt', meta.imageAlt);
  updatedHtml = upsertMetaTag(updatedHtml, 'name', 'twitter:card', meta.twitterCard);
  updatedHtml = upsertMetaTag(updatedHtml, 'name', 'twitter:title', meta.title);
  updatedHtml = upsertMetaTag(updatedHtml, 'name', 'twitter:description', meta.description);
  updatedHtml = upsertMetaTag(updatedHtml, 'name', 'twitter:image', meta.image);

  if (meta.videoUrl) {
    updatedHtml = upsertMetaTag(updatedHtml, 'property', 'og:video', meta.videoUrl);
    updatedHtml = upsertMetaTag(updatedHtml, 'property', 'og:video:secure_url', meta.videoUrl);
    updatedHtml = upsertMetaTag(updatedHtml, 'property', 'og:video:width', String(meta.videoWidth || 720));
    updatedHtml = upsertMetaTag(updatedHtml, 'property', 'og:video:height', String(meta.videoHeight || 1280));
  } else {
    updatedHtml = removeMetaTag(updatedHtml, 'property', 'og:video');
    updatedHtml = removeMetaTag(updatedHtml, 'property', 'og:video:secure_url');
    updatedHtml = removeMetaTag(updatedHtml, 'property', 'og:video:width');
    updatedHtml = removeMetaTag(updatedHtml, 'property', 'og:video:height');
  }

  if (meta.videoMimeType) {
    updatedHtml = upsertMetaTag(updatedHtml, 'property', 'og:video:type', meta.videoMimeType);
  } else {
    updatedHtml = removeMetaTag(updatedHtml, 'property', 'og:video:type');
  }

  if (meta.twitterPlayerUrl) {
    updatedHtml = upsertMetaTag(updatedHtml, 'name', 'twitter:player', meta.twitterPlayerUrl);
    updatedHtml = upsertMetaTag(updatedHtml, 'name', 'twitter:player:width', String(meta.videoWidth || 720));
    updatedHtml = upsertMetaTag(updatedHtml, 'name', 'twitter:player:height', String(meta.videoHeight || 1280));
    updatedHtml = upsertMetaTag(updatedHtml, 'name', 'twitter:player:stream', meta.videoUrl || '');
    updatedHtml = upsertMetaTag(
      updatedHtml,
      'name',
      'twitter:player:stream:content_type',
      meta.videoMimeType || 'video/mp4'
    );
  }

  if (isVideoPage(path)) {
    const videoId = extractVideoId(path);
    if (videoId) {
      const videoUrl = `https://divine.video/video/${videoId}`;
      const oembedUrl = `https://relay.divine.video/api/oembed?url=${encodeURIComponent(videoUrl)}`;
      updatedHtml = upsertLinkTag(updatedHtml, 'alternate', 'application/json+oembed', oembedUrl);
    }
  }

  return updatedHtml;
}

async function fetchVideoMeta(url: URL): Promise<PageMeta | null> {
  const match = url.pathname.match(/^\/(?:video|embed)\/([^/]+)$/);
  if (!match) {
    return null;
  }

  const identifier = safeDecodeURIComponent(match[1]);

  try {
    const response = await fetch(`${FUNNELCAKE_API_URL}/api/videos/${identifier}`);
    if (!response.ok) {
      return null;
    }

    const payload = await response.json() as VideoApiResponse;
    if (!payload.event) {
      return null;
    }

    const pageUrl = new URL(`/video/${encodeURIComponent(identifier)}`, url);
    return buildVideoPageMeta(pageUrl, payload);
  } catch {
    return null;
  }
}

function buildSimplePageMeta(
  url: URL,
  title: string,
  description: string,
  imageAlt = title
): PageMeta {
  return {
    ...getDefaultPageMeta(url),
    title,
    description,
    imageAlt,
  };
}

function buildSimpleRouteMeta(url: URL): PageMeta | null {
  const hashtagMatch = url.pathname.match(/^\/t\/([^/]+)$/);
  if (hashtagMatch) {
    const hashtag = safeDecodeURIComponent(hashtagMatch[1]).replace(/^#/, '').trim();
    return hashtag
      ? buildSimplePageMeta(url, `#${hashtag} videos on Divine`, `Watch the latest #${hashtag} videos on Divine.`)
      : null;
  }

  if (url.pathname === '/search') {
    const query = url.searchParams.get('q')?.trim().slice(0, 80);
    return query
      ? buildSimplePageMeta(url, `"${query}" on Divine`, `Search Divine for "${query}" — watch loops, find creators, follow what you love.`)
      : null;
  }

  const discoveryMatch = url.pathname.match(/^\/discovery(?:\/(new|hot|classics|top|hashtags|foryou))?$/);
  if (discoveryMatch) {
    const labels = {
      trending: 'Trending videos',
      new: 'Trending videos',
      hot: 'Trending videos',
      classics: 'Classic videos',
      top: 'Classic videos',
      hashtags: 'Trending hashtags',
      foryou: 'For you videos',
    } as const;
    const feedType = discoveryMatch[1] as keyof typeof labels | undefined;
    const label = labels[feedType || 'trending'];
    return buildSimplePageMeta(url, `${label} on Divine`, `${label} on Divine — 6-second loops from real humans.`);
  }

  if (url.pathname === '/') {
    return buildSimplePageMeta(
      url,
      'Divine — 6-second loops from real humans',
      'Watch and share 6-second looping videos on the decentralized Nostr network.'
    );
  }

  return null;
}

async function fetchAtUsernameMeta(url: URL): Promise<PageMeta | null> {
  const match = url.pathname.match(/^\/@([a-zA-Z0-9_-]+)$/);
  if (!match) {
    return null;
  }

  const username = match[1].toLowerCase();

  try {
    const resolutionResponse = await fetch(
      `https://divine.video/.well-known/nostr.json?name=${encodeURIComponent(username)}`
    );
    if (!resolutionResponse.ok) {
      return null;
    }

    const resolution = await resolutionResponse.json() as { names?: Record<string, string> };
    const pubkey = resolution.names?.[username];
    if (!pubkey || !/^[0-9a-f]{64}$/i.test(pubkey)) {
      return null;
    }

    const profileResponse = await fetch(`${FUNNELCAKE_API_URL}/api/users/${pubkey}`);
    if (profileResponse.ok) {
      const profile = await profileResponse.json() as ProfileApiResponse;
      if (profile.profile) {
        return buildProfilePageMeta(url, profile);
      }
    }

    return buildProfilePageMeta(url, { profile: { name: username } });
  } catch {
    return null;
  }
}

async function fetchProfileMeta(url: URL): Promise<PageMeta | null> {
  const npub = extractProfileNpub(url.pathname);
  if (!npub) {
    return null;
  }

  const pubkey = decodeNpubToHex(npub);
  if (!pubkey) {
    return null;
  }

  try {
    const response = await fetch(`${FUNNELCAKE_API_URL}/api/users/${pubkey}`);
    if (!response.ok) {
      return null;
    }

    const payload = await response.json() as ProfileApiResponse;
    if (!payload.profile) {
      return null;
    }

    return buildProfilePageMeta(url, payload);
  } catch {
    return null;
  }
}

async function fetchCategoryMeta(url: URL): Promise<PageMeta | null> {
  if (url.pathname === '/category') {
    return buildCategoriesIndexMeta(url);
  }

  const categoryName = extractCategoryName(url.pathname);
  if (!categoryName) {
    return null;
  }

  try {
    const response = await fetch(`${FUNNELCAKE_API_URL}/api/categories`);
    if (!response.ok) {
      return buildCategoryPageMeta(url);
    }

    const payload = await response.json() as Array<{ name: string; video_count?: number }>;
    const matchedCategory = payload.find(category => category.name.toLowerCase() === categoryName.toLowerCase());

    return buildCategoryPageMeta(url, matchedCategory);
  } catch {
    return buildCategoryPageMeta(url);
  }
}

async function fetchRouteMeta(url: URL): Promise<PageMeta | null> {
  if (url.pathname.startsWith('/video/')) {
    return fetchVideoMeta(url);
  }

  if (url.pathname === '/category' || url.pathname.startsWith('/category/')) {
    return fetchCategoryMeta(url);
  }

  if (url.pathname.startsWith('/profile/')) {
    return fetchProfileMeta(url);
  }

  if (url.pathname.startsWith('/@')) {
    return fetchAtUsernameMeta(url);
  }

  // Family resource hub at /family on apex.
  if (url.pathname === '/family') {
    return buildFamilyPageMeta(url);
  }

  // Age-review page at /age-review on apex.
  if (url.pathname === '/age-review') {
    return buildAgeReviewPageMeta(url);
  }

  // Kids policy page at /kids on apex.
  if (url.pathname === '/kids') {
    return buildKidsPolicyPageMeta(url);
  }

  if (url.pathname === '/download') {
    return buildDownloadPageMeta(url);
  }

  return buildSimpleRouteMeta(url);
}

function renderEmbedPage(meta: PageMeta): string {
  const title = escapeHtml(meta.title);
  const poster = escapeHtml(meta.image);
  const videoUrl = escapeHtml(meta.videoUrl || '');
  const mimeType = escapeHtml(meta.videoMimeType || 'video/mp4');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <style>
    html,body{margin:0;padding:0;height:100%;background:#000;overflow:hidden}
    video{width:100vw;height:100vh;object-fit:contain;display:block}
  </style>
</head>
<body>
  <video autoplay loop muted playsinline poster="${poster}">
    <source src="${videoUrl}" type="${mimeType}">
  </video>
</body>
</html>`;
}

export async function onRequest(context: {
  request: Request;
  next: () => Promise<Response>;
  env: Record<string, unknown>;
}) {
  const url = new URL(context.request.url);
  const path = url.pathname;

  // Serve .well-known files directly - don't intercept them
  if (path.startsWith('/.well-known/')) {
    return context.next();
  }

  if (/^\/embed\/[^/]+$/.test(path)) {
    const meta = await fetchVideoMeta(url);
    if (!meta?.videoUrl) {
      return new Response('Video not found', { status: 404 });
    }

    return new Response(renderEmbedPage(meta), {
      status: 200,
      headers: {
        'content-type': 'text/html; charset=UTF-8',
        'cache-control': 'public, max-age=300',
        'content-security-policy': 'frame-ancestors *',
        'x-robots-tag': 'noindex',
      },
    });
  }

  // Try to serve the requested asset first
  const response = await context.next();
  const meta = await fetchRouteMeta(url);

  if (meta && response.ok && response.headers.get('content-type')?.includes('text/html')) {
    const html = injectMetaTags(await response.text(), meta, path);
    const headers = new Headers(response.headers);
    headers.set('content-type', 'text/html; charset=UTF-8');

    return new Response(html, {
      status: response.status,
      headers,
    });
  }

  // If the response is a 404 and not a file request (no extension or is .html),
  // serve index.html with a 200 status code
  if (response.status === 404) {
    // Check if this is a route (not a static asset)
    const hasExtension = path.includes('.') && !path.endsWith('.html');

    if (!hasExtension) {
      // Fetch index.html from the static assets
      const indexUrl = new URL('/index.html', context.request.url);
      const indexResponse = await fetch(indexUrl);
      const html = injectMetaTags(
        await indexResponse.text(),
        meta || getDefaultPageMeta(url),
        path
      );
      const headers = new Headers(indexResponse.headers);
      headers.set('content-type', 'text/html; charset=UTF-8');

      return new Response(html, {
        status: 200,
        headers,
      });
    }
  }

  return response;
}
