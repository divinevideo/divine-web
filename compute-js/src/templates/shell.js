// ABOUTME: Document shell wrapper for edge-templated HTML pages
// ABOUTME: Generates complete HTML documents with head, meta tags, inline CSS, and deferred scripts

import { CRITICAL_CSS } from './css.js';

/**
 * Escape HTML special characters to prevent XSS.
 */
export function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Format large numbers for display (e.g., 1234 -> "1.2K").
 */
export function formatCount(n) {
  if (!n || n < 0) return '0';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(n);
}

/**
 * Generate the complete HTML document shell.
 *
 * @param {Object} options
 * @param {string} options.title - Page title
 * @param {string} options.description - Meta description
 * @param {string} options.ogImage - OG image URL
 * @param {string} options.ogUrl - Canonical URL
 * @param {string} options.ogType - OG type (website, video.other, profile)
 * @param {string} options.body - Inner HTML for #root
 * @param {string} [options.headExtra] - Extra tags to inject in <head>
 * @param {string} [options.jsonInjection] - Script tag with window.__DIVINE_* data
 * @param {string} [options.preloadLinks] - Preload link tags
 * @param {Object} [options.staticAssets] - Map of asset paths from the build manifest
 */
export function renderShell({
  title = 'diVine Web - Short-form Looping Videos on Nostr',
  description = 'Watch and share 6-second looping videos on the decentralized Nostr network.',
  ogImage = 'https://divine.video/og.png',
  ogUrl = 'https://divine.video/',
  ogType = 'website',
  body = '',
  headExtra = '',
  jsonInjection = '',
  preloadLinks = '',
  staticAssets = null,
} = {}) {
  const safeTitle = escapeHtml(title);
  const safeDesc = escapeHtml(description);
  const safeOgImage = escapeHtml(ogImage);
  const safeOgUrl = escapeHtml(ogUrl);

  // Determine main script/CSS paths from static assets if available
  const mainScript = staticAssets?.mainJs || '/src/main.tsx';
  const mainCss = staticAssets?.mainCss || '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes, viewport-fit=cover" />

  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.gstatic.com https://www.googletagmanager.com https://static.zdassets.com https://ekr.zdassets.com https://*.zendesk.com https://v2.zopim.com https://static.cloudflareinsights.com https://*.hsforms.net https://*.hsforms.com https://*.hubspot.com https://*.hubspotusercontent-na2.net https://*.hsappstatic.net https://*.hs-scripts.com https://*.hs-banner.com https://*.hs-analytics.net https://*.hscollectedforms.net https://*.usemessages.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://static.zdassets.com; frame-src 'self' https: https://static.zdassets.com https://*.hubspot.com https://*.hsforms.net https://*.hsforms.com; font-src 'self' data: https://fonts.gstatic.com https://static.zdassets.com; base-uri 'self'; manifest-src 'self'; worker-src 'self' blob:; connect-src 'self' blob: https: wss: https://www.google-analytics.com https://analytics.google.com https://firebaseinstallations.googleapis.com https://ekr.zdassets.com wss://*.zopim.com wss://*.zendesk.com https://*.hsforms.com https://*.hubspot.com https://*.hubapi.com https://*.hs-banner.com https://*.hscollectedforms.net; img-src 'self' data: blob: https: https://www.google-analytics.com https://static.zdassets.com https://v2assets.zopim.io https://*.hsforms.com https://*.hubspot.com; media-src 'self' blob: https:;">
  <meta http-equiv="X-Content-Type-Options" content="nosniff">
  <meta http-equiv="X-XSS-Protection" content="1; mode=block">
  <meta http-equiv="Referrer-Policy" content="strict-origin-when-cross-origin">
  <link rel="canonical" href="${safeOgUrl}" />

  <title>${safeTitle}</title>
  <meta name="description" content="${safeDesc}" />
  <meta name="theme-color" content="#27C58B" />

  <meta name="mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="default" />
  <meta name="apple-mobile-web-app-title" content="diVine" />
  <meta name="application-name" content="diVine" />

  <!-- Open Graph -->
  <meta property="og:type" content="${escapeHtml(ogType)}" />
  <meta property="og:url" content="${safeOgUrl}" />
  <meta property="og:title" content="${safeTitle}" />
  <meta property="og:description" content="${safeDesc}" />
  <meta property="og:image" content="${safeOgImage}" />
  <meta property="og:site_name" content="diVine" />

  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${safeTitle}" />
  <meta name="twitter:description" content="${safeDesc}" />
  <meta name="twitter:image" content="${safeOgImage}" />

  <!-- Icons -->
  <link rel="icon" type="image/png" sizes="72x72" href="/favicon.png" />
  <link rel="apple-touch-icon" href="/app_icon.png" />
  <link rel="manifest" href="/manifest.webmanifest">

  <!-- Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,500;12..96,600;12..96,700;12..96,800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">

  <!-- Performance preconnects -->
  <link rel="dns-prefetch" href="//relay.divine.video" />
  <link rel="preconnect" href="https://relay.divine.video" crossorigin />
  <link rel="dns-prefetch" href="//media.divine.video" />
  <link rel="preconnect" href="https://media.divine.video" crossorigin />

  ${preloadLinks}

  <!-- Critical CSS for edge-rendered content -->
  <style>${CRITICAL_CSS}</style>

  ${mainCss ? `<link rel="stylesheet" href="${escapeHtml(mainCss)}" />` : ''}
  ${headExtra}
  ${jsonInjection}
</head>
<body>
  <div id="root" data-divine-ssr="true">${body}</div>

  <!-- HubSpot tracking & GDPR cookie consent -->
  <script type="text/javascript" id="hs-script-loader" async defer src="https://js-na2.hs-scripts.com/244466832.js"></script>

  <script type="module" src="${escapeHtml(mainScript)}"></script>
</body>
</html>`;
}
