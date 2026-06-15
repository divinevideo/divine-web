// ABOUTME: Tests for useVideoUpload hook
// ABOUTME: Covers segment combining, duration extraction, Blossom upload, progress tracking, and error handling

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useVideoUpload } from './useVideoUpload';

// ── Module mocks ──────────────────────────────────────────────────────────────

const mockMutateAsync = vi.fn();
vi.mock('@/hooks/useUploadFile', () => ({
  useUploadFile: () => ({ mutateAsync: mockMutateAsync }),
}));

const mockToast = vi.fn();
vi.mock('@/hooks/useToast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

function makeSegment(blobUrl = 'blob:segment-1') {
  return {
    blob: new Blob(['video-data'], { type: 'video/webm' }),
    blobUrl,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useVideoUpload', () => {
  let mockCreateObjectURL: ReturnType<typeof vi.fn>;
  let mockRevokeObjectURL: ReturnType<typeof vi.fn>;

  let videoEl: {
    preload: string;
    duration: number;
    _src: string;
    onloadedmetadata: (() => void) | null;
    onerror: (() => void) | null;
  };
  let videoShouldError: boolean;

  beforeEach(() => {
    vi.resetAllMocks();
    videoShouldError = false;

    // Re-stub URL blob APIs after reset (jsdom does not implement them)
    mockCreateObjectURL = vi.fn().mockReturnValue('blob:mock-url');
    mockRevokeObjectURL = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', {
      value: mockCreateObjectURL,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      value: mockRevokeObjectURL,
      writable: true,
      configurable: true,
    });

    // Mock <video> element so getVideoDuration resolves without real media decoding
    videoEl = {
      preload: '',
      duration: 3.5, // seconds — hook converts to ms (3500)
      _src: '',
      onloadedmetadata: null,
      onerror: null,
    };

    Object.defineProperty(videoEl, 'src', {
      configurable: true,
      set(val: string) {
        this._src = val;
        // Simulate the browser dispatching metadata/error events asynchronously
        Promise.resolve().then(() => {
          if (videoShouldError) {
            this.onerror?.();
          } else {
            this.onloadedmetadata?.();
          }
        });
      },
      get() {
        return this._src;
      },
    });

    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation(
      (tag: string, ...args: unknown[]) => {
        if (tag === 'video') return videoEl as unknown as HTMLVideoElement;
        return originalCreateElement(tag, ...(args as [ElementCreationOptions?]));
      },
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── 1. Single segment — happy path ──────────────────────────────────────────

  describe('combineSegments — single segment', () => {
    it('returns the original blob, blobUrl and duration in milliseconds', async () => {
      mockMutateAsync.mockResolvedValueOnce([
        ['url', 'https://blossom.divine.video/abc.webm'],
      ]);
      const { result } = renderHook(() => useVideoUpload(), { wrapper: createWrapper() });

      let uploadResult: Awaited<ReturnType<typeof result.current.uploadVideo>>;
      await act(async () => {
        uploadResult = await result.current.uploadVideo({ segments: [makeSegment()] });
      });

      expect(uploadResult!.duration).toBe(3500); // 3.5 s × 1000
    });

    it('does not show a toast for a single segment', async () => {
      mockMutateAsync.mockResolvedValueOnce([
        ['url', 'https://blossom.divine.video/abc.webm'],
      ]);
      const { result } = renderHook(() => useVideoUpload(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.uploadVideo({ segments: [makeSegment()] });
      });

      expect(mockToast).not.toHaveBeenCalled();
    });
  });

  // ── 2. Multiple segments — MVP first-clip-only behaviour ────────────────────

  describe('combineSegments — multiple segments (MVP)', () => {
    it('shows a "Multi-clip recording." toast with the expected description', async () => {
      mockMutateAsync.mockResolvedValueOnce([
        ['url', 'https://blossom.divine.video/abc.webm'],
      ]);
      const { result } = renderHook(() => useVideoUpload(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.uploadVideo({
          segments: [makeSegment('blob:seg-1'), makeSegment('blob:seg-2')],
        });
      });

      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Multi-clip recording.',
          description: 'Using the first clip for now — full merging is coming soon.',
          variant: 'default',
        }),
      );
    });

    it('uploads a File built from the first segment blob only', async () => {
      mockMutateAsync.mockResolvedValueOnce([
        ['url', 'https://blossom.divine.video/abc.webm'],
      ]);
      const { result } = renderHook(() => useVideoUpload(), { wrapper: createWrapper() });

      const firstBlob = new Blob(['first'], { type: 'video/webm' });
      await act(async () => {
        await result.current.uploadVideo({
          segments: [
            { blob: firstBlob, blobUrl: 'blob:seg-1' },
            { blob: new Blob(['second'], { type: 'video/webm' }), blobUrl: 'blob:seg-2' },
          ],
        });
      });

      const uploadedFile: File = mockMutateAsync.mock.calls[0][0];
      expect(uploadedFile).toBeInstanceOf(File);
      expect(uploadedFile.size).toBe(firstBlob.size);
    });
  });

  // ── 3. Empty segments array ──────────────────────────────────────────────────

  describe('combineSegments — empty array', () => {
    it('throws "No segments to combine"', async () => {
      const { result } = renderHook(() => useVideoUpload(), { wrapper: createWrapper() });

      await expect(
        act(async () => {
          await result.current.uploadVideo({ segments: [] });
        }),
      ).rejects.toThrow('No segments to combine');
    });
  });

  // ── 4. getVideoDuration error path ───────────────────────────────────────────

  describe('getVideoDuration — error', () => {
    it('propagates "Failed to load video metadata" for a single segment', async () => {
      videoShouldError = true;
      const { result } = renderHook(() => useVideoUpload(), { wrapper: createWrapper() });

      await expect(
        act(async () => {
          await result.current.uploadVideo({ segments: [makeSegment()] });
        }),
      ).rejects.toThrow('Failed to load video metadata');
    });

    it('calls revokeObjectURL on the video src element before rejecting', async () => {
      videoShouldError = true;
      const { result } = renderHook(() => useVideoUpload(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.uploadVideo({ segments: [makeSegment()] }).catch(() => {});
      });

      expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    });
  });

  // ── 5. Successful upload ─────────────────────────────────────────────────────

  describe('uploadVideo — success', () => {
    const MOCK_TAGS = [
      ['url', 'https://blossom.divine.video/abc.webm'],
      ['m', 'video/webm'],
    ];

    it('returns url, tags and duration', async () => {
      mockMutateAsync.mockResolvedValueOnce(MOCK_TAGS);
      const { result } = renderHook(() => useVideoUpload(), { wrapper: createWrapper() });

      let uploadResult: Awaited<ReturnType<typeof result.current.uploadVideo>>;
      await act(async () => {
        uploadResult = await result.current.uploadVideo({ segments: [makeSegment()] });
      });

      expect(uploadResult!.url).toBe('https://blossom.divine.video/abc.webm');
      expect(uploadResult!.tags).toEqual(MOCK_TAGS);
      expect(uploadResult!.duration).toBe(3500);
    });

    it('passes a correctly typed File to uploadFile', async () => {
      mockMutateAsync.mockResolvedValueOnce(MOCK_TAGS);
      const { result } = renderHook(() => useVideoUpload(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.uploadVideo({
          segments: [makeSegment()],
          filename: 'my-vine.webm',
        });
      });

      const uploadedFile: File = mockMutateAsync.mock.calls[0][0];
      expect(uploadedFile).toBeInstanceOf(File);
      expect(uploadedFile.name).toBe('my-vine.webm');
      expect(uploadedFile.type).toBe('video/webm');
    });

    it('uses a default vine-<timestamp>.webm filename when none is provided', async () => {
      mockMutateAsync.mockResolvedValueOnce(MOCK_TAGS);
      const { result } = renderHook(() => useVideoUpload(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.uploadVideo({ segments: [makeSegment()] });
      });

      const uploadedFile: File = mockMutateAsync.mock.calls[0][0];
      expect(uploadedFile.name).toMatch(/^vine-\d+\.webm$/);
    });

    it('sets uploadProgress to 1 on completion', async () => {
      mockMutateAsync.mockResolvedValueOnce(MOCK_TAGS);
      const { result } = renderHook(() => useVideoUpload(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.uploadVideo({ segments: [makeSegment()] });
      });

      expect(result.current.uploadProgress).toBe(1);
    });

    it('revokes segment blobUrls after a successful upload', async () => {
      mockMutateAsync.mockResolvedValueOnce(MOCK_TAGS);
      const { result } = renderHook(() => useVideoUpload(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.uploadVideo({ segments: [makeSegment('blob:to-revoke')] });
      });

      expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:to-revoke');
    });
  });

  // ── 6. No URL tag in upload response ────────────────────────────────────────

  describe('uploadVideo — no URL tag in response', () => {
    it('throws "Upload succeeded but no URL returned"', async () => {
      mockMutateAsync.mockResolvedValueOnce([['m', 'video/webm']]); // url tag missing
      const { result } = renderHook(() => useVideoUpload(), { wrapper: createWrapper() });

      await expect(
        act(async () => {
          await result.current.uploadVideo({ segments: [makeSegment()] });
        }),
      ).rejects.toThrow('Upload succeeded but no URL returned');
    });
  });

  // ── 7. uploadFile rejects ────────────────────────────────────────────────────

  describe('uploadVideo — uploadFile rejects', () => {
    it('shows a destructive "Upload snagged." toast', async () => {
      mockMutateAsync.mockRejectedValueOnce(new Error('Network error'));
      const { result } = renderHook(() => useVideoUpload(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.uploadVideo({ segments: [makeSegment()] }).catch(() => {});
      });

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'Upload snagged.',
            variant: 'destructive',
          }),
        );
      });
    });

    it('includes the original error message in the toast description', async () => {
      mockMutateAsync.mockRejectedValueOnce(new Error('Server 503'));
      const { result } = renderHook(() => useVideoUpload(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.uploadVideo({ segments: [makeSegment()] }).catch(() => {});
      });

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({ description: 'Server 503' }),
        );
      });
    });

    it('resets uploadProgress to 0', async () => {
      mockMutateAsync.mockRejectedValueOnce(new Error('Network error'));
      const { result } = renderHook(() => useVideoUpload(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.uploadVideo({ segments: [makeSegment()] }).catch(() => {});
      });

      expect(result.current.uploadProgress).toBe(0);
    });

    it('re-throws the original error', async () => {
      mockMutateAsync.mockRejectedValueOnce(new Error('Network error'));
      const { result } = renderHook(() => useVideoUpload(), { wrapper: createWrapper() });

      await expect(
        act(async () => {
          await result.current.uploadVideo({ segments: [makeSegment()] });
        }),
      ).rejects.toThrow('Network error');
    });
  });

  // ── 8. isUploading flag ──────────────────────────────────────────────────────

  describe('isUploading', () => {
    it('is false initially', () => {
      const { result } = renderHook(() => useVideoUpload(), { wrapper: createWrapper() });
      expect(result.current.isUploading).toBe(false);
    });

    it('is false after a successful upload', async () => {
      mockMutateAsync.mockResolvedValueOnce([
        ['url', 'https://blossom.divine.video/abc.webm'],
      ]);
      const { result } = renderHook(() => useVideoUpload(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.uploadVideo({ segments: [makeSegment()] });
      });

      expect(result.current.isUploading).toBe(false);
    });

    it('is false after a failed upload', async () => {
      mockMutateAsync.mockRejectedValueOnce(new Error('failed'));
      const { result } = renderHook(() => useVideoUpload(), { wrapper: createWrapper() });

      await act(async () => {
        await result.current.uploadVideo({ segments: [makeSegment()] }).catch(() => {});
      });

      await waitFor(() => expect(result.current.isUploading).toBe(false));
    });
  });

  // ── 9. uploadProgress initial state ─────────────────────────────────────────

  it('starts with uploadProgress = 0', () => {
    const { result } = renderHook(() => useVideoUpload(), { wrapper: createWrapper() });
    expect(result.current.uploadProgress).toBe(0);
  });
});
