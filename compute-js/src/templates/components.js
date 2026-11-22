// ABOUTME: Reusable HTML fragment generators for edge-templated pages
// ABOUTME: Mirrors AppSidebar, AppHeader, DiscoveryPage tabs, and brand VideoCard

import { escapeHtml, formatCount } from './shell.js';

const PLAY_ICON_SVG = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>`;

/**
 * Navigation shell matching AppSidebar (desktop) + AppHeader (mobile).
 */
export function navbar({ currentPath = '/', apexDomain = 'divine.video' } = {}) {
  const isActive = (path) => currentPath === path ? ' divine-nav-link--active' : '';
  const homeHref = `https://${escapeHtml(apexDomain)}/`;
  const discoverActive = currentPath === '/' || currentPath === '/discovery';

  return `<aside class="divine-sidebar" aria-label="Primary navigation">
  <a href="${homeHref}" class="divine-sidebar-logo" aria-label="Divine home">
    <img src="/divine-logo.svg" alt="Divine" width="96" height="22" />
  </a>
  <nav class="divine-sidebar-nav">
    <a href="/supporters" class="divine-nav-link${isActive('/supporters')}">Supporters</a>
    <a href="/search" class="divine-nav-link${isActive('/search')}">Search</a>
    <a href="/discovery/classics" class="divine-nav-link${discoverActive ? ' divine-nav-link--active' : ''}">Discover</a>
    <a href="/popular" class="divine-nav-link${isActive('/popular')}">Popular</a>
    <a href="/leaderboard" class="divine-nav-link${isActive('/leaderboard')}">Leaderboard</a>
    <a href="/services" class="divine-nav-link${isActive('/services')}">Services</a>
  </nav>
</aside>
<header class="divine-mobile-header">
  <a href="${homeHref}" aria-label="Divine home">
    <img src="/divine-logo.svg" alt="Divine" width="96" height="22" />
  </a>
  <div class="divine-mobile-links">
    <a href="/discovery/classics">Discover</a>
    <a href="/search">Search</a>
  </div>
</header>`;
}

/**
 * Discovery tab navigation matching the real DiscoveryPage tabs (Classic, Hot, Tags).
 */
export function discoveryTabs({ activeTab = 'hot' } = {}) {
  const tabs = [
    { id: 'classics', label: 'Classic', path: '/discovery/classics' },
    { id: 'hot', label: 'Hot', path: '/discovery/hot' },
    { id: 'hashtags', label: 'Tags', path: '/discovery/hashtags' },
  ];
  const items = tabs.map(t =>
    `<a href="${t.path}" class="divine-tab${t.id === activeTab ? ' divine-tab--active' : ''}">${t.label}</a>`
  ).join('\n    ');
  return `<div class="divine-tabs" role="tablist">\n    ${items}\n  </div>`;
}

/**
 * Single video card matching Divine's brand VideoCard layout.
 * @param {Object} video - Video data from Funnelcake API
 * @param {Object} [options]
 * @param {string} [options.accent] - Brand shadow accent ('green' | 'pink' | 'violet')
 * @param {boolean} [options.isPriority] - First visible card (eager high-priority poster)
 */
