// ABOUTME: Tests for bunker URL parsing and window.nostr injection
// ABOUTME: Verifies bunker URL parsing and window.nostr management

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  parseBunkerUrl,
  injectWindowNostr,
  isAppInjectedWindowNostr,
  removeWindowNostr,
} from './bunkerToWindowNostr';
import type { NostrSigner } from '@nostrify/nostrify';

describe('bunkerToWindowNostr', () => {
  describe('parseBunkerUrl', () => {
    it('should parse valid bunker URL', () => {
      const pubkey = 'a'.repeat(64);
      const bunkerUrl = `bunker://${pubkey}?relay=wss://relay.damus.io&secret=xyz123`;
      const result = parseBunkerUrl(bunkerUrl);

      expect(result).toBeTruthy();
      expect(result?.remotePubkey).toBe(pubkey);
      expect(result?.relayUrl).toBe('wss://relay.damus.io');
      expect(result?.secret).toBe('xyz123');
    });

    it('should handle URL-encoded relay URLs', () => {
      const pubkey = 'a'.repeat(64);
      const encodedRelay = encodeURIComponent('wss://relay.example.com');
      const bunkerUrl = `bunker://${pubkey}?relay=${encodedRelay}&secret=xyz123`;
      const result = parseBunkerUrl(bunkerUrl);

      expect(result?.relayUrl).toBe('wss://relay.example.com');
    });

    it('should return null for invalid format', () => {
      const invalidUrls = [
        'invalid-url',
        'bunker://invalid',
        'bunker://abc?relay=wss://relay.io', // Missing secret
        'bunker://abc?secret=xyz', // Missing relay
        'bunker://tooshort?relay=wss://relay.io&secret=xyz', // Pubkey too short
      ];

      invalidUrls.forEach((url) => {
        expect(parseBunkerUrl(url)).toBeNull();
      });
    });

    it('should return null for empty string', () => {
      expect(parseBunkerUrl('')).toBeNull();
    });
  });

  describe('injectWindowNostr', () => {
    let mockSigner: NostrSigner;

    beforeEach(() => {
      // Clean up window.nostr before each test
      removeWindowNostr();

      // Create mock signer
      mockSigner = {
        getPublicKey: vi.fn().mockResolvedValue('a'.repeat(64)),
        signEvent: vi.fn().mockResolvedValue({
          id: 'event-id',
          pubkey: 'a'.repeat(64),
          sig: 'signature',
          kind: 1,
          content: 'test',
          tags: [],
          created_at: 1234567890,
        }),
      };
    });

    afterEach(() => {
      // Clean up after each test, including a fake browser extension
      removeWindowNostr();
      delete window.nostr;
    });

    it('should inject signer into window.nostr', () => {
      injectWindowNostr(mockSigner);

      expect(window.nostr).toBeDefined();
      expect(window.nostr).toBe(mockSigner);
    });

    it('should dispatch nostr:ready event', () => {
      const eventSpy = vi.fn();
      window.addEventListener('nostr:ready', eventSpy);

      injectWindowNostr(mockSigner);

      expect(eventSpy).toHaveBeenCalled();

      window.removeEventListener('nostr:ready', eventSpy);
    });

    it("replaces the app's own earlier signer", () => {
      const firstSigner = mockSigner;
      const secondSigner = {
        ...mockSigner,
        getPublicKey: vi.fn().mockResolvedValue('b'.repeat(64)),
      };

      injectWindowNostr(firstSigner);
      expect(window.nostr).toBe(firstSigner);

      injectWindowNostr(secondSigner);
      expect(window.nostr).toBe(secondSigner);
    });

    // A hosted account's signer is only a fallback for code that reads
    // window.nostr. Replacing a browser extension there would make every
    // extension login sign with the hosted account instead.
    it('leaves a browser extension on window.nostr in place', () => {
      const extension: NostrSigner = { getPublicKey: vi.fn(), signEvent: vi.fn() };
      window.nostr = extension;

      const injected = injectWindowNostr(mockSigner);

      expect(injected).toBe(false);
      expect(window.nostr).toBe(extension);
      expect(isAppInjectedWindowNostr()).toBe(false);
    });
  });

  describe('removeWindowNostr', () => {
    let mockSigner: NostrSigner;

    afterEach(() => {
      removeWindowNostr();
      delete window.nostr;
    });

    beforeEach(() => {
      mockSigner = {
        getPublicKey: vi.fn().mockResolvedValue('a'.repeat(64)),
        signEvent: vi.fn().mockResolvedValue({
          id: 'event-id',
          pubkey: 'a'.repeat(64),
          sig: 'signature',
          kind: 1,
          content: 'test',
          tags: [],
          created_at: 1234567890,
        }),
      };
    });

    it('should remove window.nostr', () => {
      injectWindowNostr(mockSigner);
      expect(window.nostr).toBeDefined();

      removeWindowNostr();
      expect(window.nostr).toBeUndefined();
    });

    it('should not throw if window.nostr does not exist', () => {
      removeWindowNostr();
      expect(window.nostr).toBeUndefined();

      // Should not throw
      expect(() => removeWindowNostr()).not.toThrow();
    });

    it('leaves a browser extension that loaded after the app signer in place', () => {
      injectWindowNostr(mockSigner);
      const extension: NostrSigner = { getPublicKey: vi.fn(), signEvent: vi.fn() };
      window.nostr = extension;

      removeWindowNostr();

      expect(window.nostr).toBe(extension);
    });

    it('should handle multiple remove calls', () => {
      injectWindowNostr(mockSigner);

      removeWindowNostr();
      expect(window.nostr).toBeUndefined();

      removeWindowNostr();
      expect(window.nostr).toBeUndefined();
    });
  });
});
