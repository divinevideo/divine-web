const DEFAULT_OG_IMAGE = 'https://divine.video/og.png';
const DEFAULT_SITE_DESCRIPTION = 'Watch and share 6-second looping videos on the decentralized Nostr network.';

const CATEGORY_LABEL_OVERRIDES: Record<string, string> = {
  diy: 'DIY',
  vlog: 'Vlog',
  ai: 'AI',
};

const BECH32_CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';

export interface PageMeta {
  title: string;
  description: string;
  ogType: string;
  url: string;
  image: string;
  imageAlt: string;
  twitterCard: string;
  videoUrl?: string;
  videoMimeType?: string;
}

export interface VideoApiResponse {
  event: {
    id: string;
    content: string;
    tags: string[][];
  };
  stats?: {
    author_name?: string;
  };
}

export interface ProfileApiResponse {
  profile?: {
    display_name?: string;
    name?: string;
    about?: string;
    picture?: string;
  };
  stats?: {
    video_count?: number;
  };
}

function cleanText(value?: string | null): string {
  return value?.replace(/\s+/g, ' ').trim() || '';
}

function pickFirstNonEmpty(...values: Array<string | undefined | null>): string | null {
  for (const value of values) {
    const cleaned = cleanText(value);
    if (cleaned) {
      return cleaned;
    }
  }

  return null;
}

function truncateText(value: string, maxLength: number): string {
  const trimmed = cleanText(value);
  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  return `${trimmed.slice(0, maxLength - 1).trimEnd()}…`;
}

function getTagValue(tags: string[][], name: string): string | undefined {
  return tags.find(tag => tag[0] === name)?.[1];
}

function parseImeta(tags: string[][]): { url?: string; image?: string; mimeType?: string } {
  const imetaTag = tags.find(tag => tag[0] === 'imeta');
  if (!imetaTag) {
    return {};
  }

  const parsed: { url?: string; image?: string; mimeType?: string } = {};

  for (let i = 1; i < imetaTag.length; i += 1) {
    const part = imetaTag[i];
    const separatorIndex = part.indexOf(' ');
    if (separatorIndex === -1) {
      continue;
    }

    const key = part.slice(0, separatorIndex);
    const value = part.slice(separatorIndex + 1).trim();

    if (key === 'url') parsed.url = value;
    if (key === 'image') parsed.image = value;
    if (key === 'm') parsed.mimeType = value;
  }

  return parsed;
}

