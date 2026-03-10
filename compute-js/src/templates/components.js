// ABOUTME: Reusable HTML fragment generators for edge-templated pages
// ABOUTME: Pure string-returning functions for navbar, video cards, profile header, etc.

import { escapeHtml, formatCount } from './shell.js';

const PLAY_ICON_SVG = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M8 5v14l11-7z"/></svg>`;

/**
 * Top navigation bar with links to main sections.
 */
export function navbar({ currentPath = '/', apexDomain = 'divine.video' } = {}) {
  const isActive = (path) => currentPath === path ? ' divine-nav-link--active' : '';
  return `<nav class="divine-nav">
  <a href="https://${escapeHtml(apexDomain)}/" class="divine-nav-logo">diVine</a>
  <div class="divine-nav-links">
    <a href="/" class="divine-nav-link${isActive('/')}">Home</a>
    <a href="/discovery/hot" class="divine-nav-link${isActive('/discovery')}">Discover</a>
    <a href="/search" class="divine-nav-link${isActive('/search')}">Search</a>
  </div>
</nav>`;
}

/**
 * Discovery tab navigation (Trending, New, Classics, Top).
 */
export function discoveryTabs({ activeTab = 'hot' } = {}) {
  const tabs = [
    { id: 'hot', label: 'Trending', path: '/discovery/hot' },
    { id: 'new', label: 'New', path: '/discovery/new' },
    { id: 'classics', label: 'Classics', path: '/discovery/classics' },
    { id: 'top', label: 'Top', path: '/discovery/top' },
  ];
  const items = tabs.map(t =>
    `<a href="${t.path}" class="divine-tab${t.id === activeTab ? ' divine-tab--active' : ''}">${t.label}</a>`
  ).join('\n    ');
  return `<div class="divine-tabs">\n    ${items}\n  </div>`;
}

/**
 * Single video card for grid display.
 * @param {Object} video - Video data from Funnelcake API
 */
export function videoCard(video) {
  const title = escapeHtml(video.title || 'Untitled');
  const thumbnail = escapeHtml(video.thumbnail || '');
  const authorName = escapeHtml(video.author_name || video.authorName || '');
  const authorAvatar = escapeHtml(video.author_avatar || video.authorAvatar || '');
  const videoId = escapeHtml(video.id || video.d_tag || '');
  const href = videoId ? `/video/${videoId}` : '#';

  const stats = [];
  const loops = video.loops || video.loop_count || 0;
  const reactions = video.reactions || video.reaction_count || 0;
  const comments = video.comments || video.comment_count || 0;
  if (loops > 0) stats.push(`${formatCount(loops)} loops`);
  if (reactions > 0) stats.push(`${formatCount(reactions)} likes`);
  if (comments > 0) stats.push(`${formatCount(comments)} comments`);

  const thumbImg = thumbnail
    ? `<img src="${thumbnail}" alt="${title}" loading="lazy" />`
    : `<div style="width:100%;height:100%;background:#d1d5db;"></div>`;

  return `<a href="${href}" class="divine-card">
  <div class="divine-card-thumb">
    ${thumbImg}
    <div class="divine-card-play">${PLAY_ICON_SVG}</div>
  </div>
  <div class="divine-card-body">
    <div class="divine-card-title">${title}</div>
    <div class="divine-card-author">
      ${authorAvatar ? `<img src="${authorAvatar}" alt="" class="divine-card-avatar" loading="lazy" />` : ''}
      <span>${authorName}</span>
    </div>
    ${stats.length ? `<div class="divine-card-stats">${stats.join(' &middot; ')}</div>` : ''}
  </div>
</a>`;
}

/**
 * Grid of video cards.
 */
export function videoGrid(videos) {
  if (!videos || !videos.length) {
    return `<div class="divine-grid"><p style="grid-column:1/-1;text-align:center;color:#9ca3af;padding:48px 0;">No videos found</p></div>`;
  }
  return `<div class="divine-grid">\n${videos.map(v => videoCard(v)).join('\n')}\n</div>`;
}

/**
 * Video detail view with poster and inline play.
 */
export function videoDetail(video) {
  const title = escapeHtml(video.title || 'Video on diVine');
  const description = escapeHtml(video.description || video.content || '');
  const thumbnail = escapeHtml(video.thumbnail || '');
  const videoUrl = escapeHtml(video.video_url || video.videoUrl || '');
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
      ? `<img src="${thumbnail}" alt="${title}" />`
      : `<div style="width:100%;height:100%;background:#1a1a1a;"></div>`);

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
  <p>diVine &mdash; Short-form looping videos on Nostr</p>
</footer>`;
}
