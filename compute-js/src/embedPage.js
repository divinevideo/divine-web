// ABOUTME: Minimal /embed/:id HTML for iframed players (Slack, Twitter)
// ABOUTME: No JS bundles, no analytics — just an autoplaying loop

import { escapeHtml } from './ogTags.js';
import { progressive720pUrl } from './videoMetadata.js';

export function renderEmbedPage({ videoUrl, mime, poster, title }) {
  const e = escapeHtml;
  const safeTitle = e(title || 'Video on Divine');

  if (!videoUrl) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${safeTitle}</title>
  <style>html,body{margin:0;height:100%;background:#000;color:#fff;font-family:system-ui;display:flex;align-items:center;justify-content:center}</style>
</head>
<body><p>Video unavailable</p></body>
</html>`;
  }

  // The player falls back to the original when the 720p rendition is missing.
  const rendition = progressive720pUrl(videoUrl);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${safeTitle}</title>
  <style>
    html,body{margin:0;padding:0;height:100%;background:#000;overflow:hidden}
    video{width:100vw;height:100vh;object-fit:contain;display:block}
  </style>
</head>
<body>
  <video autoplay loop muted playsinline${poster ? ` poster="${e(poster)}"` : ''}>
    ${rendition ? `<source src="${e(rendition)}" type="video/mp4">\n    ` : ''}<source src="${e(videoUrl)}" type="${e(mime || 'video/mp4')}">
  </video>
</body>
</html>`;
}