export function videoCard(video, { accent = 'green', isPriority = false } = {}) {
  const isAgeRestricted = video.age_restricted === true || video.moderation_status === 'age_restricted';
  const title = escapeHtml(video.title || 'Untitled');
  const thumbnail = isAgeRestricted ? '' : escapeHtml(video.thumbnail || '');
  const authorName = escapeHtml(video.author_name || video.authorName || '');
  const authorAvatar = escapeHtml(video.author_avatar || video.authorAvatar || '');
  // SPA convention is /video/{event.id}; d_tag resolution on that route is
  // unverified for native videos, so only fall back to d_tag when id is absent.
  const videoId = escapeHtml(video.id || video.d_tag || '');
  const href = videoId ? `/video/${videoId}` : '#';

  const stats = [];
  const loops = video.loops || video.loop_count || 0;
  const views = video.views || 0;
  const reactions = (video.embedded_likes || 0) + (video.reactions || video.reaction_count || 0);
  const comments = (video.embedded_comments || 0) + (video.comments || video.comment_count || 0);
  if (loops > 0) stats.push(`${formatCount(loops)} loops`);
  else if (views > 0) stats.push(`${formatCount(views)} views`);
  if (reactions > 0) stats.push(`${formatCount(reactions)} likes`);
  if (comments > 0) stats.push(`${formatCount(comments)} comments`);

  const imgAttrs = isPriority
    ? 'loading="eager" fetchpriority="high" decoding="async"'
    : 'loading="lazy" decoding="async"';

  const thumbImg = thumbnail
    ? `<img src="${thumbnail}" alt="${title}" ${imgAttrs} />`
    : `<div style="width:100%;height:100%;background:#07241B;"></div>`;

  const accentClass = accent === 'pink'
    ? ' divine-card--pink'
    : accent === 'violet'
      ? ' divine-card--violet'
      : '';

  return `<article class="divine-card${accentClass}">
  <a href="${href}">
    ${authorName ? `<div class="divine-card-header">
      ${authorAvatar ? `<img src="${authorAvatar}" alt="" class="divine-card-avatar" loading="lazy" decoding="async" />` : `<div class="divine-card-avatar"></div>`}
      <span class="divine-card-author-name">${authorName}</span>
    </div>` : ''}
    <div class="divine-card-thumb">
      ${thumbImg}
      <div class="divine-card-play">${PLAY_ICON_SVG}</div>
    </div>
    <div class="divine-card-body">
      <div class="divine-card-title">${title}</div>
      ${stats.length ? `<div class="divine-card-stats">${stats.join(' &middot; ')}</div>` : ''}
    </div>
  </a>
</article>`;
}

/**
 * Single-column vertical video feed (matches DiscoveryPage / VideoFeed).
 */
export function videoFeed(videos, { accent = 'green' } = {}) {
  if (!videos || !videos.length) {
    return `<div class="divine-feed"><p style="text-align:center;color:var(--dv-fg-muted);padding:48px 0;">No videos found</p></div>`;
  }
  return `<div class="divine-feed">\n${videos.map((v, i) => videoCard(v, { accent, isPriority: i === 0 })).join('\n')}\n</div>`;
}

/**
 * Grid of video cards (matches ProfilePage / SearchPage VideoGrid).
 */
export function videoGrid(videos) {
  if (!videos || !videos.length) {
    return `<div class="divine-grid"><p style="grid-column:1/-1;text-align:center;color:var(--dv-fg-muted);padding:48px 0;">No videos found</p></div>`;
  }
  return `<div class="divine-grid">\n${videos.map((v, i) => videoCard(v, { isPriority: i === 0 })).join('\n')}\n</div>`;
}

/**
 * Video detail view with poster and inline play.
 */
