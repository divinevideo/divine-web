// ABOUTME: Tests for NIP-39 external identity parsing and verification
// ABOUTME: Tests parseIdentityTag, verifyIdentityClaim, and useExternalIdentities hook

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// Mock nostrify
const mockNostrQuery = vi.fn();
vi.mock('@nostrify/react', () => ({
  useNostr: () => ({
    nostr: {
      query: mockNostrQuery,
    },
  }),
}));

// Mock verification cache
const mockGetCached = vi.fn().mockReturnValue(null);
const mockSetCached = vi.fn();
vi.mock('@/lib/verificationCache', () => ({
  getCachedVerification: (...args: unknown[]) => mockGetCached(...args),
  setCachedVerification: (...args: unknown[]) => mockSetCached(...args),
}));

// Mock API config
vi.mock('@/config/api', () => ({
  API_CONFIG: {
    verificationService: {
      baseUrl: '',
      timeout: 10000,
      endpoints: { verify: '/api/verify' },
    },
  },
  getFeatureFlag: () => false,
}));

import {
  parseIdentityTag,
  verifyIdentityClaim,
  useExternalIdentities,
  SUPPORTED_PLATFORMS,
  type ExternalIdentity,
} from './useExternalIdentities';

const TEST_PUBKEY = 'a'.repeat(64);

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

// -- parseIdentityTag --

describe('parseIdentityTag', () => {
  it('parses a GitHub identity tag', () => {
    const tag = ['i', 'github:semisol', '9721ce4ee4fceb3c7b532b0c'];
    const result = parseIdentityTag(tag);

    expect(result).toEqual({
      platform: 'github',
      identity: 'semisol',
      proof: '9721ce4ee4fceb3c7b532b0c',
      profileUrl: 'https://github.com/semisol',
      proofUrl: 'https://gist.github.com/semisol/9721ce4ee4fceb3c7b532b0c',
    });
  });

  it('parses a Twitter identity tag', () => {
    const tag = ['i', 'twitter:semisol_public', '1619277047516401664'];
    const result = parseIdentityTag(tag);

    expect(result).toEqual({
      platform: 'twitter',
      identity: 'semisol_public',
      proof: '1619277047516401664',
      profileUrl: 'https://twitter.com/semisol_public',
      proofUrl: 'https://twitter.com/semisol_public/status/1619277047516401664',
    });
  });

  it('parses a Mastodon identity tag per NIP-39 format', () => {
    const tag = ['i', 'mastodon:bitcoinhackers.org/@semisol', '109775066355589413'];
    const result = parseIdentityTag(tag);

    expect(result).toEqual({
      platform: 'mastodon',
      identity: 'bitcoinhackers.org/@semisol',
      proof: '109775066355589413',
      profileUrl: 'https://bitcoinhackers.org/@semisol',
      proofUrl: 'https://bitcoinhackers.org/@semisol/109775066355589413',
    });
  });

  it('parses a Telegram identity tag', () => {
    const tag = ['i', 'telegram:1087295469', 'somechannel/123'];
    const result = parseIdentityTag(tag);

    expect(result).toEqual({
      platform: 'telegram',
      identity: '1087295469',
      proof: 'somechannel/123',
      profileUrl: 'https://t.me/1087295469',
      proofUrl: 'https://t.me/somechannel/123',
    });
  });

  it('returns null for non-i tags', () => {
    expect(parseIdentityTag(['p', 'somepubkey'])).toBeNull();
    expect(parseIdentityTag(['e', 'someeventid'])).toBeNull();
  });

  it('returns null for i tags without colon separator', () => {
    expect(parseIdentityTag(['i', 'nocolon'])).toBeNull();
  });

  it('returns null for empty/missing tag values', () => {
    expect(parseIdentityTag(['i'])).toBeNull();
    expect(parseIdentityTag(['i', ''])).toBeNull();
  });

  it('parses a Bluesky identity tag', () => {
    const tag = ['i', 'bluesky:alice.bsky.social', '3jxh5kdbmop2o'];
    const result = parseIdentityTag(tag);

    expect(result).toEqual({
      platform: 'bluesky',
      identity: 'alice.bsky.social',
      proof: '3jxh5kdbmop2o',
      profileUrl: 'https://bsky.app/profile/alice.bsky.social',
      proofUrl: 'https://bsky.app/profile/alice.bsky.social/post/3jxh5kdbmop2o',
    });
  });

  it('parses a Discord identity tag', () => {
    const tag = ['i', 'discord:alice', 'AbCdEf'];
    const result = parseIdentityTag(tag);

    expect(result).toEqual({
      platform: 'discord',
      identity: 'alice',
      proof: 'AbCdEf',
      profileUrl: 'https://discord.com/users/alice',
      proofUrl: 'https://discord.gg/AbCdEf',
    });
  });

  it('handles unknown platforms with empty URLs', () => {
    const tag = ['i', 'linkedin:someone', 'someproof'];
    const result = parseIdentityTag(tag);

    expect(result).toEqual({
      platform: 'linkedin',
      identity: 'someone',
      proof: 'someproof',
      profileUrl: '',
      proofUrl: '',
    });
  });

  it('handles identity tag without proof', () => {
    const tag = ['i', 'github:semisol'];
    const result = parseIdentityTag(tag);

    expect(result).toEqual({
      platform: 'github',
      identity: 'semisol',
      proof: '',
      profileUrl: 'https://github.com/semisol',
      proofUrl: '',
    });
  });
});

