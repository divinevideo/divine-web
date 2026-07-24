import { describe, expect, it, vi, beforeEach } from 'vitest';
import { enrichAgeRestrictedVideos } from './ageRestrictedVideos';
import { mapVideoEvent } from './fetchListVideos';
import type { NostrEvent } from '@nostrify/nostrify';
import type { ParsedVideoData } from '@/types/video';

const mockFetchVideoModerationStatus = vi.fn();

vi.mock('@/lib/videoVerification', () => ({
  fetchVideoModerationStatus: (...args: unknown[]) => mockFetchVideoModerationStatus(...args),
}));

function makeVideo(overrides: Partial<ParsedVideoData> = {}): ParsedVideoData {
  return {
    id: 'video-1',
    pubkey: 'f'.repeat(64),
    kind: 34236,
    createdAt: 1700000000,
    content: 'Test video',
    videoUrl: 'https://media.divine.video/0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    thumbnailUrl: 'https://media.divine.video/0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef.jpg',
    sha256: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    hashtags: [],
    vineId: 'vine-id-1',
    reposts: [],
    isVineMigrated: false,
    ...overrides,
  };
}

describe('enrichAgeRestrictedVideos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps explicit age-restricted flags without extra moderation lookups', async () => {
    const result = await enrichAgeRestrictedVideos([
      makeVideo({
        ageRestricted: true,
      }),
    ]);

    expect(result[0].ageRestricted).toBe(true);
    expect(mockFetchVideoModerationStatus).not.toHaveBeenCalled();
  });

  it('marks videos as age-restricted when the moderation proxy says so', async () => {
    mockFetchVideoModerationStatus.mockResolvedValue({
      ageRestricted: true,
    });

    const result = await enrichAgeRestrictedVideos([
      makeVideo({
        ageRestricted: false,
      }),
    ]);

    expect(result[0].ageRestricted).toBe(true);
    expect(mockFetchVideoModerationStatus).toHaveBeenCalledWith(
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      undefined,
    );
  });

  it('can enrich videos produced by the shared Nostr event mapper', async () => {
    mockFetchVideoModerationStatus.mockResolvedValue({
      ageRestricted: true,
    });
    const event: NostrEvent = {
      id: 'a'.repeat(64),
      pubkey: 'b'.repeat(64),
      kind: 34236,
      created_at: 1700000000,
      tags: [
        ['d', 'mapped-video'],
        ['imeta', 'url https://media.divine.video/mapped.mp4', 'm video/mp4', 'x abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789'],
      ],
      content: '',
      sig: 'c'.repeat(128),
    };

    const mapped = mapVideoEvent(event);
    const result = await enrichAgeRestrictedVideos(mapped ? [mapped] : []);

    expect(result[0].ageRestricted).toBe(true);
    expect(mockFetchVideoModerationStatus).toHaveBeenCalledWith(
      'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
      undefined,
    );
  });
});
