// ABOUTME: RSS feed URL builders for all feed types
// ABOUTME: Centralized feed URL generation using API_CONFIG base URL

import { getFunnelcakeBaseUrl } from '@/config/api';

export const feedUrls = {
  latest: () => `${getFunnelcakeBaseUrl()}/feed/latest`,
  trending: () => `${getFunnelcakeBaseUrl()}/feed/trending`,
  userVideos: (npub: string) => `${getFunnelcakeBaseUrl()}/feed/${npub}/videos`,
  userFeed: (npub: string) => `${getFunnelcakeBaseUrl()}/feed/${npub}/feed`,
  hashtag: (tag: string) => `${getFunnelcakeBaseUrl()}/feed/tag/${encodeURIComponent(tag)}`,
  category: (name: string) => `${getFunnelcakeBaseUrl()}/feed/category/${encodeURIComponent(name)}`,
};
