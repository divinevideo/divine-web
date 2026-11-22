// ABOUTME: Full page composer functions for edge-templated HTML
// ABOUTME: Combines shell, components, and data to produce complete HTML documents

import {
  escapeHtml,
  escapeJsonForScript,
  renderShell,
  serializeJsonForScript,
} from './shell.js';
import { navbar, discoveryTabs, videoFeed, videoGrid, videoDetail, profileHeader, footer } from './components.js';
import { HOME_DESCRIPTION, HOME_TITLE, HOT_DESCRIPTION } from '../siteCopy.js';

/**
 * The path a feed page is rendered and cached under. `/index.html` is the
 * homepage, so it shares `/`'s HTML rather than keeping a copy of its own.
 *
 * @param {string} pathname - Request path
 * @returns {string}
 */
export function feedPagePath(pathname) {
  return pathname === '/index.html' ? '/' : pathname;
}

/**
 * Render a feed/discovery page (home, trending, new, classics, top).
 *
 * @param {Object} options
 * @param {Array} options.videos - Array of video objects from Funnelcake API
 * @param {string} options.feedType - Feed type (trending, recent, classics)
 * @param {string} options.pathname - Request path; it alone decides whether this is the homepage
 * @param {string} options.feedJson - Stringified feed data for window.__DIVINE_FEED__
 * @param {Object} [options.staticAssets] - Build manifest asset paths
 */
