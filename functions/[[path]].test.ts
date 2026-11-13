import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

import { onRequest } from './[[path]]';
import { DISCOVERY_DESCRIPTION } from '../src/lib/discoveryMeta';

const INDEX_HTML = readFileSync('index.html', 'utf8');
const SHELL_META = new DOMParser().parseFromString(INDEX_HTML, 'text/html');
const SHELL_TITLE = SHELL_META.title;

describe('functions/[[path]]', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => {
      const url = typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

      if (url.endsWith('/index.html')) {
        return new Response(INDEX_HTML, {
          status: 200,
          headers: { 'content-type': 'text/html; charset=UTF-8' },
        });
      }

      if (url.includes('/api/videos/abc123')) {
        return new Response(JSON.stringify({
          event: {
            id: 'abc123',
            content: '',
            tags: [
              ['title', 'Bangkok rooftop'],
              ['summary', 'Skyline views over Bangkok'],
              ['imeta', 'url https://media.divine.video/abc123.mp4', 'm video/mp4', 'image https://media.divine.video/abc123.jpg', 'dim 1080x1080'],
            ],
          },
          stats: {
            author_name: 'TravelTelly',
          },
        }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }

      if (url.includes('/api/videos/blank-title')) {
        return new Response(JSON.stringify({
          event: {
            id: 'blank-title',
            content: 'Choo choo!\n\nInspired by nostr:npub15l5atkgtzladdezjdnjc7zhej7uvzjpxaj7mctpe2hnwyk85qqxqjuecgm',
            tags: [
              ['title', ''],
              ['summary', 'Choo choo!'],
              ['alt', ''],
              ['imeta', 'url https://media.divine.video/blank-title.mp4', 'm video/mp4', 'image https://media.divine.video/blank-title.jpg'],
            ],
          },
          stats: {
            author_name: 'The Wall!',
          },
        }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }

      if (url.includes('/api/users/076c979382b90f5d3a2b21f95e1ee86b6033f14c92e79b7fad3fe1f1073f4886')) {
        return new Response(JSON.stringify({
          pubkey: '076c979382b90f5d3a2b21f95e1ee86b6033f14c92e79b7fad3fe1f1073f4886',
          profile: {
            name: '',
            display_name: 'The Wall!',
            about: 'How can you have any pudding if you have not eaten your meat? ',
            picture: 'https://media.divine.video/545aff83f83b4643f340747213e86520fac83596f899e8ea3117e0aa8b260f7b',
          },
          stats: {
            video_count: 125,
          },
        }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }

      if (url.includes('/.well-known/nostr.json?name=jalcine')) {
        return new Response(JSON.stringify({
          names: {
            jalcine: '076c979382b90f5d3a2b21f95e1ee86b6033f14c92e79b7fad3fe1f1073f4886',
          },
        }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }

      if (url.includes('/api/categories')) {
        return new Response(JSON.stringify([
          { name: 'dance', video_count: 895 },
          { name: 'music', video_count: 1812 },
        ]), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }

      return new Response('not found', { status: 404 });
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('injects video-specific social metadata for video routes', async () => {
    const response = await onRequest({
      request: new Request('https://divine.video/video/abc123'),
      next: async () => new Response('not found', { status: 404 }),
      env: {},
    });

    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain('<title>Bangkok rooftop</title>');
    expect(html).toContain('property="og:url" content="https://divine.video/video/abc123"');
    expect(html).toContain('property="og:type" content="video.other"');
    expect(html).toContain('property="og:title" content="Bangkok rooftop"');
    expect(html).toContain('property="og:description" content="Skyline views over Bangkok"');
    expect(html).toContain('property="og:image" content="https://media.divine.video/abc123.jpg"');
    expect(html).toContain('property="og:video" content="https://media.divine.video/abc123.mp4"');
    expect(html).toContain('property="og:video:type" content="video/mp4"');
    expect(html).toContain('name="twitter:card" content="player"');
    expect(html).toContain('name="twitter:player" content="https://divine.video/embed/abc123"');
    expect(html).toContain('property="og:video:width" content="1080"');
    expect(html).toContain('property="og:video:height" content="1080"');
    expect(html).toContain('name="twitter:player:width" content="1080"');
    expect(html).toContain('name="twitter:player:height" content="1080"');
    expect(html).toContain('name="twitter:title" content="Bangkok rooftop"');
    expect(html).toContain('rel="alternate" type="application/json+oembed"');
    expect(html).toContain('href="https://relay.divine.video/api/oembed?url=https%3A%2F%2Fdivine.video%2Fvideo%2Fabc123"');
  });

  it('serves the video embed with iframe and indexing headers', async () => {
    const response = await onRequest({
      request: new Request('https://divine.video/embed/abc123'),
      next: async () => new Response('not found', { status: 404 }),
      env: {},
    });

    const html = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-security-policy')).toBe('frame-ancestors *');
    expect(response.headers.get('x-robots-tag')).toBe('noindex');
    expect(html).toContain('html,body{margin:0;padding:0;height:100%;background:#000;overflow:hidden}');
    expect(html).toContain('video{width:100vw;height:100vh;object-fit:contain;display:block}');
    expect(html).toContain('<video autoplay loop muted playsinline');
    expect(html).toContain('src="https://media.divine.video/abc123.mp4"');
  });

  it('leaves the trailing-slash embed widget route to static routing', async () => {
    const next = vi.fn(async () => new Response('Divine Video Widget', { status: 200 }));
    const response = await onRequest({
      request: new Request('https://divine.video/embed/'),
      next,
      env: {},
    });

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('Divine Video Widget');
    expect(next).toHaveBeenCalledOnce();
  });

  it('returns a normal not-found response for a malformed embed identifier', async () => {
    const response = await onRequest({
      request: new Request('https://divine.video/embed/%zz'),
      next: async () => new Response('not found', { status: 404 }),
      env: {},
    });

    expect(response.status).toBe(404);
    expect(await response.text()).toBe('Video not found');
  });

  it.each([
    ['a d tag', `34236:${'a'.repeat(64)}:${'c'.repeat(64)}`],
    ['an empty d tag', `34236:${'a'.repeat(64)}:`],
    ['percent-encoded separators', `34236%3A${'a'.repeat(64)}%3A${'c'.repeat(64)}`],
  ])('serves the generic shell for an author-named video route with %s, without a d-tag lookup', async (_label, route) => {
    // `/api/videos/{id}` would read the whole coordinate as one d tag, which
    // can name a different video than the coordinate's author and d tag.
    const fetchMock = vi.mocked(fetch);

    const response = await onRequest({
      request: new Request(`https://divine.video/video/${route}`),
      next: async () => new Response('not found', { status: 404 }),
      env: {},
    });

    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain(`<title>${SHELL_TITLE}</title>`);
    expect(html).not.toContain('application/json+oembed');
    const requested = fetchMock.mock.calls.map(([input]) => String(input instanceof Request ? input.url : input));
    expect(requested.some(url => url.includes('/api/videos/'))).toBe(false);
  });

  it('falls back to the generic shell when video metadata is unavailable', async () => {
    const response = await onRequest({
      request: new Request('https://divine.video/video/missing'),
      next: async () => new Response('not found', { status: 404 }),
      env: {},
    });

    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain(`<title>${SHELL_TITLE}</title>`);
    expect(html).not.toContain('property="og:video"');
  });

  it('uses summary text when the video title is blank', async () => {
    const response = await onRequest({
      request: new Request('https://divine.video/video/blank-title'),
      next: async () => new Response('not found', { status: 404 }),
      env: {},
    });

    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain('<title>Choo choo!</title>');
    expect(html).toContain('property="og:title" content="Choo choo!"');
    expect(html).toContain('name="twitter:title" content="Choo choo!"');
  });

  it('injects profile metadata for apex profile routes', async () => {
    const response = await onRequest({
      request: new Request('https://divine.video/profile/npub1qakf0yuzhy846w3ty8u4u8hgddsr8u2vjtneklad8lslzpelfzrqsy63m7'),
      next: async () => new Response('not found', { status: 404 }),
      env: {},
    });

    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain('<title>The Wall! on Divine</title>');
    expect(html).toContain('property="og:title" content="The Wall! on Divine"');
    expect(html).toContain('property="og:description" content="How can you have any pudding if you have not eaten your meat?"');
    expect(html).toContain('property="og:image" content="https://media.divine.video/545aff83f83b4643f340747213e86520fac83596f899e8ea3117e0aa8b260f7b"');
  });

  it('injects family-hub metadata for /family on apex', async () => {
    const response = await onRequest({
      request: new Request('https://divine.video/family'),
      next: async () => new Response('not found', { status: 404 }),
      env: {},
    });

    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain('<title>For families on Divine — Conversation-first guidance for parents and teens</title>');
    expect(html).toContain('property="og:url" content="https://divine.video/family"');
    expect(html).toContain('property="og:title" content="For families on Divine');
    expect(html).toContain('name="twitter:title" content="For families on Divine');
  });

  it('injects age-review metadata for /age-review on apex', async () => {
    const response = await onRequest({
      request: new Request('https://divine.video/age-review'),
      next: async () => new Response('not found', { status: 404 }),
      env: {},
    });

    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain('<title>Account review — Divine</title>');
    expect(html).toContain('property="og:url" content="https://divine.video/age-review"');
    expect(html).toContain('property="og:title" content="Account review — Divine"');
    expect(html).toContain('name="twitter:title" content="Account review — Divine"');
    expect(html).toContain('15-day window');
  });

  it('injects kids-policy metadata for /kids on apex', async () => {
    const response = await onRequest({
      request: new Request('https://divine.video/kids'),
      next: async () => new Response('not found', { status: 404 }),
      env: {},
    });

    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain('<title>Kids on Divine — How accounts work for under-16s</title>');
    expect(html).toContain('property="og:url" content="https://divine.video/kids"');
    expect(html).toContain('property="og:title" content="Kids on Divine');
    expect(html).toContain('name="twitter:title" content="Kids on Divine');
  });

  it('injects download metadata for /download on apex', async () => {
    const response = await onRequest({
      request: new Request('https://divine.video/download'),
      next: async () => new Response('not found', { status: 404 }),
      env: {},
    });

    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain('<title>Download Divine</title>');
    expect(html).toContain('property="og:url" content="https://divine.video/download"');
    expect(html).toContain('App Store, Google Play, or Zapstore');
  });

  it('injects category metadata for category routes', async () => {
    const response = await onRequest({
      request: new Request('https://divine.video/category/dance'),
      next: async () => new Response('not found', { status: 404 }),
      env: {},
    });

    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain('<title>Dance Videos - Divine</title>');
    expect(html).toContain('property="og:title" content="Dance Videos - Divine"');
    expect(html).toContain('property="og:description" content="Explore 895 dance videos on Divine."');
  });

  it.each([
    ['/t/funny', '#funny videos on Divine', 'https://divine.video/t/funny'],
    ['/search?q=cats', '&quot;cats&quot; on Divine', 'https://divine.video/search?q=cats'],
    ['/discovery', 'Discover Videos - Divine', 'https://divine.video/discovery'],
    // The app redirects new to hot and top to classics, so they share those titles.
    ['/discovery/new', 'Trending Videos - Divine', 'https://divine.video/discovery/new'],
    ['/discovery/hot', 'Trending Videos - Divine', 'https://divine.video/discovery/hot'],
    ['/discovery/classics', 'Classic Vines - Divine', 'https://divine.video/discovery/classics'],
    ['/discovery/top', 'Classic Vines - Divine', 'https://divine.video/discovery/top'],
    ['/discovery/foryou', 'For You Videos - Divine', 'https://divine.video/discovery/foryou'],
    ['/@jalcine', 'The Wall! on Divine', 'https://divine.video/@jalcine'],
    ['/', SHELL_TITLE, 'https://divine.video/'],
  ])('injects route metadata for %s', async (path, title, canonicalUrl) => {
    const response = await onRequest({
      request: new Request(`https://divine.video${path}`),
      next: async () => new Response('not found', { status: 404 }),
      env: {},
    });

    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain(`<title>${title}</title>`);
    expect(html).toContain(`property="og:url" content="${canonicalUrl}"`);
  });

  it('describes discovery pages with the copy the app writes after hydration', async () => {
    const response = await onRequest({
      request: new Request('https://divine.video/discovery/classics'),
      next: async () => new Response('not found', { status: 404 }),
      env: {},
    });
    const page = new DOMParser().parseFromString(await response.text(), 'text/html');

    for (const selector of ['meta[name="description"]', 'meta[property="og:description"]', 'meta[name="twitter:description"]']) {
      expect(page.querySelector(selector)?.getAttribute('content')).toBe(DISCOVERY_DESCRIPTION);
    }
  });

  it('treats dollar sequences in route text as literal characters', async () => {
    const response = await onRequest({
      request: new Request('https://divine.video/search?q=%24%26'),
      next: async () => new Response('not found', { status: 404 }),
      env: {},
    });

    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain('<title>&quot;$&amp;&quot; on Divine</title>');
    expect(html).toContain('property="og:title" content="&quot;$&amp;&quot; on Divine"');
    // A `$&` in the replacement string would splice the matched tag back in.
    expect(html).not.toContain('<title><title>');
    expect(html).not.toContain('content="&quot;<meta');
  });

  it('keeps a dollar sequence in the query string out of the injected og:url', async () => {
    const response = await onRequest({
      request: new Request('https://divine.video/no-such-route?a=$&'),
      next: async () => new Response('not found', { status: 404 }),
      env: {},
    });

    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain('property="og:url" content="https://divine.video/no-such-route?a=$&amp;"');
    expect(html).not.toContain('content="https://divine.video/no-such-route?a=<meta');
  });

  it('does not throw on a malformed hashtag escape', async () => {
    const response = await onRequest({
      request: new Request('https://divine.video/t/%zz'),
      next: async () => new Response('not found', { status: 404 }),
      env: {},
    });
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain('<title>#%zz videos on Divine</title>');
  });

  it.each(['/profile/%zz', '/category/%zz'])(
    'does not throw on a malformed dynamic segment at %s',
    async (path) => {
      const response = await onRequest({
        request: new Request(`https://divine.video${path}`),
        next: async () => new Response('not found', { status: 404 }),
        env: {},
      });

      expect(response.status).toBe(200);
    }
  );

  it('keeps generic metadata for an unknown at-username route', async () => {
    const response = await onRequest({
      request: new Request('https://divine.video/@missing'),
      next: async () => new Response('not found', { status: 404 }),
      env: {},
    });

    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain(`<title>${SHELL_TITLE}</title>`);
    expect(html).not.toContain('missing on Divine');
  });

  it('restores generic metadata when the index fetch resolves through the home route', async () => {
    const homeHtml = INDEX_HTML
      .replaceAll(SHELL_TITLE, 'Unexpected home title')
      .replace('https://divine.video/', 'https://preview.pages.dev/');
    vi.mocked(fetch).mockResolvedValueOnce(new Response(homeHtml, {
      status: 200,
      headers: { 'content-type': 'text/html; charset=UTF-8' },
    }));

    const response = await onRequest({
      request: new Request('https://preview.pages.dev/no-such-route'),
      next: async () => new Response('not found', { status: 404 }),
      env: {},
    });
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain(`<title>${SHELL_TITLE}</title>`);
    expect(html).toContain('property="og:url" content="https://preview.pages.dev/no-such-route"');
  });

  it.each([
    ['/', 200],
    ['/', 404],
    ['/profile/invalid-npub', 404],
  ] as const)('keeps the shipped homepage copy for %s with an asset status of %s', async (path, status) => {
    const response = await onRequest({
      request: new Request(`https://divine.video${path}`),
      next: async () => new Response(status === 200 ? INDEX_HTML : 'not found', {
        status,
        headers: { 'content-type': 'text/html; charset=UTF-8' },
      }),
      env: {},
    });
    const page = new DOMParser().parseFromString(await response.text(), 'text/html');

    expect(page.title).toBe(SHELL_TITLE);
    for (const selector of ['meta[name="description"]', 'meta[property="og:title"]', 'meta[property="og:description"]', 'meta[property="og:image:alt"]', 'meta[name="twitter:title"]', 'meta[name="twitter:description"]']) {
      expect(page.querySelector(selector)?.getAttribute('content')).toBe(SHELL_META.querySelector(selector)?.getAttribute('content'));
    }
  });
});
