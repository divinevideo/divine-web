import { describe, expect, it } from 'vitest';
import { shouldDropHandledMediaHttpClientEvent } from '@/lib/sentryHttpClientFilter';

interface TestEventOptions {
  url?: string;
  statusCode?: number | string;
  mechanismType?: string;
  message?: string;
}

function createHttpClientEvent({
  url = 'https://media.divine.video/hash/hls/master.m3u8',
  statusCode = 401,
  mechanismType = 'auto.http.client.fetch',
  message,
}: TestEventOptions = {}) {
  const resolvedMessage = message ?? `HTTP Client Error with status code: ${statusCode}`;

  return {
    message: resolvedMessage,
    request: { url },
    contexts: { response: { status_code: statusCode } },
    exception: {
      values: [
        {
          value: resolvedMessage,
          mechanism: {
            type: mechanismType,
          },
        },
      ],
    },
  };
}

describe('shouldDropHandledMediaHttpClientEvent', () => {
  it('drops 401 failures for protected media assets', () => {
    const event = createHttpClientEvent({
      url: 'https://media.divine.video/43debb/hls/master.m3u8',
      statusCode: 401,
    });

    expect(shouldDropHandledMediaHttpClientEvent(event)).toBe(true);
  });

  it('drops 403 failures for protected media assets', () => {
    const event = createHttpClientEvent({
      url: 'https://media.divine.video/43debb/downloads/default.mp4',
      statusCode: 403,
    });

    expect(shouldDropHandledMediaHttpClientEvent(event)).toBe(true);
  });

  it('drops 404 failures for subtitle endpoints', () => {
    const event = createHttpClientEvent({
      url: 'https://media.divine.video/f423713/vtt',
      statusCode: 404,
    });

    expect(shouldDropHandledMediaHttpClientEvent(event)).toBe(true);
  });

  it('drops 422 failures for subtitle files', () => {
    const event = createHttpClientEvent({
      url: 'https://media.divine.video/f423713/captions/en.vtt',
      statusCode: 422,
    });

    expect(shouldDropHandledMediaHttpClientEvent(event)).toBe(true);
  });

  it('drops 404 failures for optional preview assets', () => {
    const event = createHttpClientEvent({
      url: 'https://media.divine.video/f423713/poster.jpg',
      statusCode: 404,
    });

    expect(shouldDropHandledMediaHttpClientEvent(event)).toBe(true);
  });

  it('keeps media 404 failures for non-optional playback assets', () => {
    const event = createHttpClientEvent({
      url: 'https://media.divine.video/f423713/hls/master.m3u8',
      statusCode: 404,
    });

    expect(shouldDropHandledMediaHttpClientEvent(event)).toBe(false);
  });

  it('keeps media 5xx failures visible', () => {
    const event = createHttpClientEvent({
      url: 'https://media.divine.video/f423713/hls/master.m3u8',
      statusCode: 500,
    });

    expect(shouldDropHandledMediaHttpClientEvent(event)).toBe(false);
  });

  it('keeps failures from non-media hosts', () => {
    const event = createHttpClientEvent({
      url: 'https://api.divine.video/api/videos',
      statusCode: 401,
    });

    expect(shouldDropHandledMediaHttpClientEvent(event)).toBe(false);
  });

  it('keeps non-http-client errors even when URL/status match', () => {
    const event = createHttpClientEvent({
      url: 'https://media.divine.video/43debb/hls/master.m3u8',
      statusCode: 401,
      mechanismType: 'generic',
      message: 'Something else happened',
    });

    expect(shouldDropHandledMediaHttpClientEvent(event)).toBe(false);
  });

  it('uses message fallback when contexts.response.status_code is missing', () => {
    const event = createHttpClientEvent({
      url: 'https://media.divine.video/f423713/vtt',
      statusCode: 422,
    });
    (event.contexts.response as { status_code?: number | string }).status_code = undefined;

    expect(shouldDropHandledMediaHttpClientEvent(event)).toBe(true);
  });

  it('keeps events with invalid URLs', () => {
    const event = createHttpClientEvent({
      url: 'not-a-valid-url',
      statusCode: 401,
    });

    expect(shouldDropHandledMediaHttpClientEvent(event)).toBe(false);
  });
});
