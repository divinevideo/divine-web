import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchVideoModerationStatus } from './videoVerification';

const { moderationConfig } = vi.hoisted(() => ({
  moderationConfig: {
    baseUrl: '', timeout: 10000,
    endpoints: { checkResult: '/api/moderation/check-result/{sha256}' },
  },
}));

vi.mock('@/config/api', () => ({ API_CONFIG: { moderationService: moderationConfig } }));

describe('fetchVideoModerationStatus transport', () => {
  const hash = 'a'.repeat(64);

  beforeEach(() => {
    moderationConfig.baseUrl = '';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      age_restricted: true,
    }), { status: 200 })));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('preserves the default proxy path for existing callers', async () => {
    await fetchVideoModerationStatus(hash);
    expect(fetch).toHaveBeenCalledWith(
      `/api/moderation/check-result/${hash}`,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('uses the public JSON service only when explicitly requested without a proxy override', async () => {
    const result = await fetchVideoModerationStatus(hash, undefined, { publicEndpointFallback: true });
    expect(fetch).toHaveBeenCalledWith(
      `https://moderation-api.divine.video/check-result/${hash}`,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(result?.ageRestricted).toBe(true);
  });

  it('preserves an explicitly configured proxy origin and path', async () => {
    moderationConfig.baseUrl = 'https://proxy.example';
    await fetchVideoModerationStatus(hash, undefined, { publicEndpointFallback: true });
    expect(fetch).toHaveBeenCalledWith(
      `https://proxy.example/api/moderation/check-result/${hash}`,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });
});