// -- SUPPORTED_PLATFORMS config --

describe('SUPPORTED_PLATFORMS', () => {
  it('has correct canVerifyInBrowser flags', () => {
    expect(SUPPORTED_PLATFORMS.github.canVerifyInBrowser).toBe(true);
    expect(SUPPORTED_PLATFORMS.twitter.canVerifyInBrowser).toBe(false);
    expect(SUPPORTED_PLATFORMS.mastodon.canVerifyInBrowser).toBe(false);
    expect(SUPPORTED_PLATFORMS.telegram.canVerifyInBrowser).toBe(false);
    expect(SUPPORTED_PLATFORMS.bluesky.canVerifyInBrowser).toBe(false);
    expect(SUPPORTED_PLATFORMS.discord.canVerifyInBrowser).toBe(false);
  });

  it('generates correct Mastodon URLs for NIP-39 format', () => {
    const config = SUPPORTED_PLATFORMS.mastodon;
    expect(config.profileUrl('bitcoinhackers.org/@semisol'))
      .toBe('https://bitcoinhackers.org/@semisol');
    expect(config.proofUrl('bitcoinhackers.org/@semisol', '109775066355589413'))
      .toBe('https://bitcoinhackers.org/@semisol/109775066355589413');
  });

  it('generates correct Telegram proof URLs', () => {
    const config = SUPPORTED_PLATFORMS.telegram;
    expect(config.proofUrl('1087295469', 'somechannel/123'))
      .toBe('https://t.me/somechannel/123');
  });

  it('generates correct GitHub create proof URL', () => {
    const config = SUPPORTED_PLATFORMS.github;
    expect(config.createProofUrl?.('semisol', 'npub1test'))
      .toBe('https://gist.github.com/');
  });

  it('generates correct Twitter intent URL with npub', () => {
    const config = SUPPORTED_PLATFORMS.twitter;
    const npub = 'npub1testkey';
    const url = config.createProofUrl?.('alice', npub) ?? '';
    expect(url).toContain('https://twitter.com/intent/tweet');
    expect(url).toContain(encodeURIComponent(npub));
  });

  it('has no createProofUrl for mastodon (instance-specific)', () => {
    expect(SUPPORTED_PLATFORMS.mastodon.createProofUrl).toBeUndefined();
  });

  it('has no createProofUrl for telegram', () => {
    expect(SUPPORTED_PLATFORMS.telegram.createProofUrl).toBeUndefined();
  });

  it('generates correct Bluesky URLs', () => {
    const config = SUPPORTED_PLATFORMS.bluesky;
    expect(config.profileUrl('alice.bsky.social'))
      .toBe('https://bsky.app/profile/alice.bsky.social');
    expect(config.proofUrl('alice.bsky.social', '3jxh5kdbmop2o'))
      .toBe('https://bsky.app/profile/alice.bsky.social/post/3jxh5kdbmop2o');
  });

  it('Bluesky verification text includes npub', () => {
    const texts = SUPPORTED_PLATFORMS.bluesky.verificationText('npub1abc');
    expect(texts.some((t) => t.includes('npub1abc'))).toBe(true);
  });

  it('GitHub verification text includes npub', () => {
    const texts = SUPPORTED_PLATFORMS.github.verificationText('npub1abc');
    expect(texts.some((t) => t.includes('npub1abc'))).toBe(true);
    // Backward compat: still accepts the standard NIP-39 text
    expect(texts).toContainEqual('Verifying that I control the following Nostr public key: npub1abc');
  });

  it('Twitter verification text includes npub or @divinevideoapp', () => {
    const texts = SUPPORTED_PLATFORMS.twitter.verificationText('npub1abc');
    expect(texts.some((t) => t.includes('npub1abc') || t.includes('@divinevideoapp'))).toBe(true);
  });

  it('Mastodon verification text includes npub', () => {
    const texts = SUPPORTED_PLATFORMS.mastodon.verificationText('npub1abc');
    expect(texts.some((t) => t.includes('npub1abc'))).toBe(true);
  });

  it('Telegram verification text includes npub', () => {
    const texts = SUPPORTED_PLATFORMS.telegram.verificationText('npub1abc');
    expect(texts.some((t) => t.includes('npub1abc'))).toBe(true);
  });

  it('generates correct Discord URLs', () => {
    const config = SUPPORTED_PLATFORMS.discord;
    expect(config.profileUrl('alice'))
      .toBe('https://discord.com/users/alice');
    expect(config.proofUrl('alice', 'AbCdEf'))
      .toBe('https://discord.gg/AbCdEf');
  });

  it('Discord verification text includes npub', () => {
    const texts = SUPPORTED_PLATFORMS.discord.verificationText('npub1abc');
    expect(texts.some((t) => t.includes('npub1abc'))).toBe(true);
  });

  it('has no createProofUrl for discord', () => {
    expect(SUPPORTED_PLATFORMS.discord.createProofUrl).toBeUndefined();
  });

  it('generates correct Discord URLs', () => {
    const config = SUPPORTED_PLATFORMS.discord;
    expect(config.profileUrl('alice'))
      .toBe('https://discord.com/users/alice');
    expect(config.proofUrl('alice', 'AbCdEf'))
      .toBe('https://discord.gg/AbCdEf');
  });

  it('Discord verification text has quotes per NIP-39', () => {
    const text = SUPPORTED_PLATFORMS.discord.verificationText('npub1abc')[0];
    expect(text).toContain('"npub1abc"');
  });

  it('has no createProofUrl for discord', () => {
    expect(SUPPORTED_PLATFORMS.discord.createProofUrl).toBeUndefined();
  });
});

