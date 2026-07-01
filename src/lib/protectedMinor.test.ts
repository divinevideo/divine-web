import { afterEach, describe, expect, it, vi } from 'vitest';
import { DIVINE_LOGIN_ORIGIN } from './divineLoginOrigin';
import { fetchProtectedMinorStatus } from './protectedMinor';

const ACCOUNT_URL = `${DIVINE_LOGIN_ORIGIN}/api/user/account`;

function fetchReturning(body: unknown, ok = true): typeof fetch {
  return vi.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 500,
    json: async () => body,
  }) as unknown as typeof fetch;
}

describe('fetchProtectedMinorStatus', () => {
  afterEach(() => vi.restoreAllMocks());

  it('is protected with a timestamp when verified_minor is true', async () => {
    const fetchImpl = fetchReturning({
      verified_minor: true,
      verified_minor_at: '2026-06-30T12:00:00Z',
    });

    const status = await fetchProtectedMinorStatus('tok123', fetchImpl);

    expect(status.isProtectedMinor).toBe(true);
    expect(status.verifiedMinorAt).toEqual(new Date('2026-06-30T12:00:00Z'));
    expect(fetchImpl).toHaveBeenCalledWith(
      ACCOUNT_URL,
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer tok123' }),
      }),
    );
  });

  it('is not protected when verified_minor is false', async () => {
    const status = await fetchProtectedMinorStatus(
      't',
      fetchReturning({ verified_minor: false }),
    );

    expect(status.isProtectedMinor).toBe(false);
    expect(status.verifiedMinorAt).toBeNull();
  });

  it('is not protected when the flag is absent', async () => {
    const status = await fetchProtectedMinorStatus(
      't',
      fetchReturning({ email: 'a@b.com' }),
    );

    expect(status.isProtectedMinor).toBe(false);
  });

  it('stays protected with a null timestamp on a bad date', async () => {
    const status = await fetchProtectedMinorStatus(
      't',
      fetchReturning({ verified_minor: true, verified_minor_at: 'not-a-date' }),
    );

    expect(status.isProtectedMinor).toBe(true);
    expect(status.verifiedMinorAt).toBeNull();
  });

  it('fails to not-protected on a non-ok response', async () => {
    const status = await fetchProtectedMinorStatus(
      't',
      fetchReturning({}, false),
    );

    expect(status.isProtectedMinor).toBe(false);
  });

  it('fails to not-protected when fetch throws', async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValue(new Error('network')) as unknown as typeof fetch;

    const status = await fetchProtectedMinorStatus('t', fetchImpl);

    expect(status.isProtectedMinor).toBe(false);
  });
});
