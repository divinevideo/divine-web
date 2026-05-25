import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/blossomAuth', () => ({
  createBlossomGetAuthHeader: vi.fn(),
}));
vi.mock('@/lib/nip98Auth', () => ({
  createNip98AuthHeader: vi.fn(),
}));

import { createBlossomGetAuthHeader } from '@/lib/blossomAuth';
import { createNip98AuthHeader } from '@/lib/nip98Auth';
import { createMediaViewerAuthHeader } from '@/lib/mediaViewerAuth';

const signer = { signEvent: vi.fn(), getPublicKey: vi.fn() };
const URL = 'https://media.divine.video/abc.mp4';
const HASH = 'a'.repeat(64);

describe('createMediaViewerAuthHeader', () => {
  beforeEach(() => {
    vi.mocked(createBlossomGetAuthHeader).mockReset().mockResolvedValue('Nostr BLOSSOM');
    vi.mocked(createNip98AuthHeader).mockReset().mockResolvedValue('Nostr NIP98');
  });

  it('prefers Blossom when a sha256 is provided', async () => {
    const header = await createMediaViewerAuthHeader({ signer, url: URL, sha256: HASH });
    expect(header).toBe('Nostr BLOSSOM');
    expect(createBlossomGetAuthHeader).toHaveBeenCalledWith(signer, HASH);
    expect(createNip98AuthHeader).not.toHaveBeenCalled();
  });

  it('falls back to NIP-98 when no sha256 is known', async () => {
    const header = await createMediaViewerAuthHeader({ signer, url: URL });
    expect(header).toBe('Nostr NIP98');
    expect(createNip98AuthHeader).toHaveBeenCalledWith(signer, URL, 'GET');
    expect(createBlossomGetAuthHeader).not.toHaveBeenCalled();
  });

  it('returns null when there is no signer', async () => {
    const header = await createMediaViewerAuthHeader({ signer: null, url: URL, sha256: HASH });
    expect(header).toBeNull();
    expect(createBlossomGetAuthHeader).not.toHaveBeenCalled();
    expect(createNip98AuthHeader).not.toHaveBeenCalled();
  });

  it('never invokes both protocols for a single request', async () => {
    await createMediaViewerAuthHeader({ signer, url: URL, sha256: HASH });
    expect(
      vi.mocked(createBlossomGetAuthHeader).mock.calls.length +
        vi.mocked(createNip98AuthHeader).mock.calls.length,
    ).toBe(1);
  });

  it('treats an empty sha256 as "no hash"', async () => {
    const header = await createMediaViewerAuthHeader({ signer, url: URL, sha256: '' });
    expect(header).toBe('Nostr NIP98');
    expect(createBlossomGetAuthHeader).not.toHaveBeenCalled();
  });
});
