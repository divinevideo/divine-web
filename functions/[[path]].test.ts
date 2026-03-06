import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { onRequest } from './[[path]]';

const INDEX_HTML = `<!DOCTYPE html>
<html lang="en">
  <head>
    <title>diVine Web - Short-form Looping Videos on Nostr</title>
    <meta name="description" content="Watch and share 6-second looping videos on the decentralized Nostr network." />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="https://divine.video/" />
    <meta property="og:title" content="diVine Web - Short-form Looping Videos on Nostr" />
    <meta property="og:description" content="Watch and share 6-second looping videos on the decentralized Nostr network." />
    <meta property="og:image" content="https://divine.video/og.png" />
    <meta property="og:image:alt" content="diVine Web - Short-form looping videos on the Nostr network" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="diVine Web - Short-form Looping Videos on Nostr" />
    <meta name="twitter:description" content="Watch and share 6-second looping videos on the decentralized Nostr network." />
    <meta name="twitter:image" content="https://divine.video/og.png" />
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`;

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
              ['imeta', 'url https://media.divine.video/abc123.mp4', 'm video/mp4', 'image https://media.divine.video/abc123.jpg'],
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
    expect(html).toContain('name="twitter:title" content="Bangkok rooftop"');
  });

  it('falls back to the generic shell when video metadata is unavailable', async () => {
    const response = await onRequest({
      request: new Request('https://divine.video/video/missing'),
      next: async () => new Response('not found', { status: 404 }),
      env: {},
    });

    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain(`<title>${'diVine Web - Short-form Looping Videos on Nostr'}</title>`);
    expect(html).not.toContain('property="og:video"');
  });
});
