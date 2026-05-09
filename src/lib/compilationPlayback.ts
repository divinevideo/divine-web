export interface CompilationPlaybackParams {
  play: boolean;
  start?: number;
  videoId?: string;
}

function setOptionalParam(params: URLSearchParams, key: string, value?: string | number) {
  if (value === undefined || value === null || value === '') {
    return;
  }

  params.set(key, String(value));
}

export function clearCompilationPlaybackParams(params: URLSearchParams) {
  params.delete('play');
  params.delete('start');
  params.delete('video');
}

export function buildCompilationPlaybackUrl(
  path: string,
  options: {
    start?: number;
    videoId?: string;
    extraParams?: Record<string, string | number | undefined>;
  } = {}
): string {
  const url = new URL(path, 'https://divine.video');
  const params = new URLSearchParams(url.search);

  clearCompilationPlaybackParams(params);
  params.set('play', 'compilation');
  setOptionalParam(params, 'start', options.start);
  setOptionalParam(params, 'video', options.videoId);

  if (options.extraParams) {
    for (const [key, value] of Object.entries(options.extraParams)) {
      if (value === undefined || value === null || value === '') {
        params.delete(key);
      } else {
        params.set(key, String(value));
      }
    }
  }

  const query = params.toString();
  return `${url.pathname}${query ? `?${query}` : ''}${url.hash}`;
}

export function parseCompilationPlaybackParams(params: URLSearchParams): CompilationPlaybackParams {
  const start = params.get('start');

  return {
    play: params.get('play') === 'compilation',
    start: start ? Number(start) : undefined,
    videoId: params.get('video') || undefined,
  };
}

export function getCompilationStartIndex(
  request: CompilationPlaybackParams,
  videos: ReadonlyArray<{ id: string }>
): number {
  if (videos.length === 0) {
    return 0;
  }

  if (request.videoId) {
    return videos.findIndex(video => video.id === request.videoId);
  }

  return Math.min(Math.max(request.start ?? 0, 0), videos.length - 1);
}
