import type { FunnelcakeVideoRaw } from '@/types/funnelcake';

export interface FeaturedTabsResponse {
  poll_interval_seconds: number;
  featured_tabs: FeaturedTabConfigRaw[];
}

export interface FeaturedTabConfigRaw {
  id: string;
  slug: string;
  label: Record<string, string>;
  position: unknown;
  starts_at: string;
  ends_at: string;
  enabled: boolean;
  visible_to_minors: boolean;
  pill_label: unknown;
  disclosure_label: unknown;
  has_content: boolean;
}

export interface FeaturedTabPosition {
  after?: DiscoveryTabName;
  before?: DiscoveryTabName;
}

export interface ResolvedFeaturedTab {
  id: string;
  slug: string;
  label: string;
  position: FeaturedTabPosition | null;
  pillLabel: string | null;
  sponsorName: string | null;
}

export interface FeaturedTabVideoRaw extends Omit<FunnelcakeVideoRaw, 'created_at'> {
  created_at: string | number;
  sha256?: string;
}

export interface FeaturedTabVideosResponseRaw {
  data: FeaturedTabVideoRaw[];
  // Optional because the transform treats a malformed envelope as "no more
  // pages" rather than throwing.
  pagination?: {
    next_cursor?: string | null;
    has_more?: boolean;
  };
}

export type DiscoveryTabName = 'foryou' | 'classics' | 'hot' | 'hashtags';
