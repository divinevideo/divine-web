import { describe, expect, it } from 'vitest';
import { shouldServeFeedToSearchCrawler } from './searchCrawler.js';

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