export function renderFeedPage({ videos, feedType = 'trending', pathname, feedJson = '', staticAssets = null }) {
  // No default: a discovery feed rendered without its path would silently get
  // the homepage's title, description and canonical.
  if (typeof pathname !== 'string') {
    throw new TypeError('renderFeedPage needs the request pathname');
  }
  const tabMap = { trending: 'hot', recent: 'new', classics: 'classics', top: 'top' };
  const activeTab = tabMap[feedType] || 'hot';

  const titleMap = {
    trending: 'Trending Videos',
    recent: 'New Videos',
    classics: 'Classic Vines',
    top: 'Top Videos',
  };
  const pageTitle = `${titleMap[feedType] || 'Videos'} - Divine`;
  const isHome = feedPagePath(pathname) === '/';
  const currentPath = isHome ? '/' : '/discovery';

  const accent = activeTab === 'hot' ? 'pink' : activeTab === 'classics' ? 'violet' : 'green';

  const body = `<div class="divine-shell">
  ${navbar({ currentPath })}
  <div class="divine-content">
    <main class="divine-main">
      <div class="divine-feed-column">
        <header class="divine-page-header">
          <h1 class="divine-page-title">Discover</h1>
          <p class="divine-page-subtitle">Explore videos from the network</p>
        </header>
        ${discoveryTabs({ activeTab })}
        ${videoFeed(videos || [], { accent })}
      </div>
    </main>
    ${footer()}
  </div>
</div>`;

  // Preload only the LCP poster image; avoid preloading the full MP4 before
  // React selects the active feed/video (prevents wasted video bytes).
  let preloadLinks = '';
  const firstThumb = videos?.[0]?.thumbnail;
  if (firstThumb) {
    preloadLinks = `<link rel="preload" href="${escapeHtml(firstThumb)}" as="image" fetchpriority="high">`;
  }

  // Inject a compact version of feed data for React (strip bulky Nostr event tags)
  const jsonInjection = feedJson
    ? `<script>window.__DIVINE_FEED__=${escapeJsonForScript(feedJson)};window.__DIVINE_FEED_TYPE__=${serializeJsonForScript(feedType)};</script>`
    : '';

  return renderShell({
    title: isHome ? HOME_TITLE : pageTitle,
    description: isHome ? HOME_DESCRIPTION : pathname === '/discovery/hot' ? HOT_DESCRIPTION : undefined,
    ogUrl: `https://divine.video${isHome ? '/' : pathname}`,
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
  const title = video.title || 'Video on Divine';
  const description = video.description || video.content || 'Watch this short video on Divine';
  const isAgeRestricted = video.age_restricted === true || video.moderation_status === 'age_restricted';
  const thumbnail = isAgeRestricted ? 'https://divine.video/og.png' : (video.thumbnail || 'https://divine.video/og.png');
  // renderShell escapes ogUrl once when writing meta/canonical attributes.
  const ogUrl = `https://divine.video/video/${videoId}`;
  const videoUrl = isAgeRestricted ? '' : (video.video_url || video.videoUrl || '');

  const body = `<div class="divine-shell">
  ${navbar({ currentPath: '/video' })}
  <div class="divine-content">
    <main class="divine-main">
      ${videoDetail(video)}
    </main>
    ${footer()}
  </div>
</div>`;

  // Preload poster image (skip for age-restricted videos)
  let preloadLinks = '';
  if (!isAgeRestricted && video.thumbnail) {
    preloadLinks = `<link rel="preload" href="${escapeHtml(video.thumbnail)}" as="image" fetchpriority="high">`;
  }

  // VideoObject structured data for search engine video rich results
  const videoLd = {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: title,
    description,
    thumbnailUrl: [thumbnail],
    embedUrl: `https://divine.video/embed/${videoId}`,
    ...(videoUrl ? { contentUrl: videoUrl } : {}),
    ...(video.created_at ? { uploadDate: new Date(video.created_at * 1000).toISOString() } : {}),
    ...(video.authorName || video.author_name ? {
      author: { '@type': 'Person', name: video.authorName || video.author_name },
    } : {}),
  };
  const headExtra = `<script type="application/ld+json">${serializeJsonForScript(videoLd)}</script>`;

  // Inject feed data for hydration (single video). The feed type must be set:
  // useInfiniteVideosFunnelcake treats an undefined __DIVINE_FEED_TYPE__ as a
  // trending match and would consume this single-video payload as a feed page.
  const hydrationVideo = isAgeRestricted
    ? { ...video, thumbnail: undefined, video_url: undefined, videoUrl: undefined }
    : video;
  const feedJson = serializeJsonForScript({
    videos: [hydrationVideo],
    type: 'single',
  });
  const jsonInjection = `<script>window.__DIVINE_FEED__=${feedJson};window.__DIVINE_FEED_TYPE__="single";</script>`;

  return renderShell({
    title: `${title} - Divine`,
    description,
    ogImage: thumbnail,
    ogUrl,
    ogType: 'video.other',
    body,
    headExtra,
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
export function renderProfilePage({ profile, videos = [], staticAssets = null, canonicalUrl = null }) {
  const name = profile.displayName || profile.username || 'Unknown';
  const ogTitle = `${name} on Divine`;
  const ogDescription = profile.about || `Watch ${name}'s videos on Divine`;
  const ogImage = profile.picture || 'https://divine.video/og.png';
  // renderShell escapes ogUrl once when writing meta/canonical attributes.
  const ogUrl = canonicalUrl || `https://${profile.subdomain}.${profile.apexDomain || 'divine.video'}/`;

  const body = `<div class="divine-shell">
  ${navbar({ currentPath: '/profile', apexDomain: profile.apexDomain || 'divine.video' })}
  <div class="divine-content">
    <main class="divine-main">
      ${profileHeader(profile)}
      <h2 style="font-family:'Bricolage Grotesque',sans-serif;font-size:18px;font-weight:700;padding:24px 16px 8px;">Videos</h2>
      ${videoGrid(videos)}
    </main>
    ${footer()}
  </div>
</div>`;

  // Inject profile data for hydration
  const jsonInjection = `<script>window.__DIVINE_USER__=${serializeJsonForScript(profile)};</script>`;

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
  <div class="divine-content">
    <main class="divine-main">
      <div style="padding:0 0 8px;">
        <h1 class="divine-page-title">
          ${query ? `Results for "${safeQuery}"` : 'Search'}
        </h1>
      </div>
      ${videoGrid(results)}
    </main>
    ${footer()}
  </div>
</div>`;

  return renderShell({
    title: query ? `"${query}" - Divine Search` : 'Search - Divine',
    description: query ? `Search results for "${query}" on Divine` : 'Search videos on Divine',
    body,
    staticAssets,
  });
}
