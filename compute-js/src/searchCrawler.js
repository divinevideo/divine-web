const SEARCH_CRAWLERS = ['googlebot', 'bingbot', 'yandexbot', 'duckduckbot', 'baiduspider', 'applebot'];
const FEED_PATHS = new Set(['/', '/index.html', '/discovery/hot']);

export function shouldServeFeedToSearchCrawler(pathname, userAgent = '') {
  return FEED_PATHS.has(pathname) && SEARCH_CRAWLERS.some((crawler) => userAgent.toLowerCase().includes(crawler));
}
