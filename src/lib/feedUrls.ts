// ABOUTME: RSS feed URL builders for all feed types
// ABOUTME: Centralized feed URL generation using API_CONFIG base URL

import { API_CONFIG } from '@/config/api';

const base = API_CONFIG.funnelcake.baseUrl;

export const feedUrls = {
  latest: () => `${base}/feed/latest`,
  trending: () => `${base}/feed/trending`,
  userVideos: (npub: string) => `${base}/feed/${npub}/videos`,
  userFeed: (npub: string) => `${base}/feed/${npub}/feed`,
  hashtag: (tag: string) => `${base}/feed/tag/${encodeURIComponent(tag)}`,
  category: (name: string) => `${base}/feed/category/${encodeURIComponent(name)}`,
};
