import { describe, expect, it } from 'vitest';
import { CRITICAL_CSS } from './css.js';
import { renderFeedPage, renderProfilePage, renderVideoPage } from './pages.js';

const BREAKOUT = '</script><script>alert(1)</script>\u2028\u2029';

describe('edge page templates', () => {
  it('escapes feed hydration JSON for executable script context', () => {
    const feedJson = JSON.stringify({ videos: [{ title: BREAKOUT }] });

    const html = renderFeedPage({
      videos: [{ title: BREAKOUT, d_tag: 'feed-video' }],
      feedJson,
      feedType: 'trending',
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
    const html = renderFeedPage({ videos: [] });

    expect(html).not.toContain('/src/main.tsx');
  });

  it('keeps critical CSS free of layout gradients', () => {
    expect(CRITICAL_CSS).not.toMatch(/(?:linear|radial)-gradient\(/);
  });
});
