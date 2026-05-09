// ABOUTME: Crawler-OG handlers for /video, /profile, /category, /@username
// ABOUTME: Each returns a Response with full OG/Twitter Card HTML or null

import { KVStore } from 'fastly:kv-store';
import { buildCrawlerHtml, cleanText } from './ogTags.js';
import { hexToNpub, decodeNpubToHex } from './bech32.js';
import { transformVideoApiResponse } from './videoMetadata.js';

const FUNNELCAKE_API_URL = 'https://relay.divine.video';
const DEFAULT_OG_IMAGE = 'https://divine.video/og.png';
const DEFAULT_SITE_DESCRIPTION = 'Watch and share 6-second looping videos on the decentralized Nostr network.';

/**
 * Fetch video metadata from Funnelcake API using Fastly backend
 */
export async function fetchVideoMetadata(videoId) {
  try {
    const response = await fetch(`${FUNNELCAKE_API_URL}/api/videos/${videoId}`, {
      backend: 'funnelcake',
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Host': 'relay.divine.video',
      },
    });

    if (!response.ok) {
      console.log('Funnelcake API returned:', response.status);
      return null;
    }

    const result = await response.json();
    const meta = transformVideoApiResponse(result, { defaultOgImage: DEFAULT_OG_IMAGE });
    if (meta) {
      console.log('Fetched video metadata - title:', meta.title, 'videoUrl:', meta.videoUrl);
    }
    return meta;
  } catch (err) {
    console.error('Failed to fetch video metadata:', err.message);
    return null;
  }
}

async function fetchProfileMetadata(pubkey) {
  try {
    const response = await fetch(`${FUNNELCAKE_API_URL}/api/users/${pubkey}`, {
      backend: 'funnelcake',
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Host': 'relay.divine.video',
      },
    });

    if (!response.ok) {
      console.log('Profile API returned:', response.status);
      return null;
    }

    return await response.json();
  } catch (err) {
    console.error('Failed to fetch profile metadata:', err.message);
    return null;
  }
}

async function fetchCategoriesMetadata() {
  try {
    const response = await fetch(`${FUNNELCAKE_API_URL}/api/categories`, {
      backend: 'funnelcake',
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Host': 'relay.divine.video',
      },
    });

    if (!response.ok) {
      console.log('Categories API returned:', response.status);
      return null;
    }

    return await response.json();
  } catch (err) {
    console.error('Failed to fetch category metadata:', err.message);
    return null;
  }
}

function humanizeCategoryName(name) {
  const normalized = cleanText(decodeURIComponent(name || '').toLowerCase());
  if (!normalized) {
    return 'Category';
  }

  if (normalized === 'diy') return 'DIY';
  if (normalized === 'vlog') return 'Vlog';
  if (normalized === 'ai') return 'AI';

  return normalized
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/**
 * Handle video page requests for social media crawlers
 * Injects dynamic OG meta tags with video-specific content
 */
export async function handleVideoOgTags(request, videoId, url) {
  try {
    // Fetch video metadata from Funnelcake
    let videoMeta = null;
    try {
      videoMeta = await fetchVideoMetadata(videoId);
    } catch (e) {
      console.error('Failed to fetch video metadata:', e.message);
    }

    // Default meta values if video not found
    const title = videoMeta?.title || 'Video on Divine';
    const description = videoMeta?.description || `Watch this video on Divine. ${DEFAULT_SITE_DESCRIPTION}`;
    const thumbnail = videoMeta?.thumbnail || DEFAULT_OG_IMAGE;
    const authorName = videoMeta?.authorName || '';
    const pageUrl = `https://divine.video/video/${videoId}`;

    const hasPlayableVideo = Boolean(videoMeta?.videoUrl);
    const videoBlock = hasPlayableVideo ? {
      url: videoMeta.videoUrl,
      type: videoMeta.videoMime || 'video/mp4',
      width: videoMeta.videoWidth || 720,
      height: videoMeta.videoHeight || 1280,
      embedUrl: `https://divine.video/embed/${videoId}`,
    } : null;

    console.log('Generating OG HTML for video:', videoId, 'title:', title, 'player:', hasPlayableVideo);
    const html = buildCrawlerHtml({
      title,
      description,
      image: thumbnail,
      url: pageUrl,
      ogType: 'video.other',
      twitterCard: hasPlayableVideo ? 'player' : 'summary_large_image',
      twitterCreator: authorName,
      imageWidth: videoMeta?.imageWidth || 1200,
      imageHeight: videoMeta?.imageHeight || 630,
      video: videoBlock,
    });

    console.log('Generated OG HTML, length:', html.length);

    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
        'Vary': 'User-Agent', // Cache different versions for crawlers vs browsers
      },
    });
  } catch (err) {
    console.error('handleVideoOgTags error:', err.message, err.stack);
    return null;
  }
}

