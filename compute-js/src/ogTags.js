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

// Serialize a value to JSON for safe embedding inside an inline <script> element.
// JSON.stringify alone is unsafe here: it leaves `<` raw (so a string containing
// `</script>` breaks out of the tag) and leaves the JS line terminators U+2028/U+2029
// raw (valid in JSON, but they terminate a script's string literals). Escaping those
// three keeps the embedded data inert while still parsing back to the original value.
export function escapeFeedJson(value) {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

// The injected profile object carries user-controlled Nostr fields (displayName,
// about, picture, ...), so it must go through escapeFeedJson, never raw
// JSON.stringify.
export function buildUserScript(divineUser) {
  return `<script>window.__DIVINE_USER__ = ${escapeFeedJson(divineUser)};</script>`;
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
  imageWidth = null,
  imageHeight = null,
  siteName = 'Divine',
  video = null,
  alternate = null,
}) {
  const e = escapeHtml;
  const imageDimsBlock = (imageWidth && imageHeight) ? `
  <meta property="og:image:width" content="${Number(imageWidth) || 1200}" />
  <meta property="og:image:height" content="${Number(imageHeight) || 630}" />` : '';
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
  const alternateBlock = alternate?.map(a =>
    `  <link rel="${e(a.rel)}" type="${e(a.type)}" href="${e(a.href)}"${a.title ? ` title="${e(a.title)}"` : ''} />`
  ).join('\n') || '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${e(title)}</title>

  <meta property="og:type" content="${e(ogType)}" />
  <meta property="og:title" content="${e(title)}" />
  <meta property="og:description" content="${e(description)}" />
  <meta property="og:image" content="${e(image)}" />${imageDimsBlock}
  <meta property="og:url" content="${e(url)}" />
  <meta property="og:site_name" content="${e(siteName)}" />
${videoBlock}
  <meta name="twitter:card" content="${e(twitterCard)}" />
  <meta name="twitter:title" content="${e(title)}" />
  <meta name="twitter:description" content="${e(description)}" />
  <meta name="twitter:image" content="${e(image)}" />
  ${twitterCreator ? `<meta name="twitter:creator" content="${e(twitterCreator)}" />` : ''}

  <link rel="canonical" href="${e(url)}" />
${alternateBlock}
</head>
<body>
  <p><a href="${e(url)}">${e(title)}</a></p>
</body>
</html>`;
}
