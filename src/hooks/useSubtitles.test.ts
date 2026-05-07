import React from 'react';
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
      () => useSubtitles(makeVideo({ ageRestricted: true })),
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
      () => useSubtitles(makeVideo({ ageRestricted: true })),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.current.hasSubtitles).toBe(false);
  });

  it('does not make raw CDN subtitle requests for protected media with unknown age gate status', async () => {
    const fetchSpy = vi.fn();
    global.fetch = fetchSpy as typeof fetch;

    const { result } = renderHook(
      () => useSubtitles(makeVideo({ ageRestricted: undefined })),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.current.hasSubtitles).toBe(false);
  });
});
