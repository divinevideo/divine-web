// ABOUTME: Cloudflare Pages Function to handle SPA routing and route-specific social metadata
// ABOUTME: Returns index.html with a 200 status for SPA routes and injects per-video OG/Twitter tags for bots

import {
  buildAgeReviewPageMeta,
  buildCategoriesIndexMeta,
  buildCategoryPageMeta,
  buildFamilyPageMeta,
  buildKidsPolicyPageMeta,
  buildProfilePageMeta,
  buildVideoPageMeta,
  decodeNpubToHex,
  extractCategoryName,
  extractProfileNpub,
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

function replaceTitle(html: string, title: string): string {
  return html.replace(/<title>[^<]*<\/title>/i, `<title>${escapeHtml(title)}</title>`);
}

function upsertMetaTag(html: string, attribute: 'name' | 'property', key: string, content: string): string {
  const escapedKey = escapeRegExp(key);
  const pattern = new RegExp(`(<meta[^>]+${attribute}="${escapedKey}"[^>]+content=")[^"]*(".*?>)`, 'i');
  const escapedContent = escapeHtml(content);

  if (pattern.test(html)) {
    return html.replace(pattern, `$1${escapedContent}$2`);
  }

  return html.replace(
    '</head>',
    `    <meta ${attribute}="${key}" content="${escapedContent}" />\n  </head>`
  );
}

function upsertLinkTag(html: string, rel: string, type: string, href: string): string {
  const linkTag = `<link rel="${rel}" type="${type}" href="${href}">`;
  const pattern = new RegExp(`<link[^>]+rel="${rel}"[^>]*>`, 'i');

  if (pattern.test(html)) {
    return html.replace(pattern, linkTag);
  }

  return html.replace('</head>', `${linkTag}</head>`);
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
  } else {
    updatedHtml = removeMetaTag(updatedHtml, 'property', 'og:video');
    updatedHtml = removeMetaTag(updatedHtml, 'property', 'og:video:secure_url');
  }

  if (meta.videoMimeType) {
    updatedHtml = upsertMetaTag(updatedHtml, 'property', 'og:video:type', meta.videoMimeType);
  } else {
    updatedHtml = removeMetaTag(updatedHtml, 'property', 'og:video:type');
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
  const match = url.pathname.match(/^\/video\/([^/]+)$/);
  if (!match) {
    return null;
  }

  const identifier = decodeURIComponent(match[1]);

  try {
    const response = await fetch(`${FUNNELCAKE_API_URL}/api/videos/${identifier}`);
    if (!response.ok) {
      return null;
    }

    const payload = await response.json() as VideoApiResponse;
    if (!payload.event) {
      return null;
    }

    return buildVideoPageMeta(url, payload);
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

  return null;
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

  // Try to serve the requested asset first
  const response = await context.next();
  const meta = await fetchRouteMeta(url);

  if (meta && response.ok && response.headers.get('content-type')?.includes('text/html')) {
    const html = injectMetaTags(await response.text(), meta);
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

      if (meta) {
        const html = injectMetaTags(await indexResponse.text(), meta, path);
        const headers = new Headers(indexResponse.headers);
        headers.set('content-type', 'text/html; charset=UTF-8');

        return new Response(html, {
          status: 200,
          headers,
        });
      }

      // Return index.html with 200 status code
      return new Response(indexResponse.body, {
        status: 200,
        headers: indexResponse.headers,
      });
    }
  }

  return response;
}