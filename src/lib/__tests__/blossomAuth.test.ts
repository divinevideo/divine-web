import { describe, it, expect, vi } from 'vitest';
import { createBlossomGetAuthHeader } from '@/lib/blossomAuth';

function makeSigner() {
  return {
    getPublicKey: vi.fn().mockResolvedValue('pubkey-hex'),
    signEvent: vi.fn().mockImplementation(async (template) => ({
      ...template,
      id: 'event-id',
      pubkey: 'pubkey-hex',
      sig: 'sig-hex',
    })),
  };
}

describe('createBlossomGetAuthHeader', () => {
  const HASH = 'a'.repeat(64);

  it('signs a kind 24242 GET auth event for the given sha256', async () => {
    const signer = makeSigner();
    const header = await createBlossomGetAuthHeader(signer, HASH);

    expect(header).toMatch(/^Nostr /);
    const payload = JSON.parse(atob(header!.slice('Nostr '.length)));
    expect(payload.kind).toBe(24242);
    expect(payload.content).toBe('Get blob');
    const tagMap = new Map(payload.tags.map((t: string[]) => [t[0], t[1]]));
    expect(tagMap.get('t')).toBe('get');
    expect(tagMap.get('x')).toBe(HASH);
    const exp = Number(tagMap.get('expiration'));
    expect(Number.isFinite(exp)).toBe(true);
    const now = Math.floor(Date.now() / 1000);
    expect(exp).toBeGreaterThanOrEqual(now + 30);
    expect(exp).toBeLessThanOrEqual(now + 120);
  });

  it('returns null when the signer throws', async () => {
    const signer = makeSigner();
    signer.signEvent.mockRejectedValueOnce(new Error('boom'));

    const header = await createBlossomGetAuthHeader(signer, HASH);
    expect(header).toBeNull();
  });
});
