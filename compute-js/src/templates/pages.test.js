import { describe, expect, it } from 'vitest';
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
});
