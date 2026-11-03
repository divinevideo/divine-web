import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { searchFeedFallbackTab, shouldServeFeedToSearchCrawler } from './searchCrawler.js';

describe('shouldServeFeedToSearchCrawler', () => {
  it.each(['/', '/index.html', '/discovery/hot'])(
    'serves the watchable feed to Googlebot at %s',
    (pathname) => expect(shouldServeFeedToSearchCrawler(pathname, 'Googlebot/2.1')).toBe(true),
  );

  it('keeps link-preview bots on the social metadata path', () => {
    expect(shouldServeFeedToSearchCrawler('/', 'Twitterbot/1.0')).toBe(false);
    expect(shouldServeFeedToSearchCrawler('/discovery/hot', 'facebookexternalhit/1.1')).toBe(false);
  });

  it('keeps search crawler metadata on other route types', () => {
    expect(shouldServeFeedToSearchCrawler('/video/example', 'Googlebot/2.1')).toBe(false);
    expect(shouldServeFeedToSearchCrawler('/discovery/classics', 'Googlebot/2.1')).toBe(false);
  });
});

describe('searchFeedFallbackTab', () => {
  it('answers the hot route with its own discovery metadata', () => {
    expect(searchFeedFallbackTab('/discovery/hot')).toBe('hot');
  });

  it.each(['/', '/index.html'])('leaves %s to the SPA shell, which carries the homepage metadata', (pathname) => {
    expect(searchFeedFallbackTab(pathname)).toBeNull();
  });

  it('is what the worker falls back to when the feed page does not render', () => {
    const worker = readFileSync('compute-js/src/index.js', 'utf8');
    // handleRequest needs the Fastly runtime, so pin the exact block: the tab
    // comes from the helper and the response is returned, after the feed page.
    const fallbackBlock = [
      '  const searchFallbackTab = serveSearchFeed ? searchFeedFallbackTab(url.pathname) : null;',
      '  if (searchFallbackTab) {',
      '    const ogResponse = await handleDiscoveryOgTags(searchFallbackTab);',
      '    if (ogResponse) return ogResponse;',
      '  }',
    ].join('\n');
    const feedPage = worker.indexOf('const feedPageResponse = await handleFeedPage(');

    expect(feedPage).toBeGreaterThan(-1);
    expect(worker.indexOf(fallbackBlock)).toBeGreaterThan(feedPage);
  });
});
