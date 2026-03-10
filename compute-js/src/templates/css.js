// ABOUTME: Critical inline CSS for edge-templated HTML pages
// ABOUTME: Minimal styles for visible content before React/Tailwind loads

/**
 * Critical CSS inlined in <style> tags for edge-rendered pages.
 * Keeps pages visually usable without the full Tailwind bundle.
 */
export const CRITICAL_CSS = `
/* Reset & base */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html, body { min-height: 100vh; font-family: 'Inter', system-ui, -apple-system, sans-serif; }
body { background-color: #F9F7F6; color: #07241B; }
a { color: inherit; text-decoration: none; }
img, video { max-width: 100%; display: block; }

/* Layout */
.divine-shell { display: flex; flex-direction: column; min-height: 100vh; }
.divine-main { flex: 1; max-width: 1280px; margin: 0 auto; padding: 0 16px; width: 100%; }

/* Navbar */
.divine-nav {
  display: flex; align-items: center; justify-content: space-between;
  padding: 12px 24px; border-bottom: 1px solid #e5e7eb;
  background: #fff; position: sticky; top: 0; z-index: 50;
}
.divine-nav-logo { font-family: 'Bricolage Grotesque', sans-serif; font-weight: 700; font-size: 24px; color: #27C58B; }
.divine-nav-links { display: flex; gap: 24px; align-items: center; }
.divine-nav-link { font-size: 14px; font-weight: 500; color: #6b7280; transition: color 0.15s; }
.divine-nav-link:hover { color: #07241B; }
.divine-nav-link--active { color: #27C58B; font-weight: 600; }

/* Discovery tabs */
.divine-tabs { display: flex; gap: 8px; padding: 16px 0; overflow-x: auto; }
.divine-tab {
  padding: 8px 20px; border-radius: 9999px; font-size: 14px; font-weight: 500;
  background: #f3f4f6; color: #374151; white-space: nowrap; transition: all 0.15s;
}
.divine-tab:hover { background: #e5e7eb; }
.divine-tab--active { background: #27C58B; color: #fff; }

/* Video grid */
.divine-grid {
  display: grid; gap: 16px; padding: 16px 0;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
}
@media (max-width: 640px) { .divine-grid { grid-template-columns: 1fr 1fr; gap: 8px; } }
@media (max-width: 380px) { .divine-grid { grid-template-columns: 1fr; } }

/* Video card */
.divine-card { border-radius: 12px; overflow: hidden; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.08); transition: transform 0.15s, box-shadow 0.15s; }
.divine-card:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.12); }
.divine-card-thumb { position: relative; aspect-ratio: 1; background: #e5e7eb; overflow: hidden; }
.divine-card-thumb img { width: 100%; height: 100%; object-fit: cover; }
.divine-card-play {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  background: rgba(0,0,0,0.2); opacity: 0; transition: opacity 0.15s;
}
.divine-card:hover .divine-card-play { opacity: 1; }
.divine-card-play svg { width: 48px; height: 48px; fill: #fff; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3)); }
.divine-card-body { padding: 12px; }
.divine-card-title { font-size: 14px; font-weight: 600; line-height: 1.3; margin-bottom: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.divine-card-author { font-size: 13px; color: #6b7280; display: flex; align-items: center; gap: 6px; }
.divine-card-avatar { width: 20px; height: 20px; border-radius: 50%; object-fit: cover; background: #d1d5db; flex-shrink: 0; }
.divine-card-stats { font-size: 12px; color: #9ca3af; margin-top: 6px; display: flex; gap: 12px; }

/* Video detail page */
.divine-video-page { max-width: 800px; margin: 0 auto; padding: 24px 16px; }
.divine-video-container { position: relative; aspect-ratio: 1; background: #000; border-radius: 12px; overflow: hidden; margin-bottom: 16px; }
.divine-video-container video, .divine-video-container img { width: 100%; height: 100%; object-fit: contain; }
.divine-video-info { padding: 0 4px; }
.divine-video-title { font-family: 'Bricolage Grotesque', sans-serif; font-size: 20px; font-weight: 700; margin-bottom: 8px; }
.divine-video-author { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
.divine-video-author-avatar { width: 36px; height: 36px; border-radius: 50%; object-fit: cover; background: #d1d5db; }
.divine-video-author-name { font-weight: 600; font-size: 15px; }
.divine-video-description { font-size: 14px; color: #374151; line-height: 1.5; margin-bottom: 16px; }
.divine-video-stats { display: flex; gap: 24px; font-size: 14px; color: #6b7280; }
.divine-video-stat { display: flex; align-items: center; gap: 6px; }

/* Profile page */
.divine-profile { max-width: 1024px; margin: 0 auto; padding: 0 16px; }
.divine-profile-banner { width: 100%; height: 200px; object-fit: cover; background: linear-gradient(135deg, #27C58B 0%, #0f4a35 100%); border-radius: 0 0 16px 16px; }
.divine-profile-header { display: flex; gap: 16px; align-items: flex-end; margin-top: -40px; padding: 0 16px; position: relative; z-index: 1; }
.divine-profile-avatar { width: 80px; height: 80px; border-radius: 50%; border: 4px solid #fff; object-fit: cover; background: #d1d5db; flex-shrink: 0; }
.divine-profile-info { padding-bottom: 8px; }
.divine-profile-name { font-family: 'Bricolage Grotesque', sans-serif; font-size: 22px; font-weight: 700; }
.divine-profile-nip05 { font-size: 13px; color: #6b7280; }
.divine-profile-bio { font-size: 14px; color: #374151; line-height: 1.5; padding: 16px; max-width: 600px; }
.divine-profile-stats-bar { display: flex; gap: 24px; padding: 12px 16px; font-size: 14px; }
.divine-profile-stat-value { font-weight: 700; }
.divine-profile-stat-label { color: #6b7280; margin-left: 4px; }
.divine-follow-btn {
  padding: 8px 24px; border-radius: 9999px; font-size: 14px; font-weight: 600;
  background: #27C58B; color: #fff; border: none; cursor: pointer;
  margin-left: auto; align-self: center;
}
.divine-follow-btn:hover { background: #1fa574; }

/* Footer */
.divine-footer { padding: 24px; text-align: center; font-size: 13px; color: #9ca3af; border-top: 1px solid #e5e7eb; margin-top: 32px; }

/* No-JS video play button */
.divine-play-overlay {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  cursor: pointer; background: rgba(0,0,0,0.15);
}
.divine-play-overlay svg { width: 64px; height: 64px; fill: #fff; filter: drop-shadow(0 2px 8px rgba(0,0,0,0.4)); }
`;
