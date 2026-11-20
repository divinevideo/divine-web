import React from 'react';
import { createHash } from 'node:crypto';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSubtitles } from './useSubtitles';
import type { ParsedVideoData } from '@/types/video';

const mockNostrQuery = vi.fn();
const mockUseAdultVerification = vi.fn();

vi.mock('@nostrify/react', () => ({
  useNostr: () => ({
    nostr: {
      query: mockNostrQuery,
    },
  }),
}));

vi.mock('@/hooks/useAdultVerification', () => ({
  useAdultVerification: () => mockUseAdultVerification(),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

function makeVideo(overrides: Partial<ParsedVideoData> = {}): ParsedVideoData {
  return {
    id: 'video-1',
    pubkey: 'f'.repeat(64),
    kind: 34236,
    createdAt: 1700000000,
    content: 'Test video',
    title: 'Test video',
    videoUrl: 'https://media.divine.video/4a31d696c2275e60dbfe2359e6ff006f78a30f5df11c7290233a7860c4e8c31e',
    thumbnailUrl: 'https://media.divine.video/4a31d696c2275e60dbfe2359e6ff006f78a30f5df11c7290233a7860c4e8c31e.jpg',
    hashtags: [],
    vineId: 'vine-id-1',
    reposts: [],
    isVineMigrated: false,
    ageRestricted: false,
    ...overrides,
  };
}

describe('useSubtitles protected media auth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNostrQuery.mockResolvedValue([]);
    mockUseAdultVerification.mockReturnValue({
      isVerified: false,
      isLoading: false,
      hasSigner: false,
      getAuthHeader: vi.fn().mockResolvedValue(null),
    });
  });

  it('sends authorization headers for age-restricted CDN subtitle requests', async () => {
    const getAuthHeader = vi.fn().mockResolvedValue('Nostr subtitles-auth');
    mockUseAdultVerification.mockReturnValue({
      isVerified: true,
      isLoading: false,
      hasSigner: true,
      getAuthHeader,
    });

    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('WEBVTT\n\n00:00.000 --> 00:01.000\nhello'),
    });
    global.fetch = fetchSpy as typeof fetch;

    const { result } = renderHook(
      () => useSubtitles(makeVideo({
        ageRestricted: true,
        textTrackRef: `39307:${'a'.repeat(64)}:subtitles:video-1`,
      })),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.hasSubtitles).toBe(true);
    });

    expect(getAuthHeader).toHaveBeenCalledWith(
      'https://media.divine.video/4a31d696c2275e60dbfe2359e6ff006f78a30f5df11c7290233a7860c4e8c31e/vtt',
      'GET'
    );
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://media.divine.video/4a31d696c2275e60dbfe2359e6ff006f78a30f5df11c7290233a7860c4e8c31e/vtt',
      expect.objectContaining({
        headers: { Authorization: 'Nostr subtitles-auth' },
        signal: expect.any(AbortSignal),
      })
    );
  });

  it('does not make raw CDN subtitle requests for age-restricted media without auth', async () => {
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as typeof fetch;

    const { result } = renderHook(
      () => useSubtitles(makeVideo({
        ageRestricted: true,
        textTrackRef: `39307:${'a'.repeat(64)}:subtitles:video-1`,
      })),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.current.hasSubtitles).toBe(false);
  });

  it('does not probe CDN subtitles when video does not advertise text tracks', async () => {
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as typeof fetch;

    const { result } = renderHook(
      () => useSubtitles(makeVideo({ ageRestricted: false, textTrackRef: undefined })),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockNostrQuery).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.current.hasSubtitles).toBe(false);
  });

  it('treats CDN 422 subtitle responses as benign missing subtitles', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      text: () => Promise.resolve(''),
    });
    global.fetch = fetchSpy as typeof fetch;

    const { result } = renderHook(
      () => useSubtitles(makeVideo({
        textTrackRef: `39307:${'a'.repeat(64)}:subtitles:video-1`,
      })),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://media.divine.video/4a31d696c2275e60dbfe2359e6ff006f78a30f5df11c7290233a7860c4e8c31e/vtt',
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
    expect(result.current.hasSubtitles).toBe(false);
  });
});