// -- verifyIdentityClaim --

describe('verifyIdentityClaim', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    global.fetch = vi.fn();
  });

  it('returns error for identity without proof URL', async () => {
    const identity: ExternalIdentity = {
      platform: 'github',
      identity: 'test',
      proof: '',
      profileUrl: 'https://github.com/test',
      proofUrl: '',
    };

    const result = await verifyIdentityClaim(identity, TEST_PUBKEY);
    expect(result.verified).toBe(false);
    expect(result.error).toBe('No proof URL');
  });

  it('returns manual for non-CORS platforms without fetching', async () => {
    const platforms = ['twitter', 'mastodon', 'telegram', 'bluesky', 'discord'] as const;

    for (const platform of platforms) {
      const identity: ExternalIdentity = {
        platform,
        identity: 'test',
        proof: '123',
        profileUrl: `https://example.com/${platform}`,
        proofUrl: 'https://example.com/proof',
      };

      const result = await verifyIdentityClaim(identity, TEST_PUBKEY);
      expect(result.verified).toBe(false);
      expect(result.error).toBe('manual');
    }

    // fetch should never have been called (no service, no browser verification)
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('fetches GitHub gist via API for verification', async () => {
    const identity: ExternalIdentity = {
      platform: 'github',
      identity: 'semisol',
      proof: 'abc123',
      profileUrl: 'https://github.com/semisol',
      proofUrl: 'https://gist.github.com/semisol/abc123',
    };

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve('some json with npub embedded'),
    });

    await verifyIdentityClaim(identity, TEST_PUBKEY);

    // Should use the GitHub API URL, not the gist URL
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.github.com/gists/abc123',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('returns error on HTTP failure', async () => {
    const identity: ExternalIdentity = {
      platform: 'github',
      identity: 'test',
      proof: 'abc',
      profileUrl: 'https://github.com/test',
      proofUrl: 'https://gist.github.com/test/abc',
    };

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 404,
    });

    const result = await verifyIdentityClaim(identity, TEST_PUBKEY);
    expect(result.verified).toBe(false);
    expect(result.error).toBe('HTTP 404');
  });

  it('returns error on network failure', async () => {
    const identity: ExternalIdentity = {
      platform: 'github',
      identity: 'test',
      proof: 'abc',
      profileUrl: 'https://github.com/test',
      proofUrl: 'https://gist.github.com/test/abc',
    };

    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('Network error'),
    );

    const result = await verifyIdentityClaim(identity, TEST_PUBKEY);
    expect(result.verified).toBe(false);
    expect(result.error).toBe('Network error');
  });

  it('returns error for unknown platform', async () => {
    const identity: ExternalIdentity = {
      platform: 'unknown',
      identity: 'test',
      proof: 'abc',
      profileUrl: '',
      proofUrl: 'https://example.com/proof',
    };

    const result = await verifyIdentityClaim(identity, TEST_PUBKEY);
    expect(result.verified).toBe(false);
    expect(result.error).toBe('Unknown platform');
  });

  it('returns cached result without fetching', async () => {
    mockGetCached.mockReturnValueOnce({ verified: true });

    const identity: ExternalIdentity = {
      platform: 'github',
      identity: 'alice',
      proof: 'abc123',
      profileUrl: 'https://github.com/alice',
      proofUrl: 'https://gist.github.com/alice/abc123',
    };

    const result = await verifyIdentityClaim(identity, TEST_PUBKEY);
    expect(result.verified).toBe(true);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('caches result after successful verification', async () => {
    const identity: ExternalIdentity = {
      platform: 'github',
      identity: 'alice',
      proof: 'abc123',
      profileUrl: 'https://github.com/alice',
      proofUrl: 'https://gist.github.com/alice/abc123',
    };

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(`Verifying that I control the following Nostr public key: npub1${TEST_PUBKEY}`),
    });

    await verifyIdentityClaim(identity, TEST_PUBKEY);

    expect(mockSetCached).toHaveBeenCalledWith(
      'github', 'alice', 'abc123',
      expect.objectContaining({ verified: expect.any(Boolean) }),
    );
  });
});

