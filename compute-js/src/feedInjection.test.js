import { describe, expect, it } from 'vitest';
import { brotliCompressSync, brotliDecompressSync } from 'node:zlib';
import { injectFeedDataIntoHtml } from './feedInjection.js';
import { hasViteEntryScript } from './staticContent.js';

const makeHtml = (entry = '/assets/index-abc123.js') =>
  `<!doctype html><html><head>` +
  `<meta charset="utf-8">` +
  `<script type="module" crossorigin src="${entry}"></script>` +
  `</head><body><div id="root"></div></body></html>`;

const feedData = {
  videos: [
    {
      video_url: 'https://cdn.example.com/video.mp4',
      thumbnail: 'https://cdn.example.com/thumb.jpg',
      title: 'Test Video',
    },
  ],
};

describe('injectFeedDataIntoHtml', () => {
  it('injects the feed script tag before </head>', () => {
    const result = injectFeedDataIntoHtml({
      html: makeHtml(),
      feedType: 'trending',
      feedData,
    });
    expect(result).toContain('<script>window.__DIVINE_FEED__=');
    expect(result).toContain('window.__DIVINE_FEED_TYPE__="trending"');
    expect(result).toContain('</head>');
    expect(result.indexOf('<script>')).toBeLessThan(result.indexOf('</head>'));
  });

  it('adds preload links for the first video', () => {
    const result = injectFeedDataIntoHtml({
      html: makeHtml(),
      feedType: 'trending',
      feedData,
    });
    expect(result).toContain('<link rel="preload" href="https://cdn.example.com/video.mp4" as="video"');
    expect(result).toContain('<link rel="preload" href="https://cdn.example.com/thumb.jpg" as="image"');
  });

  it('returns html unchanged when feedData is null', () => {
    const html = makeHtml();
    expect(injectFeedDataIntoHtml({ html, feedType: 'trending', feedData: null })).toBe(html);
  });

  it('injects an empty feed script with no preloads when feedData has no videos', () => {
    const result = injectFeedDataIntoHtml({
      html: makeHtml(),
      feedType: 'trending',
      feedData: {},
    });
    expect(result).toContain('window.__DIVINE_FEED__={}');
    expect(result).not.toContain('rel="preload"');
  });

  it('omits preload links when no video_url or thumbnail', () => {
    const result = injectFeedDataIntoHtml({
      html: makeHtml(),
      feedType: 'trending',
      feedData: { videos: [{ title: 'No media' }] },
    });
    expect(result).not.toContain('rel="preload"');
  });

  it('escapes HTML in feed data embedded in JSON', () => {
    const malicious = {
      videos: [{
        video_url: 'https://example.com/video.mp4',
        title: '</script><script>alert(1)',
      }],
    };
    const result = injectFeedDataIntoHtml({
      html: makeHtml(),
      feedType: 'trending',
      feedData: malicious,
    });
    const dataMatch = result.match(/__DIVINE_FEED__=([^<]+);/);
    expect(dataMatch).not.toBeNull();
    expect(dataMatch[1]).not.toContain('</script>');
    expect(dataMatch[1]).toContain('\\u003c/script>');
  });

  it('escapes user-controlled strings in preload hrefs', () => {
    const malicious = {
      videos: [{
        video_url: 'https://example.com/"onload="alert(1)',
        thumbnail: 'https://example.com/thumb.jpg',
      }],
    };
    const result = injectFeedDataIntoHtml({
      html: makeHtml(),
      feedType: 'trending',
      feedData: malicious,
    });
    expect(result).toContain('&quot;');
  });
});

describe('regression: compressed body injection path (#489)', () => {
  it('injectFeedDataIntoHtml works on decompressed brotli HTML', () => {
    const html = makeHtml();
    const compressed = brotliCompressSync(html);
    const decompressed = brotliDecompressSync(compressed).toString();

    expect(hasViteEntryScript(decompressed)).toBe(true);

    const result = injectFeedDataIntoHtml({
      html: decompressed,
      feedType: 'trending',
      feedData,
    });
    expect(result).toContain('window.__DIVINE_FEED__=');
    expect(result).toContain('rel="preload"');
  });

  it('returns valid HTML structure after injection', () => {
    const html = makeHtml();
    const result = injectFeedDataIntoHtml({
      html,
      feedType: 'classics',
      feedData,
    });

    expect(result).toMatch(/^<!doctype html>/i);
    expect(result).toContain('</html>');
    expect(result.split('</head>').length - 1).toBe(1);
  });
});
