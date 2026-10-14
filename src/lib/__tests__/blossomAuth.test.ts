import { describe, it, expect, vi } from 'vitest';
import { createBlossomGetAuthHeader, createBlossomUploadAuthHeader } from '@/lib/blossomAuth';

function decodeToken(header: string) {
  const token = header.slice('Nostr '.length);
  const padded = token.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(token.length / 4) * 4, '=');
  const bytes = Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

function expectBase64Url(header: string) {
  expect(header.slice('Nostr '.length)).not.toMatch(/[+/=]/);
}

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
    const payload = decodeToken(header!);
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

describe('createBlossomUploadAuthHeader', () => {
  const HASH = 'b'.repeat(64);

  it('signs a hash-bound kind 24242 upload event', async () => {
    const signer = makeSigner();
    const header = await createBlossomUploadAuthHeader(signer, HASH);

    expectBase64Url(header);
    const payload = decodeToken(header);
    expect(payload).toMatchObject({ kind: 24242, content: 'Upload blob' });
    expect(payload.tags).toContainEqual(['t', 'upload']);
    expect(payload.tags).toContainEqual(['x', HASH]);
  });

  it('surfaces signing failures to the mirror flow', async () => {
    const signer = makeSigner();
    signer.signEvent.mockRejectedValueOnce(new Error('signing denied'));

    await expect(createBlossomUploadAuthHeader(signer, HASH)).rejects.toThrow('signing denied');
  });
});
