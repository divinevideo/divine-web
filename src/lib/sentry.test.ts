import { describe, expect, it } from 'vitest';
import { shouldDropBenignSubtitleVttEvent } from './sentry';

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
