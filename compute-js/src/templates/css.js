// ABOUTME: Critical inline CSS for edge-templated HTML pages
// ABOUTME: Mirrors AppLayout, AppSidebar, DiscoveryPage, and brand VideoCard before React mounts

/**
 * Critical CSS inlined in <style> tags for edge-rendered pages.
 * Matches the real Divine brand system (off-white #F9F7F6 / dark green #07241B,
 * Bricolage Grotesque + Inter, 240px desktop sidebar, max-w-2xl single-column
 * feed, chunky brand cards with offset shadows, zero layout gradients).
 */
export const CRITICAL_CSS = `
:root {
  --dv-bg: #F9F7F6;
  --dv-surface: #FFFFFF;
  --dv-muted: #EFECE9;
  --dv-fg: #07241B;
  --dv-fg-muted: #4B635B;
  --dv-border: #D9E2DE;
  --dv-brand: #27C58B;
  --dv-brand-ink: #07241B;
  --dv-accent-green: #27C58B;
  --dv-accent-pink: #FF7496;
  --dv-accent-violet: #A3A9FF;
}
@media (prefers-color-scheme: dark) {
  :root {
    --dv-bg: #07241B;
    --dv-surface: #0D3226;
    --dv-muted: #123D2F;
    --dv-fg: #F9F7F6;
    --dv-fg-muted: #A6BDB5;
    --dv-border: #1D4D3D;
  }
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html, body { min-height: 100vh; font-family: 'Inter', system-ui, -apple-system, sans-serif; }
body { background-color: var(--dv-bg); color: var(--dv-fg); -webkit-font-smoothing: antialiased; }
a { color: inherit; text-decoration: none; }
img, video { max-width: 100%; display: block; }

/* App shell: 240px fixed desktop sidebar + offset main column */
.divine-shell { min-height: 100vh; display: flex; flex-direction: column; }

.divine-sidebar {
  display: none;
  position: fixed; left: 0; top: 0; bottom: 0; width: 240px; z-index: 40;
  flex-direction: column;
  background: var(--dv-bg);
  border-right: 1px solid var(--dv-border);
  padding: 0 12px 16px;
}
.divine-sidebar-logo {
  display: flex; align-items: center; height: 56px; padding: 0 8px;
}
.divine-sidebar-logo img { height: 22px; width: auto; }
.divine-sidebar-badges {
  display: flex; flex-direction: column; gap: 6px; padding: 0 8px 12px;
}
.divine-sidebar-badges img { height: 36px; width: auto; }
.divine-sidebar-nav { display: flex; flex-direction: column; gap: 2px; }
.divine-nav-link {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 12px; border-radius: 8px;
  font-size: 15px; font-weight: 500; color: var(--dv-fg-muted);
}
.divine-nav-link--active {
  background: var(--dv-brand); color: var(--dv-brand-ink); font-weight: 600;
  box-shadow: 3px 3px 0 #07241B;
}

/* Mobile top header (matches AppHeader) */
.divine-mobile-header {
  display: flex; align-items: center; justify-content: space-between;
  height: 56px; padding: 0 16px;
  background: var(--dv-bg); border-bottom: 1px solid var(--dv-border);
  position: sticky; top: 0; z-index: 40;
}
.divine-mobile-header img { height: 22px; width: auto; }
.divine-mobile-links { display: flex; gap: 16px; font-size: 14px; font-weight: 500; color: var(--dv-fg-muted); }

.divine-content { display: flex; flex-direction: column; flex: 1; min-height: 100vh; }
.divine-main { flex: 1; width: 100%; max-width: 1024px; margin: 0 auto; padding: 24px 16px; }
.divine-feed-column { max-width: 672px; margin: 0 auto; }

@media (min-width: 768px) {
  .divine-sidebar { display: flex; }
  .divine-mobile-header { display: none; }
  .divine-content { margin-left: 240px; }
}

/* Page header */
.divine-page-header { margin-bottom: 20px; }
.divine-page-title {
  font-family: 'Bricolage Grotesque', sans-serif;
  font-size: 24px; font-weight: 800; line-height: 1.2; color: var(--dv-fg);
}
.divine-page-subtitle { font-size: 14px; color: var(--dv-fg-muted); margin-top: 4px; }

/* Discovery tabs (matches Radix TabsList in DiscoveryPage) */
.divine-tabs {
  display: flex; gap: 4px; padding: 4px; margin-bottom: 24px;
  background: var(--dv-muted); border-radius: 12px;
}
.divine-tab {
  flex: 1; text-align: center; padding: 8px 12px; border-radius: 8px;
  font-size: 14px; font-weight: 600; color: var(--dv-fg-muted); white-space: nowrap;
}
.divine-tab--active {
  background: var(--dv-brand); color: var(--dv-brand-ink);
  box-shadow: 3px 3px 0 #07241B;
}

/* Single-column vertical feed (matches VideoFeed) */
.divine-feed { display: flex; flex-direction: column; gap: 24px; }

/* Brand VideoCard (thick dark-green border, 22px radius, chunky offset shadow) */
.divine-card {
  display: block; overflow: hidden;
  background: var(--dv-surface);
  border: 2px solid #07241B;
  border-radius: 22px;
  box-shadow: 6px 6px 0 var(--dv-accent-green);
}
.divine-card--pink { box-shadow: 6px 6px 0 var(--dv-accent-pink); }
.divine-card--violet { box-shadow: 6px 6px 0 var(--dv-accent-violet); }

.divine-card-header {
  display: flex; align-items: center; gap: 10px; padding: 14px 16px;
}
.divine-card-avatar {
  width: 36px; height: 36px; border-radius: 12px; object-fit: cover;
  background: var(--dv-muted); flex-shrink: 0;
}
.divine-card-author-name { font-size: 14px; font-weight: 600; color: var(--dv-fg); }

.divine-card-thumb {
  position: relative; aspect-ratio: 1; width: 100%;
  background: #07241B; overflow: hidden;
}
.divine-card-thumb img { width: 100%; height: 100%; object-fit: cover; }
.divine-card-play {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  background: rgba(7, 36, 27, 0.18);
}
.divine-card-play svg { width: 52px; height: 52px; fill: #F9F7F6; }

.divine-card-body { padding: 14px 16px; }
.divine-card-title {
  font-size: 15px; font-weight: 600; line-height: 1.35; margin-bottom: 8px;
  color: var(--dv-fg);
}
.divine-card-stats {
  font-size: 13px; color: var(--dv-fg-muted); display: flex; flex-wrap: wrap; gap: 14px;
}

/* Profile / search video grid (matches VideoGrid) */
.divine-grid {
  display: grid; gap: 16px; padding: 16px 0;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
}
@media (max-width: 640px) { .divine-grid { grid-template-columns: 1fr 1fr; gap: 10px; } }
.divine-grid .divine-card { border-radius: 16px; box-shadow: 4px 4px 0 var(--dv-accent-green); }
.divine-grid .divine-card-header { padding: 10px 12px; }
.divine-grid .divine-card-body { padding: 10px 12px; }

/* Video detail page */
.divine-video-page { max-width: 672px; margin: 0 auto; }
.divine-video-container {
  position: relative; aspect-ratio: 1; background: #07241B;
  border: 2px solid #07241B; border-radius: 22px; overflow: hidden;
  box-shadow: 6px 6px 0 var(--dv-accent-green);
  margin-bottom: 16px;
}
.divine-video-container video, .divine-video-container img { width: 100%; height: 100%; object-fit: contain; }
.divine-video-info { padding: 4px; }
.divine-video-title {
  font-family: 'Bricolage Grotesque', sans-serif;
  font-size: 22px; font-weight: 800; margin-bottom: 10px;
}
.divine-video-author { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
.divine-video-author-avatar { width: 40px; height: 40px; border-radius: 12px; object-fit: cover; background: var(--dv-muted); }
.divine-video-author-name { font-weight: 600; font-size: 15px; }
.divine-video-description { font-size: 14px; color: var(--dv-fg-muted); line-height: 1.5; margin-bottom: 16px; }
.divine-video-stats { display: flex; flex-wrap: wrap; gap: 20px; font-size: 14px; color: var(--dv-fg-muted); }
.divine-video-stat { display: flex; align-items: center; gap: 6px; }

/* Profile page */
.divine-profile { max-width: 960px; margin: 0 auto; }
.divine-profile-banner { width: 100%; height: 180px; object-fit: cover; background: var(--dv-brand); border-radius: 16px; border: 2px solid #07241B; }
.divine-profile-header { display: flex; gap: 16px; align-items: flex-end; margin-top: -40px; padding: 0 16px; position: relative; z-index: 1; }
.divine-profile-avatar { width: 80px; height: 80px; border-radius: 20px; border: 3px solid var(--dv-bg); object-fit: cover; background: var(--dv-muted); flex-shrink: 0; }
.divine-profile-info { padding-bottom: 8px; }
.divine-profile-name { font-family: 'Bricolage Grotesque', sans-serif; font-size: 22px; font-weight: 800; }
.divine-profile-nip05 { font-size: 13px; color: var(--dv-fg-muted); }
.divine-profile-bio { font-size: 14px; color: var(--dv-fg-muted); line-height: 1.5; padding: 14px 16px; max-width: 600px; }
.divine-profile-stats-bar { display: flex; gap: 24px; padding: 10px 16px; font-size: 14px; }
.divine-profile-stat-value { font-weight: 700; }
.divine-profile-stat-label { color: var(--dv-fg-muted); margin-left: 4px; }
.divine-follow-btn {
  padding: 8px 22px; border-radius: 14px; font-size: 14px; font-weight: 700;
  background: var(--dv-brand); color: var(--dv-brand-ink);
  border: 2px solid #07241B; box-shadow: 4px 4px 0 #07241B;
  cursor: pointer; margin-left: auto; align-self: center;
}

/* Footer */
.divine-footer { padding: 24px 16px; text-align: center; font-size: 13px; color: var(--dv-fg-muted); border-top: 1px solid var(--dv-border); margin-top: 32px; }

/* No-JS video play button */
.divine-play-overlay {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  cursor: pointer; background: rgba(7, 36, 27, 0.2);
}
.divine-play-overlay svg { width: 64px; height: 64px; fill: #F9F7F6; }
`;
