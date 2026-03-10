// ABOUTME: Full page composer functions for edge-templated HTML
// ABOUTME: Combines shell, components, and data to produce complete HTML documents

import { renderShell, escapeHtml } from './shell.js';
import { navbar, discoveryTabs, videoGrid, videoDetail, profileHeader, footer } from './components.js';

/**
 * Render a feed/discovery page (home, trending, new, classics, top).
 *
 * @param {Object} options
 * @param {Array} options.videos - Array of video objects from Funnelcake API
 * @param {string} options.feedType - Feed type (trending, recent, classics)
 * @param {string} options.feedJson - Stringified feed data for window.__DIVINE_FEED__
 * @param {Object} [options.staticAssets] - Build manifest asset paths
 */
export function renderFeedPage({ videos, feedType = 'trending', feedJson = '', staticAssets = null }) {
  const tabMap = { trending: 'hot', recent: 'new', classics: 'classics', top: 'top' };
  const activeTab = tabMap[feedType] || 'hot';

  const titleMap = {
    trending: 'Trending Videos',
    recent: 'New Videos',
    classics: 'Classic Vines',
    top: 'Top Videos',
  };
  const pageTitle = `${titleMap[feedType] || 'Videos'} - diVine`;
  const isHome = feedType === 'trending';
  const currentPath = isHome ? '/' : '/discovery';

  const body = `<div class="divine-shell">
  ${navbar({ currentPath })}
  <main class="divine-main">
    ${discoveryTabs({ activeTab })}
    ${videoGrid(videos || [])}
  </main>
  ${footer()}
</div>`;

  // Preload first video thumbnail
  let preloadLinks = '';
  const firstThumb = videos?.[0]?.thumbnail;
  if (firstThumb) {
    preloadLinks = `<link rel="preload" href="${escapeHtml(firstThumb)}" as="image" fetchpriority="high">`;
  }
  const firstVideoUrl = videos?.[0]?.video_url;
  if (firstVideoUrl) {
    preloadLinks += `\n  <link rel="preload" href="${escapeHtml(firstVideoUrl)}" as="video" type="video/mp4">`;
  }

  const jsonInjection = feedJson
    ? `<script>window.__DIVINE_FEED__=${feedJson};window.__DIVINE_FEED_TYPE__="${escapeHtml(feedType)}";</script>`
    : '';

  return renderShell({
    title: isHome ? 'diVine Web - Short-form Looping Videos on Nostr' : pageTitle,
    body,
    jsonInjection,
    preloadLinks,
    staticAssets,
  });
}

/**
 * Render a single video page.
 *
 * @param {Object} options
 * @param {Object} options.video - Video data (merged event + stats)
 * @param {string} options.videoId - Video identifier
 * @param {Object} [options.staticAssets] - Build manifest asset paths
 */
export function renderVideoPage({ video, videoId, staticAssets = null }) {
  const title = video.title || 'Video on diVine';
  const description = video.description || video.content || 'Watch this short video on diVine';
  const thumbnail = video.thumbnail || 'https://divine.video/og.avif';
  const ogUrl = `https://divine.video/video/${escapeHtml(videoId)}`;

  const body = `<div class="divine-shell">
  ${navbar({ currentPath: '/video' })}
  <main class="divine-main">
    ${videoDetail(video)}
  </main>
  ${footer()}
</div>`;

  // Preload poster image
  let preloadLinks = '';
  if (video.thumbnail) {
    preloadLinks = `<link rel="preload" href="${escapeHtml(video.thumbnail)}" as="image" fetchpriority="high">`;
  }

  // Inject feed data for hydration (single video)
  const feedJson = JSON.stringify({
    videos: [video],
    type: 'single',
  });
  const jsonInjection = `<script>window.__DIVINE_FEED__=${feedJson};</script>`;

  return renderShell({
    title: `${title} - diVine`,
    description,
    ogImage: thumbnail,
    ogUrl,
    ogType: 'video.other',
    body,
    jsonInjection,
    preloadLinks,
    staticAssets,
  });
}

/**
 * Render a user profile page.
 *
 * @param {Object} options
 * @param {Object} options.profile - User profile data (from __DIVINE_USER__ shape)
 * @param {Array} options.videos - User's videos
 * @param {Object} [options.staticAssets] - Build manifest asset paths
 */
export function renderProfilePage({ profile, videos = [], staticAssets = null }) {
  const name = profile.displayName || profile.username || 'Unknown';
  const ogTitle = `${name} on diVine`;
  const ogDescription = profile.about || `Watch ${name}'s videos on diVine`;
  const ogImage = profile.picture || 'https://divine.video/og.png';
  const ogUrl = `https://${escapeHtml(profile.subdomain)}.${escapeHtml(profile.apexDomain || 'divine.video')}/`;

  const body = `<div class="divine-shell">
  ${navbar({ currentPath: '/profile', apexDomain: profile.apexDomain || 'divine.video' })}
  <main class="divine-main">
    ${profileHeader(profile)}
    <h2 style="font-family:'Bricolage Grotesque',sans-serif;font-size:18px;font-weight:700;padding:24px 16px 8px;">Videos</h2>
    ${videoGrid(videos)}
  </main>
  ${footer()}
</div>`;

  // Inject profile data for hydration
  const jsonInjection = `<script>window.__DIVINE_USER__=${JSON.stringify(profile)};</script>`;

  return renderShell({
    title: ogTitle,
    description: ogDescription,
    ogImage,
    ogUrl,
    ogType: 'profile',
    body,
    jsonInjection,
    staticAssets,
  });
}

/**
 * Render a search results page.
 *
 * @param {Object} options
 * @param {string} options.query - Search query
 * @param {Array} options.results - Search result videos
 * @param {Object} [options.staticAssets] - Build manifest asset paths
 */
export function renderSearchPage({ query = '', results = [], staticAssets = null }) {
  const safeQuery = escapeHtml(query);

  const body = `<div class="divine-shell">
  ${navbar({ currentPath: '/search' })}
  <main class="divine-main">
    <div style="padding:24px 0 8px;">
      <h1 style="font-family:'Bricolage Grotesque',sans-serif;font-size:22px;font-weight:700;">
        ${query ? `Results for "${safeQuery}"` : 'Search'}
      </h1>
    </div>
    ${videoGrid(results)}
  </main>
  ${footer()}
</div>`;

  return renderShell({
    title: query ? `"${query}" - diVine Search` : 'Search - diVine',
    description: query ? `Search results for "${query}" on diVine` : 'Search videos on diVine',
    body,
    staticAssets,
  });
}