function humanizeCategoryName(name: string): string {
  const normalized = decodeURIComponent(name).trim().toLowerCase();
  if (!normalized) {
    return 'Category';
  }

  if (CATEGORY_LABEL_OVERRIDES[normalized]) {
    return CATEGORY_LABEL_OVERRIDES[normalized];
  }

  return normalized
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function categoryDescription(name: string, videoCount?: number): string {
  const normalized = cleanText(decodeURIComponent(name).toLowerCase()) || 'category';
  if (typeof videoCount === 'number' && Number.isFinite(videoCount) && videoCount >= 0) {
    return `Explore ${videoCount} ${normalized} videos on Divine.`;
  }

  return `Explore ${normalized} videos on Divine.`;
}

function convertBits(data: number[], fromBits: number, toBits: number, pad: boolean): number[] | null {
  let acc = 0;
  let bits = 0;
  const result: number[] = [];
  const maxv = (1 << toBits) - 1;
  const maxAcc = (1 << (fromBits + toBits - 1)) - 1;

  for (const value of data) {
    if (value < 0 || (value >> fromBits) !== 0) {
      return null;
    }

    acc = ((acc << fromBits) | value) & maxAcc;
    bits += fromBits;

    while (bits >= toBits) {
      bits -= toBits;
      result.push((acc >> bits) & maxv);
    }
  }

  if (pad) {
    if (bits > 0) {
      result.push((acc << (toBits - bits)) & maxv);
    }
  } else if (bits >= fromBits || ((acc << (toBits - bits)) & maxv) !== 0) {
    return null;
  }

  return result;
}

export function decodeNpubToHex(npub: string): string | null {
  const normalized = npub.toLowerCase();
  if (!normalized.startsWith('npub1')) {
    return null;
  }

  const separatorIndex = normalized.lastIndexOf('1');
  if (separatorIndex === -1) {
    return null;
  }

  const dataPart = normalized.slice(separatorIndex + 1);
  if (dataPart.length < 6) {
    return null;
  }

  const values = [...dataPart].map(char => BECH32_CHARSET.indexOf(char));
  if (values.some(value => value === -1)) {
    return null;
  }

  const payload = values.slice(0, -6);
  const decoded = convertBits(payload, 5, 8, false);
  if (!decoded) {
    return null;
  }

  return decoded.map(value => value.toString(16).padStart(2, '0')).join('');
}

export function extractProfileNpub(pathname: string): string | null {
  const match = pathname.match(/^\/profile\/([^/]+)$/);
  if (!match) {
    return null;
  }

  return decodeURIComponent(match[1]);
}

export function extractCategoryName(pathname: string): string | null {
  const match = pathname.match(/^\/category\/([^/]+)$/);
  if (!match) {
    return null;
  }

  return decodeURIComponent(match[1]);
}

export function buildVideoPageMeta(url: URL, payload: VideoApiResponse): PageMeta {
  const authorName = cleanText(payload.stats?.author_name);
  const title = pickFirstNonEmpty(
    getTagValue(payload.event.tags, 'title'),
    getTagValue(payload.event.tags, 'alt'),
    getTagValue(payload.event.tags, 'summary'),
    payload.event.content,
    authorName ? `Video by ${authorName}` : null,
    'Video on Divine'
  ) || 'Video on Divine';

  const description = truncateText(
    pickFirstNonEmpty(
      payload.event.content,
      getTagValue(payload.event.tags, 'summary'),
      getTagValue(payload.event.tags, 'alt'),
      authorName ? `Watch this video by ${authorName} on Divine` : null,
      'Watch this video on Divine'
    ) || 'Watch this video on Divine',
    200
  );

  const media = parseImeta(payload.event.tags);

  return {
    title,
    description,
    ogType: 'video.other',
    url: url.toString(),
    image: media.image || DEFAULT_OG_IMAGE,
    imageAlt: title,
    twitterCard: 'summary_large_image',
    videoUrl: media.url,
    videoMimeType: media.mimeType,
  };
}

export function buildProfilePageMeta(url: URL, payload: ProfileApiResponse): PageMeta {
  const displayName = pickFirstNonEmpty(
    payload.profile?.display_name,
    payload.profile?.name,
    'Profile on Divine'
  ) || 'Profile on Divine';
  const about = cleanText(payload.profile?.about);
  const videoCount = payload.stats?.video_count;
  const description = about
    || (typeof videoCount === 'number' && videoCount > 0
      ? `Watch ${displayName}'s ${videoCount} videos on Divine.`
      : `Watch ${displayName}'s videos on Divine.`);

  return {
    title: `${displayName} on Divine`,
    description,
    ogType: 'profile',
    url: url.toString(),
    image: cleanText(payload.profile?.picture) || DEFAULT_OG_IMAGE,
    imageAlt: displayName,
    twitterCard: 'summary',
  };
}

export function buildCategoryPageMeta(
  url: URL,
  category: { video_count?: number } = {}
): PageMeta {
  const categoryName = extractCategoryName(url.pathname) || 'category';
  const label = humanizeCategoryName(categoryName);

  return {
    title: `${label} Videos - Divine`,
    description: categoryDescription(categoryName, category.video_count),
    ogType: 'website',
    url: url.toString(),
    image: DEFAULT_OG_IMAGE,
    imageAlt: `${label} videos on Divine`,
    twitterCard: 'summary_large_image',
  };
}

export function buildCategoriesIndexMeta(url: URL): PageMeta {
  return {
    title: 'Browse Categories - Divine',
    description: 'Explore video categories on Divine - comedy, music, dance, animals, sports, food, and more.',
    ogType: 'website',
    url: url.toString(),
    image: DEFAULT_OG_IMAGE,
    imageAlt: 'Browse Divine video categories',
    twitterCard: 'summary_large_image',
  };
}

export function getDefaultPageMeta(url: URL): PageMeta {
  return {
    title: 'Divine Web - Short-form Looping Videos on Nostr',
    description: DEFAULT_SITE_DESCRIPTION,
    ogType: 'website',
    url: url.toString(),
    image: DEFAULT_OG_IMAGE,
    imageAlt: 'Divine Web - Short-form looping videos on the Nostr network',
    twitterCard: 'summary_large_image',
  };
}
