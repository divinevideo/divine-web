// ABOUTME: Tests the pinned official-accounts set + discriminated NIP-05
// ABOUTME: resolver + graded pin ∩ NIP-05 gate for the protected-minor DM
// ABOUTME: restriction (#176 web).

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  isPinnedMinorContactable,
  OfficialAccountsService,
  resolveOfficialNip05,
  type OfficialAccount,
} from './officialAccounts';

const HQ = 'c4a39f1291291d452405cd8ddd798c4a29a3858c52cd0d843f1f6852cf17682e';
const OTHER = '0'.repeat(64);
const HQ_NIP05 = '_@divinehq.divine.video';

function fetchReturning(
  body: unknown,
  { ok = true, status = 200 }: { ok?: boolean; status?: number } = {},
) {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    headers: { get: () => null },
    json: async () => body,
  }) as unknown as typeof fetch;
}

describe('resolveOfficialNip05', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('matched: the name maps to the expected pubkey', async () => {
    const res = await resolveOfficialNip05(HQ_NIP05, HQ, {
      fetchImpl: fetchReturning({ names: { _: HQ } }),
    });
    expect(res).toEqual({ kind: 'matched', resolvedPubkey: HQ });
  });

  it('differentKey: the name maps to a different pubkey', async () => {
    const res = await resolveOfficialNip05(HQ_NIP05, HQ, {
      fetchImpl: fetchReturning({ names: { _: OTHER } }),
    });
    expect(res).toEqual({ kind: 'differentKey', resolvedPubkey: OTHER });
  });

  it('absent: well-formed names map that lacks the name', async () => {
    const res = await resolveOfficialNip05(HQ_NIP05, HQ, {
      fetchImpl: fetchReturning({ names: { someoneelse: OTHER } }),
    });
    expect(res).toEqual({ kind: 'absent' });
  });

  it('absent: 404 from the name server', async () => {
    const res = await resolveOfficialNip05(HQ_NIP05, HQ, {
      fetchImpl: fetchReturning(null, { ok: false, status: 404 }),
    });
    expect(res).toEqual({ kind: 'absent' });
  });

  it('networkError: 5xx from the name server', async () => {
    const res = await resolveOfficialNip05(HQ_NIP05, HQ, {
      fetchImpl: fetchReturning(null, { ok: false, status: 503 }),
    });
    expect(res).toEqual({ kind: 'networkError' });
  });

  it('networkError: fetch throws (timeout/offline)', async () => {
    const res = await resolveOfficialNip05(HQ_NIP05, HQ, {
      fetchImpl: vi.fn().mockRejectedValue(new Error('offline')) as unknown as typeof fetch,
    });
    expect(res).toEqual({ kind: 'networkError' });
  });

  it('networkError: malformed body without a names map', async () => {
    const res = await resolveOfficialNip05(HQ_NIP05, HQ, {
      fetchImpl: fetchReturning({ relays: {} }),
    });
    expect(res).toEqual({ kind: 'networkError' });
  });

  it('networkError: a non-hex value for the name does not revoke (malformed entry)', async () => {
    const res = await resolveOfficialNip05(HQ_NIP05, HQ, {
      fetchImpl: fetchReturning({ names: { _: 'not-a-valid-hex-pubkey' } }),
    });
    // Must NOT be differentKey — garbage should keep last-known, not drop.
    expect(res).toEqual({ kind: 'networkError' });
  });

  it('case+whitespace-normalized compare: padded/uppercase still matches', async () => {
    const res = await resolveOfficialNip05(HQ_NIP05, HQ, {
      fetchImpl: fetchReturning({ names: { _: `  ${HQ.toUpperCase()}\n` } }),
    });
    expect(res.kind).toBe('matched');
  });
});

const MOD = '8fd5eb6d8f362163bc00a5ab6b4a3167dbf32d00ec4efdbcf43b3c9514433b7e';
const STRANGER = 'de'.repeat(32);

function fakeStorage(): Storage {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
    key: (i: number) => [...m.keys()][i] ?? null,
    get length() {
      return m.size;
    },
  } as Storage;
}

describe('isPinnedMinorContactable', () => {
  it('accepts a pinned minor-contactable account, rejects a stranger', () => {
    expect(isPinnedMinorContactable(HQ)).toBe(true);
    expect(isPinnedMinorContactable(MOD)).toBe(true);
    expect(isPinnedMinorContactable(STRANGER)).toBe(false);
  });
  it('normalizes the caller hex (mixed-case + whitespace)', () => {
    expect(isPinnedMinorContactable(`  ${HQ.toUpperCase()}\n`)).toBe(true);
  });
});