// -- useExternalIdentities hook --

describe('useExternalIdentities', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns empty array when no events found', async () => {
    mockNostrQuery.mockResolvedValueOnce([]);

    const { result } = renderHook(
      () => useExternalIdentities(TEST_PUBKEY),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });

  it('parses identity tags from kind 10011 event', async () => {
    mockNostrQuery.mockResolvedValueOnce([{
      kind: 10011,
      pubkey: TEST_PUBKEY,
      created_at: 1700000000,
      tags: [
        ['i', 'github:semisol', '9721ce4ee4fceb3c7b532b0c'],
        ['i', 'twitter:semisol_public', '1619277047516401664'],
      ],
      content: '',
      id: 'abc',
      sig: 'def',
    }]);

    const { result } = renderHook(
      () => useExternalIdentities(TEST_PUBKEY),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(2);
    expect(result.current.data![0].platform).toBe('github');
    expect(result.current.data![0].identity).toBe('semisol');
    expect(result.current.data![1].platform).toBe('twitter');
  });

  it('takes the most recent event when multiple returned', async () => {
    mockNostrQuery.mockResolvedValueOnce([
      {
        kind: 10011,
        pubkey: TEST_PUBKEY,
        created_at: 1700000000,
        tags: [['i', 'github:old', 'proof1']],
        content: '',
        id: 'old',
        sig: 'sig1',
      },
      {
        kind: 10011,
        pubkey: TEST_PUBKEY,
        created_at: 1700001000,
        tags: [['i', 'github:new', 'proof2']],
        content: '',
        id: 'new',
        sig: 'sig2',
      },
    ]);

    const { result } = renderHook(
      () => useExternalIdentities(TEST_PUBKEY),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data![0].identity).toBe('new');
  });

  it('skips non-i tags', async () => {
    mockNostrQuery.mockResolvedValueOnce([{
      kind: 10011,
      pubkey: TEST_PUBKEY,
      created_at: 1700000000,
      tags: [
        ['p', 'somepubkey'],
        ['i', 'github:real', 'proof'],
        ['e', 'someeventid'],
      ],
      content: '',
      id: 'abc',
      sig: 'def',
    }]);

    const { result } = renderHook(
      () => useExternalIdentities(TEST_PUBKEY),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data![0].platform).toBe('github');
  });

  it('is disabled when pubkey is undefined', () => {
    const { result } = renderHook(
      () => useExternalIdentities(undefined),
      { wrapper: createWrapper() },
    );

    expect(result.current.fetchStatus).toBe('idle');
  });

  it('queries kind 10011 with correct filters', async () => {
    mockNostrQuery.mockResolvedValueOnce([]);

    renderHook(
      () => useExternalIdentities(TEST_PUBKEY),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(mockNostrQuery).toHaveBeenCalled());
    expect(mockNostrQuery).toHaveBeenCalledWith(
      [{ kinds: [10011], authors: [TEST_PUBKEY], limit: 1 }],
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });
});
