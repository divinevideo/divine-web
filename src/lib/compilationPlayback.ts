import { nip19 } from 'nostr-tools';
import { buildProfilePath } from '@/lib/directSearch';

type CompilationPlayable = 'compilation';
type SearchFilter = 'all' | 'videos' | 'users' | 'hashtags';
type CompilationFeedSource =
  | 'discovery'
  | 'home'
  | 'trending'
  | 'recent'
  | 'classics'
  | 'foryou'
  | 'category'
  | 'hashtag'
  | 'profile';

interface CompilationBase {
  play?: CompilationPlayable;
  sort?: string;
  start?: number;
  videoId?: string;
  returnTo?: string;
}

export interface SearchCompilationSource extends CompilationBase {
  source: 'search';
  query: string;
  filter?: SearchFilter;
}

export interface FeedCompilationSource extends CompilationBase {
  source: CompilationFeedSource;
  tag?: string;
  pubkey?: string;
  category?: string;
}

export type CompilationSource = SearchCompilationSource | FeedCompilationSource;
export type ParsedCompilationSource = CompilationSource & { play: CompilationPlayable };

function setOptionalParam(params: URLSearchParams, key: string, value?: string | number) {
  if (value === undefined || value === null || value === '') {
    return;
  }

  params.set(key, String(value));
}

function getProfileFallbackPath(pubkey?: string): string {
  if (!pubkey) {
    return '/';
  }

  try {
    return buildProfilePath(nip19.npubEncode(pubkey));
  } catch {
    return buildProfilePath(pubkey);
  }
}

export function buildCompilationPlaybackUrl(source: CompilationSource): string {
  const params = new URLSearchParams({
    play: 'compilation',
    source: source.source,
  });

  setOptionalParam(params, 'sort', source.sort);
  setOptionalParam(params, 'start', source.start);
  setOptionalParam(params, 'video', source.videoId);
  setOptionalParam(params, 'returnTo', source.returnTo);

  if (source.source === 'search') {
    setOptionalParam(params, 'q', source.query);
    setOptionalParam(params, 'filter', source.filter);
  } else {
    setOptionalParam(params, 'tag', source.tag);
    setOptionalParam(params, 'pubkey', source.pubkey);
    setOptionalParam(params, 'category', source.category);
  }

  return `/watch?${params.toString()}`;
}

export function parseCompilationPlaybackParams(params: URLSearchParams): ParsedCompilationSource {
  const play = (params.get('play') || 'compilation') as CompilationPlayable;
  const source = (params.get('source') || 'discovery') as CompilationSource['source'];
  const sort = params.get('sort') || undefined;
  const start = params.get('start');
  const videoId = params.get('video') || undefined;
  const returnTo = params.get('returnTo') || undefined;

  if (source === 'search') {
    return {
      play,
      source,
      query: params.get('q') || '',
      filter: (params.get('filter') || undefined) as SearchFilter | undefined,
      sort,
      start: start ? Number(start) : undefined,
      videoId,
      returnTo,
    };
  }

  return {
    play,
    source,
    tag: params.get('tag') || undefined,
    pubkey: params.get('pubkey') || undefined,
    category: params.get('category') || undefined,
    sort,
    start: start ? Number(start) : undefined,
    videoId,
    returnTo,
  };
}

export function getCompilationFallbackPath(source: CompilationSource): string {
  if (source.source === 'search') {
    const params = new URLSearchParams();
    setOptionalParam(params, 'q', source.query);
    setOptionalParam(params, 'filter', source.filter);
    setOptionalParam(params, 'sort', source.sort);
    const query = params.toString();
    return query ? `/search?${query}` : '/search';
  }

  switch (source.source) {
    case 'classics':
      return '/discovery/classics';
    case 'foryou':
      return '/discovery/foryou';
    case 'recent':
      return '/discovery/new';
    case 'discovery':
      return '/discovery';
    case 'trending':
      return '/trending';
    case 'home':
      return '/home';
    case 'hashtag':
      return source.tag ? `/hashtag/${encodeURIComponent(source.tag)}` : '/hashtags';
    case 'profile':
      return getProfileFallbackPath(source.pubkey);
    case 'category':
      return source.category ? `/category/${encodeURIComponent(source.category)}` : '/category';
  }
}

export function getCompilationTitle(source: CompilationSource): string {
  if (source.source === 'search') {
    return `Search: "${source.query}"`;
  }

  switch (source.source) {
    case 'classics':
      return 'Classics';
    case 'foryou':
      return 'For You';
    case 'trending':
      return 'Trending';
    case 'recent':
      return 'New';
    case 'home':
      return 'Following';
    case 'hashtag':
      return source.tag ? `#${source.tag}` : 'Hashtag';
    case 'profile':
      return 'Profile videos';
    case 'category':
      return source.category ? `Category: ${source.category}` : 'Category';
    case 'discovery':
      return 'Discovery';
  }
}
