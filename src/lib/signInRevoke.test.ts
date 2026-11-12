// ABOUTME: Tests the verifier revoke client: platform mapping, the request it sends,
// ABOUTME: and that every failure resolves instead of throwing.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NostrEvent } from '@nostrify/nostrify';

vi.mock('@/config/api', () => ({
  API_CONFIG: {
    verificationService: {
      baseUrl: 'https://verifier.example',
      timeout: 10000,
      endpoints: { verify: '/api/verify', revoke: '/auth/oauth/revoke' },
    },
  },
}));

import { revokeSignInLink, signInPlatform, type SignInRevokeRequest } from './signInRevoke';

const PUBKEY = 'a'.repeat(64);
const LIST: NostrEvent = {
  id: 'b'.repeat(64),
  pubkey: PUBKEY,
  sig: 'c'.repeat(128),
  created_at: 1700000000,
  kind: 10011,
  tags: [],
  content: '',
};
const REQUEST: SignInRevokeRequest = { platform: 'bluesky', identity: 'Alice.bsky.social', pubkey: PUBKEY, list: LIST };

function mockAnswer(answer: { ok: boolean; status: number; json: () => Promise<unknown> }) {
  global.fetch = vi.fn().mockResolvedValue(answer);
}

describe('signInPlatform', () => {
  it.each([
    ['twitter', 'twitter'], ['x', 'twitter'], [' X ', 'twitter'],
    ['bluesky', 'bluesky'], ['youtube', 'youtube'], ['tiktok', 'tiktok'],
    ['github', null], ['discord', null], ['mastodon', null], ['', null],
  ])('signInPlatform(%j) is %j', (input, expected) => {
    expect(signInPlatform(input)).toBe(expected);
  });
});

describe('revokeSignInLink', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('posts the platform, identity, pubkey and published list to the revoke endpoint', async () => {
    mockAnswer({ ok: true, status: 200, json: async () => ({ revoked: true }) });
    const result = await revokeSignInLink(REQUEST);
    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe('https://verifier.example/auth/oauth/revoke');
    expect(init?.method).toBe('POST');
    expect(init?.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(JSON.parse(init?.body as string)).toEqual({ platform: 'bluesky', identity: 'Alice.bsky.social', pubkey: PUBKEY, list: LIST });
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    expect(result).toEqual({ revoked: true });
  });

  it("keeps the verifier's code and message on a refusal", async () => {
    mockAnswer({
      ok: false,
      status: 409,
      json: async () => ({ error: 'This list still holds the linked account.', code: 'unlink_claim_listed' }),
    });
    expect(await revokeSignInLink(REQUEST)).toEqual({
      revoked: false,
      code: 'unlink_claim_listed',
      error: 'This list still holds the linked account.',
    });
  });

  it('resolves without a code when the error body is not JSON', async () => {
    mockAnswer({
      ok: false,
      status: 502,
      json: async () => { throw new SyntaxError('Unexpected token <'); },
    });
    expect(await revokeSignInLink(REQUEST)).toEqual({ revoked: false });
  });

  it('resolves when the verifier cannot be reached', async () => {
    global.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    expect(await revokeSignInLink(REQUEST)).toEqual({ revoked: false });
  });
});
