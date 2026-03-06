// ABOUTME: Cloudflare Pages Function to handle SPA routing and route-specific social metadata
// ABOUTME: Returns index.html with a 200 status for SPA routes and injects per-video OG/Twitter tags for bots

const FUNNELCAKE_API_URL = 'https://relay.divine.video';
const DEFAULT_OG_IMAGE = 'https://divine.video/og.png';

interface VideoApiResponse {
  event: {
    id: string;
    content: string;
    tags: string[][];
  };
  stats?: {
    author_name?: string;
  };
}

interface PageMeta {
  title: string;
  description: string;
  ogType: string;
  url: string;
  image: string;
  imageAlt: string;
  twitterCard: string;
  videoUrl?: string;
  videoMimeType?: string;
}

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

function truncateText(value: string, maxLength: number): string {
  const trimmed = value.replace(/\s+/g, ' ').trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  return `${trimmed.slice(0, maxLength - 1).trimEnd()}…`;
}

function getTagValue(tags: string[][], name: string): string | undefined {
  return tags.find(tag => tag[0] === name)?.[1];
}

function parseImeta(tags: string[][]): { url?: string; image?: string; mimeType?: string } {
  const imetaTag = tags.find(tag => tag[0] === 'imeta');
  if (!imetaTag) {
    return {};
  }

  const parsed: { url?: string; image?: string; mimeType?: string } = {};

  for (let i = 1; i < imetaTag.length; i += 1) {
    const part = imetaTag[i];
    const separatorIndex = part.indexOf(' ');
    if (separatorIndex === -1) {
      continue;
    }

    const key = part.slice(0, separatorIndex);
    const value = part.slice(separatorIndex + 1).trim();

    if (key === 'url') parsed.url = value;
    if (key === 'image') parsed.image = value;
    if (key === 'm') parsed.mimeType = value;
  }

  return parsed;
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

function removeMetaTag(html: string, attribute: 'name' | 'property', key: string): string {
  const escapedKey = escapeRegExp(key);
  return html.replace(new RegExp(`\\s*<meta[^>]+${attribute}="${escapedKey}"[^>]*>\\s*`, 'ig'), '');
}

function injectMetaTags(html: string, meta: PageMeta): string {
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

    const title = getTagValue(payload.event.tags, 'title')
      || getTagValue(payload.event.tags, 'alt')
      || 'Video on diVine';
    const authorName = payload.stats?.author_name;
    const description = truncateText(
      getTagValue(payload.event.tags, 'summary')
        || payload.event.content
        || getTagValue(payload.event.tags, 'alt')
        || (authorName ? `Watch this video by ${authorName} on diVine` : 'Watch this video on diVine'),
      200
    );
    const media = parseImeta(payload.event.tags);

    return {
      title,
      description,
      ogType: 'video.other',
      url: url.toString(),
      image: media.image || DEFAULT_OG_IMAGE,
      imageAlt: title,
      twitterCard: 'summary_large_image',
      videoUrl: media.url,
      videoMimeType: media.mimeType,
    };
  } catch {
    return null;
  }
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

  // If the response is a 404 and not a file request (no extension or is .html),
  // serve index.html with a 200 status code
  if (response.status === 404) {
    // Check if this is a route (not a static asset)
    const hasExtension = path.includes('.') && !path.endsWith('.html');

    if (!hasExtension) {
      // Fetch index.html from the static assets
      const indexUrl = new URL('/index.html', context.request.url);
      const indexResponse = await fetch(indexUrl);
      const meta = await fetchVideoMeta(url);

      if (meta) {
        const html = injectMetaTags(await indexResponse.text(), meta);
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
