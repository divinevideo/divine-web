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
