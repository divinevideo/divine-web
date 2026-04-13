import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { onRequest } from './[[path]]';

const INDEX_HTML = `<!DOCTYPE html>
<html lang="en">
  <head>
    <title>Divine Web - Short-form Looping Videos on Nostr</title>
    <meta name="description" content="Watch and share 6-second looping videos on the decentralized Nostr network." />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="https://divine.video/" />
    <meta property="og:title" content="Divine Web - Short-form Looping Videos on Nostr" />
    <meta property="og:description" content="Watch and share 6-second looping videos on the decentralized Nostr network." />
    <meta property="og:image" content="https://divine.video/og.png" />
    <meta property="og:image:alt" content="Divine Web - Short-form looping videos on the Nostr network" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="Divine Web - Short-form Looping Videos on Nostr" />
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
    expect(html).toContain(`<title>${'Divine Web - Short-form Looping Videos on Nostr'}</title>`);
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
});
