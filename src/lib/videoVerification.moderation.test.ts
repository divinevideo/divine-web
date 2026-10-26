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

  it('uses the public JSON service when no proxy override is configured', async () => {
    const result = await fetchVideoModerationStatus(hash);
    expect(fetch).toHaveBeenCalledWith(
      `https://moderation-api.divine.video/check-result/${hash}`,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(result?.ageRestricted).toBe(true);
  });

  it('preserves an explicitly configured proxy origin and path', async () => {
    moderationConfig.baseUrl = 'https://proxy.example';
    await fetchVideoModerationStatus(hash);
    expect(fetch).toHaveBeenCalledWith(
      `https://proxy.example/api/moderation/check-result/${hash}`,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });
});
