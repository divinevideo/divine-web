import { afterEach, describe, expect, it, vi } from 'vitest';
import { DIVINE_LOGIN_ORIGIN } from './divineLoginOrigin';
import { fetchProtectedMinorStatus, isMinorDmRestricted } from './protectedMinor';

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

    expect(status.state).toBe('protected');
    expect(status.isKnown).toBe(true);
    expect(status.verifiedMinorAt).toEqual(new Date('2026-06-30T12:00:00Z'));
    expect(fetchImpl).toHaveBeenCalledWith(
      ACCOUNT_URL,
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer tok123' }),
      }),
    );
  });

  it('does not call fetch and is not protected for an empty token', async () => {
    const fetchSpy = vi.fn() as unknown as typeof fetch;

    const status = await fetchProtectedMinorStatus('', fetchSpy);

    expect(status.state).toBe('not_protected');
    expect(status.isKnown).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('fails closed on a truthy non-boolean verified_minor (schema drift)', async () => {
    // A stringly "true" (or any truthy non-boolean) is not a trustworthy
    // NEGATIVE: mapping it to not_protected would lift protection for an
    // actual minor if keycast's schema ever drifts. Only explicit booleans
    // are authoritative; anything else truthy stays unknown.
    for (const drifted of ['true', 1, {}] as const) {
      const status = await fetchProtectedMinorStatus(
        't',
        fetchReturning({ verified_minor: drifted }),
      );
      expect(status.state).toBe('unknown');
    }
  });

  it('is not protected when verified_minor is false', async () => {
    const status = await fetchProtectedMinorStatus(
      't',
      fetchReturning({ verified_minor: false }),
    );

    expect(status.state).toBe('not_protected');
    expect(status.verifiedMinorAt).toBeNull();
  });

  it('is not protected when the flag is absent', async () => {
    const status = await fetchProtectedMinorStatus(
      't',
      fetchReturning({ email: 'a@b.com' }),
    );

    expect(status.state).toBe('not_protected');
  });

  it('stays protected with a null timestamp on a bad date', async () => {
    const status = await fetchProtectedMinorStatus(
      't',
      fetchReturning({ verified_minor: true, verified_minor_at: 'not-a-date' }),
    );

    expect(status.state).toBe('protected');
    expect(status.verifiedMinorAt).toBeNull();
  });

  it('is unknown on a non-ok response', async () => {
    const status = await fetchProtectedMinorStatus(
      't',
      fetchReturning({}, false),
    );

    expect(status.state).toBe('unknown');
    expect(status.isKnown).toBe(false);
  });

  it('is unknown (not not_protected) on a malformed non-object 200 body', async () => {
    // A malformed 200 (an error page or truncated body deserialized to a
    // non-object) must NOT read as a positive not_protected: through the sticky
    // store that would overwrite a confirmed `protected`. Only a well-formed
    // object with an explicit verified_minor is authoritative; anything else
    // carries no trustworthy signal.
    for (const body of ['unexpected', 42, ['x'], true] as const) {
      const status = await fetchProtectedMinorStatus('t', fetchReturning(body));
      expect(status.state).toBe('unknown');
    }
  });

  it('is unknown when fetch throws', async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValue(new Error('network')) as unknown as typeof fetch;

    const status = await fetchProtectedMinorStatus('t', fetchImpl);

    expect(status.state).toBe('unknown');
    expect(status.isKnown).toBe(false);
  });
});

describe('isMinorDmRestricted', () => {
  it('restricts a protected account', () => {
    expect(isMinorDmRestricted('protected')).toBe(true);
  });

  it('fails closed: restricts while the status is unknown', () => {
    expect(isMinorDmRestricted('unknown')).toBe(true);
  });

  it('lifts the restriction only on a positive not_protected verdict', () => {
    expect(isMinorDmRestricted('not_protected')).toBe(false);
  });
});
