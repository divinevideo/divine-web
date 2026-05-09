// ABOUTME: Open Graph + Twitter Card HTML for social media crawlers
// ABOUTME: Pure functions; no Fastly bindings; safe to unit-test in jsdom

export function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function cleanText(value) {
  return (value || '').replace(/\s+/g, ' ').trim();
}

export function truncateText(value, maxLength) {
  const trimmed = cleanText(value);
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength - 1).trimEnd()}…`;
}

export function buildCrawlerHtml({
  title,
  description,
  image,
  url,
  ogType,
  twitterCard = 'summary_large_image',
  twitterCreator = '',
  imageWidth = 1200,
  imageHeight = 630,
  siteName = 'Divine',
  video = null,
}) {
  const e = escapeHtml;
  const videoBlock = video ? `
  <meta property="og:video" content="${e(video.url)}" />
  <meta property="og:video:secure_url" content="${e(video.url)}" />
  <meta property="og:video:type" content="${e(video.type || 'video/mp4')}" />
  <meta property="og:video:width" content="${Number(video.width) || 720}" />
  <meta property="og:video:height" content="${Number(video.height) || 1280}" />
  ${video.embedUrl ? `<meta name="twitter:player" content="${e(video.embedUrl)}" />
  <meta name="twitter:player:width" content="${Number(video.width) || 720}" />
  <meta name="twitter:player:height" content="${Number(video.height) || 1280}" />
  <meta name="twitter:player:stream" content="${e(video.url)}" />
  <meta name="twitter:player:stream:content_type" content="${e(video.type || 'video/mp4')}" />` : ''}` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${e(title)}</title>

  <meta property="og:type" content="${e(ogType)}" />
  <meta property="og:title" content="${e(title)}" />
  <meta property="og:description" content="${e(description)}" />
  <meta property="og:image" content="${e(image)}" />
  <meta property="og:image:width" content="${Number(imageWidth) || 1200}" />
  <meta property="og:image:height" content="${Number(imageHeight) || 630}" />
  <meta property="og:url" content="${e(url)}" />
  <meta property="og:site_name" content="${e(siteName)}" />
${videoBlock}
  <meta name="twitter:card" content="${e(twitterCard)}" />
  <meta name="twitter:title" content="${e(title)}" />
  <meta name="twitter:description" content="${e(description)}" />
  <meta name="twitter:image" content="${e(image)}" />
  ${twitterCreator ? `<meta name="twitter:creator" content="${e(twitterCreator)}" />` : ''}

  <link rel="canonical" href="${e(url)}" />
</head>
<body>
  <p><a href="${e(url)}">${e(title)}</a></p>
</body>
</html>`;
}
