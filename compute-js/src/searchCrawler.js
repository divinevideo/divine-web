// The only list of search-engine user agents; isSocialMediaCrawler in index.js
// reuses it so the two can't drift apart.
const SEARCH_CRAWLERS = ['googlebot', 'bingbot', 'yandexbot', 'duckduckbot', 'baiduspider', 'applebot'];
const FEED_PATHS = new Set(['/', '/index.html', '/discovery/hot']);

export function isSearchCrawler(userAgent = '') {
  const normalized = userAgent.toLowerCase();
  return SEARCH_CRAWLERS.some((crawler) => normalized.includes(crawler));
}

export function shouldServeFeedToSearchCrawler(pathname, userAgent = '') {
  return FEED_PATHS.has(pathname) && isSearchCrawler(userAgent);
}

/**
 * The discovery tab whose metadata a search crawler gets when its feed page
 * can't render. `/` needs none: the SPA shell it falls through to already
 * carries the homepage's metadata, which is wrong for `/discovery/hot`.
 */
export function searchFeedFallbackTab(pathname) {
  return pathname === '/discovery/hot' ? 'hot' : null;
}