export async function handleProfileOgTags(request, url) {
  try {
    const npub = url.pathname.split('/profile/')[1]?.split('?')[0];
    const pubkey = decodeNpubToHex(npub || '');
    if (!pubkey) {
      return null;
    }

    const profileMeta = await fetchProfileMetadata(pubkey);
    const profile = profileMeta?.profile || {};
    const stats = profileMeta?.stats || {};
    const displayName = cleanText(profile.display_name) || cleanText(profile.name) || 'Profile on Divine';
    const about = cleanText(profile.about);
    const videoCount = typeof stats.video_count === 'number' ? stats.video_count : null;
    const description = about
      || (videoCount && videoCount > 0
        ? `Watch ${displayName}'s ${videoCount} videos on Divine.`
        : `Watch ${displayName}'s videos on Divine.`);
    const image = cleanText(profile.picture) || DEFAULT_OG_IMAGE;
    const profileUrl = `https://divine.video/profile/${npub}`;
    const html = buildCrawlerHtml({
      title: `${displayName} on Divine`,
      description,
      image,
      url: profileUrl,
      ogType: 'profile',
      twitterCard: 'summary',
    });

    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
        'Vary': 'User-Agent',
      },
    });
  } catch (err) {
    console.error('handleProfileOgTags error:', err.message, err.stack);
    return null;
  }
}

export async function handleCategoryOgTags(request, url) {
  try {
    const categoryName = url.pathname === '/category'
      ? null
      : decodeURIComponent(url.pathname.split('/category/')[1]?.split('?')[0] || '');

    let title = 'Browse Categories - Divine';
    let description = 'Explore video categories on Divine - comedy, music, dance, animals, sports, food, and more.';
    let categoryUrl = 'https://divine.video/category';

    if (categoryName) {
      const categories = await fetchCategoriesMetadata();
      const matchedCategory = categories?.find(category => category.name.toLowerCase() === categoryName.toLowerCase()) || null;
      const label = humanizeCategoryName(categoryName);
      title = `${label} Videos - Divine`;
      description = typeof matchedCategory?.video_count === 'number'
        ? `Explore ${matchedCategory.video_count} ${categoryName.toLowerCase()} videos on Divine.`
        : `Explore ${categoryName.toLowerCase()} videos on Divine.`;
      categoryUrl = `https://divine.video/category/${encodeURIComponent(categoryName)}`;
    }

    const html = buildCrawlerHtml({
      title,
      description,
      image: DEFAULT_OG_IMAGE,
      url: categoryUrl,
      ogType: 'website',
      twitterCard: 'summary_large_image',
      imageWidth: 1200,
      imageHeight: 630,
    });

    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
        'Vary': 'User-Agent',
      },
    });
  } catch (err) {
    console.error('handleCategoryOgTags error:', err.message, err.stack);
    return null;
  }
}

export async function handleAtUsernameOg(username, url) {
  try {
    const namesStore = new KVStore('divine-names');
    const entry = await namesStore.get(`user:${username}`);
    if (!entry) return null;
    const userData = JSON.parse(await entry.text());
    if (userData.status !== 'active' || !userData.pubkey) return null;

    const npub = hexToNpub(userData.pubkey);
    let profile = {};
    let stats = {};
    try {
      const r = await fetch(`https://relay.divine.video/api/users/${userData.pubkey}`, {
        backend: 'funnelcake',
        method: 'GET',
        headers: { 'Accept': 'application/json', 'Host': 'relay.divine.video' },
      });
      if (r.ok) {
        const data = await r.json();
        profile = data.profile || {};
        stats = data.stats || {};
      }
    } catch (e) {
      console.error('handleAtUsernameOg funnelcake error:', e.message);
    }

    const displayName = cleanText(profile.display_name) || cleanText(profile.name) || username;
    const about = cleanText(profile.about);
    const videoCount = typeof stats.video_count === 'number' ? stats.video_count : null;
    const description = about
      || (videoCount && videoCount > 0
        ? `Watch ${displayName}'s ${videoCount} videos on Divine.`
        : `Watch ${displayName}'s videos on Divine.`);

    const html = buildCrawlerHtml({
      title: `${displayName} on Divine`,
      description,
      image: cleanText(profile.picture) || DEFAULT_OG_IMAGE,
      url: `https://divine.video/@${username}`,
      ogType: 'profile',
      twitterCard: 'summary',
    });

    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
        'Vary': 'User-Agent',
      },
    });
  } catch (err) {
    console.error('handleAtUsernameOg error:', err.message);
    return null;
  }
}