export function videoDetail(video) {
  const title = escapeHtml(video.title || 'Video on Divine');
  const description = escapeHtml(video.description || video.content || '');
  const isAgeRestricted = video.age_restricted === true || video.moderation_status === 'age_restricted';
  const thumbnail = isAgeRestricted ? '' : escapeHtml(video.thumbnail || '');
  const videoUrl = isAgeRestricted ? '' : escapeHtml(video.video_url || video.videoUrl || '');
  const authorName = escapeHtml(video.author_name || video.authorName || '');
  const authorAvatar = escapeHtml(video.author_avatar || video.authorAvatar || '');

  const reactions = video.reactions || video.reaction_count || 0;
  const comments = video.comments || video.comment_count || 0;
  const reposts = video.reposts || video.repost_count || 0;
  const loops = video.loops || video.loop_count || 0;

  // Tiny inline JS for play/pause without loading the full app
  const playScript = videoUrl ? `<script>
(function(){
  var c=document.getElementById('divine-video-player');
  var o=document.getElementById('divine-play-btn');
  if(!c||!o)return;
  o.addEventListener('click',function(){
    c.play();o.style.display='none';
  });
  c.addEventListener('click',function(){
    if(c.paused)c.play();else c.pause();
  });
  c.addEventListener('ended',function(){
    c.currentTime=0;c.play();
  });
})();
</script>` : '';

  const mediaEl = videoUrl
    ? `<video id="divine-video-player" poster="${thumbnail}" preload="none" playsinline loop>
        <source src="${videoUrl}" type="video/mp4" />
      </video>
      <div id="divine-play-btn" class="divine-play-overlay">${PLAY_ICON_SVG}</div>`
    : (thumbnail
      ? `<img src="${thumbnail}" alt="${title}" loading="eager" fetchpriority="high" />`
      : `<div style="width:100%;height:100%;background:#07241B;"></div>`);

  return `<div class="divine-video-page">
  <div class="divine-video-container">
    ${mediaEl}
  </div>
  <div class="divine-video-info">
    <h1 class="divine-video-title">${title}</h1>
    <div class="divine-video-author">
      ${authorAvatar ? `<img src="${authorAvatar}" alt="" class="divine-video-author-avatar" />` : `<div class="divine-video-author-avatar"></div>`}
      <span class="divine-video-author-name">${authorName}</span>
    </div>
    ${description ? `<p class="divine-video-description">${description}</p>` : ''}
    <div class="divine-video-stats">
      ${loops > 0 ? `<span class="divine-video-stat">${formatCount(loops)} loops</span>` : ''}
      ${reactions > 0 ? `<span class="divine-video-stat">${formatCount(reactions)} likes</span>` : ''}
      ${comments > 0 ? `<span class="divine-video-stat">${formatCount(comments)} comments</span>` : ''}
      ${reposts > 0 ? `<span class="divine-video-stat">${formatCount(reposts)} reposts</span>` : ''}
    </div>
  </div>
  ${playScript}
</div>`;
}

/**
 * Profile header with avatar, banner, stats.
 */
export function profileHeader(profile) {
  const name = escapeHtml(profile.displayName || profile.username || 'Unknown');
  const nip05 = escapeHtml(profile.nip05 || '');
  const about = escapeHtml(profile.about || '');
  const avatar = escapeHtml(profile.picture || '');
  const banner = escapeHtml(profile.banner || '');

  const followers = profile.followersCount || 0;
  const following = profile.followingCount || 0;
  const videoCount = profile.videoCount || 0;

  const bannerEl = banner
    ? `<img src="${banner}" alt="" class="divine-profile-banner" />`
    : `<div class="divine-profile-banner"></div>`;

  return `<div class="divine-profile">
  ${bannerEl}
  <div class="divine-profile-header">
    ${avatar ? `<img src="${avatar}" alt="${name}" class="divine-profile-avatar" />` : `<div class="divine-profile-avatar"></div>`}
    <div class="divine-profile-info">
      <h1 class="divine-profile-name">${name}</h1>
      ${nip05 ? `<div class="divine-profile-nip05">${nip05}</div>` : ''}
    </div>
    <button class="divine-follow-btn" data-divine-hydrate="follow">Follow</button>
  </div>
  ${about ? `<p class="divine-profile-bio">${about}</p>` : ''}
  <div class="divine-profile-stats-bar">
    <div><span class="divine-profile-stat-value">${formatCount(followers)}</span><span class="divine-profile-stat-label">followers</span></div>
    <div><span class="divine-profile-stat-value">${formatCount(following)}</span><span class="divine-profile-stat-label">following</span></div>
    <div><span class="divine-profile-stat-value">${formatCount(videoCount)}</span><span class="divine-profile-stat-label">videos</span></div>
  </div>
</div>`;
}

/**
 * Simple page footer.
 */
export function footer() {
  return `<footer class="divine-footer">
  <p>Divine &mdash; Short-form looping videos on Nostr</p>
</footer>`;
}
