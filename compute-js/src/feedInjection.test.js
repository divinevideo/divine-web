import { describe, expect, it, vi } from 'vitest';
import { injectFeedDataIntoHtml, resolveFeedInjectedHtml } from './feedInjection.js';

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
    const dataMatch = result.match(/window\.__DIVINE_FEED__=(.*?);window\.__DIVINE_FEED_TYPE__/);
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
    expect(result).toContain('href="https://example.com/&quot;onload=&quot;alert(1)"');
  });

  it('escapes feedType as JavaScript data', () => {
    const result = injectFeedDataIntoHtml({
      html: makeHtml(),
      feedType: 'x";alert(1);//',
      feedData,
    });

    expect(result).toContain('window.__DIVINE_FEED_TYPE__="x\\";alert(1);//"');
    expect(result).not.toContain('window.__DIVINE_FEED_TYPE__="x";alert(1);//"');
  });
});

describe('resolveFeedInjectedHtml', () => {
  it('reads identity HTML, fetches feed data, and injects it', async () => {
    const result = await resolveFeedInjectedHtml({
      readHtml: () => Promise.resolve(makeHtml()),
      fetchFeedData: vi.fn(() => Promise.resolve(feedData)),
      feedType: 'trending',
      pathname: '/',
    });

    expect(result).toContain('window.__DIVINE_FEED__=');
    expect(result).toContain('rel="preload"');
  });

  it('returns valid HTML structure after injection', async () => {
    const html = makeHtml();
    const result = await resolveFeedInjectedHtml({
      readHtml: () => Promise.resolve(html),
      fetchFeedData: () => Promise.resolve(feedData),
      feedType: 'classics',
      pathname: '/discovery/classics',
    });

    expect(result).toMatch(/^<!doctype html>/i);
    expect(result).toContain('</html>');
    expect(result.split('</head>').length - 1).toBe(1);
  });

  it('returns null when reading HTML fails so the worker can serve static passthrough', async () => {
    const logger = { error: vi.fn() };

    const result = await resolveFeedInjectedHtml({
      readHtml: () => Promise.reject(new Error('malformed UTF-8')),
      fetchFeedData: () => Promise.resolve(feedData),
      feedType: 'trending',
      pathname: '/',
      logger,
    });

    expect(result).toBeNull();
    expect(logger.error).toHaveBeenCalledWith('Feed injection error:', 'malformed UTF-8');
  });

  it('returns null when KV HTML is missing the Vite entry script', async () => {
    const logger = { error: vi.fn() };

    const result = await resolveFeedInjectedHtml({
      readHtml: () => Promise.resolve('<!doctype html><html><head></head><body></body></html>'),
      fetchFeedData: () => Promise.resolve(feedData),
      feedType: 'trending',
      pathname: '/',
      logger,
    });

    expect(result).toBeNull();
    expect(logger.error).toHaveBeenCalledWith(
      'Publisher returned unusable KV HTML for',
      '/',
      'length:',
      54,
    );
  });

  it('returns null when fetching feed data throws', async () => {
    const logger = { error: vi.fn() };

    const result = await resolveFeedInjectedHtml({
      readHtml: () => Promise.resolve(makeHtml()),
      fetchFeedData: () => Promise.reject(new Error('feed unavailable')),
      feedType: 'trending',
      pathname: '/',
      logger,
    });

    expect(result).toBeNull();
    expect(logger.error).toHaveBeenCalledWith('Feed injection error:', 'feed unavailable');
  });
});
