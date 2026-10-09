// ABOUTME: Tests verifyIdentityClaim against the verification service: which
// ABOUTME: answers are saved in the browser, and that the service's code is kept.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetCached = vi.fn().mockReturnValue(null);
const mockSetCached = vi.fn();
vi.mock('@/lib/verificationCache', () => ({
  getCachedVerification: (...args: unknown[]) => mockGetCached(...args),
  setCachedVerification: (...args: unknown[]) => mockSetCached(...args),
}));

vi.mock('@/config/api', () => ({
  API_CONFIG: {
    verificationService: {
      baseUrl: 'https://verifier.example',
      timeout: 10000,
      endpoints: { verify: '/api/verify' },
    },
  },
  getFeatureFlag: () => true,
}));

import { verifyIdentityClaim, type ExternalIdentity } from './useExternalIdentities';

const TEST_PUBKEY = 'a'.repeat(64);

const twitterClaim: ExternalIdentity = {
  platform: 'twitter',
  identity: 'alice',
  proof: '1234567890',
  profileUrl: 'https://x.com/alice',
  proofUrl: 'https://x.com/alice/status/1234567890',
};

function serviceAnswers(body: Record<string, unknown>) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => body,
  });
}

describe('verifyIdentityClaim with the verification service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCached.mockReturnValue(null);
  });

  it('keeps the service\'s code with its answer', async () => {
    serviceAnswers({ verified: false, code: 'temporarily_unavailable', error: 'Twitter / X couldn\'t be checked right now. Try again in a few minutes.' });

    const result = await verifyIdentityClaim(twitterClaim, TEST_PUBKEY);

    expect(result).toEqual({
      verified: false,
      code: 'temporarily_unavailable',
      error: 'Twitter / X couldn\'t be checked right now. Try again in a few minutes.',
    });
  });

  it('does not save an answer the service couldn\'t check, so the next view asks again', async () => {
    serviceAnswers({ verified: false, code: 'temporarily_unavailable', error: 'Twitter / X couldn\'t be checked right now. Try again in a few minutes.' });

    await verifyIdentityClaim(twitterClaim, TEST_PUBKEY);

    expect(mockSetCached).not.toHaveBeenCalled();
  });

  it('still saves a real rejection', async () => {
    serviceAnswers({ verified: false, error: 'Tweet not found' });

    await verifyIdentityClaim(twitterClaim, TEST_PUBKEY);

    expect(mockSetCached).toHaveBeenCalledWith('twitter', 'alice', '1234567890', TEST_PUBKEY, { verified: false, error: 'Tweet not found' });
  });

  it('still saves a verified answer', async () => {
    serviceAnswers({ verified: true });

    await verifyIdentityClaim(twitterClaim, TEST_PUBKEY);

    expect(mockSetCached).toHaveBeenCalledWith('twitter', 'alice', '1234567890', TEST_PUBKEY, { verified: true });
  });

  it('ignores a code that isn\'t text', async () => {
    serviceAnswers({ verified: false, code: 42, error: 'Tweet not found' });

    const result = await verifyIdentityClaim(twitterClaim, TEST_PUBKEY);

    expect(result).toEqual({ verified: false, error: 'Tweet not found' });
  });
});
