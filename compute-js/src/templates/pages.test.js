import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CRITICAL_CSS } from './css.js';
import { feedPagePath, renderFeedPage, renderProfilePage, renderVideoPage } from './pages.js';

const BREAKOUT = '</script><script>alert(1)</script>\u2028\u2029';

describe('edge page templates', () => {
  it('escapes feed hydration JSON for executable script context', () => {
    const feedJson = JSON.stringify({ videos: [{ title: BREAKOUT }] });

    const html = renderFeedPage({
      videos: [{ title: BREAKOUT, d_tag: 'feed-video' }],
      feedJson,
      feedType: 'trending',
      pathname: '/',
    });

    expect(html).not.toContain('</script><script>alert(1)</script>');
    expect(html).toContain('\\u003c/script>\\u003cscript>alert(1)\\u003c/script>');
    expect(html).toContain('\\u2028\\u2029');
  });

  it('escapes video hydration JSON for executable script context', () => {
    const html = renderVideoPage({
      videoId: 'video-1',
      video: {
        id: 'video-1',
        title: BREAKOUT,
        content: BREAKOUT,
        thumbnail: 'https://example.com/poster.jpg',
      },
    });

    expect(html).not.toContain('</script><script>alert(1)</script>');
    expect(html).toContain('\\u003c/script>\\u003cscript>alert(1)\\u003c/script>');
    expect(html).toContain('\\u2028\\u2029');
  });

  it('escapes profile hydration JSON for executable script context', () => {
    const html = renderProfilePage({
      profile: {
        subdomain: 'alice',
        apexDomain: 'divine.video',
        displayName: BREAKOUT,
        about: BREAKOUT,
      },
      videos: [],
    });

    expect(html).not.toContain('</script><script>alert(1)</script>');
    expect(html).toContain('\\u003c/script>\\u003cscript>alert(1)\\u003c/script>');
    expect(html).toContain('\\u2028\\u2029');
  });

  it('uses the resolved production app entry script when provided', () => {
    const html = renderFeedPage({
      videos: [],
      pathname: '/',
      staticAssets: {
        mainJs: '/assets/index-abc123.js',
        mainCss: '/assets/index-abc123.css',
      },
    });

    expect(html).toContain('<script type="module" src="/assets/index-abc123.js"></script>');
    expect(html).toContain('<link rel="stylesheet" href="/assets/index-abc123.css" />');
    expect(html).not.toContain('/src/main.tsx');
  });

  it('does not fall back to the Vite dev entry when static assets are absent', () => {
    const html = renderFeedPage({ videos: [], pathname: '/' });

    expect(html).not.toContain('/src/main.tsx');
  });

  it('renders and caches /index.html as the homepage rather than a page of its own', () => {
    expect(feedPagePath('/index.html')).toBe('/');
    expect(feedPagePath('/')).toBe('/');
    expect(feedPagePath('/discovery/hot')).toBe('/discovery/hot');
    expect(readFileSync('compute-js/src/index.js', 'utf8')).toContain('const CACHE_KEY = `page:feed:${feedPagePath(pathname)}`;');
  });

  it('refuses to render a feed without its path instead of defaulting to the homepage', () => {
    expect(() => renderFeedPage({ videos: [], feedType: 'trending' })).toThrow(TypeError);
  });

  it('keeps critical CSS free of layout gradients', () => {
    expect(CRITICAL_CSS).not.toMatch(/(?:linear|radial)-gradient\(/);
  });

  it('links video cards to /video/{event.id}, falling back to d_tag', () => {
    const html = renderFeedPage({
      videos: [
        { id: 'event-id-1', d_tag: 'dtag-1', title: 'A' },
        { d_tag: 'dtag-2', title: 'B' },
      ],
      feedType: 'trending',
      pathname: '/',
    });

    expect(html).toContain('href="/video/event-id-1"');
    expect(html).toContain('href="/video/dtag-2"');
  });

  it('marks video page hydration JSON with a non-feed feed type', () => {
    const html = renderVideoPage({
      videoId: 'video-1',
      video: { id: 'video-1', title: 'A video' },
    });

    expect(html).toContain('window.__DIVINE_FEED__=');
    expect(html).toContain('window.__DIVINE_FEED_TYPE__="single"');
  });

  it('renders the real sidebar + single-column feed layout without dead tabs or video preload', () => {
    const html = renderFeedPage({
      videos: [
        {
          id: 'vid-1',
          title: 'First clip',
          thumbnail: 'https://media.divine.video/thumb.jpg',
          video_url: 'https://media.divine.video/vid.mp4',
        },
      ],
      feedType: 'trending',
      pathname: '/',
    });

    expect(html).toContain('class="divine-sidebar"');
    expect(html).toContain('class="divine-feed"');
    expect(html).toContain('href="/discovery/classics"');
    expect(html).toContain('href="/discovery/hot"');
    expect(html).toContain('href="/discovery/hashtags"');
    expect(html).not.toContain('href="/discovery/new"');
    expect(html).not.toContain('href="/discovery/top"');
    expect(html).toContain('rel="preload" href="https://media.divine.video/thumb.jpg" as="image"');
    expect(html).not.toContain('as="video"');
    expect(html).toContain('rel="preconnect" href="https://api.divine.video"');
  });

  it('includes VideoObject JSON-LD structured data on video pages', () => {
    const html = renderVideoPage({
      videoId: 'video-1',
      video: {
        id: 'video-1',
        title: 'Test Loop',
        description: 'A 6-second loop',
        thumbnail: 'https://media.divine.video/thumb.jpg',
        video_url: 'https://media.divine.video/video.mp4',
        author_name: 'Alice',
        created_at: 1700000000,
      },
    });

    expect(html).toContain('<script type="application/ld+json">');
    expect(html).toContain('"@type":"VideoObject"');
    expect(html).toContain('"embedUrl":"https://divine.video/embed/video-1"');
    expect(html).toContain('"contentUrl":"https://media.divine.video/video.mp4"');
    expect(html).toContain('"uploadDate":"2023-11-14T22:13:20.000Z"');
  });

  it('omits media URLs and poster preload for age-restricted video pages', () => {
    const html = renderVideoPage({
      videoId: 'restricted-1',
      video: {
        id: 'restricted-1',
        title: 'Age-gated clip',
        thumbnail: 'https://media.divine.video/secret-thumb.jpg',
        video_url: 'https://media.divine.video/secret-video.mp4',
        age_restricted: true,
      },
    });

    expect(html).not.toContain('secret-thumb.jpg');
    expect(html).not.toContain('secret-video.mp4');
    expect(html).not.toContain('"contentUrl"');
  });

  it('uses explicit canonicalUrl for apex /@username profile pages without double-escaping', () => {
    const html = renderProfilePage({
      profile: {
        subdomain: 'alice',
        apexDomain: 'divine.video',
        displayName: 'Alice',
      },
      videos: [],
      canonicalUrl: 'https://divine.video/@alice',
    });

    expect(html).toContain('<link rel="canonical" href="https://divine.video/@alice" />');
    expect(html).toContain('<meta property="og:url" content="https://divine.video/@alice" />');
  });
});
