// ABOUTME: Tests for videoParser HLS fallback URL generation
// ABOUTME: Verifies that hlsUrl is preserved and auto-generated for media.divine.video videos

import { describe, it, expect } from 'vitest';
import { extractVideoMetadata } from './videoParser';
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