describe('OfficialAccountsService', () => {
  let clock: number;
  const build = (opts: {
    resolve?: typeof resolveOfficialNip05 extends never ? never : (nip05: string, hex: string) => Promise<import('./officialAccounts').Nip05Resolution>;
    accounts?: OfficialAccount[];
    storage?: Storage;
  } = {}) =>
    new OfficialAccountsService({
      now: () => clock,
      storage: opts.storage ?? fakeStorage(),
      resolve: opts.resolve,
      accounts: opts.accounts,
    });

  beforeEach(() => {
    clock = 1_000_000_000;
  });

  it('unpinned pubkey is never approved and never resolved', async () => {
    const resolve = vi.fn();
    const svc = build({ resolve: resolve as never });
    expect(svc.isApprovedMinorDmRecipientSync(STRANGER)).toBe(false);
    expect(await svc.isApprovedMinorDmRecipient(STRANGER)).toBe(false);
    expect(resolve).not.toHaveBeenCalled();
  });

  it('pinned but not minorContactable is rejected without resolving', async () => {
    const resolve = vi.fn();
    const svc = build({
      resolve: resolve as never,
      accounts: [{ pubkeyHex: HQ, nip05: HQ_NIP05, role: 'hq', minorContactable: false }],
    });
    expect(await svc.isApprovedMinorDmRecipient(HQ)).toBe(false);
    expect(resolve).not.toHaveBeenCalled();
  });

  it('pinned + matched -> approved', async () => {
    const svc = build({ resolve: async () => ({ kind: 'matched', resolvedPubkey: HQ }) });
    expect(await svc.isApprovedMinorDmRecipient(HQ)).toBe(true);
  });

  it('pinned + differentKey -> dropped immediately and persisted', async () => {
    const svc = build({ resolve: async () => ({ kind: 'differentKey', resolvedPubkey: STRANGER }) });
    expect(await svc.isApprovedMinorDmRecipient(HQ)).toBe(false);
    expect(svc.isApprovedMinorDmRecipientSync(HQ)).toBe(false);
  });

  it('a single absence never drops', async () => {
    const svc = build({ resolve: async () => ({ kind: 'absent' }) });
    expect(await svc.isApprovedMinorDmRecipient(HQ)).toBe(true);
    expect(svc.isApprovedMinorDmRecipientSync(HQ)).toBe(true);
  });

  it('a confirming absence after the recheck window drops', async () => {
    const svc = build({ resolve: async () => ({ kind: 'absent' }) });
    expect(await svc.isApprovedMinorDmRecipient(HQ)).toBe(true);
    clock += 6 * 60 * 1000;
    expect(await svc.isApprovedMinorDmRecipient(HQ)).toBe(false);
  });

  it('networkError keeps a previously revoked verdict', async () => {
    const answers: Array<import('./officialAccounts').Nip05Resolution> = [
      { kind: 'differentKey', resolvedPubkey: STRANGER },
      { kind: 'networkError' },
    ];
    let i = 0;
    const svc = build({ resolve: async () => answers[i++] });
    expect(await svc.isApprovedMinorDmRecipient(HQ)).toBe(false);
    clock += 2 * 60 * 60 * 1000;
    expect(await svc.isApprovedMinorDmRecipient(HQ)).toBe(false);
  });

  it('networkError with no record defaults to pin-trusted', async () => {
    const svc = build({ resolve: async () => ({ kind: 'networkError' }) });
    expect(await svc.isApprovedMinorDmRecipient(HQ)).toBe(true);
  });

  it('a fresh verdict is reused without re-resolving (TTL)', async () => {
    const resolve = vi.fn(async () => ({ kind: 'matched', resolvedPubkey: HQ }) as const);
    const svc = build({ resolve: resolve as never });
    expect(await svc.isApprovedMinorDmRecipient(HQ)).toBe(true);
    clock += 30 * 60 * 1000;
    expect(await svc.isApprovedMinorDmRecipient(HQ)).toBe(true);
    expect(resolve).toHaveBeenCalledTimes(1);
  });

  it('a stale verdict re-resolves (send-time freshness)', async () => {
    const resolve = vi.fn(async () => ({ kind: 'matched', resolvedPubkey: HQ }) as const);
    const svc = build({ resolve: resolve as never });
    expect(await svc.isApprovedMinorDmRecipient(HQ)).toBe(true);
    clock += 2 * 60 * 60 * 1000;
    expect(await svc.isApprovedMinorDmRecipient(HQ)).toBe(true);
    expect(resolve).toHaveBeenCalledTimes(2);
  });

  it('persists across a reload (a new service over the same storage sees revoked)', async () => {
    const storage = fakeStorage();
    const svc = build({ resolve: async () => ({ kind: 'differentKey', resolvedPubkey: STRANGER }), storage });
    await svc.isApprovedMinorDmRecipient(HQ);
    const reloaded = build({ storage });
    expect(reloaded.isApprovedMinorDmRecipientSync(HQ)).toBe(false);
  });

  it('concurrent calls for the same account resolve once', async () => {
    let calls = 0;
    let release!: (r: import('./officialAccounts').Nip05Resolution) => void;
    const pending = new Promise<import('./officialAccounts').Nip05Resolution>((r) => (release = r));
    const svc = build({
      resolve: (() => {
        calls++;
        return pending;
      }) as never,
    });
    const a = svc.isApprovedMinorDmRecipient(HQ);
    const b = svc.isApprovedMinorDmRecipient(HQ);
    release({ kind: 'matched', resolvedPubkey: HQ });
    expect(await a).toBe(true);
    expect(await b).toBe(true);
    expect(calls).toBe(1);
  });
});
