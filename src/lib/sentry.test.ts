import { afterEach, describe, expect, it, vi } from 'vitest';

const sentryInitMock = vi.hoisted(() => vi.fn());

vi.mock('@sentry/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@sentry/react')>();
  return {
    ...actual,
    init: sentryInitMock,
  };
});

import { initializeSentry, shouldDropBenignSubtitleVttEvent } from './sentry';

describe('initializeSentry', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    sentryInitMock.mockClear();
  });

  it('skips Sentry.init when VITE_SENTRY_DSN is empty or whitespace', () => {
    vi.stubEnv('VITE_SENTRY_DEV_ENABLED', 'true');
    vi.stubEnv('VITE_SENTRY_DSN', '   ');

    initializeSentry();

    expect(sentryInitMock).not.toHaveBeenCalled();
  });

  it('initializes Sentry with the trimmed DSN when configured', () => {
    vi.stubEnv('VITE_SENTRY_DEV_ENABLED', 'true');
    vi.stubEnv('VITE_SENTRY_DSN', ' https://public@example.ingest.sentry.io/1 ');
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    initializeSentry();

    expect(sentryInitMock).toHaveBeenCalledTimes(1);
    expect(sentryInitMock.mock.calls[0][0]).toMatchObject({
      dsn: 'https://public@example.ingest.sentry.io/1',
    });
  });
});

describe('shouldDropBenignSubtitleVttEvent', () => {
  it('drops media subtitle /vtt 422 events', () => {
    const event = {
      request: {
        url: 'https://media.divine.video/f423713bd22dc6ff6e28cd1767a13a85cd4013397a592dbc55060808cf84824c/vtt',
      },
      contexts: {
        response: {
          status_code: 422,
        },
      },
    };

    expect(shouldDropBenignSubtitleVttEvent(event)).toBe(true);
  });

  it('drops media subtitle /vtt 404 events', () => {
    const event = {
      request: {
        url: 'https://media.divine.video/example-hash/vtt',
      },
      contexts: {
        response: {
          status_code: '404',
        },
      },
    };

    expect(shouldDropBenignSubtitleVttEvent(event)).toBe(true);
  });

  it('keeps non-benign /vtt errors', () => {
    const event = {
      request: {
        url: 'https://media.divine.video/example-hash/vtt',
      },
      contexts: {
        response: {
          status_code: 500,
        },
      },
    };

    expect(shouldDropBenignSubtitleVttEvent(event)).toBe(false);
  });

  it('keeps 422 errors for non-subtitle URLs', () => {
    const event = {
      request: {
        url: 'https://api.divine.video/api/videos',
      },
      contexts: {
        response: {
          status_code: 422,
        },
      },
    };

    expect(shouldDropBenignSubtitleVttEvent(event)).toBe(false);
  });
});
