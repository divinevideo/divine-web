import { escapeHtml, escapeFeedJson } from './ogTags.js';
import { hasViteEntryScript } from './staticContent.js';

export async function resolveFeedInjectedHtml({
  readHtml,
  fetchFeedData,
  feedType,
  pathname,
  logger = console,
}) {
  try {
    const html = await readHtml();
    if (!html || !hasViteEntryScript(html)) {
      logger.error('Publisher returned unusable KV HTML for', pathname, 'length:', html?.length ?? 0);
      return null;
    }

    const feedData = await fetchFeedData(feedType);
    return injectFeedDataIntoHtml({ html, feedType, feedData });
  } catch (err) {
    logger.error('Feed injection error:', err.message);
    return null;
  }
}

// Map a Funnelcake v2 envelope ({ data, pagination }) to the client's expected
// shape ({ videos, next_cursor, has_more }). Legacy v1 arrays and already-shaped
// payloads pass through untouched — the client normalizes those itself.
export function normalizeFeedResponse(feedData) {
  if (!feedData || Array.isArray(feedData)) return feedData;
  if (Array.isArray(feedData.data)) {
    const pagination = feedData.pagination ?? {};
    return {
      videos: feedData.data,
      next_cursor: pagination.next_cursor ?? undefined,
      has_more: pagination.has_more ?? false,
    };
  }
  return feedData;
}

export function injectFeedDataIntoHtml({ html, feedType, feedData }) {
  if (!feedData) return html;

  const feedJson = escapeFeedJson(feedData);
  const feedTypeJson = escapeFeedJson(feedType);
  let injection = `<script>window.__DIVINE_FEED__=${feedJson};window.__DIVINE_FEED_TYPE__=${feedTypeJson};</script>`;

  const firstVideo = feedData.videos?.[0] || feedData[0];
  const firstVideoUrl = firstVideo?.video_url;
  const firstThumbnail = firstVideo?.thumbnail;

  if (firstVideoUrl) {
    injection += `\n<link rel="preload" href="${escapeHtml(firstVideoUrl)}" as="video" type="video/mp4">`;
  }
  if (firstThumbnail) {
    injection += `\n<link rel="preload" href="${escapeHtml(firstThumbnail)}" as="image" fetchpriority="high">`;
  }

  return html.replace('</head>', injection + '</head>');
}
