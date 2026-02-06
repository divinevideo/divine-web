// ABOUTME: Tests for videoParser HLS fallback URL generation
// ABOUTME: Verifies that hlsUrl is preserved and auto-generated for media.divine.video videos

import { describe, it, expect } from 'vitest';
import { extractVideoMetadata, parseVideoEvents } from './videoParser';
import type { NostrEvent } from '@nostrify/nostrify';

function makeEvent(tags: string[][]): NostrEvent {
  return {
    id: 'test-id',
    pubkey: 'test-pubkey',
    created_at: 1700000000,
    kind: 34236,
    tags,
    content: '',
    sig: 'test-sig',
  };
}

describe('extractVideoMetadata', () => {
  describe('HLS fallback URL handling', () => {
    it('should preserve hlsUrl when present in imeta alongside MP4', () => {
      const event = makeEvent([
        ['imeta', 'url https://media.divine.video/abc123/file.mp4', 'm video/mp4', 'hls https://media.divine.video/abc123/hls/master.m3u8'],
      ]);

      const metadata = extractVideoMetadata(event);
      expect(metadata).not.toBeNull();
      expect(metadata!.url).toBe('https://media.divine.video/abc123/file.mp4');
      expect(metadata!.hlsUrl).toBe('https://media.divine.video/abc123/hls/master.m3u8');
    });

    it('should generate hlsUrl from hash for media.divine.video MP4 without explicit HLS', () => {
      const event = makeEvent([
        ['imeta', 'url https://media.divine.video/abc123/file.mp4', 'm video/mp4', 'x deadbeef1234567890abcdef'],
      ]);

      const metadata = extractVideoMetadata(event);
      expect(metadata).not.toBeNull();
      expect(metadata!.url).toBe('https://media.divine.video/abc123/file.mp4');
      expect(metadata!.hlsUrl).toBe('https://media.divine.video/deadbeef1234567890abcdef/hls/master.m3u8');
    });

    it('should not generate hlsUrl for non-divine-video hosts', () => {
      const event = makeEvent([
        ['imeta', 'url https://cdn.example.com/video.mp4', 'm video/mp4', 'x deadbeef1234'],
      ]);

      const metadata = extractVideoMetadata(event);
      expect(metadata).not.toBeNull();
      expect(metadata!.url).toBe('https://cdn.example.com/video.mp4');
      expect(metadata!.hlsUrl).toBeUndefined();
    });

    it('should not generate hlsUrl when no hash is available', () => {
      const event = makeEvent([
        ['imeta', 'url https://media.divine.video/abc123/file.mp4', 'm video/mp4'],
      ]);

      const metadata = extractVideoMetadata(event);
      expect(metadata).not.toBeNull();
      expect(metadata!.url).toBe('https://media.divine.video/abc123/file.mp4');
      expect(metadata!.hlsUrl).toBeUndefined();
    });

    it('should not overwrite explicit hlsUrl with generated one', () => {
      const event = makeEvent([
        ['imeta', 'url https://media.divine.video/abc123/file.mp4', 'm video/mp4', 'hls https://custom.cdn.com/stream.m3u8', 'x deadbeef1234'],
      ]);

      const metadata = extractVideoMetadata(event);
      expect(metadata).not.toBeNull();
      expect(metadata!.hlsUrl).toBe('https://custom.cdn.com/stream.m3u8');
    });
  });
});

describe('parseVideoEvents', () => {
  describe('duration filtering', () => {
    function makeVideoEvent(tags: string[][]): ReturnType<typeof makeEvent> {
      return {
        id: 'test-id',
        pubkey: 'test-pubkey',
        created_at: 1700000000,
        kind: 34236,
        tags: [['d', 'test-vine-id'], ...tags],
        content: '',
        sig: 'test-sig',
      };
    }

    it('should include videos with duration under 7 seconds', () => {
      const event = makeVideoEvent([
        ['imeta', 'url https://example.com/video.mp4', 'duration 6'],
      ]);

      const parsed = parseVideoEvents([event]);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].duration).toBe(6);
    });

    it('should exclude videos with duration of exactly 7 seconds', () => {
      const event = makeVideoEvent([
        ['imeta', 'url https://example.com/video.mp4', 'duration 7'],
      ]);

      const parsed = parseVideoEvents([event]);
      expect(parsed).toHaveLength(0);
    });

    it('should exclude videos with duration over 7 seconds', () => {
      const event = makeVideoEvent([
        ['imeta', 'url https://example.com/video.mp4', 'duration 30'],
      ]);

      const parsed = parseVideoEvents([event]);
      expect(parsed).toHaveLength(0);
    });

    it('should include videos without declared duration', () => {
      const event = makeVideoEvent([
        ['imeta', 'url https://example.com/video.mp4'],
      ]);

      const parsed = parseVideoEvents([event]);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].duration).toBeUndefined();
    });

    it('should filter mixed batch correctly', () => {
      const shortVideo = makeVideoEvent([
        ['d', 'short-1'],
        ['imeta', 'url https://example.com/short.mp4', 'duration 5'],
      ]);
      shortVideo.id = 'short-id';

      const longVideo = makeVideoEvent([
        ['d', 'long-1'],
        ['imeta', 'url https://example.com/long.mp4', 'duration 60'],
      ]);
      longVideo.id = 'long-id';

      const noDuration = makeVideoEvent([
        ['d', 'no-dur'],
        ['imeta', 'url https://example.com/unknown.mp4'],
      ]);
      noDuration.id = 'no-dur-id';

      const parsed = parseVideoEvents([shortVideo, longVideo, noDuration]);
      expect(parsed).toHaveLength(2);
      expect(parsed.map(v => v.id)).toEqual(['short-id', 'no-dur-id']);
    });
  });
});
