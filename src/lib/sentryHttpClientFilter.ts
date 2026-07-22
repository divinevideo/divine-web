type SentryExceptionValue = {
  value?: unknown;
  mechanism?: {
    type?: unknown;
    data?: Record<string, unknown>;
  };
};

type SentryEventLike = {
  message?: unknown;
  request?: {
    url?: unknown;
  };
  contexts?: {
    response?: {
      status_code?: unknown;
    };
  };
  exception?: {
    values?: SentryExceptionValue[];
  };
};

const MEDIA_HOSTNAME = 'media.divine.video';
const FUNNELCAKE_API_HOSTNAMES = new Set([
  'api.divine.video',
  'api.staging.divine.video',
]);
const FUNNELCAKE_RELAY_HOSTNAMES = new Set([
  'relay.divine.video',
  'relay.staging.divine.video',
]);
const HEX_64_RE = /^[a-f0-9]{64}$/i;
const HTTP_CLIENT_MESSAGE_RE = /^HTTP Client Error with status code:\s*(\d{3})$/i;
const OPTIONAL_IMAGE_EXTENSION_RE = /\.(?:avif|gif|jpe?g|png|webp)$/i;
const OPTIONAL_PREVIEW_PATH_SEGMENT_RE = /\/(?:poster|preview|thumbnail|thumb)(?:\/|$)/i;
const SUBTITLE_PATH_RE = /(?:\/vtt(?:\/|$)|\.vtt$)/i;

function toSafeString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function parseStatusFromHttpClientMessage(message: string | null): number | null {
  if (!message) return null;
  const match = message.match(HTTP_CLIENT_MESSAGE_RE);
  if (!match) return null;
  const statusCode = Number.parseInt(match[1], 10);
  return Number.isFinite(statusCode) ? statusCode : null;
}

function extractStatusCode(event: SentryEventLike): number | null {
  const rawStatusCode = event.contexts?.response?.status_code;
  if (typeof rawStatusCode === 'number' && Number.isFinite(rawStatusCode)) {
    return rawStatusCode;
  }
  if (typeof rawStatusCode === 'string' && rawStatusCode.trim().length > 0) {
    const parsedStatusCode = Number.parseInt(rawStatusCode, 10);
    if (Number.isFinite(parsedStatusCode)) {
      return parsedStatusCode;
    }
  }

  const statusFromMessage = parseStatusFromHttpClientMessage(toSafeString(event.message));
  if (statusFromMessage !== null) {
    return statusFromMessage;
  }

  const exceptionValues = event.exception?.values ?? [];
  for (const value of exceptionValues) {
    const statusFromException = parseStatusFromHttpClientMessage(toSafeString(value.value));
    if (statusFromException !== null) {
      return statusFromException;
    }
  }

  return null;
}

function hasAutoHttpClientMechanism(event: SentryEventLike): boolean {
  const exceptionValues = event.exception?.values ?? [];

  return exceptionValues.some((value) => {
    const mechanismType = toSafeString(value.mechanism?.type);
    if (mechanismType?.startsWith('auto.http.client.')) {
      return true;
    }

    const mechanismDataType = toSafeString(value.mechanism?.data?.type);
    return mechanismDataType?.startsWith('auto.http.client.') ?? false;
  });
}

function isHttpClientEvent(event: SentryEventLike): boolean {
  if (hasAutoHttpClientMechanism(event)) {
    return true;
  }

  if (parseStatusFromHttpClientMessage(toSafeString(event.message)) !== null) {
    return true;
  }

  const exceptionValues = event.exception?.values ?? [];
  return exceptionValues.some((value) => (
    parseStatusFromHttpClientMessage(toSafeString(value.value)) !== null
  ));
}

function isSubtitlePath(pathname: string): boolean {
  return SUBTITLE_PATH_RE.test(pathname);
}

function isOptionalPreviewPath(pathname: string): boolean {
  if (OPTIONAL_PREVIEW_PATH_SEGMENT_RE.test(pathname)) {
    return true;
  }

  return OPTIONAL_IMAGE_EXTENSION_RE.test(pathname);
}

function isFunnelcakeFallbackReportedPath(pathname: string): boolean {
  const normalizedPath = pathname.replace(/\/+$/, '') || '/';
  const segments = normalizedPath.split('/').filter(Boolean);

  if (normalizedPath === '/api/search' || normalizedPath === '/api/search/profiles') {
    return true;
  }

  if (normalizedPath === '/api/users/bulk' || normalizedPath === '/api/leaderboard/creators') {
    return true;
  }

  if (segments.length === 3 && segments[0] === 'api' && segments[1] === 'users') {
    return HEX_64_RE.test(segments[2]);
  }

  if (segments.length === 3 && segments[0] === 'api' && segments[1] === 'videos') {
    return segments[2].length > 0 && segments[2] !== 'stats';
  }

  return false;
}

/**
 * Filters raw "HTTP Client Error" events for Funnelcake REST API requests.
 *
 * Only suppress endpoints whose call sites emit a replacement
 * FunnelcakeFallbackError. Other Funnelcake REST failures must keep their raw
 * HTTP-client event so Sentry does not lose the only signal for that failure.
 */
export function shouldDropFunnelcakeHttpClientEvent(event: SentryEventLike): boolean {
  if (!isHttpClientEvent(event)) {
    return false;
  }

  const requestUrl = toSafeString(event.request?.url);
  if (!requestUrl) {
    return false;
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(requestUrl);
  } catch {
    return false;
  }

  if (!isFunnelcakeFallbackReportedPath(parsedUrl.pathname)) {
    return false;
  }

  if (FUNNELCAKE_API_HOSTNAMES.has(parsedUrl.hostname)) {
    return true;
  }

  return FUNNELCAKE_RELAY_HOSTNAMES.has(parsedUrl.hostname)
    && parsedUrl.pathname.startsWith('/api/');
}

/**
 * Filters handled media fetch failures produced by Sentry's httpClientIntegration.
 *
 * Keep narrow allowlists to avoid hiding actionable production failures:
 * - 401/403 on gated media assets
 * - 404/422 on optional subtitles and preview/poster images
 */
export function shouldDropHandledMediaHttpClientEvent(event: SentryEventLike): boolean {
  if (!isHttpClientEvent(event)) {
    return false;
  }

  const requestUrl = toSafeString(event.request?.url);
  if (!requestUrl) {
    return false;
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(requestUrl);
  } catch {
    return false;
  }

  if (parsedUrl.hostname !== MEDIA_HOSTNAME) {
    return false;
  }

  const statusCode = extractStatusCode(event);
  if (statusCode === null) {
    return false;
  }

  if (statusCode === 401 || statusCode === 403) {
    return true;
  }

  if (statusCode !== 404 && statusCode !== 422) {
    return false;
  }

  if (isSubtitlePath(parsedUrl.pathname)) {
    return true;
  }

  if (isOptionalPreviewPath(parsedUrl.pathname)) {
    return true;
  }

  return false;
}