const OLD_VTT = 'WEBVTT\n\n00:00.000 --> 00:01.000\nold caption';
const NEW_VTT = 'WEBVTT\n\n00:00.000 --> 00:01.000\nnew caption';

function sha256(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

describe('useSubtitles embedded captions against the caption file ref', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNostrQuery.mockResolvedValue([]);
    mockUseAdultVerification.mockReturnValue({
      isVerified: false,
      isLoading: false,
      hasSigner: false,
      getAuthHeader: vi.fn().mockResolvedValue(null),
    });
  });

  it.each([
    ['a bare hash', sha256(OLD_VTT)],
    ['an uppercase hash with an extension', `${sha256(OLD_VTT).toUpperCase()}.vtt`],
  ])('plays embedded captions without a request when the ref names %s of them', async (_, fileName) => {
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as typeof fetch;

    const { result } = renderHook(
      () => useSubtitles(makeVideo({
        textTrackContent: OLD_VTT,
        textTrackRef: `https://media.divine.video/${fileName}`,
      })),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.hasSubtitles).toBe(true);
    });

    expect(result.current.cues.map((cue) => cue.text)).toEqual(['old caption']);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(mockNostrQuery).not.toHaveBeenCalled();
  });

  it.each([
    ['a bare hash', sha256(NEW_VTT)],
    ['a hash with an extension', `${sha256(NEW_VTT)}.vtt`],
  ])('plays the caption file the ref names by %s when embedded captions hash to something else', async (_, fileName) => {
    const refUrl = `https://media.divine.video/${fileName}`;
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve(NEW_VTT),
    });
    global.fetch = fetchSpy as typeof fetch;

    const { result } = renderHook(
      () => useSubtitles(makeVideo({ textTrackContent: OLD_VTT, textTrackRef: refUrl })),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.hasSubtitles).toBe(true);
    });

    expect(result.current.cues.map((cue) => cue.text)).toEqual(['new caption']);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith(
      refUrl,
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });

  it.each([
    ['the request fails', () => Promise.reject(new TypeError('Failed to fetch'))],
    ['the file is missing', () => Promise.resolve({ ok: false, status: 404, text: () => Promise.resolve('') })],
    ['the file is not WebVTT', () => Promise.resolve({ ok: true, status: 200, text: () => Promise.resolve('<html></html>') })],
  ])('falls back to embedded captions when they are stale and %s', async (_, respond) => {
    const refUrl = `https://media.divine.video/${sha256(NEW_VTT)}`;
    const fetchSpy = vi.fn().mockImplementation(respond);
    global.fetch = fetchSpy as typeof fetch;

    const { result } = renderHook(
      () => useSubtitles(makeVideo({ textTrackContent: OLD_VTT, textTrackRef: refUrl })),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.hasSubtitles).toBe(true);
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      refUrl,
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
    expect(result.current.cues.map((cue) => cue.text)).toEqual(['old caption']);
  });

  it.each([
    ['a 39307 coordinate', `39307:${'a'.repeat(64)}:subtitles:video-1`],
    ['a transcript URL', `https://media.divine.video/${sha256(NEW_VTT)}/vtt`],
    ['a named file', 'https://media.divine.video/captions/en.vtt'],
  ])('plays embedded captions without a request when the ref is %s', async (_, ref) => {
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as typeof fetch;

    const { result } = renderHook(
      () => useSubtitles(makeVideo({ textTrackContent: OLD_VTT, textTrackRef: ref })),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.hasSubtitles).toBe(true);
    });

    expect(result.current.cues.map((cue) => cue.text)).toEqual(['old caption']);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(mockNostrQuery).not.toHaveBeenCalled();
  });
});
