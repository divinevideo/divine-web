import { escapeHtml, escapeFeedJson } from './ogTags.js';

export function injectFeedDataIntoHtml({ html, feedType, feedData }) {
  if (!feedData) return html;

  const feedJson = escapeFeedJson(feedData);
  let injection = `<script>window.__DIVINE_FEED__=${feedJson};window.__DIVINE_FEED_TYPE__="${feedType}";</script>`;

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
